/**
 * Every filter the dashboard lets the user change, in one place.
 *
 * The dashboard has one control per period: three range pickers and five year
 * pickers that each narrow a single chart. They are all collected here so the
 * page component only has to read them, and so a new filter is added in one
 * obvious spot instead of beside the derivations it feeds.
 */
import { useEffect, useState } from 'react';
import { PROVINCE_ORDER } from '../../../services/provinceGDP';

/**
 * `?province=<name>` accompanies a destinations deep link from the top bar
 * search, which does not know which province the user wants. The value is checked
 * against the canonical order before it reaches state, and the visitor scope is
 * deliberately left alone so a deep link matches what a click on the province
 * select would have produced.
 */
export function useTourismFilters(requestedProvince) {
  const [arrivalRange, setArrivalRange] = useState('all');
  const [revenueRange, setRevenueRange] = useState('all');
  const [stayRange, setStayRange] = useState('all');
  const [selectedSourceYear, setSelectedSourceYear] = useState('');
  const [purposeYear, setPurposeYear] = useState('');
  const [trekkingYear, setTrekkingYear] = useState('');
  const [sexYear, setSexYear] = useState('');
  const [ageYear, setAgeYear] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedProvinceScope, setSelectedProvinceScope] = useState('');

  useEffect(() => {
    if (!PROVINCE_ORDER.includes(requestedProvince)) return;
    setSelectedProvince(requestedProvince);
  }, [requestedProvince]);

  // Arrivals and revenue share one control in the trends section: the two series
  // sit side by side and are read together, so a single period keeps them
  // comparable. The length-of-stay chart keeps its own control.
  const setTrendRange = (range) => {
    setArrivalRange(range);
    setRevenueRange(range);
  };

  return {
    arrivalRange,
    revenueRange,
    stayRange,
    setArrivalRange,
    setRevenueRange,
    setStayRange,
    setTrendRange,
    selectedSourceYear,
    setSelectedSourceYear,
    purposeYear,
    setPurposeYear,
    trekkingYear,
    setTrekkingYear,
    sexYear,
    setSexYear,
    ageYear,
    setAgeYear,
    selectedProvince,
    setSelectedProvince,
    selectedProvinceScope,
    setSelectedProvinceScope,
  };
}
