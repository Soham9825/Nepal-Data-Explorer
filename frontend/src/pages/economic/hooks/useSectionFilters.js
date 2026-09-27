/**
 * Every per-section control on the page, in one place.
 *
 * The three time series that offer a period picker each keep their own range
 * because the choices are independent: a reader comparing ten years of world
 * output against five years of trade is not making a mistake. The remaining
 * controls are a single selected value each — the year a sector list is cut to,
 * the flow the partner chart shows, the province and price basis the GDP panel
 * reports.
 *
 * The values are returned next to their setters and handed to the sections as one
 * object, so a section reaches for `actions.setPartnerView` without the page
 * passing eight props down for it.
 */
import { useMemo, useState } from 'react';
import { DEFAULT_PARTNER_VIEW, DEFAULT_RANGE } from '../constants';

/** Every province option, plus the national aggregate they all roll up into. */
export const ALL_PROVINCES = 'All';

export function useSectionFilters() {
  const [growthRange, setGrowthRange] = useState(DEFAULT_RANGE);
  const [tradeRange, setTradeRange] = useState(DEFAULT_RANGE);
  const [balanceRange, setBalanceRange] = useState(DEFAULT_RANGE);
  const [sectorYear, setSectorYear] = useState('');
  const [sectorGroup, setSectorGroup] = useState('');
  const [partnerView, setPartnerView] = useState(DEFAULT_PARTNER_VIEW);
  const [selectedProvince, setSelectedProvince] = useState(ALL_PROVINCES);
  const [growthMetric, setGrowthMetric] = useState('basic_price');

  return useMemo(
    () => ({
      growthRange,
      tradeRange,
      balanceRange,
      sectorYear,
      sectorGroup,
      partnerView,
      selectedProvince,
      growthMetric,
      growthField:
        growthMetric === 'purchaser_price' ? 'growth_purchaser_price' : 'growth_basic_price',
      setGrowthRange,
      setTradeRange,
      setBalanceRange,
      setSectorYear,
      setSectorGroup,
      setPartnerView,
      setSelectedProvince,
      setGrowthMetric,
    }),
    [
      growthRange,
      tradeRange,
      balanceRange,
      sectorYear,
      sectorGroup,
      partnerView,
      selectedProvince,
      growthMetric,
    ]
  );
}
