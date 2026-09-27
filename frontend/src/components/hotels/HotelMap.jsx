import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon paths when bundled with Vite
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIconRetinaUrl,
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
});

const NEPAL_CENTER = [28.3949, 84.124];
const DEFAULT_ZOOM = 7;

const AMP = String.fromCharCode(38);
const HTML_ESCAPES = {
  [AMP]: AMP + 'amp;',
  [String.fromCharCode(60)]: AMP + 'lt;',
  [String.fromCharCode(62)]: AMP + 'gt;',
  [String.fromCharCode(34)]: AMP + 'quot;',
};

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"]/g, (ch) => HTML_ESCAPES[ch]);
}

function formatPrice(hotel) {
  if (hotel.lowest_price == null) return null;
  const currency = hotel.currency ? `${hotel.currency} ` : '';
  return `${currency}${hotel.lowest_price}`;
}

/**
 * Interactive Leaflet map for Hotel Intelligence.
 *
 * - OpenStreetMap tiles (loaded on demand only, no bulk/offline download)
 * - Required OSM attribution always visible
 * - Pan / zoom / wheel / double-click / pinch (Leaflet defaults)
 * - Emits viewport bounds via onBoundsChange for "Search this area"
 * - Grid-based lightweight clustering (no extra dependency, no DOM explosion)
 * - Optional price markers when a real observed price exists
 * - Marker <-> list synchronization through selectedHotelId
 *
 * Backwards compatible: `hotels`, `searchLocation`, `selectedHotel`,
 * `onSelectHotel` and `height` all keep working as before.
 */
