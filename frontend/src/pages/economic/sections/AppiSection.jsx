import LineChart from '../../../components/charts/LineChart';
import { toSeries } from '../../../theme/chartPalette';
import { APPI_BASE, APPI_OVERALL_LABEL, EMPTY_ARRAY } from '../constants';
import ChartBox from '../components/ChartBox';
import { formatValue } from '../format';

/**
 * The producer price index across every year the source reports.
 *
 * The aggregate leads and is drawn heavy: it is the index the product lines explain,
 * not one product among them. The rest are the heaviest by weight, since a line chart
 * stops separating its lines past about five. The y-axis names the base the index is
 * measured from, because 169.6 is an index and not a magnitude.
 */
function AppiSection({ view }) {
  const { appi } = view;
  const { products = EMPTY_ARRAY, rows = EMPTY_ARRAY } = appi;

  const series = toSeries(
    products.map((product) => ({
      key: product,
      label: product,
      bold: product === APPI_OVERALL_LABEL,
    }))
  );

  return (
    <ChartBox>
      <LineChart
        data={rows}
        xKey="year"
        labelKey="year"
        tooltipKey="year"
        series={series}
        height="100%"
        yAxisTitle={`Index (base year = ${APPI_BASE})`}
        valueFormatter={formatValue}
        ariaLabel="Agriculture producer price index by product, by fiscal year"
      />
    </ChartBox>
  );
}

export const APPI_SECTION = {
  id: 'appi',
  subtitle: (view) => {
    const { appi } = view;
    const years = appi.years?.length || 0;
    const headline = Number.isFinite(appi.overall)
      ? `Overall index ${formatValue(appi.overall)}`
      : '';
    const products = `${appi.products?.length || 0} products`;
    return [headline, years > 1 ? `${years} years` : '', products].filter(Boolean).join(' · ');
  },
  action: () => null,
  content: AppiSection,
};
