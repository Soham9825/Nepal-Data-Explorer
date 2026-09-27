import DataFooter from '../../../components/common/DataFooter';
import { downloadTourismCsv, downloadTourismReport } from '../../../services/reportApi';
import { TABS } from '../constants';
import { periodEnd, periodStart } from '../format';

/**
 * The page footer: the CSV and PDF exports, and the caption that tells the reader
 * what the export covers.
 *
 * The report records the state the page is in — active tab, period ranges, the
 * year picked on each chart, the province and visitor scope — so a saved report
 * can be traced back to the view that produced it.
 */
export default function TourismFooter({
  csvRows,
  activeTab,
  filters,
  trends,
  markets,
  purpose,
  trekking,
  gender,
  age,
  destinations,
}) {
  const { latestArrival, latestRevenue, arrivalTrend, revenueTrend, avgStayTrend } = trends;
  const { activeProvince, activeScopeRecord } = destinations;
  const indicatorLabels = TABS.map((tab) => tab.label).join(', ');

  const rangeLabel = (label, series, range) =>
    range === 'all'
      ? `${label} ${periodStart(series)}–${periodEnd(series)}`
      : `Last ${range} ${label.toLowerCase()} periods`;

  const downloadReport = () =>
    downloadTourismReport({
      fiscal_year: String(latestArrival?.year || ''),
      selected_indicators: TABS.map((tab) => tab.label),
      active_tab: activeTab,
      arrival_range: filters.arrivalRange,
      revenue_range: filters.revenueRange,
      stay_range: filters.stayRange,
      include_all_source_markets: true,
      purpose_year: purpose.year,
      trekking_year: trekking.year,
      sex_year: gender.year,
      age_year: age.year,
      filters: {
        source_market_year: markets.year,
        province: activeProvince,
        province_scope: destinations.activeScope,
      },
    });

  return (
    <DataFooter
      csvData={csvRows}
      csvFilename="tourism.csv"
      datasetLabel="Tourism"
      reportTitle="Tourism Dashboard Report"
      reportSubtitle="Tourism indicators with the dashboard’s current period and destination selections"
      reportMeta={{
        fiscalYear: latestRevenue?.fiscal_year || String(latestArrival?.year || ''),
        indicators: indicatorLabels,
        periodRange: [
          rangeLabel('Arrivals', arrivalTrend, filters.arrivalRange),
          rangeLabel('Revenue', revenueTrend, filters.revenueRange),
          rangeLabel('Stay', avgStayTrend, filters.stayRange),
          `Source markets ${markets.year}`,
          `Purpose ${purpose.year}`,
          `Trekking ${trekking.year}`,
          `Gender ${gender.year}`,
          `Age ${age.year}`,
          `${activeProvince} · ${activeScopeRecord?.label || 'all destination scopes'}`,
        ].join(' | '),
      }}
      onDownloadReport={downloadReport}
      onDownloadCsv={() => downloadTourismCsv({})}
      preferFullCsv
    />
  );
}
