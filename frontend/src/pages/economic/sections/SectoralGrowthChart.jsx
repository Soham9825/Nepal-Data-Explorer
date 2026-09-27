import { useMemo } from 'react';
import { SECTORAL_GROUP_COLORS } from '../constants';
import { formatSigned } from '../format';

const GROUP_ORDER = ['Services', 'Industry', 'Agriculture'];

/** Group membership, coloured from this section's own palette. */
function groupColor(label) {
  return SECTORAL_GROUP_COLORS[label] || '#667085';
}

function niceMaximum(value) {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
}

/** One sector's bar, on the scale shared by every row. */
function SectorRow({ sector, zero, negativeEnd, range }) {
  const end = ((sector.value - negativeEnd) / range) * 100;
  const left = Math.min(zero, end);
  const width = Math.max(Math.abs(end - zero), 0.35);

  return (
    <div className="grid grid-cols-[minmax(0,32%)_1fr_58px] items-center gap-3 border-b border-nepal-crimson/25 py-1.5 pl-2">
      <span className="break-words text-sm leading-5 text-onSurface">{sector.label}</span>
      <div className="relative h-3.5 rounded-sm bg-canvas/70">
        <span
          className="absolute top-1/2 h-3.5 w-[1.5px] -translate-x-1/2 -translate-y-1/2 bg-hairline-axis"
          style={{ left: `${zero}%` }}
        />
        <span
          className="absolute top-0.5 h-2.5 rounded-sm"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            backgroundColor: groupColor(sector.group),
          }}
        />
      </div>
      <span
        className={`text-right text-sm tabular-nums ${
          sector.value < 0 ? 'font-bold text-onSurface' : 'font-semibold text-onSurface-variant'
        }`}
      >
        {formatSigned(sector.value)}
      </span>
    </div>
  );
}

/**
 * Every sector in the economy as one list of bars, strongest first.
 *
 * This used to be three bordered panels — Services across the full width, Industry and
 * Agriculture side by side — each with its own header, its own sector count and its own
 * total. A panel was spending most of its height on chrome to express one of three
 * memberships, and its total repeated the summary strip directly above it.
 *
 * One flat list sorted by growth rate answers the question a growth chart exists for,
 * which is which sectors moved most, and it does it in roughly half the height.
 *
 * A bar is coloured by the group it belongs to, from this section's own palette, and
 * whether a sector grew or shrank is left to which side of the zero line it sits on.
 * Colouring by sign instead — the obvious reading of a growth chart — turns almost the
 * whole list a single colour, because sixteen of eighteen sectors are positive in an
 * ordinary year and they all land on the same green. Which group a sector belongs to is
 * the one thing a reader cannot work out otherwise, so that is what the colour says.
 *
 * The list is split into two halves that read down the left column and then the right,
 * so the sort still runs in one direction. A CSS grid filling row-wise would put the
 * strongest and the weakest sectors side by side in the top row.
 */
export default function SectoralGrowthChart({ groups, year }) {
  const sectors = useMemo(
    () =>
      groups
        .slice()
        .sort((a, b) => GROUP_ORDER.indexOf(a.label) - GROUP_ORDER.indexOf(b.label))
        .flatMap((group) => group.children.map((child) => ({ ...child, group: group.label })))
        .sort((first, second) => second.value - first.value),
    [groups]
  );

  const minimum = Math.min(0, ...sectors.map((sector) => sector.value));
  const maximum = Math.max(0, ...sectors.map((sector) => sector.value));
  const positiveEnd = niceMaximum(maximum);
  const negativeEnd = minimum < 0 ? -niceMaximum(Math.abs(minimum)) : 0;
  const range = positiveEnd - negativeEnd || 1;
  const zero = ((0 - negativeEnd) / range) * 100;

  const half = Math.ceil(sectors.length / 2);
  const columns = [sectors.slice(0, half), sectors.slice(half)];

  return (
    <div
      className="flex h-full min-h-0 flex-col font-hanken"
      role="group"
      aria-label={`Sectoral growth ${year}, ${sectors.length} sectors, strongest first`}
    >
      <div className="mb-1 grid shrink-0 grid-cols-[minmax(0,32%)_1fr_58px] items-center gap-3 border-b border-nepal-crimson/30 py-1 pl-2 text-xs font-semibold uppercase tracking-wide text-onSurface-variant">
        <span>Sector &middot; {year}</span>
        <div className="relative h-4">
          {negativeEnd < 0 && (
            <>
              <span
                className="absolute top-1/2 h-4 w-[1.5px] -translate-x-1/2 -translate-y-1/2 bg-hairline-axis"
                style={{ left: `${zero}%` }}
              />
              <span className="absolute bottom-0 left-0 leading-none">{negativeEnd}%</span>
            </>
          )}
          <span
            className="absolute -translate-x-1/2 leading-none"
            style={{ left: `${zero}%`, bottom: 0 }}
          >
            0%
          </span>
          <span className="absolute bottom-0 right-0 leading-none">{positiveEnd}%</span>
        </div>
        <span className="text-right">Rate</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-x-4 overflow-y-auto pr-1 scrollbar-thin lg:flex-row lg:items-start">
        {columns.map((column, index) => (
          <div
            key={index}
            className={`min-w-0 flex-1 ${index === 0 ? 'lg:border-r lg:border-nepal-crimson/40 lg:pr-4' : 'lg:pl-4'}`}
          >
            {column.map((sector) => (
              <SectorRow
                key={sector.key}
                sector={sector}
                zero={zero}
                negativeEnd={negativeEnd}
                range={range}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
