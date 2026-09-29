import LineChart from '../../../components/charts/LineChart';
import { SEMANTIC_COLORS as COLORS } from '../../../theme/colors';
import { ZERO_DOMAIN } from '../constants';
import { formatNumber, formatPercent, formatTourismValue } from '../format';
import ChartPanel from '../components/ChartPanel';
import SectionLabel from '../components/SectionLabel';
import SelectControl from '../components/SelectControl';
import YearSummaryCard from '../components/YearSummaryCard';

/**
 * Visitor gender: the selected year's composition beside a year summary, with
 * the full gender history charted underneath.
 *
 * The history feeds the composition above it, so the two can be read together.
 */
export default function GenderPanel({ gender, onYearChange, saveButton }) {
  const { years, year, series, total, breakdown, hasComposition, summaryRows, narrative } = gender;

  return (
    <ChartPanel
      id="tourism-section-gender"
      title="Visitor gender"
      subtitle="Arrival counts by year · composition shown for selected year"
      action={
        <div className="flex items-center gap-2">
          <SelectControl
            label="Year"
            value={year}
            onChange={onYearChange}
            options={years.map((option) => ({ value: option, label: option }))}
          />
          {saveButton}
        </div>
      }
      note="Lines show reported arrivals; the selected-year composition is calculated from those counts."
    >
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(240px,1fr)]">
        <div className="flex flex-col border border-outline-variant bg-background p-4">
          <SectionLabel>Gender composition</SectionLabel>
          {hasComposition ? (
            <div className="mt-3 grid flex-1 grid-cols-2 gap-3">
              {breakdown.map((row) => (
                <div
                  key={row.key}
                  className="flex flex-col justify-between border border-outline-variant bg-surface p-3 card-shadow transition-colors duration-200 hover:border-primary"
                >
                  <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                    {row.label}
                  </p>
                  <p
                    className="mt-1.5 font-hanken text-2xl font-bold tabular-nums"
                    style={{ color: row.color }}
                  >
                    {formatPercent(row.share)}
                  </p>
                  <div
                    className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-container"
                    role="img"
                    aria-label={`${row.label}: ${formatPercent(row.share)} of ${
                      year || 'the selected year'
                    } arrivals`}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${Math.min(Math.max(row.share || 0, 0), 100)}%`,
                        backgroundColor: row.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">
              No gender composition is available for the selected year.
            </p>
          )}
        </div>

        <YearSummaryCard
          label={year ? `${year} summary` : 'Year summary'}
          heroLabel="Total arrivals"
          heroValue={formatNumber(total)}
          stats={summaryRows.map((row) => ({
            key: row.key,
            label: row.label,
            color: row.color,
            value: formatNumber(row.value),
            suffix: formatPercent(row.share),
          }))}
          note={narrative}
        />
      </div>

      <div className="mt-4 border-t border-outline-variant pt-4">
        <SectionLabel>Historical visitor gender trend</SectionLabel>
        <div className="mt-2 h-[300px] min-h-0">
          <LineChart
            data={series}
            xKey="year"
            series={[
              { key: 'female', color: COLORS.female, label: 'Female' },
              { key: 'male', color: COLORS.male, label: 'Male' },
            ]}
            yDomain={ZERO_DOMAIN}
            valueFormatter={formatTourismValue}
            fillArea={false}
            showLegend
            ariaLabel="Tourist arrivals by gender over time"
            height="100%"
          />
        </div>
      </div>
    </ChartPanel>
  );
}
