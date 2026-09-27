/**
 * Readers for the raw tourism payload.
 *
 * The analytics endpoint returns every series as loose rows: values as strings or
 * blanks, years in several shapes, and one metric split across a `statistic_type`
 * column. Each function here turns one of those lists into rows the rest of the
 * page can trust — numbers as numbers, unusable rows dropped, order fixed.
 *
 * They are plain functions on purpose: no React, no memoisation, so the parsing
 * rules for a dataset can be read and changed in one place.
 */
import { EMPTY_ARRAY } from './constants';
import { fiscalYearSort, toNumber } from './format';

/** Total arrivals per calendar year, oldest first. */
export function selectArrivalTrend(tourismData) {
  return (tourismData?.arrival_trend || EMPTY_ARRAY)
    .map((record) => ({ ...record, total_arrivals: toNumber(record.total_arrivals) }))
    .filter((record) => record.total_arrivals !== null)
    .sort((first, second) => Number(first.year) - Number(second.year));
}

/** Tourism revenue per fiscal year, oldest first. */
export function selectRevenueTrend(tourismData) {
  return (tourismData?.revenue || EMPTY_ARRAY)
    .map((record) => ({ ...record, value: toNumber(record.value) }))
    .filter((record) => record.value !== null)
    .sort(fiscalYearSort);
}

/** Average length of stay per calendar year, oldest first. */
export function selectAvgStayTrend(tourismData) {
  return (tourismData?.avg_stay_trend || EMPTY_ARRAY)
    .map((record) => ({ ...record, value: toNumber(record.value) }))
    .filter((record) => record.value !== null)
    .sort((first, second) => Number(first.year) - Number(second.year));
}

/** Arrivals per nationality per year, with the source-reported share kept. */
export function selectSourceMarketRows(tourismData) {
  return (tourismData?.nationality_trend || EMPTY_ARRAY)
    .map((record) => ({
      ...record,
      arrivals: toNumber(record.arrivals),
      percent: toNumber(record.percent),
    }))
    .filter((record) => record.arrivals !== null);
}

/** Arrivals per purpose of visit per year. */
export function selectPurposeTrend(tourismData) {
  return (tourismData?.purpose_trend || EMPTY_ARRAY)
    .map((record) => ({ ...record, value: toNumber(record.value) }))
    .filter((record) => record.value !== null);
}

/** Trekkers per trekking area per year. */
export function selectTrekkingTrend(tourismData) {
  return (tourismData?.trekking_trend || EMPTY_ARRAY)
    .map((record) => ({ ...record, trekkers: toNumber(record.trekkers) }))
    .filter((record) => record.trekkers !== null);
}

/** Arrivals per age band per year, with the source-reported total kept. */
export function selectAgeTrend(tourismData) {
  return (tourismData?.age_trend || EMPTY_ARRAY)
    .map((record) => ({
      ...record,
      value: toNumber(record.value),
      total: toNumber(record.total),
    }))
    .filter((record) => record.value !== null);
}

/**
 * Arrivals by gender per year, pivoted into one row per year.
 *
 * The source reports gender as two independent series and mixes counts with
 * percentages in a `statistic_type` column, so the rows have to be folded
 * together: a year ends up holding `male`/`female` counts plus the reported
 * `malePercent`/`femalePercent` shares, used only when a count is missing.
 * Anything that is not a male or female reading is ignored.
 */
export function selectSexSeries(tourismData) {
  const recordsByYear = {};
  (tourismData?.sex_trend || EMPTY_ARRAY).forEach((record) => {
    const year = Number(record.year);
    const value = toNumber(record.value);
    if (!Number.isFinite(year) || value === null) return;
    const gender = String(record.gender || '').toLowerCase();
    if (!['male', 'female'].includes(gender)) return;
    const yearRecord = recordsByYear[year] || {
      year,
      male: null,
      female: null,
      malePercent: null,
      femalePercent: null,
    };
    const statisticType = String(record.statistic_type || '').toLowerCase();
    if (statisticType === 'percent' || statisticType === 'percentage') {
      yearRecord[`${gender}Percent`] = value;
    } else if (statisticType === 'number' || !statisticType) {
      yearRecord[gender] = value;
    }
    recordsByYear[year] = yearRecord;
  });
  return Object.values(recordsByYear).sort((first, second) => first.year - second.year);
}

/** The province-level block: latest records, per-destination series and years. */
export function selectProvinceTourism(tourismData) {
  return tourismData?.province_tourism || {};
}
