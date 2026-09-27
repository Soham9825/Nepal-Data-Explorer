import DataFooter from '../../../components/common/DataFooter';
import { downloadEconomicCsv, downloadEconomicReport } from '../../../services/reportApi';
import { DEFAULT_RANGE, REPORT_INDICATORS, TAB_BY_ID } from '../constants';
import { ALL_PROVINCES } from '../hooks/useSectionFilters';

/** "All world-output years", "5 trade years" — one clause per active period picker. */
function describeRange(label, range) {
  return range === DEFAULT_RANGE ? `All ${label} years` : `${range} ${label} years`;
}

function periodRange({ growthRange, tradeRange, balanceRange }, { sectoral, appi }) {
  return [
    describeRange('world-output', growthRange),
    describeRange('trade', tradeRange),
    describeRange('balance', balanceRange),
    sectoral.year ? `Sector year ${sectoral.year}` : '',
    appi.year ? `APPI base year ${appi.year}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
}

export default function EconomicFooter({ csvRows, view, actions, activeTab }) {
  const { sectoral, appi } = view;

  return (
    <DataFooter
      csvData={csvRows}
      csvFilename="economic-dataset.csv"
      datasetLabel="Economic"
      reportTitle="Economic Dashboard Report"
      onDownloadReport={() =>
        downloadEconomicReport({
          selected_indicators: ['growth', 'trade', 'sectors'],
          indicator: 'sectors',
          year: sectoral.year,
          range: actions.growthRange,
          active_tab: activeTab,
          filters: {},
        })
      }
      onDownloadCsv={() => downloadEconomicCsv({})}
      preferFullCsv
      reportMeta={{
        fiscalYear: sectoral.year,
        activeTab: TAB_BY_ID[activeTab]?.label || activeTab,
        selectedProvince:
          actions.selectedProvince === ALL_PROVINCES ? '' : actions.selectedProvince,
        indicators: REPORT_INDICATORS,
        periodRange: periodRange(actions, { sectoral, appi }),
      }}
    />
  );
}
