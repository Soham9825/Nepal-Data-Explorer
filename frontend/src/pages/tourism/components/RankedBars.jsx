import { getCountryFlag } from '../../../utils/countryFlags';
import { SEMANTIC_COLORS as COLORS } from '../../../theme/colors';
import { formatNumber, formatPercent, toNumber } from '../format';
import EmptyPanel from './EmptyPanel';

/**
 * A ranked list drawn as horizontal bars.
 *
 * Items are `{ label, value, share?, flag?, color?, meta? }`. Bars are scaled
 * against the largest value, and `maxHeight` caps the list so a long ranking
 * scrolls inside its panel instead of stretching the page.
 */
export default function RankedBars({
  items,
  color = COLORS.arrivals,
  valueFormatter = formatNumber,
  showShare = true,
  showFlags = false,
  listTitle,
  unitLabel,
  maxHeight,
  emptyMessage,
}) {
  if (!items.length) return <EmptyPanel message={emptyMessage} />;
  const maxValue = Math.max(...items.map((item) => toNumber(item.value) || 0), 1);
  const gridColumns = showFlags
    ? 'grid-cols-[1.25rem_1.25rem_minmax(0,1fr)_auto_3.5rem]'
    : 'grid-cols-[1.25rem_minmax(0,1fr)_auto_3.5rem]';
  const barColumn = showFlags ? 3 : 2;

  return (
    <div>
      {listTitle && (
        <div className="mb-3.5 flex items-baseline justify-between gap-4 border-b border-outline-variant pb-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {listTitle}
          </p>
          {unitLabel && <p className="text-xs font-medium text-ink-faint">{unitLabel}</p>}
        </div>
      )}
      <div
        className={`space-y-3 ${maxHeight ? `${maxHeight} overflow-y-auto pr-1.5` : ''}`}
        role="list"
        tabIndex={maxHeight ? 0 : undefined}
      >
        {items.map((item, index) => {
          const numericValue = toNumber(item.value) || 0;
          const barWidth = `${Math.max((numericValue / maxValue) * 100, numericValue > 0 ? 1.5 : 0)}%`;
          // One subject, one colour: rank is carried by order, bar length and
          // the printed value, so every bar takes the panel's semantic token
          // unless the item overrides it (an unknown value, say).
          const itemColor = item.color || color;
          const hasShare = showShare && item.share !== null && item.share !== undefined;
          return (
            <div
              key={`${item.label}-${index}`}
              role="listitem"
              className={`grid ${gridColumns} items-center gap-x-3 gap-y-1.5`}
            >
              <span className="justify-self-end text-xs font-medium tabular-nums text-ink-faint">
                {index + 1}
              </span>
              {showFlags && (
                <span aria-hidden="true" className="justify-self-start text-base leading-none">
                  {item.flag || getCountryFlag(item.label)}
                </span>
              )}
              <span className="truncate text-sm font-semibold text-ink" title={item.label}>
                {item.label}
              </span>
              <span className="justify-self-end text-sm font-bold tabular-nums text-ink">
                {valueFormatter(item.value)}
              </span>
              {hasShare && (
                <span className="justify-self-end text-xs tabular-nums text-ink-muted">
                  {formatPercent(item.share)}
                </span>
              )}
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container"
                style={{ gridColumnStart: barColumn }}
                role="img"
                aria-label={`${item.label}: ${valueFormatter(item.value)}${
                  hasShare ? `, ${formatPercent(item.share)} of the total` : ''
                }`}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{ width: barWidth, backgroundColor: itemColor }}
                />
              </div>
              {item.meta && (
                <p
                  className="text-xs leading-5 text-ink-muted"
                  style={{ gridColumnStart: barColumn }}
                >
                  {item.meta}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
