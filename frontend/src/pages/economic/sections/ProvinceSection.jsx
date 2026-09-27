import BarChart from '../../../components/charts/BarChart';
import ErrorMessage from '../../../components/common/ErrorMessage';
import Loader from '../../../components/common/Loader';
import { GROWTH_METRICS, PROVINCE_ORDER } from '../../../services/provinceGDP';
import { PROVINCE_CHART_HEIGHT, PROVINCE_PANEL_MIN_H } from '../constants';
import ToggleControl from '../components/ToggleControl';
import { ALL_PROVINCES } from '../hooks/useSectionFilters';

const PROVINCE_OPTIONS = [ALL_PROVINCES, ...PROVINCE_ORDER];

/** The two price bases, labelled the way the KPI card names them. */
const PRICE_BASIS_OPTIONS = Object.values(GROWTH_METRICS).map(({ key, shortLabel }) => ({
  id: key,
  label: shortLabel,
}));

/** Chip colours follow the source's own status wording: amber provisional, indigo revised. */
const STATUS_CLASS = {
  Provisional: 'bg-[#fef3c7] text-[#92400e]',
  Revised: 'bg-[#e0e7ff] text-[#3730a3]',
};

const statusClass = (status) => STATUS_CLASS[status] || 'bg-[#d1fae5] text-[#065f46]';

/**
 * The provenance chip in the card header.
 *
 * A province's last reading is often provisional or revised, which is the first
 * thing a reader of a GDP figure needs to know — so it sits in the header rather
 * than in the source note at the foot of the panel.
 */
export function GdpStatusChip({ status, fiscalYear }) {
  if (!status) return null;
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-1 text-xs font-bold ${statusClass(status)}`}
    >
      {status} {fiscalYear}
    </span>
  );
}

/**
 * Province-wise GDP growth.
 *
 * "All" is the default and is a real case rather than an empty one: it plots every
 * province as its own series, which is how a reader compares them. A single
 * province collapses the chart to one series. The two price bases are a toggle
 * rather than a pair of charts, since they measure the same thing at different
 * prices and stacking them would double-count.
 *
 * Loading and failure are handled inside the panel instead of at page level: the
 * other nine sections are already on screen and usable, so a province failure
 * should read as one empty section rather than a broken page.
 */
function ProvinceSection({ view, actions }) {
  const { province, provinceRequest } = view;
  const { selectedProvince, growthMetric, setSelectedProvince, setGrowthMetric } = actions;

  return (
    <div className={`${PROVINCE_CHART_HEIGHT} flex flex-col`}>
      <div className="flex flex-col gap-3 border-b border-outline-variant p-1 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="group"
          aria-label="Filter by province"
          className="flex flex-wrap gap-1.5 empty:hidden"
        >
          {PROVINCE_OPTIONS.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={selectedProvince === name}
              onClick={() => setSelectedProvince(name)}
              className={`rounded-sm border px-3 py-1.5 text-sm font-medium font-hanken transition-colors duration-200 ${
                selectedProvince === name
                  ? 'border-primary bg-primary text-white'
                  : 'border-outline-variant text-onSurface-variant hover:border-primary hover:text-onSurface'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <ToggleControl
          ariaLabel="GDP growth price basis"
          className="shrink-0 self-start lg:self-auto"
          value={growthMetric}
          onChange={setGrowthMetric}
          options={PRICE_BASIS_OPTIONS}
        />
      </div>

      {provinceRequest.loading ? (
        <div className={`flex ${PROVINCE_PANEL_MIN_H} flex-1 items-center justify-center`}>
          <Loader size="lg" />
        </div>
      ) : provinceRequest.error ? (
        <div className={`flex ${PROVINCE_PANEL_MIN_H} flex-1 items-center justify-center p-6`}>
          <ErrorMessage
            title="Failed to load province GDP data"
            message={provinceRequest.error}
            onRetry={provinceRequest.retry}
          />
        </div>
      ) : province.rows.length === 0 ? (
        <div
          className={`flex ${PROVINCE_PANEL_MIN_H} flex-1 items-center justify-center p-6 text-sm text-onSurface-variant`}
        >
          No province-wise GDP data is available for{' '}
          {selectedProvince === ALL_PROVINCES ? 'the selected filters' : selectedProvince}.
        </div>
      ) : (
        <div className="min-h-0 flex-1 p-5">
          <BarChart
            data={province.rows}
            xKey="fiscal_year"
            series={province.series}
            height="100%"
            bordered={false}
            showLegend={province.showLegend}
          />
        </div>
      )}

      <div className="border-t border-outline-variant px-5 py-3 text-xs text-onSurface-variant">
        Source: CBS province-wise GDP series. Growth values show annual change for each fiscal year;
        R = revised, P = provisional figures.
      </div>
    </div>
  );
}

export const PROVINCE_SECTION = {
  id: 'province',
  subtitle: (view) =>
    view.province.isAll
      ? 'Annual real growth (%) per province by fiscal year — CBS series'
      : `${view.province.selectedProvince} annual real growth (%) by fiscal year — CBS series`,
  action: (view) => (
    <GdpStatusChip status={view.province.dataStatus} fiscalYear={view.province.latestYear} />
  ),
  content: ProvinceSection,
};
