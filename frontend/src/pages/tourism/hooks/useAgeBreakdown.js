/**
 * Visitor age groups for the selected year.
 *
 * Unlike the other breakdowns the order is not by size: the source publishes
 * bands in life-stage order, and a ranked age chart would read as a ranking of
 * ages rather than of arrivals. A band the source does not list is pushed to the
 * end, and the "not specified" band takes the neutral colour instead of the
 * arrivals colour, since it is an absence of data rather than a finding.
 */
import { useMemo } from 'react';
import { AGE_ORDER, AGE_VISIBLE_ROWS } from '../constants';
import { SEMANTIC_COLORS as COLORS } from '../../../theme/colors';
import { getUniqueYears, resolveYear, toNumber } from '../format';
import { selectAgeTrend } from '../series';

const NOT_SPECIFIED = 'Not_Specified';

function ageBandRank(ageGroup) {
  const index = AGE_ORDER.indexOf(ageGroup);
  return index === -1 ? AGE_ORDER.length : index;
}

export function useAgeBreakdown(tourismData, ageYear) {
  const rows = useMemo(() => selectAgeTrend(tourismData), [tourismData]);
  const years = getUniqueYears(rows);
  const year = resolveYear(years, ageYear);

  const { items, total } = useMemo(() => {
    const visible = rows.filter((record) => String(record.year) === year && record.value >= 0);
    // The source reports the year's total alongside the bands; fall back to the
    // sum of the bands when it is missing, so the shares always divide by
    // something published.
    const sum =
      toNumber(visible.find((record) => record.total !== null)?.total) ??
      visible.reduce((running, record) => running + record.value, 0);
    return {
      total: sum,
      items: [...visible]
        .sort((first, second) => ageBandRank(first.age_group) - ageBandRank(second.age_group))
        .map((record) => ({
          label: record.age_group === NOT_SPECIFIED ? 'Not specified' : record.age_group,
          value: record.value,
          share: sum ? (record.value / sum) * 100 : 0,
          color: record.age_group === NOT_SPECIFIED ? COLORS.notSpecified : COLORS.arrivals,
        })),
    };
  }, [rows, year]);

  return { years, year, items, total, scrolls: items.length > AGE_VISIBLE_ROWS };
}
