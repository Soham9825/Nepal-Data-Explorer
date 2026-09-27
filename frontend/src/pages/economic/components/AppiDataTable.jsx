import { useMemo, useState } from 'react';
import { Icon } from '../../../components/ui/Icon';
import { APPI_OVERALL_LABEL } from '../constants';
import { formatValue } from '../format';

/**
 * The producer price index as a grid: one row per product, one column per year.
 *
 * The Product and Weight columns are pinned, because ten year columns do not fit a
 * laptop and a reader scrolling sideways loses track of which product the numbers
 * belong to. Pinning needs the Product column to have a fixed width, so the two
 * sticky offsets are the same width as the column itself rather than a guess.
 *
 * A product that contains other products carries a disclosure and starts collapsed,
 * because Wheat, Paddy and Maize are inside Cereals and are not three more slices of
 * the index beside it — printing them flat is what makes the weights look like they
 * sum to 134. They appear when the reader asks for them, and their weight stays blank
 * either way; see `selectAppiTable`.
 */
const PRODUCT_COL = 'w-40';
const WEIGHT_COL = 'w-20';
const STICKY_PRODUCT = 'sticky left-0';
const STICKY_WEIGHT = 'sticky left-40';

function AppiDataTable({ years, rows }) {
  const [expanded, setExpanded] = useState(() => new Set());

  // Parent -> how many parts it holds, so the disclosure can say how many rows it
  // is hiding rather than leaving the reader to find out by expanding it.
  const childCounts = useMemo(() => {
    const counts = new Map();
    rows.forEach((row) => {
      if (row.parent) counts.set(row.parent, (counts.get(row.parent) ?? 0) + 1);
    });
    return counts;
  }, [rows]);

  const visible = rows.filter((row) => !row.parent || expanded.has(row.parent));

  const toggle = (product) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(product)) next.delete(product);
      else next.add(product);
      return next;
    });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-outline-variant">
            <th
              className={`${PRODUCT_COL} ${STICKY_PRODUCT} z-10 bg-surface py-2 pr-4 text-left font-bold uppercase tracking-[0.04em] text-onSurface-variant`}
            >
              Product
            </th>
            <th
              className={`${WEIGHT_COL} ${STICKY_WEIGHT} z-10 bg-surface py-2 pr-4 text-right font-bold uppercase tracking-[0.04em] text-onSurface-variant`}
            >
              Weight
            </th>
            {years.map((year) => (
              <th
                key={year}
                className="py-2 pr-4 text-right font-bold uppercase tracking-[0.04em] text-onSurface-variant"
              >
                {year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const childCount = childCounts.get(row.product) ?? 0;
            const isOpen = expanded.has(row.product);
            return (
              <tr
                key={row.product}
                className={`border-b border-outline-variant last:border-0 ${
                  row.product === APPI_OVERALL_LABEL ? 'font-semibold' : ''
                }`}
              >
                <td
                  className={`${PRODUCT_COL} ${STICKY_PRODUCT} z-10 bg-surface py-2 pr-4 text-onSurface ${
                    row.parent ? 'pl-6 text-onSurface-variant' : ''
                  }`}
                >
                  {childCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggle(row.product)}
                      aria-expanded={isOpen}
                      className="flex items-center gap-1.5 text-left hover:text-accent-nepal"
                    >
                      <Icon
                        name="chevron_right"
                        size={15}
                        aria-hidden="true"
                        style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
                        className="transition-transform duration-150"
                      />
                      {row.product}
                      <span className="font-normal text-onSurface-variant">({childCount})</span>
                    </button>
                  ) : (
                    row.product
                  )}
                </td>
                <td
                  className={`${WEIGHT_COL} ${STICKY_WEIGHT} z-10 bg-surface py-2 pr-4 text-right tabular-nums text-onSurface-variant`}
                >
                  {row.weight === null ? '—' : formatValue(row.weight)}
                </td>
                {years.map((year) => (
                  <td key={year} className="py-2 pr-4 text-right tabular-nums text-onSurface">
                    {formatValue(row.values[year])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-onSurface-variant">
        Index, base year = 100. Weight is a product&rsquo;s share of the index; a product listed
        under another one is part of it and is not counted again.
      </p>
    </div>
  );
}

export default AppiDataTable;
