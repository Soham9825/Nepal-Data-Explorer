import LineChart from '../../../components/charts/LineChart';
import { SEMANTIC_COLORS as COLORS } from '../../../theme/colors';
import { RANGE_OPTIONS, ZERO_DOMAIN } from '../constants';
import {
  formatNumber,
  formatRevenueValue,
  formatSigned,
  formatStayValue,
  formatTourismValue,
  periodEnd,
  periodStart,
} from '../format';
import ChartPanel from '../components/ChartPanel';
import KeyIndicators from '../components/KeyIndicators';
import MiniStat from '../components/MiniStat';
import SectionHeading from '../components/SectionHeading';
import PeriodControl from '../../../components/ui/PeriodControl';
import YearOnYearNote from '../components/YearOnYearNote';

/**
 * Overview tab: the headline indicators, the length-of-stay behaviour chart with
 * its snapshot, and the arrivals/revenue trends.
 */
export default function OverviewTab({
  trends,
  topSource,
  topMarket,
  arrivalRange,
  stayRange,
  setTrendRange,
  setStayRange,
  saveButtonFor,
}) {
  const {
    visibleArrivalTrend,
    visibleRevenueTrend,
    visibleAvgStay,
    latestStay,
    fiveYearStayChange,
    peakStay,
  } = trends;

  return (
    <div className="space-y-8">
      <KeyIndicators trends={trends} topSource={topSource} topMarket={topMarket} />

      <section
        id="tourism-section-stay"
        className="scroll-mt-24 space-y-4"
        aria-label="Visitor behavior"
      >
        <SectionHeading
          title="Visitor behavior"
          description="How long visitors stay in Nepal, reported by calendar year."
          action={
            <PeriodControl
              value={stayRange}
              onChange={setStayRange}
              options={RANGE_OPTIONS}
              label="Period"
              ariaLabel="Stay period range"
            />
          }
        />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <ChartPanel
            title="Average length of stay"
            subtitle={`Calendar year · ${periodStart(visibleAvgStay)} to ${periodEnd(
              visibleAvgStay
            )} · average days per arrival`}
            action={saveButtonFor('stay')}
          >
            <div className="h-[200px] min-h-0 flex-1">
              <LineChart
                data={visibleAvgStay.map((record) => ({
                  year: record.year,
                  stay: record.value,
                }))}
                xKey="year"
                series={[{ key: 'stay', color: COLORS.stay, label: 'Average stay' }]}
                yDomain={ZERO_DOMAIN}
                valueFormatter={formatStayValue}
                showLegend={false}
                ariaLabel="Average tourist length of stay by year"
                height="100%"
              />
            </div>
          </ChartPanel>

          <section className="flex flex-col border border-outline-variant bg-surface p-5 card-shadow transition-colors duration-200 hover:border-primary">
            <h3 className="text-base font-bold text-ink">Stay snapshot</h3>
            <p className="mt-1 text-sm leading-5 text-ink-muted">
              Latest reported average, recent change, and the recorded peak.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <MiniStat
                label="Latest average"
                value={latestStay ? `${formatNumber(latestStay.value, 1)} days` : '—'}
              />
              <MiniStat
                label="Five-period change"
                value={fiveYearStayChange === null ? '—' : formatSigned(fiveYearStayChange, '%')}
              />
              <MiniStat
                label="Recorded peak"
                value={
                  peakStay ? `${formatNumber(peakStay.value, 1)} days · ${peakStay.year}` : '—'
                }
              />
            </div>
            <p className="mt-auto pt-5 text-xs leading-5 text-ink-muted">
              This is the average duration of an arrival, not the total number of nights or unique
              visitors.
            </p>
          </section>
        </div>
      </section>

      <section
        id="tourism-section-trends"
        className="scroll-mt-24 space-y-4"
        aria-label="Tourism trends"
      >
        <SectionHeading
          title="Tourism trends"
          description="Arrivals and tourism revenue over time. Each series keeps its own reporting basis."
          action={
            <PeriodControl
              value={arrivalRange}
              onChange={setTrendRange}
              options={RANGE_OPTIONS}
              label="Period"
              ariaLabel="Trend period range"
            />
          }
        />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartPanel
            title="Tourist arrivals"
            subtitle={`Calendar year · ${periodStart(visibleArrivalTrend)} to ${periodEnd(
              visibleArrivalTrend
            )} · total arrivals`}
            action={saveButtonFor('arrivals')}
            note="Hover any year for arrivals and the year-on-year change. Arrivals fell sharply in 2020 and 2021 during the pandemic period."
          >
            <div className="min-h-[384px] flex-1">
              <LineChart
                data={visibleArrivalTrend.map((record) => ({
                  year: record.year,
                  arrivals: record.total_arrivals,
                  yoy: record.percent_change,
                }))}
                xKey="year"
                series={[{ key: 'arrivals', color: COLORS.arrivals, label: 'Tourist arrivals' }]}
                yDomain={ZERO_DOMAIN}
                valueFormatter={formatTourismValue}
                tooltipExtra={YearOnYearNote}
                showLegend={false}
                ariaLabel="Tourist arrivals by calendar year"
                height="100%"
              />
            </div>
          </ChartPanel>

          <ChartPanel
            title="Tourism revenue"
            subtitle={`Fiscal year · ${periodStart(visibleRevenueTrend)} to ${periodEnd(
              visibleRevenueTrend
            )} · US$ millions${trends.latestRevenue?.fiscal_year.endsWith('*') ? ' · latest year estimated' : ''}`}
            action={saveButtonFor('revenue')}
            note="Revenue is reported by fiscal year, so it is not directly comparable with the calendar-year arrival series. An asterisk marks a source estimate."
          >
            <div className="min-h-[384px] flex-1">
              <LineChart
                data={visibleRevenueTrend.map((record) => ({
                  year: record.fiscal_year,
                  revenue: record.value,
                }))}
                xKey="year"
                series={[{ key: 'revenue', color: COLORS.revenue, label: 'Tourism revenue' }]}
                yDomain={ZERO_DOMAIN}
                valueFormatter={formatRevenueValue}
                showLegend={false}
                ariaLabel="Tourism revenue by fiscal year in US dollars millions"
                height="100%"
              />
            </div>
          </ChartPanel>
        </div>
      </section>
    </div>
  );
}
