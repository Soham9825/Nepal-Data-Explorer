import { useCallback, useMemo, useRef, useState } from 'react';
import { SectionCard } from '../ui/Card';
import { BtnPrimary, BtnOutline } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { hotelAPI } from '../../services/hotelAPI';
import HotelMap from './HotelMap';
import HotelSearchResults from './HotelSearchResults';
import HotelComparePanel from './HotelComparePanel';

// Quick destinations. Coordinates are used internally only (map recentering);
// they are never exposed as user-facing inputs.
const QUICK_PLACES = [
  { label: 'Sauraha', lat: 27.5667, lon: 84.5 },
  { label: 'Pokhara', lat: 28.2096, lon: 83.9856 },
  { label: 'Kathmandu', lat: 27.7172, lon: 85.324 },
  { label: 'Bharatpur', lat: 27.6833, lon: 84.4333 },
  { label: 'Chitwan', lat: 27.6833, lon: 84.4333 },
];

const SORTS = [
  ['distance', 'Distance'],
  ['price', 'Price (low → high)'],
  ['stars', 'Rating'],
  ['name', 'Name'],
];

const inputClass = 'rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-onSurface outline-none focus:border-primary';

function boundsDiffer(a, b, threshold = 0.02) {
  if (!a || !b) return true;
  return (
    Math.abs(a.north - b.north) > threshold
    || Math.abs(a.south - b.south) > threshold
    || Math.abs(a.east - b.east) > threshold
    || Math.abs(a.west - b.west) > threshold
  );
}

