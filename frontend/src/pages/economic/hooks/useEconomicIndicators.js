import { useMemo } from 'react';
import { GDP_CARD_COLORS } from '../constants';
import { formatValue } from '../format';
import { GROWTH_METRICS } from '../../../services/provinceGDP';
import { ALL_PROVINCES } from './useSectionFilters';

const growthCard = (value) => (value == null ? '—' : `${formatValue(value)}%`);

export function useEconomicIndicators({ province, selectedProvince, growthMetric }) {
  return useMemo(() => {
    const latest = province.latestYear || 'Unavailable';
    const provinceScope =
      selectedProvince === ALL_PROVINCES ? 'Province average' : selectedProvince;

    return [
      {
        label: 'GDP at Current Prices',
        value: province.cards.current.value,
        unit: province.cards.current.unit,
        tooltip: province.cards.current.tooltip,
        subtitle: 'Latest fiscal year',
        change: province.latestYear ? `${latest} · ${province.dataStatus}` : 'Unavailable',
        icon: 'payments',
        color: province.accentColor || GDP_CARD_COLORS.current,
      },
      {
        label: 'GDP at Constant Prices',
        value: province.cards.constant.value,
        unit: province.cards.constant.unit,
        tooltip: province.cards.constant.tooltip,
        subtitle: 'Latest fiscal year, real terms',
        change: latest,
        icon: 'account_balance',
        color: GDP_CARD_COLORS.constant,
      },
      {
        label: 'GDP per Capita',
        value: province.cards.perCapita.value,
        unit: province.cards.perCapita.unit,
        tooltip: province.cards.perCapita.tooltip,
        subtitle: provinceScope,
        change: latest,
        icon: 'person',
        color: GDP_CARD_COLORS.perCapita,
      },
      {
        label: `Growth (${GROWTH_METRICS[growthMetric].shortLabel})`,
        value: growthCard(province.cards.growth),
        subtitle: provinceScope,
        change: latest,
        icon: 'trending_up',
        color: GDP_CARD_COLORS.growth,
      },
    ];
  }, [province, selectedProvince, growthMetric]);
}
