/**
 * Growth sections: sectoral growth, economy-wide growth, world output and the
 * comparison economies.
 *
 * These four are read off one payload and share the "growth" family in the nav,
 * so they are derived together. Each returns the rows its own chart draws plus
 * the resolved year or period window the header control needs — resolving the
 * selection here rather than in the section is what stops a picker from pointing
 * at a year the current data no longer has.
 */
import { useMemo } from 'react';
import { tailRange } from '../format';
import {
  resolveNewest,
  selectEconomyContexts,
  selectEconomyGrowth,
  selectEconomyWideGrowth,
  selectSectorGroups,
  selectSectorYears,
  selectWorldOutput,
} from '../series';

/**
 * One group's sectors for the chosen fiscal year.
 *
 * The chart draws a single group at a time rather than all eighteen sectors at
 * once. Stacked flat, the three groups ran to the bottom of the card behind an
 * inner scrollbar and a reader comparing, say, Industry against Services had both
 * halves of the comparison on screen at once only by accident of scroll position.
 * The groups are also not near-equals in size — services has twelve sectors,
 * agriculture one — so a single fixed-height chart either wasted most of itself on
 * agriculture or clipped services.
 *
 * `groups` is kept alongside the selection so the section can offer the choice, and
 * the selection falls back to the first group, which the parser ordered by subtotal.
 * A group that is not in the current year — the reader picked Industry, then chose
 * an earlier year that has no such row — resolves the same way instead of leaving
 * the chart blank.
 */
export function useSectoralGrowth(data, sectorYear, sectorGroup) {
  return useMemo(() => {
    const years = selectSectorYears(data);
    const year = resolveNewest(years, sectorYear);
    const { groups, economyExcludingAgriculture } = selectSectorGroups(data, year);
    const selectedGroup = groups.find((group) => group.key === sectorGroup) || groups[0] || null;
    return {
      years,
      year,
      groups,
      selectedGroup,
      economyExcludingAgriculture,
    };
  }, [data, sectorYear, sectorGroup]);
}

/** World output real growth, cut to the selected period window. */
export function useWorldOutput(data, growthRange) {
  return useMemo(() => {
    const rows = selectWorldOutput(data);
    return { rows, visibleRows: tailRange(rows, growthRange), latest: rows.at(-1) };
  }, [data, growthRange]);
}

/** Economy-wide growth plus the per-economy comparison, which share one section pair. */
export function useEconomyGrowth(data) {
  return useMemo(() => {
    const contexts = selectEconomyContexts(data?.economies_growth);
    return {
      economyWideRows: selectEconomyWideGrowth(data),
      economyRows: selectEconomyGrowth(data),
      contexts,
    };
  }, [data]);
}
