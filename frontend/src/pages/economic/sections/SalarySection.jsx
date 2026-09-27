import LineChart from '../../../components/charts/LineChart';
import { toSeries } from '../../../theme/chartPalette';
import ChartBox from '../components/ChartBox';

/**
 * Salary and wage-rate index per category, across every fiscal year.
 *
 * The source reports eleven categories; the ones charted together are listed in
 * `SALARY_GROUPS`, because a line chart stops separating its lines past about five
 * and a chart whose lines cross unreadably is worse than a shorter one. All
 * categories, charted or not, are exported in the CSV.
 *
 * No unit is printed on the axis because the series is an index, not a currency;
 * the subtitle carries the fiscal years instead.
 */
function SalarySection({ view }) {
  const { salary } = view;

  return (
    <ChartBox>
      <LineChart
        data={salary.rows}
        xKey="year"
        labelKey="year"
        tooltipKey="year"
        series={toSeries(salary.groups.map((group) => ({ key: group, label: group })))}
        height="100%"
        yAxisTitle="Index (base year = 100)"
        ariaLabel="Salary and wage rate index by category"
      />
    </ChartBox>
  );
}

export const SALARY_SECTION = {
  id: 'salary',
  subtitle: () => 'Index by category across fiscal years',
  action: () => null,
  content: SalarySection,
};
