import { SEMANTIC_COLORS as COLORS } from '../../../theme/colors';
import { RANKED_BAR_MAX_H, TREKKING_VISIBLE_ROWS } from '../constants';
import { formatNumber, formatPercent } from '../format';
import ChartPanel from '../components/ChartPanel';
import RankedBars from '../components/RankedBars';
import SectionLabel from '../components/SectionLabel';
import SelectControl from '../components/SelectControl';
import YearSummaryCard from '../components/YearSummaryCard';

/**
 * Trekking areas: the ranked areas for a year beside a summary that repeats only
 * the leaders, since the ranking on the left already shows every area.
 */
export default function TrekkingPanel({ trekking, onYearChange, saveButton }) {
  const { years, year, items, total, scrolls, leaders } = trekking;

  return (
    <>
      <ChartPanel
        id="tourism-section-trekking"
        title="Trekking areas"
        subtitle={`Reported trekkers by area in ${year || 'the latest available year'}${
          scrolls ? ' — scroll to see all' : ''
        }`}
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
        note="Trekker totals are a separate tourism series and should not be compared directly with total arrivals."
      >
        <RankedBars
          items={items}
          color={COLORS.activity}
          listTitle="Trekking areas by trekkers"
          unitLabel="Trekkers"
          maxHeight={scrolls ? RANKED_BAR_MAX_H[TREKKING_VISIBLE_ROWS] : undefined}
          emptyMessage="No trekking records are available for this year."
        />
      </ChartPanel>

      <YearSummaryCard
        label={year ? `${year} summary` : 'Year summary'}
        heroLabel="Total trekkers"
        heroValue={formatNumber(total)}
        stats={[
          { key: 'areas', label: 'Areas reported', value: items.length },
          { key: 'top-share', label: 'Top area share', value: formatPercent(items[0]?.share) },
        ]}
        extra={
          leaders.length > 0 ? (
            <div className="mt-4">
              <SectionLabel>Leading areas</SectionLabel>
              <div className="mt-3 space-y-3">
                {leaders.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium text-ink">{item.label}</span>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
                        {formatNumber(item.value)}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-container"
                      role="img"
                      aria-label={`${item.label}: ${formatPercent(item.share)} of trekking arrivals`}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-500 ease-out"
                        style={{
                          width: `${Math.min(Math.max(item.share || 0, 0), 100)}%`,
                          backgroundColor: COLORS.activity,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        }
        note={
          items.length
            ? `${items[0].label} recorded the most trekkers in ${year || 'the selected year'}.`
            : 'No trekking areas are reported for the selected year.'
        }
      />
    </>
  );
}