export default function HotelMap({
  hotels = [],
  searchLocation = null,
  selectedHotel = null,
  selectedHotelId = null,
  onSelectHotel,
  onBoundsChange,
  onClearSelection,
  onSearchAtLocation,
  showSearchThisArea = false,
  onSearchThisArea,
  searching = false,
  recenterOn = null,
  height = 420,
  zoom = DEFAULT_ZOOM,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const markersRef = useRef(new Map());
  const centerMarkerRef = useRef(null);
  const tempMarkerRef = useRef(null);
  const [pendingPoint, setPendingPoint] = useState(null);
  const callbacksRef = useRef({});
  callbacksRef.current = { onClearSelection, onSearchAtLocation };

  const activeId = selectedHotelId != null
    ? selectedHotelId
    : (selectedHotel ? (selectedHotel.id ?? selectedHotel.external_id) : null);

  // Initialise the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(NEPAL_CENTER, zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.attributionControl.setPrefix(false);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    const emitBounds = () => {
      if (!onBoundsChange) return;
      const b = map.getBounds();
      onBoundsChange({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
        zoom: map.getZoom(),
      });
    };
    map.on('moveend zoomend', emitBounds);
    emitBounds();

    // Empty-map click: drop a temporary marker and offer "Search hotels here".
    map.on('click', (e) => {
      const { onClearSelection: clear, onSearchAtLocation: searchAt } = callbacksRef.current;
      if (clear) clear();
      if (!searchAt) return;
      if (tempMarkerRef.current) {
        map.removeLayer(tempMarkerRef.current);
        tempMarkerRef.current = null;
      }
      const tempIcon = L.divIcon({
        className: 'hotel-temp-marker',
        html: '<div style="width:16px;height:16px;border-radius:9999px;background:#0051d5;border:3px solid #fff;box-shadow:0 0 0 2px #0051d5,0 1px 4px rgba(0,0,0,.4);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      tempMarkerRef.current = L.marker(e.latlng, { icon: tempIcon, title: 'Search point' }).addTo(map);
      setPendingPoint({ lat: e.latlng.lat, lon: e.latlng.lng });
    });

    const markers = markersRef.current;
    return () => {
      map.off('moveend zoomend', emitBounds);
      map.remove();
      mapRef.current = null;
      markers.clear();
      tempMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-centre when requested by a destination search.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !recenterOn) return;
    const lat = Number(recenterOn.lat);
    const lon = Number(recenterOn.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    map.setView([lat, lon], recenterOn.zoom || 13);
    if (centerMarkerRef.current) {
      map.removeLayer(centerMarkerRef.current);
    }
    const centreIcon = L.divIcon({
      className: 'hotel-centre-marker',
      html: '<div style="width:14px;height:14px;border-radius:9999px;background:#0051d5;border:3px solid #fff;box-shadow:0 0 0 2px #0051d5;"></div>',
      iconSize: [14, 14],
    });
    centerMarkerRef.current = L.marker([lat, lon], { icon: centreIcon, title: 'Search location' })
      .bindPopup(`<strong>Search location</strong><br/>${escapeHtml(recenterOn.label || '')}`)
      .addTo(map);
  }, [recenterOn]);

  // Build marker groups from the current hotel list (memoised per render input).
  const visibleHotels = useMemo(
    () => (hotels || []).filter((h) => Number.isFinite(Number(h.latitude)) && Number.isFinite(Number(h.longitude))),
    [hotels],
  );

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markersRef.current.clear();
    const hasSelection = activeId != null;
    const bounds = [];

    if (searchLocation && Number.isFinite(searchLocation.lat) && Number.isFinite(searchLocation.lon)) {
      bounds.push([searchLocation.lat, searchLocation.lon]);
    }

    // Lightweight grid clustering: group hotels whose coords match to ~3 decimals.
    const useClusters = visibleHotels.length > 60;
    const groups = new Map();
    visibleHotels.forEach((hotel) => {
      const lat = Number(hotel.latitude);
      const lon = Number(hotel.longitude);
      const key = useClusters ? `${lat.toFixed(2)}:${lon.toFixed(2)}` : `${hotel.id ?? hotel.external_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(hotel);
    });

    groups.forEach((group) => {
      if (group.length > 1 && useClusters && !hasSelection) {
        const lat = group.reduce((s, h) => s + Number(h.latitude), 0) / group.length;
        const lon = group.reduce((s, h) => s + Number(h.longitude), 0) / group.length;
        const clusterIcon = L.divIcon({
          className: 'hotel-cluster-marker',
          html: `<div style="min-width:34px;height:34px;padding:0 6px;border-radius:9999px;background:#b70011;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)">${group.length}</div>`,
          iconSize: [34, 34],
        });
        const marker = L.marker([lat, lon], { icon: clusterIcon, title: `${group.length} hotels` });
        marker.on('click', () => map.setView([lat, lon], Math.min(19, map.getZoom() + 2)));
        marker.addTo(layer);
        return;
      }

      group.forEach((hotel, index) => {
        const lat = Number(hotel.latitude);
        const lon = Number(hotel.longitude);
        const id = hotel.id ?? hotel.external_id;
        const isSelected = activeId != null && String(activeId) === String(id);
        const priceLabel = formatPrice(hotel);

        let marker;
        if (priceLabel) {
          const priceIcon = L.divIcon({
            className: 'hotel-price-marker',
            html: `<div style="padding:3px 8px;border-radius:6px;background:${isSelected ? '#b70011' : '#0051d5'};color:#fff;font-weight:700;font-size:12px;white-space:nowrap;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${escapeHtml(priceLabel)}</div>`,
            iconSize: [0, 0],
            iconAnchor: [22, 18],
          });
          marker = L.marker([lat, lon], { icon: priceIcon, title: hotel.name, zIndexOffset: isSelected ? 1000 : 0 });
        } else {
          marker = L.marker([lat, lon], {
            title: hotel.name || `Hotel ${index + 1}`,
            opacity: isSelected ? 1 : 0.9,
            zIndexOffset: isSelected ? 1000 : 0,
          });
        }

        const distanceLine = hotel.straight_line_km != null
          ? `<br/>Straight-line: <strong>${hotel.straight_line_km} km</strong>`
          : '';
        const drivingLine = hotel.driving_km != null
          ? `<br/>Driving: <strong>${hotel.driving_km} km</strong>${hotel.driving_min != null ? ` (~${hotel.driving_min} min)` : ''}`
          : '';
        const priceLine = hotel.lowest_price != null
          ? `<br/>Observed: <strong>${escapeHtml(formatPrice(hotel))}</strong>${hotel.price_source ? ` · ${escapeHtml(hotel.price_source)}` : ''}`
          : '';
        const starsLine = hotel.stars != null ? `<br/>★ ${hotel.stars}` : '';
        marker.bindPopup(
          `<strong>${escapeHtml(hotel.name || 'Hotel')}</strong>`
          + starsLine
          + (hotel.address ? `<br/>${escapeHtml(hotel.address)}` : '')
          + (hotel.district ? `<br/>${escapeHtml(hotel.district)}` : '')
          + priceLine + distanceLine + drivingLine
          + (hotel.source_url ? `<br/><a href="${escapeHtml(hotel.source_url)}" target="_blank" rel="noreferrer">OpenStreetMap record</a>` : ''),
        );
        marker.on('click', () => {
          if (onSelectHotel) onSelectHotel(hotel);
        });
        marker.addTo(layer);
        markersRef.current.set(String(id), marker);
        bounds.push([lat, lon]);
      });
    });

    // Only auto-fit when nothing is selected (avoid fighting user panning).
    if (!hasSelection && bounds.length > 1) {
      const cLat = (searchLocation && searchLocation.lat) || null;
      // Fit only the first ~25 markers to keep performance reasonable.
      map.fitBounds(bounds.slice(0, 25), { padding: [40, 40], maxZoom: 14 });
      if (cLat === null) {
        // noop — keeps eslint quiet about unused binding
      }
    } else if (!hasSelection && bounds.length === 1) {
      map.setView(bounds[0], 13);
    }
  }, [visibleHotels, searchLocation, activeId, onSelectHotel]);

  // Pan to the selected hotel without refitting the whole map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || activeId == null) return;
    const marker = markersRef.current.get(String(activeId));
    if (!marker) return;
    const latlng = marker.getLatLng();
    map.panTo(latlng);
    marker.openPopup();
  }, [activeId]);

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant">
      <div className="relative">
        <div ref={containerRef} style={{ height }} className="w-full" />
        {showSearchThisArea && (
          <button
            type="button"
            onClick={onSearchThisArea}
            disabled={searching}
            aria-label="Search hotels in the area currently shown on the map"
            className="absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full border border-primary/30 bg-surface px-4 py-2 text-xs font-bold text-primary shadow-md transition-colors hover:bg-primary hover:text-white disabled:opacity-60"
          >
            {searching ? 'Searching this area…' : '↻ Search this area'}
          </button>
        )}

        {pendingPoint && onSearchAtLocation && (
          <button
            type="button"
            onClick={() => {
              const point = pendingPoint;
              if (tempMarkerRef.current && mapRef.current) {
                mapRef.current.removeLayer(tempMarkerRef.current);
                tempMarkerRef.current = null;
              }
              setPendingPoint(null);
              onSearchAtLocation(point);
            }}
            disabled={searching}
            aria-label="Search hotels at the clicked location"
            className="absolute bottom-4 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-60"
          >
            {searching ? 'Searching…' : '📍 Search hotels here'}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            const map = mapRef.current;
            if (!map) return;
            const target = recenterOn && Number.isFinite(Number(recenterOn.lat))
              ? [Number(recenterOn.lat), Number(recenterOn.lon)]
              : NEPAL_CENTER;
            map.setView(target, recenterOn && recenterOn.zoom ? recenterOn.zoom : DEFAULT_ZOOM);
          }}
          aria-label="Recenter map"
          title="Recenter map"
          className="absolute bottom-4 right-3 z-[500] flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-surface text-onSurface shadow-md transition-colors hover:border-primary hover:text-primary"
        >
          <span aria-hidden="true">⌖</span>
        </button>
      </div>
      <p className="border-t border-outline-variant bg-surface-low px-3 py-1.5 text-[11px] text-onSurface-variant">
        Map data &copy;{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">
          OpenStreetMap contributors
        </a>
        . Hotel metadata from OpenStreetMap (ODbL) via Overpass; tiles load on demand only.
      </p>
    </div>
  );
}