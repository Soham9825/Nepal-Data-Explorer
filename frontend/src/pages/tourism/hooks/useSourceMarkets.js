/**
 * Source markets: who visits Nepal, ranked, for the selected year.
 *
 * The source reports each nationality's share of that year's arrivals, but not
 * every year carries a share, so it is derived from the calendar-year arrival
 * total when it is missing. Its aggregate "Others" row is not a country and is
 * split out of the ranking, then shown as a single line beneath it.
 */
import { useMemo } from 'react';
import { getUniqueYears, resolveYear } from '../format';
import { selectSourceMarketRows } from '../series';

const isOtherMarket = (record) => /^others?$/i.test(String(record.nationality).trim());

export function useSourceMarkets(tourismData, arrivalTrend, selectedSourceYear) {
  const rows = useMemo(() => selectSourceMarketRows(tourismData), [tourismData]);
  const years = getUniqueYears(rows);
  const year = resolveYear(years, selectedSourceYear);

  const yearTotal = arrivalTrend.find((record) => String(record.year) === year)?.total_arrivals;

  const { countryMarkets, otherMarketTotal, topMarket } = useMemo(() => {
    const ranked = rows
      .filter((record) => String(record.year) === year)
      .map((record) => ({
        ...record,
        share: record.percent ?? (yearTotal ? (record.arrivals / yearTotal) * 100 : 0),
      }))
      .sort((first, second) => second.arrivals - first.arrivals);

    const countries = ranked.filter((record) => !isOtherMarket(record));
    return {
      countryMarkets: countries,
      otherMarketTotal: ranked
        .filter(isOtherMarket)
        .reduce((sum, record) => sum + record.arrivals, 0),
      topMarket: countries[0] || null,
    };
  }, [rows, year, yearTotal]);

  return { countryMarkets, otherMarketTotal, topMarket, years, year, yearTotal };
}
