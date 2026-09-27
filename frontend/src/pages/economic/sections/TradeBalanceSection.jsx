import LineChart from '../../../components/charts/LineChart';
import { COLORS, RANGE_OPTIONS } from '../constants';
import ChartBox from '../components/ChartBox';
import PeriodControl from '../../../components/ui/PeriodControl';

/**
 * Exports minus imports per fiscal year.
 *
 * The zero line is the whole point of this chart, so it is drawn: the line sits
 * below zero in every year shown, and the depth of the deficit is the story rather
 * than the level of trade. The colour is the exports token, matching the export
 * flow it is measured from.
 */
function TradeBalanceSection({ view }) {
  return (
    <ChartBox>
      <LineChart
        data={view.balance.visibleRows.map((row) => ({ year: row.fiscal_year, value: row.value }))}
        xKey="year"
        labelKey="year"
        tooltipKey="year"
        series={[{ key: 'value', color: COLORS.success, label: 'Trade balance' }]}
        height="100%"
        unit=""
        showZeroLine
      />
    </ChartBox>
  );
}

export const TRADE_BALANCE_SECTION = {
  id: 'balance',
  subtitle: () => 'Exports minus imports per fiscal year',
  action: (view, actions) => (
    <PeriodControl
      ariaLabel="Trade balance period"
      value={actions.balanceRange}
      onChange={actions.setBalanceRange}
      options={RANGE_OPTIONS}
    />
  ),
  content: TradeBalanceSection,
};
