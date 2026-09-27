import LineChart from '../../../components/charts/LineChart';
import { toSeries } from '../../../theme/chartPalette';
import ChartBox from '../components/ChartBox';

/**
 * Real growth for each economy and bloc Nepal is compared with.
 *
 * Colours come from the shared categorical scale rather than from a per-chart
 * index, so "China" is the same colour here as it is in the trade-by-partner
 * bars directly below.
 */
function EconomiesSection({ view }) {
  const { economy } = view;

  return (
    <ChartBox>
      <LineChart
        data={economy.economyRows}
        xKey="year"
        labelKey="year"
        tooltipKey="year"
        series={toSeries(economy.contexts.map((context) => ({ key: context, label: context })))}
        height="100%"
        unit="%"
        yAxisTitle="Real growth (%)"
        showZeroGridline
        showZeroLine
        ariaLabel="Real growth by economy and economic bloc"
      />
    </ChartBox>
  );
}

export const ECONOMIES_SECTION = {
  id: 'economies',
  subtitle: () => 'Real growth by economy and economic bloc',
  action: () => null,
  content: EconomiesSection,
};
