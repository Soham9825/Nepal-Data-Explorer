/**
 * The three headline time series — arrivals, revenue and length of stay — plus
 * the year-on-year figures the key indicator cards report.
 *
 * Each series keeps its own reporting basis (revenue is by fiscal year, the
 * other two by calendar year), so the ranges, latest values and changes are
 * derived per series rather than over a merged timeline.
 */
import { useMemo } from 'react';
import { formatChange, toNumber } from '../format';
import { selectArrivalTrend, selectAvgStayTrend, selectRevenueTrend } from '../series';

/** Keep the last `range` readings, or all of them for the `all` range. */
function limitToRange(series, range) {
  return range === 'all' ? series : series.slice(-Number(range));
}

export function useTourismTrends(tourismData, { arrivalRange, revenueRange, stayRange }) {
  const arrivalTrend = useMemo(() => selectArrivalTrend(tourismData), [tourismData]);
  const revenueTrend = useMemo(() => selectRevenueTrend(tourismData), [tourismData]);
  const avgStayTrend = useMemo(() => selectAvgStayTrend(tourismData), [tourismData]);

  const visibleArrivalTrend = limitToRange(arrivalTrend, arrivalRange);
  const visibleRevenueTrend = limitToRange(revenueTrend, revenueRange);
  const visibleAvgStay = limitToRange(avgStayTrend, stayRange);

  const latestArrival = arrivalTrend.at(-1);
  const latestRevenue = revenueTrend.at(-1);
  const latestStay = avgStayTrend.at(-1);

  // Arrivals arrive with a year-on-year figure attached; the other two are
  // compared against the previous period here.
  const arrivalChange =
    toNumber(latestArrival?.percent_change) ??
    formatChange(latestArrival?.total_arrivals, arrivalTrend.at(-2)?.total_arrivals);
  const revenueChange = formatChange(latestRevenue?.value, revenueTrend.at(-2)?.value);

  // Stay is a level, not a rate, so its change is an absolute number of days
  // and its five-period view is a percentage like the others.
  const stayChange =
    toNumber(latestStay?.value) !== null && toNumber(avgStayTrend.at(-2)?.value) !== null
      ? latestStay.value - avgStayTrend.at(-2).value
      : null;
  const fiveYearStayChange = formatChange(latestStay?.value, avgStayTrend.at(-6)?.value);

  const peakStay = avgStayTrend.reduce(
    (peak, record) => (!peak || record.value > peak.value ? record : peak),
    null
  );

  return {
    arrivalTrend,
    revenueTrend,
    avgStayTrend,
    visibleArrivalTrend,
    visibleRevenueTrend,
    visibleAvgStay,
    latestArrival,
    latestRevenue,
    latestStay,
    arrivalChange,
    revenueChange,
    stayChange,
    fiveYearStayChange,
    peakStay,
  };
}
