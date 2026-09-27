/**
 * Province-level destination records: the province list, the selected province's
 * visitor scopes, the ranked destinations and the per-destination year series.
 *
 * The province list is ordered canonically (Koshi → Sudurpashchim) so this page
 * reads in the same sequence as the Province Explorer tab bar. Alphabetical order
 * here would silently disagree with that page and make the two hard to compare.
 */
import { useMemo } from 'react';
import { EMPTY_ARRAY } from '../constants';
import { CATEGORICAL_SERIES } from '../../../theme/colors';
import { PROVINCE_ORDER } from '../../../services/provinceGDP';
import { PROVINCE_PATHS } from '../../../data/provincePaths';
import { formatPercent, toNumber } from '../format';
import { selectProvinceTourism } from '../series';

const hasVisitors = (destination) => destination.visitors !== null;

function canonicalRank(province) {
  const index = PROVINCE_ORDER.indexOf(province);
  return index === -1 ? PROVINCE_ORDER.length : index;
}

/**
 * How many destinations each province publishes under its own default visitor
 * scope, so the tab bar can show where records exist before you switch.
 */
function countDestinationsPerProvince(latestRows) {
  const counts = {};
  latestRows.forEach((province) => {
    const defaultScope = province.available_scopes?.[0]?.key;
    counts[province.province] = (province.destinations || []).filter(
      (destination) => destination.visitor_scope === defaultScope && hasVisitors(destination)
    ).length;
  });
  return counts;
}

export function useDestinations(tourismData, selectedProvince, selectedScope) {
  const provinceTourism = useMemo(() => selectProvinceTourism(tourismData), [tourismData]);

  const provinces = useMemo(() => {
    return [...(provinceTourism.latest || EMPTY_ARRAY)].sort(
      (first, second) =>
        canonicalRank(first.province) - canonicalRank(second.province) ||
        first.province.localeCompare(second.province)
    );
  }, [provinceTourism]);

  const latestYear = provinceTourism.latest_year;
  const activeProvince =
    provinces.find((province) => province.province === selectedProvince)?.province ||
    provinces[0]?.province ||
    '';
  const activeProvinceItem = provinces.find((province) => province.province === activeProvince);
  const provinceShape = PROVINCE_PATHS.find((shape) => shape.name === activeProvince) || null;

  const defaultCounts = useMemo(
    () => countDestinationsPerProvince(provinceTourism.latest || EMPTY_ARRAY),
    [provinceTourism]
  );

  const scopes = activeProvinceItem?.available_scopes || [];
  const activeScope = scopes.some((scope) => scope.key === selectedScope)
    ? selectedScope
    : scopes[0]?.key || '';
  const activeScopeRecord = scopes.find((scope) => scope.key === activeScope);

  const destinations = (activeProvinceItem?.destinations || [])
    .filter((destination) => destination.visitor_scope === activeScope && hasVisitors(destination))
    .sort((first, second) => second.visitors - first.visitors);
  const total = destinations.reduce((sum, destination) => sum + destination.visitors, 0);
  const items = destinations.map((destination) => ({
    label: destination.name,
    value: destination.visitors,
    share: total ? (destination.visitors / total) * 100 : 0,
  }));
  const topDestination = items[0] || null;

  // Published destination counts are small and uneven (1–4 per province), so the
  // summary stays lean. A "top 3" block would just restate the ranked list,
  // which already shows every destination there is.
  const summary = { total, count: items.length, topShare: topDestination?.share ?? 0 };
  const narrative = !topDestination
    ? `No destination records are published for ${activeProvince || 'this province'} under ${
        activeScopeRecord?.label || 'the selected visitor scope'
      }.`
    : `${topDestination.label} recorded the most visits in ${
        latestYear || 'the latest year'
      }, at ${formatPercent(topDestination.share)} of the ${summary.count} destination${
        summary.count === 1 ? '' : 's'
      } reported for ${activeProvince}.`;

  // The active province reads its count from the live selection instead of the
  // default, since the visitor scope picker can change it.
  const tabCounts = useMemo(() => {
    if (!activeProvince) return defaultCounts;
    return { ...defaultCounts, [activeProvince]: summary.count };
  }, [defaultCounts, activeProvince, summary.count]);

  const trends = (provinceTourism.by_destination || []).filter(
    (destination) =>
      destination.province === activeProvince &&
      destination.visitor_scope === activeScope &&
      destination.observations?.some(
        (observation) => observation.year === latestYear && hasVisitors(observation)
      )
  );

  const chartData = (provinceTourism.years || []).map((year) => {
    const row = { year };
    trends.forEach((destination, index) => {
      const observation = destination.observations.find((item) => item.year === year);
      row[`destination-${index}`] = observation ? toNumber(observation.visitors) : null;
    });
    return row;
  });

  const chartSeries = trends.map((destination, index) => ({
    key: `destination-${index}`,
    color: CATEGORICAL_SERIES[index % CATEGORICAL_SERIES.length],
    label: destination.name,
  }));

  return {
    provinces,
    activeProvince,
    provinceShape,
    scopes,
    activeScope,
    activeScopeRecord,
    latestYear,
    items,
    summary,
    narrative,
    tabCounts,
    chartData,
    chartSeries,
  };
}
