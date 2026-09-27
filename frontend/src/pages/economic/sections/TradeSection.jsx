import BarChart from '../../../components/charts/BarChart';
import { COLORS, RANGE_OPTIONS } from '../constants';
import ChartBox from '../components/ChartBox';
import PeriodControl from '../../../components/ui/PeriodControl';

/**
 * Total exports and imports per fiscal year.
 *
 * Exports and imports keep their semantic colours — green and red — so the same
 * two flows read the same way on the KPI cards and the trade-balance line below.
 * The figures arrive in millions, which the tooltip states, because the source
 * does not publish the unit in the series itself.
 */
function TradeSection({ view }) {
  return (
    <ChartBox>
      <BarChart
        data={view.trade.visibleRows}
        xKey="year"
        series={[
          { key: 'exports', color: COLORS.success, label: 'Exports' },
          { key: 'imports', color: COLORS.danger, label: 'Imports' },
        ]}
        height="100%"
        bordered={false}
        legendPosition="top"
        showYAxis
        tooltipFormatter={(value) => `${value} · NRs. in millions`}
      />
    </ChartBox>
  );
}

export const TRADE_SECTION = {
  id: 'trade',
  subtitle: () => 'Total trade values by fiscal year',
  action: (view, actions) => (
    <PeriodControl
      ariaLabel="Foreign trade period"
      value={actions.tradeRange}
      onChange={actions.setTradeRange}
      options={RANGE_OPTIONS}
    />
  ),
  content: TradeSection,
};
