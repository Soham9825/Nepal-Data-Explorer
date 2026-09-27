/**
 * Purpose of visit and trekking areas.
 *
 * Two thin wrappers over `useRankedYearBreakdown`, kept as named hooks so the
 * page reads as a list of datasets rather than a list of configuration objects.
 */
import { useMemo } from 'react';
import { PURPOSE_VISIBLE_ROWS, TREKKING_LEADERS, TREKKING_VISIBLE_ROWS } from '../constants';
import { selectPurposeTrend, selectTrekkingTrend } from '../series';
import { useRankedYearBreakdown } from './useRankedYearBreakdown';

export function usePurposeBreakdown(tourismData, purposeYear) {
  const rows = useMemo(() => selectPurposeTrend(tourismData), [tourismData]);
  return useRankedYearBreakdown(rows, purposeYear, {
    labelKey: 'category',
    valueKey: 'value',
    visibleRows: PURPOSE_VISIBLE_ROWS,
  });
}

export function useTrekkingBreakdown(tourismData, trekkingYear) {
  const rows = useMemo(() => selectTrekkingTrend(tourismData), [tourismData]);
  return useRankedYearBreakdown(rows, trekkingYear, {
    labelKey: 'region',
    valueKey: 'trekkers',
    visibleRows: TREKKING_VISIBLE_ROWS,
    leaderCount: TREKKING_LEADERS,
  });
}
