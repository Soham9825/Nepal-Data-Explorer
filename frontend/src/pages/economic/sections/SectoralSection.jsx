import {
  SECTORAL_GROUP_COLORS,
  SECTORAL_SECTION_HEIGHT,
  SECTORAL_SUMMARY_HEIGHT,
} from '../constants';
import SectoralGrowthChart from './SectoralGrowthChart';
import YearSelect from '../components/YearSelect';
import { formatSigned } from '../format';

/** Group membership, coloured from this section's own palette. */
function groupColor(label) {
  return SECTORAL_GROUP_COLORS[label] || '#667085';
}

/**
 * One figure per group for the selected year, above the chart.
 *
 * The chart below already draws every group, so this is not the only place the figures
 * are. What it holds is the fourth one — non-agriculture, the weighted combination of
 * industry and services — which the chart cannot show at all, because drawing it as a
 * group of its own would double-count it against the two it contains. The other three
 * are here to be read as figures rather than as bar lengths, and each is printed in
 * its group colour, which is what the coloured rule beside a sector row keys to.
 *
 * These used to be four bordered tiles, and each group also printed its own total
 * inside its own panel below. One of the two was always redundant, so the boxes went
 * and the numbers stayed, which is the same information in a third of the height.
 *
 * A group's figure is its subtotal, except for agriculture: its subtotal is the same
 * number as its only sector, and the parser drops the duplicate, so there the single
 * sector carries the figure.
 */
function SectoralSummary({ sectoral }) {
  const tiles = sectoral.groups.map((group) => ({
    key: group.key,
    label: group.label,
    value: group.total ?? (group.children.length === 1 ? group.children[0].value : null),
  }));
  if (sectoral.economyExcludingAgriculture != null) {
    tiles.push({
      key: 'non-agriculture',
      label: 'Non-agriculture',
      value: sectoral.economyExcludingAgriculture,
    });
  }

  return (
    <div
      role="group"
      aria-label={`Every group, ${sectoral.year}`}
      className={`${SECTORAL_SUMMARY_HEIGHT} flex shrink-0 flex-wrap items-center gap-x-6 gap-y-1 border-b border-hairline`}
    >
      {tiles.map((tile) => (
        <div key={tile.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: groupColor(tile.label) }}
          />
          <span className="text-xs font-medium text-onSurface-variant">{tile.label}</span>
          <span
            className={`text-base tabular-nums ${
              tile.value != null && tile.value < 0
                ? 'font-bold text-onSurface'
                : 'font-bold text-onSurface-variant'
            }`}
          >
            {formatSigned(tile.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Sectoral growth: every sector in the economy, for one fiscal year.
 *
 * The source splits the economy as "Agriculture" and "Non agriculture", and splits
 * only the second of those into "Industry" and "Services" — a taxonomy that reads as
 * one sector beside two rather than as three peers. The parser lifts the three to the
 * same level.
 *
 * All of them are drawn at once, as one list ranked by growth rate. This used to show
 * one group at a time, chosen from the header, and then all three together in separate
 * panels; both made the reader work to compare groups, which is the one thing a growth
 * chart exists to make unnecessary. The cost of one list is that eighteen rows need
 * room, so the list runs in two columns and the section is about half its old height.
 */
function SectoralSection({ view }) {
  const { sectoral } = view;

  return (
    <div className={`${SECTORAL_SECTION_HEIGHT} flex min-h-0 flex-col`}>
      <SectoralSummary sectoral={sectoral} />
      <div className="mt-1.5 min-h-0 flex-1">
        <SectoralGrowthChart groups={sectoral.groups} year={sectoral.year} />
      </div>
    </div>
  );
}

export const SECTORAL_SECTION = {
  id: 'sectoral',
  subtitle: (view) => {
    const { sectoral } = view;
    if (!sectoral.groups.length) return 'No sectoral reading for this year';

    const leaves = sectoral.groups.reduce((sum, group) => sum + group.children.length, 0);
    const groups = `${sectoral.groups.length} ${sectoral.groups.length === 1 ? 'group' : 'groups'}`;
    const context =
      sectoral.economyExcludingAgriculture == null
        ? ''
        : ` · non-agriculture ${formatSigned(sectoral.economyExcludingAgriculture)}`;

    return `${leaves} sectors in ${groups} · ${sectoral.year}${context}`;
  },
  action: (view, actions) => {
    const { sectoral } = view;
    if (sectoral.years.length <= 1) return null;
    return (
      <YearSelect
        ariaLabel="Sectoral growth fiscal year"
        value={sectoral.year}
        years={sectoral.years}
        onChange={actions.setSectorYear}
      />
    );
  },
  content: SectoralSection,
};