export default function HotelSearchTab() {
  const [destination, setDestination] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);
  const [geoResults, setGeoResults] = useState([]);

  const [mapBounds, setMapBounds] = useState(null);
  const [searchedBounds, setSearchedBounds] = useState(null);
  const [recenterOn, setRecenterOn] = useState(null);

  const [hotels, setHotels] = useState([]);
  const [selectedHotelId, setSelectedHotelId] = useState(null);
  const [quality, setQuality] = useState(null);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [mobileView, setMobileView] = useState('list');

  const [freshness, setFreshness] = useState(null);
  const [refreshStatus, setRefreshStatus] = useState(null);
  const [viewMode, setViewMode] = useState('list');

  const [sort, setSort] = useState('distance');
  const [filters, setFilters] = useState({ min_price: '', max_price: '', min_stars: '', tourism_type: '' });

  const resultsRef = useRef(null);

  const activeFilters = useMemo(() => {
    const out = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) out[k] = v;
    });
    return out;
  }, [filters]);

  const searchAreaStale = useMemo(
    () => hasSearched && boundsDiffer(mapBounds, searchedBounds),
    [hasSearched, mapBounds, searchedBounds],
  );

  const runGeocode = async () => {
    if (!destination.trim()) return;
    setGeoLoading(true);
    setError(null);
    try {
      const res = await hotelAPI.geocode(destination.trim());
      setGeoResults(res.results || []);
      if (res.results && res.results.length > 0) {
        const first = res.results[0];
        setRecenterOn({ lat: first.lat, lon: first.lon, label: first.display_name, zoom: 13, ts: Date.now() });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGeoLoading(false);
    }
  };

  const runSearch = useCallback(async (bounds, { refresh = true } = {}) => {
    if (!bounds) return;
    setLoading(true);
    setError(null);
    try {
      const res = await hotelAPI.searchArea({
        north: bounds.north,
        south: bounds.south,
        east: bounds.east,
        west: bounds.west,
        sort,
        filters: activeFilters,
        refresh,
      });
      setHotels(res.results || []);
      setQuality(res.quality || null);
      setSearchedBounds({ north: bounds.north, south: bounds.south, east: bounds.east, west: bounds.west });
      setHasSearched(true);
      setSelectedHotelId(null);
    } catch (err) {
      setError(err.message || 'Searching this area failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [sort, activeFilters]);

  const handleSearchThisArea = () => {
    if (!mapBounds) return;
    runSearch(mapBounds, { refresh: true });
  };

  // Destination-based search: returns database/cache results immediately and
  // schedules a background collection job when data is stale or missing.
  const runDestinationSearch = async () => {
    const place = destination.trim();
    if (!place) {
      setError('Tell us where you are going first.');
      return;
    }
    setLoading(true);
    setError(null);
    setRefreshStatus(null);
    try {
      const res = await hotelAPI.searchHotels({
        destination: place,
        check_in: checkIn || undefined,
        check_out: checkOut || undefined,
        guests,
      });
      setHotels(res.results || []);
      setFreshness(res.freshness || null);
      setHasSearched(true);
      setSelectedHotelId(null);
      if (res.job_id) {
        pollJobStatus(res.job_id);
      }
      // Recenter the map internally (coordinates never shown to the user).
      try {
        const geo = await hotelAPI.geocode(place);
        const first = geo.results && geo.results[0];
        if (first) {
          setRecenterOn({ lat: first.lat, lon: first.lon, label: first.display_name, zoom: 12, ts: Date.now() });
        }
      } catch {
        // Geocoding is optional; search results still render.
      }
    } catch (err) {
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pollJobStatus = (jobId) => {
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const status = await hotelAPI.getJobStatus(jobId);
        setRefreshStatus(status);
        if (status.status === 'queued' || status.status === 'running') {
          if (attempts < 10) {
            setTimeout(tick, 2000);
            return;
          }
        }
        if (status.status === 'completed') {
          // Refresh the list once background collection finished.
          const refreshed = await hotelAPI.searchHotels({
            destination: destination.trim(),
            check_in: checkIn || undefined,
            check_out: checkOut || undefined,
            guests,
          });
          setHotels(refreshed.results || []);
          setFreshness(refreshed.freshness || 'fresh');
        }
      } catch {
        // Status polling is best-effort; the search results remain valid.
      }
    };
    setTimeout(tick, 1500);
  };

  // Empty-map click: search hotels around the clicked point using internal coordinates.
  const handleSearchAtLocation = async ({ lat, lon }) => {
    const span = 0.04;
    await runSearch(
      {
        north: lat + span,
        south: lat - span,
        east: lon + span,
        west: lon - span,
      },
      { refresh: true },
    );
  };

  const handleSelectHotel = (hotel) => {
    setSelectedHotelId(hotel.id ?? hotel.external_id);
    setMobileView('map');
  };

  const handlePickGeocode = (result) => {
    setRecenterOn({ lat: result.lat, lon: result.lon, label: result.display_name, zoom: 14, ts: Date.now() });
    setGeoResults([]);
  };

  const handleQuickPlace = (place) => {
    setDestination(place.label);
    setRecenterOn({ lat: place.lat, lon: place.lon, label: place.label, zoom: 13, ts: Date.now() });
  };

  // Re-run the area search when sorting or filters change, if we have a viewport.
  const applySortAndFilters = () => {
    if (searchedBounds) runSearch(searchedBounds, { refresh: false });
  };

  const selectedHotel = hotels.find((h) => String(h.id ?? h.external_id) === String(selectedHotelId)) || null;

  return (
    <div className="space-y-4">
      <SectionCard
        title="Where are you going?"
        subtitle="Map-first hotel discovery across Nepal. Search by destination — coordinates stay internal. Prices shown are observed values, never live booking inventory."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-xs font-bold uppercase tracking-wide text-onSurface-variant md:col-span-2">
            Destination
            <div className="mt-2 flex gap-2">
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runDestinationSearch()}
                placeholder="Where to? e.g. Sauraha, Pokhara"
                className={`${inputClass} min-w-0 flex-1 normal-case font-normal`}
              />
              <BtnOutline onClick={runGeocode} disabled={geoLoading}>
                <Icon name="search" size={16} />
                {geoLoading ? 'Finding…' : 'Find'}
              </BtnOutline>
              <BtnPrimary onClick={runDestinationSearch} disabled={loading || geoLoading}>
                {loading ? 'Searching…' : 'Search hotels'}
              </BtnPrimary>
            </div>
          </label>
          <label className="text-xs font-bold uppercase tracking-wide text-onSurface-variant">
            Check-in (search condition)
            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={`${inputClass} mt-2 block w-full normal-case font-normal`} />
          </label>
          <label className="text-xs font-bold uppercase tracking-wide text-onSurface-variant">
            Check-out (search condition)
            <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={`${inputClass} mt-2 block w-full normal-case font-normal`} />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold uppercase tracking-wide text-onSurface-variant">
            Guests
            <input type="number" min="1" max="20" value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} className={`${inputClass} mt-2 block w-24 normal-case font-normal`} />
          </label>
          <div className="text-xs text-onSurface-variant">
            <p className="font-bold uppercase tracking-wide">Quick places</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_PLACES.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => handleQuickPlace(q)}
                  className="rounded-full border border-outline-variant px-3 py-1.5 text-xs font-semibold normal-case hover:border-primary hover:text-primary"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-onSurface-variant">
          Dates and guest counts are treated as search conditions only. No live availability is implied unless a permitted source provides it.
        </p>

        {geoResults.length > 0 && (
          <div className="mt-3 rounded-lg border border-outline-variant bg-surface-low p-3 text-xs">
            <p className="font-bold uppercase tracking-wide text-onSurface-variant">Geocoding candidates</p>
            <ul className="mt-1.5 space-y-1">
              {geoResults.slice(0, 5).map((g, i) => (
                <li key={i}>
                  <button type="button" className="text-left text-primary underline" onClick={() => handlePickGeocode(g)}>
                    {g.display_name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Filters + sorting */}
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-outline-variant pt-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-bold uppercase tracking-wide text-onSurface-variant">
            Min price
            <input type="number" min="0" value={filters.min_price} onChange={(e) => setFilters((f) => ({ ...f, min_price: e.target.value }))} className={`${inputClass} mt-2 block w-full normal-case font-normal`} />
          </label>
          <label className="text-xs font-bold uppercase tracking-wide text-onSurface-variant">
            Max price
            <input type="number" min="0" value={filters.max_price} onChange={(e) => setFilters((f) => ({ ...f, max_price: e.target.value }))} className={`${inputClass} mt-2 block w-full normal-case font-normal`} />
          </label>
          <label className="text-xs font-bold uppercase tracking-wide text-onSurface-variant">
            Min stars
            <input type="number" min="0" max="7" step="0.5" value={filters.min_stars} onChange={(e) => setFilters((f) => ({ ...f, min_stars: e.target.value }))} className={`${inputClass} mt-2 block w-full normal-case font-normal`} />
          </label>
          <label className="text-xs font-bold uppercase tracking-wide text-onSurface-variant">
            Type
            <input value={filters.tourism_type} onChange={(e) => setFilters((f) => ({ ...f, tourism_type: e.target.value }))} placeholder="hotel, hostel…" className={`${inputClass} mt-2 block w-full normal-case font-normal`} />
          </label>
          <label className="text-xs font-bold uppercase tracking-wide text-onSurface-variant">
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputClass} mt-2 block w-full normal-case font-normal`}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <BtnPrimary onClick={applySortAndFilters} disabled={!searchedBounds || loading}>
            <Icon name="filter_alt" size={16} />
            Apply filters & sorting
          </BtnPrimary>
        </div>

        {(freshness || refreshStatus) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {freshness && (
              <span className="rounded-full bg-surface-high px-3 py-1 font-semibold uppercase tracking-wide text-onSurface-variant">
                Data freshness: {freshness}
              </span>
            )}
            {refreshStatus && (
              <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
                Background update: {refreshStatus.status}
                {refreshStatus.result_count ? ` · ${refreshStatus.result_count} results` : ''}
              </span>
            )}
          </div>
        )}

        {error && (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700" role="alert">
            <Icon name="error" size={16} /> {error}
          </p>
        )}
      </SectionCard>

      {/* Mobile view toggle */}
      <div className="flex gap-2 lg:hidden">
        <button type="button" onClick={() => setMobileView('list')} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold ${mobileView === 'list' ? 'border-primary bg-primary text-white' : 'border-outline-variant text-onSurface-variant'}`}>
          Hotel list
        </button>
        <button type="button" onClick={() => setMobileView('map')} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold ${mobileView === 'map' ? 'border-primary bg-primary text-white' : 'border-outline-variant text-onSurface-variant'}`}>
          Map
        </button>
      </div>

      {/* Split layout: results (left) + sticky map (right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className={`lg:col-span-5 ${mobileView === 'list' ? 'block' : 'hidden'} lg:block`}>
          <div className="mb-3 flex items-center justify-between gap-2 text-xs text-onSurface-variant">
            <span>
              {loading ? 'Searching…' : `${hotels.length} hotel${hotels.length === 1 ? '' : 's'} in area`}
              {quality && hasSearched ? ` · retrieved ${quality.retrieved} · dupes ${quality.duplicates}` : ''}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`rounded border px-2 py-1 font-bold ${
                  viewMode === 'list' ? 'border-primary bg-primary text-white' : 'border-outline-variant'
                }`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('compare')}
                className={`rounded border px-2 py-1 font-bold ${
                  viewMode === 'compare' ? 'border-primary bg-primary text-white' : 'border-outline-variant'
                }`}
              >
                Compare
              </button>
            </div>
          </div>
          <div ref={resultsRef} className="max-h-[70vh] overflow-y-auto pr-1">
            {viewMode === 'compare' ? (
              <HotelComparePanel
                hotels={hotels}
                destination={destination}
                checkIn={checkIn}
                checkOut={checkOut}
                guests={guests}
                onSelect={handleSelectHotel}
              />
            ) : (
              <HotelSearchResults
                hotels={hotels}
                selectedHotelId={selectedHotelId}
                onSelect={handleSelectHotel}
                loading={loading}
                error={null}
              />
            )}
          </div>

          {selectedHotel && (
            <div className="mt-4 rounded-lg border border-outline-variant bg-surface-low p-3 text-sm">
              <p className="font-bold text-onSurface">{selectedHotel.name}</p>
              <p className="mt-0.5 text-xs text-onSurface-variant">
                {[selectedHotel.district, selectedHotel.province].filter(Boolean).join(' · ') || selectedHotel.address || 'Address unknown'}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div><dt className="uppercase text-onSurface-variant">Distance</dt><dd className="font-semibold">{selectedHotel.straight_line_km != null ? `${selectedHotel.straight_line_km} km away` : '—'}</dd></div>
                <div><dt className="uppercase text-onSurface-variant">Stars</dt><dd className="font-semibold">{selectedHotel.stars ?? 'Unknown'}</dd></div>
                <div className="col-span-2"><dt className="uppercase text-onSurface-variant">Source</dt><dd className="font-semibold">{selectedHotel.source} · {selectedHotel.external_id}</dd></div>
                {selectedHotel.lowest_price != null && (
                  <div className="col-span-2">
                    <dt className="uppercase text-onSurface-variant">Lowest observed price</dt>
                    <dd className="font-semibold">
                      {selectedHotel.currency} {selectedHotel.lowest_price}
                      {selectedHotel.price_source ? ` · ${selectedHotel.price_source}` : ''}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        <div className={`lg:col-span-7 ${mobileView === 'map' ? 'block' : 'hidden'} lg:block`}>
          <div className="lg:sticky lg:top-4">
            <HotelMap
              hotels={hotels}
              selectedHotelId={selectedHotelId}
              onSelectHotel={handleSelectHotel}
              onBoundsChange={setMapBounds}
              onClearSelection={() => setSelectedHotelId(null)}
              onSearchAtLocation={handleSearchAtLocation}
              showSearchThisArea={searchAreaStale}
              onSearchThisArea={handleSearchThisArea}
              searching={loading}
              recenterOn={recenterOn}
              height={560}
            />
            {!hasSearched && (
              <p className="mt-2 flex items-center gap-2 text-xs text-onSurface-variant">
                <Icon name="info" size={14} />
                Search a destination, click the map to place a point (“Search hotels here”), or pan and use “Search this area”.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}