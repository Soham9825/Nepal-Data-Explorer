import LineChart from '../../../components/charts/LineChart';
import { Icon } from '../../../components/ui/Icon';
import { SEMANTIC_COLORS as COLORS } from '../../../theme/colors';
import { ZERO_DOMAIN } from '../constants';
import { formatNumber, formatPercent, formatVisitValue } from '../format';
import ChartPanel from '../components/ChartPanel';
import EmptyPanel from '../components/EmptyPanel';
import ProvinceSelector from '../components/ProvinceSelector';
import RankedBars from '../components/RankedBars';
import SelectControl from '../components/SelectControl';
import YearSummaryCard from '../components/YearSummaryCard';

/**
 * Destinations tab: the destination records published for one province.
 *
 * The province switcher sits on its own so the tab bar reads as page navigation,
 * mirroring the Province Explorer, instead of being buried inside a chart panel's
 * header.
 */
export default function DestinationsTab({ destinations, onProvinceChange, onScopeChange }) {
  const {
    provinces,
    activeProvince,
    provinceShape,
    scopes,
    activeScope,
    activeScopeRecord,
    latestYear,
    items,
    summary,
    narrative,
    tabCounts,
    chartData,
    chartSeries,
  } = destinations;

  const scopeLabel = activeScopeRecord?.label || 'Selected visitor scope';

  return (
    <div className="space-y-6">
      <ProvinceSelector
        provinces={provinces}
        activeProvince={activeProvince}
        onChange={onProvinceChange}
        destinationCounts={tabCounts}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-hanken text-xl font-bold tracking-tight text-ink">
            {activeProvince ? `${activeProvince} Province` : 'Destinations'}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            {activeProvince
              ? `Destination visits reported for ${activeProvince}${
                  provinceShape?.hq ? ` · capital ${provinceShape.hq}` : ''
                }.`
              : 'Choose a province to compare its destinations.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {provinceShape?.hq && (
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-outline-variant bg-surface px-3 py-1.5 text-sm font-bold text-ink">
              <Icon name="map" size={16} color={COLORS.highlight} />
              {provinceShape.hq}
            </span>
          )}
          {scopes.length > 0 && (
            <SelectControl
              label="Visitor scope"
              value={activeScope}
              onChange={onScopeChange}
              options={scopes.map((scope) => ({ value: scope.key, label: scope.label }))}
            />
          )}
        </div>
      </div>

      <div
        id="tourism-section-destinations"
        className="grid scroll-mt-24 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]"
      >
        <ChartPanel
          title={`${activeProvince || 'Province'} destinations`}
          subtitle={`${scopeLabel} · ${latestYear || 'Latest year'}`}
          note="These are destination-level visits, not unique people. Repeated visits to the same destination can be counted more than once."
        >
          <RankedBars
            items={items}
            color={COLORS.activity}
            listTitle="Destination"
            unitLabel="visits"
            emptyMessage="No destination records match the selected province and visitor scope."
          />
        </ChartPanel>

        {/* Published destination counts are small, so this stays a short readout
            rather than a second ranking. */}
        <YearSummaryCard
          label={scopeLabel}
          heroLabel="Total destination visits"
          heroValue={formatNumber(summary.total)}
          stats={[
            { key: 'destinations', label: 'Destinations reported', value: summary.count },
            {
              key: 'top-share',
              label: 'Top destination share',
              value: formatPercent(summary.topShare),
            },
          ]}
          note={narrative}
        />
      </div>

      <ChartPanel
        id="tourism-section-destination-trend"
        title="Destination trend"
        subtitle={`${scopeLabel} by year`}
        note="Only destinations with a record in the selected year are charted. Years without a published value are left blank rather than treated as zero."
      >
        {chartSeries.length ? (
          <div className="h-[380px] min-h-0 flex-1">
            <LineChart
              data={chartData}
              xKey="year"
              series={chartSeries}
              yDomain={ZERO_DOMAIN}
              valueFormatter={formatVisitValue}
              showLegend={chartSeries.length > 1}
              ariaLabel={`${activeProvince} destination visits by year for ${scopeLabel}`}
              height="100%"
            />
          </div>
        ) : (
          <EmptyPanel message="No destination trend matches the selected province and visitor scope." />
        )}
      </ChartPanel>
    </div>
  );
}
