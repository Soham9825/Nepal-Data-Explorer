import { useMemo, useState } from 'react';

const SORT_TABS = [
  ['price', 'Price'],
  ['rating', 'Rating'],
  ['stars', 'Stars'],
  ['distance', 'Distance'],
  ['availability', 'Availability'],
];

function formatPrice(hotel) {
  if (hotel.lowest_price == null) return null;
  const currency = hotel.currency ? `${hotel.currency} ` : '';
  return `${currency}${Number(hotel.lowest_price).toLocaleString()}`;
}

function availabilityRank(value) {
  const v = String(value || '').toLowerCase();
  if (v.includes('available') && !v.includes('un')) return 0;
  if (v.includes('limited')) return 1;
  if (v.includes('sold') || v.includes('unavailable')) return 3;
  if (v) return 2;
  return 4; // unknown — never fabricated
}

/**
 * Side-by-side hotel comparison panel.
 *
 * Data integrity rules:
 * - Price comes from real `HotelPriceObservation` rows (lowest observed).
 * - Rating / review counts render only when the source provided them; otherwise "—".
 * - Availability is shown exactly as provided by the source; "Not specified" when absent.
 * - No value is invented or inferred.
 */
export default function HotelComparePanel({
  hotels = [],
  destination = '',
  checkIn = '',
  checkOut = '',
  guests = 2,
  onSelect,
}) {
  const [sortBy, setSortBy] = useState('price');

  const sorted = useMemo(() => {
    const list = [...hotels];
    const priceKey = (h) => (h.lowest_price == null ? Infinity : Number(h.lowest_price));
    const ratingKey = (h) => (h.rating == null ? -Infinity : Number(h.rating));
    const starsKey = (h) => (h.stars == null ? -Infinity : Number(h.stars));
    const distKey = (h) => (h.straight_line_km == null ? Infinity : Number(h.straight_line_km));
    const availKey = (h) => availabilityRank(h.price_availability);

    if (sortBy === 'price') list.sort((a, b) => priceKey(a) - priceKey(b));
    else if (sortBy === 'rating') list.sort((a, b) => ratingKey(b) - ratingKey(a));
    else if (sortBy === 'stars') list.sort((a, b) => starsKey(b) - starsKey(a));
    else if (sortBy === 'distance') list.sort((a, b) => distKey(a) - distKey(b));
    else list.sort((a, b) => availKey(a) - availKey(b));
    return list;
  }, [hotels, sortBy]);

  if (!hotels.length) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-low px-4 py-8 text-center text-sm text-onSurface-variant">
        No hotels to compare yet. Run a search first.
      </div>
    );
  }

  const headerBits = [
    destination,
    checkIn && checkOut ? `${checkIn} – ${checkOut}` : '',
    `${guests} Guest${guests === 1 ? '' : 's'}`,
  ].filter(Boolean);

  return (
    <div className="rounded-lg border border-outline-variant bg-surface p-4">
      <h3 className="text-base font-bold text-onSurface">Compare Hotels</h3>
      <p className="mt-0.5 text-sm text-onSurface-variant">{headerBits.join(' • ') || 'Current results'}</p>

      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Sort comparison">
        {SORT_TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={sortBy === key}
            onClick={() => setSortBy(key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
              sortBy === key
                ? 'border-primary bg-primary text-white'
                : 'border-outline-variant text-onSurface-variant hover:border-primary hover:text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sorted.map((hotel) => {
          const key = hotel.id ?? hotel.external_id;
          const price = formatPrice(hotel);
          const rating = hotel.rating != null ? `${hotel.rating}/10` : null;
          const reviews = hotel.review_count != null ? `${hotel.review_count} reviews` : null;
          const stars = hotel.stars != null ? Math.round(Number(hotel.stars)) : 0;
          const availability = hotel.price_availability || 'Not specified';
          const availTone = hotel.price_availability
            ? String(hotel.price_availability).toLowerCase().includes('limited')
              ? 'text-amber-600'
              : 'text-emerald-600'
            : 'text-onSurface-variant';

          return (
            <li
              key={key}
              className="flex flex-col rounded-lg border border-outline-variant bg-surface-low p-3 text-center shadow-sm"
            >
              <p className="truncate text-sm font-bold text-onSurface" title={hotel.name}>
                {hotel.name || 'Unnamed accommodation'}
              </p>

              <p className="mt-1 text-sm text-amber-500" aria-label={`${stars} star rating`}>
                {stars > 0 ? '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars)) : 'No stars'}
              </p>

              <p className="mt-1 text-lg font-bold text-onSurface">
                {rating || <span className="text-sm font-medium text-onSurface-variant">No rating</span>}
              </p>

              <p className={`mt-1 text-base font-bold ${price ? 'text-primary' : 'text-onSurface-variant'}`}>
                {price || 'No price'}
              </p>

              <p className="mt-0.5 text-xs text-onSurface-variant">{reviews || 'No reviews yet'}</p>

              <p className={`mt-1 text-xs font-semibold ${availTone}`}>{availability}</p>

              <button
                type="button"
                onClick={() => onSelect && onSelect(hotel)}
                className="mt-3 rounded-md border border-primary px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-white"
              >
                View Hotel
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[11px] text-onSurface-variant">
        Prices are observed values, never live inventory. Rating, reviews and availability appear only when the
        source provided them.
      </p>
    </div>
  );
}