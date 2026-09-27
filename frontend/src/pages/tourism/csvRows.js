/**
 * The dashboard's CSV export.
 *
 * `DataFooter` wants one flat table, so every dataset the page shows is appended
 * as its own block of rows under a `Dataset` column. Each block carries the year
 * or period it belongs to, because the datasets do not share a time basis —
 * arrivals are calendar years, revenue is fiscal years, destinations have their
 * own visitor scopes.
 *
 * The rows are assembled from the same derived data the panels read, so the
 * export always matches what is on screen: change a filter and the file follows.
 */
import { formatMarketName, toNumber } from './format';

export function buildTourismCsvRows({
  provinceTourism,
  trends,
  topSource,
  markets,
  purpose,
  trekking,
  gender,
  age,
  destinations,
}) {
  const { latestArrival, latestRevenue, visibleArrivalTrend, visibleRevenueTrend, visibleAvgStay } =
    trends;
  const { activeProvince, activeScope } = destinations;

  if (!Object.keys(provinceTourism).length) return [];

  const rows = [];

  const keyIndicator = (indicator, value, period) =>
    rows.push({ Dataset: 'Key indicators', Indicator: indicator, Value: value, Period: period });

  if (latestArrival) {
    keyIndicator('Total tourist arrivals', latestArrival.total_arrivals, latestArrival.year);
    keyIndicator(
      'Arrival growth (%)',
      toNumber(latestArrival.percent_change) ?? trends.arrivalChange,
      latestArrival.year
    );
  }
  if (latestRevenue) {
    keyIndicator('Tourism revenue (US$ million)', latestRevenue.value, latestRevenue.fiscal_year);
  }
  if (topSource?.nationality) {
    keyIndicator(
      'Top source market',
      formatMarketName(topSource.nationality),
      latestArrival?.year || ''
    );
  }

  visibleArrivalTrend.forEach((record) =>
    rows.push({ Dataset: 'Tourist arrivals', Year: record.year, Arrivals: record.total_arrivals })
  );

  markets.countryMarkets.forEach((record) =>
    rows.push({
      Dataset: 'Source markets',
      Year: record.year,
      Market: formatMarketName(record.nationality),
      Arrivals: record.arrivals,
      'Share (%)': record.share,
    })
  );

  visibleRevenueTrend.forEach((record) =>
    rows.push({
      Dataset: 'Tourism revenue',
      'Fiscal year': record.fiscal_year,
      Value: record.value,
      Unit: 'US$ million',
    })
  );

  visibleAvgStay.forEach((record) =>
    rows.push({ Dataset: 'Average stay', Year: record.year, Value: record.value, Unit: 'days' })
  );

  purpose.items.forEach((record) =>
    rows.push({
      Dataset: 'Purpose of visit',
      Year: purpose.year,
      Purpose: record.label,
      Arrivals: record.value,
      'Share (%)': record.share,
    })
  );

  trekking.items.forEach((record) =>
    rows.push({
      Dataset: 'Trekking',
      Year: trekking.year,
      Region: record.label,
      Trekkers: record.value,
      'Share (%)': record.share,
    })
  );

  if (gender.record) {
    rows.push({
      Dataset: 'Visitor sex',
      Year: gender.record.year,
      Female: gender.record.female,
      Male: gender.record.male,
      'Female share (%)': gender.breakdown[0].share,
      'Male share (%)': gender.breakdown[1].share,
    });
  }

  age.items.forEach((record) =>
    rows.push({
      Dataset: 'Visitor age',
      Year: age.year,
      'Age group': record.label,
      Arrivals: record.value,
      'Share (%)': record.share,
    })
  );

  (provinceTourism.by_destination || [])
    .filter(
      (destination) =>
        destination.province === activeProvince && destination.visitor_scope === activeScope
    )
    .forEach((destination) =>
      destination.observations.forEach((observation) =>
        rows.push({
          Dataset: 'Destinations',
          Province: activeProvince,
          Destination: destination.name,
          'Visitor scope': destination.visitor_scope_label,
          Year: observation.year,
          Visits: observation.visitors,
        })
      )
    );

  return rows;
}
