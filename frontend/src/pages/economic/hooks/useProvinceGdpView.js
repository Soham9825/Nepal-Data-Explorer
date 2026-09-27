/**
 * The province GDP view model.
 *
 * This section reads a different payload from the rest of the page and has its own
 * province and price-basis controls, so its derivations are kept together here
 * rather than spread through the component. The three things it produces are the
 * chart rows and series, the KPI figures behind them, and the provenance chip in
 * the card header.
 *
 * "All" is a real case rather than an empty one: the national figures are the sum
 * of the provinces for totals and their average for growth and per-capita values,
 * and they are labelled as such on the cards.
 */
import { useMemo } from 'react';
import { buildGrowthChartData, latestAverage, latestSum } from '../../../services/provinceGDP';
import { toSeries } from '../../../theme/chartPalette';
import { rupeesCard } from '../format';
import { ALL_PROVINCES } from './useSectionFilters';

export function useProvinceGdpView({ provinceGdp, selectedProvince, growthMetric, growthField }) {
  return useMemo(() => {
    const isAll = selectedProvince === ALL_PROVINCES;
    const record = isAll ? null : provinceGdp?.latest?.provinces?.[selectedProvince] || null;
    const latestBlock = provinceGdp?.latest || null;
    const latestYear = latestBlock?.fiscal_year || '';

    // Colours come from the shared scale, so a province is the colour it is on the
    // province map and on every other chart. This section used to carry its own
    // hand-written province palette, which was a second list to keep in step.
    const scale = toSeries(
      (isAll ? provinceGdp?.provinces || [] : [selectedProvince]).map((name) => ({
        key: name,
        label: name,
      }))
    );
    const accentColor = isAll ? null : scale[0]?.color;

    const series = isAll ? scale : [{ key: 'value', color: accentColor, label: 'Growth %' }];

    const pick = (field) => (isAll ? null : record?.[field]);

    return {
      selectedProvince,
      isAll,
      latestYear,
      dataStatus: latestBlock?.data_status || '',
      rows: buildGrowthChartData(provinceGdp, growthMetric, selectedProvince),
      series,
      showLegend: isAll,
      cards: {
        current: rupeesCard(isAll ? latestSum(provinceGdp, 'gdp_current') : pick('gdp_current')),
        constant: rupeesCard(isAll ? latestSum(provinceGdp, 'gdp_constant') : pick('gdp_constant')),
        perCapita: rupeesCard(
          isAll ? latestAverage(provinceGdp, 'per_capita_gdp_nrs') : pick('per_capita_gdp_nrs'),
          { scaleNote: '(per person)', exact: true }
        ),
        growth: isAll ? latestAverage(provinceGdp, growthField) : (record?.[growthField] ?? null),
      },
      accentColor,
    };
  }, [provinceGdp, selectedProvince, growthMetric, growthField]);
}
