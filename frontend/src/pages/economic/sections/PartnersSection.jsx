import BarChart from '../../../components/charts/BarChart';
import { toSeries } from '../../../theme/chartPalette';
import { PARTNER_KEYS, PARTNER_VIEWS } from '../constants';
import ChartBox from '../components/ChartBox';
import ToggleControl from '../components/ToggleControl';

/**
 * Trade with each major partner.
 *
 * One flow at a time, because stacking exports and imports in the same bars would
 * invite a comparison the two are not on the same basis for. Partner colours come
 * from the shared categorical scale, so a partner keeps its colour between this
 * chart and the economies chart above it.
 */
function PartnersSection({ view }) {
  return (
    <ChartBox>
      <BarChart
        data={view.partners.rows}
        xKey="fiscal_year"
        series={toSeries(PARTNER_KEYS.map((partner) => ({ key: partner, label: partner })))}
        height="100%"
        bordered={false}
        legendPosition="top"
        showYAxis
      />
    </ChartBox>
  );
}

const flowLabel = (flow) => (flow === 'imports' ? 'Imports' : 'Exports');

export const PARTNERS_SECTION = {
  id: 'partners',
  subtitle: (view) => `${flowLabel(view.partners.flow)} by major partner (units as recorded)`,
  action: (view, actions) => (
    <ToggleControl
      ariaLabel="Trade flow"
      value={view.partners.flow}
      onChange={actions.setPartnerView}
      options={PARTNER_VIEWS}
    />
  ),
  content: PartnersSection,
};
