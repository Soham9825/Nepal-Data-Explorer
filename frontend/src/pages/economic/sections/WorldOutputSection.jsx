import LineChart from '../../../components/charts/LineChart';
import { COLORS, RANGE_OPTIONS } from '../constants';
import ChartBox from '../components/ChartBox';
import PeriodControl from '../../../components/ui/PeriodControl';

/**
 * World output real growth.
 *
 * The benchmark the other growth sections are read against, so it is a single
 * series on one line with the zero line shown: a growth figure means nothing
 * without knowing which side of zero it is on.
 */
function WorldOutputSection({ view }) {
  return (
    <ChartBox>
      <LineChart
        data={view.worldOutput.visibleRows.map((row) => ({ year: row.year, value: row.value }))}
        xKey="year"
        labelKey="year"
        tooltipKey="year"
        series={[{ key: 'value', color: COLORS.primary, label: 'Real growth (%)' }]}
        height="100%"
        unit="%"
        yAxisTitle="Real growth (%)"
        showZeroGridline
        showZeroLine
        ariaLabel="World output real growth by year"
      />
    </ChartBox>
  );
}

export const WORLD_OUTPUT_SECTION = {
  id: 'growth',
  subtitle: () => 'World Output real series from the global economics dataset',
  action: (view, actions) => (
    <PeriodControl
      ariaLabel="World output period"
      value={actions.growthRange}
      onChange={actions.setGrowthRange}
      options={RANGE_OPTIONS}
    />
  ),
  content: WorldOutputSection,
};
