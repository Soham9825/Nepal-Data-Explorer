/**
 * Shared shape for the year-ranked breakdowns: purpose of visit and trekking
 * areas are the same chart with different labels, so they share one derivation.
 *
 * Rows are filtered to the selected year, ranked by value, and turned into items
 * carrying a share of that year's total. It also reports whether the list is
 * longer than the panel can show, so the caller can cap the height and let the
 * list scroll rather than pushing the layout around.
 */
import { useMemo } from 'react';
import { getUniqueYears, resolveYear } from '../format';

/**
 * @param rows      All readings for the dataset, each with a `year`.
 * @param selectedYear  The year the picker holds, which may not exist in `rows`.
 * @param labelKey     Field holding the category name.
 * @param valueKey     Field holding the count.
 * @param visibleRows  Rows the panel shows before scrolling.
 * @param leaderCount  How many top rows the summary card lists separately.
 */
export function useRankedYearBreakdown(
  rows,
  selectedYear,
  { labelKey, valueKey, visibleRows, leaderCount = 0 }
) {
  const years = getUniqueYears(rows);
  const year = resolveYear(years, selectedYear);

  const { items, total } = useMemo(() => {
    const visible = rows
      .filter((record) => String(record.year) === year && record[valueKey] > 0)
      .sort((first, second) => second[valueKey] - first[valueKey]);
    const sum = visible.reduce((running, record) => running + record[valueKey], 0);
    return {
      total: sum,
      items: visible.map((record) => ({
        label: record[labelKey],
        value: record[valueKey],
        share: sum ? (record[valueKey] / sum) * 100 : 0,
      })),
    };
  }, [rows, year, labelKey, valueKey]);

  return {
    years,
    year,
    items,
    total,
    scrolls: items.length > visibleRows,
    leaders: items.slice(0, leaderCount),
  };
}
