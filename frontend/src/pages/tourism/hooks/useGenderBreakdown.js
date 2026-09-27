/**
 * Visitor gender for the selected year, plus the composition and sentence the
 * panel closes with.
 *
 * The composition block, the year summary and the closing sentence all read from
 * one `breakdown` list, so the two halves can never disagree. Counts come first
 * and the share is computed from them; a source-reported percentage is only used
 * when a count is missing, and the male share falls back to the complement of the
 * female one.
 */
import { useMemo } from 'react';
import { SEMANTIC_COLORS as COLORS } from '../../../theme/colors';
import { resolveYear, toNumber } from '../format';
import { selectSexSeries } from '../series';

export function useGenderBreakdown(tourismData, sexYear) {
  const series = useMemo(() => selectSexSeries(tourismData), [tourismData]);
  const years = series.map((record) => String(record.year));
  const year = resolveYear(years, sexYear);
  const selectedYear = series.find((record) => String(record.year) === year);

  const female = toNumber(selectedYear?.female);
  const male = toNumber(selectedYear?.male);
  const total = female !== null && male !== null ? female + male : null;

  const femaleShare =
    total && total > 0 ? (female / total) * 100 : toNumber(selectedYear?.femalePercent);
  const maleShare =
    total && total > 0
      ? (male / total) * 100
      : (toNumber(selectedYear?.malePercent) ?? (femaleShare !== null ? 100 - femaleShare : null));

  const breakdown = [
    { key: 'female', label: 'Female', value: female, share: femaleShare, color: COLORS.female },
    { key: 'male', label: 'Male', value: male, share: maleShare, color: COLORS.male },
  ];
  const hasComposition = breakdown.some((row) => row.share !== null);
  const dominant =
    femaleShare === null || maleShare === null
      ? null
      : maleShare > femaleShare
        ? breakdown[1]
        : breakdown[0];

  // The summary leads with the larger half so the dominant share reads first.
  const summaryRows = [...breakdown].sort(
    (first, second) => (second.share ?? -1) - (first.share ?? -1)
  );

  const narrative = !hasComposition
    ? 'No gender composition is reported for the selected year.'
    : dominant.share > 50
      ? `${dominant.label} arrivals were the majority in ${year || 'the selected year'}.`
      : `${dominant.label} arrivals were slightly higher in ${year || 'the selected year'}.`;

  return {
    years,
    year,
    record: selectedYear,
    series,
    total,
    breakdown,
    hasComposition,
    summaryRows,
    narrative,
  };
}
