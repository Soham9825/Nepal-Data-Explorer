import { useEffect, useRef } from 'react';
import { Icon } from '../ui/Icon';

function formatPrice(hotel) {
  if (hotel.lowest_price == null) return null;
  const currency = hotel.currency ? `${hotel.currency} ` : '';
  return `${currency}${hotel.lowest_price}`;
}

/**
 * Left-panel hotel result cards.
 *
 * Synchronised with the map through `selectedHotelId`.
 * - Clicking a card calls onSelect(hotel) (map focuses the marker).
 * - When the selected card changes (from a map click), the card is scrolled
 *   into view. Hotel ID is the synchronization key; names are not used.
 */
export default function HotelSearchResults({
  hotels = [],
  selectedHotelId = null,
  onSelect,
  loading = false,
  error = null,
  skeletonCount = 4,
}) {
  const cardRefs = useRef(new Map());

  useEffect(() => {
    if (selectedHotelId == null) return;
    const node = cardRefs.current.get(String(selectedHotelId));
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedHotelId]);

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <p className="flex items-center gap-2 text-sm text-onSurface-variant">
          <Icon name="sync" size={16} className="animate-spin" />
          Finding hotels…
        </p>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border border-outline-variant bg-surface p-4">
            <div className="h-4 w-2/3 rounded bg-surface-high" />
            <div className="mt-2 h-3 w-1/3 rounded bg-surface-high" />
            <div className="mt-3 h-3 w-1/2 rounded bg-surface-high" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700" role="alert">
        <Icon name="error" size={16} /> {error}
      </p>
    );
  }

  if (!hotels.length) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-low px-4 py-8 text-center text-sm text-onSurface-variant">
        <Icon name="hotel" size={28} />
        <p className="mt-2 max-w-sm font-semibold text-onSurface">No hotels found in this area.</p>
        <p className="mt-1 max-w-sm">Try moving the map or zooming out, then use “Search this area”.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {hotels.map((hotel) => {
        const key = hotel.id ?? hotel.external_id;
        const isActive = selectedHotelId != null && String(selectedHotelId) === String(key);
        const price = formatPrice(hotel);
        return (
          <li key={key}>
            <button
              type="button"
              ref={(node) => {
                if (node) cardRefs.current.set(String(key), node);
                else cardRefs.current.delete(String(key));
              }}
              onClick={() => onSelect && onSelect(hotel)}
              aria-pressed={isActive}
              className={`w-full rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive ? 'border-primary bg-primary/5' : 'border-outline-variant bg-surface hover:border-primary/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-onSurface">{hotel.name || 'Unnamed accommodation'}</p>
                  <p className="mt-0.5 truncate text-xs text-onSurface-variant">
                    {[hotel.district, hotel.province].filter(Boolean).join(' · ') || hotel.address || 'Address unknown'}
                  </p>
                </div>
                {price ? (
                  <div className="text-right">
                    <span className="inline-block shrink-0 rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                      {price}
                    </span>
                    <span className="block text-[10px] text-onSurface-variant">observed total</span>
                  </div>
                ) : (
                  <span className="shrink-0 rounded-md bg-surface-high px-2 py-0.5 text-[10px] font-bold uppercase text-onSurface-variant">
                    No price
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-onSurface-variant">
                {hotel.stars != null && (
                  <span aria-label={`${hotel.stars} star rating`}>
                    <span className="text-amber-500">★</span> <strong className="text-onSurface">{hotel.stars}</strong>
                  </span>
                )}
                {hotel.straight_line_km != null && (
                  <span>
                    <strong className="text-onSurface">{hotel.straight_line_km} km</strong> away
                  </span>
                )}
                {hotel.tourism_type && (
                  <span className="rounded bg-surface-high px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-onSurface">
                    {hotel.tourism_type.replace(/_/g, ' ')}
                  </span>
                )}
              </div>

              {price && (
                <div className="mt-2 rounded bg-surface-low px-2 py-1 text-[11px] text-onSurface-variant">
                  <span className="font-semibold text-onSurface">Observed Rate:</span> {hotel.currency || ''}
                  {hotel.price_room_type ? ` · ${hotel.price_room_type}` : ''}
                  {hotel.price_occupancy ? ` · ${hotel.price_occupancy} guests` : ''}
                  {hotel.price_source ? ` · via ${hotel.price_source}` : ''}
                </div>
              )}

              <div className="mt-2 flex items-center justify-between text-[11px] text-onSurface-variant">
                <span className="font-medium">
                  Source: <strong className="text-onSurface">{hotel.source || 'OpenStreetMap'}</strong>
                </span>
                {hotel.source_url && (
                  <a
                    href={hotel.source_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="truncate text-primary hover:underline"
                  >
                    View Source &rarr;
                  </a>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}