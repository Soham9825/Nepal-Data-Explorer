/**
 * Economic dashboard.
 *
 * This file is the wiring, nothing else. It loads the two payloads, holds the tab
 * and control state, asks each domain for its derived view, and hands those views
 * to the panel that draws them. Every other concern lives one level down:
 *
 *   series.js   how the raw payload is parsed
 *   format.js   how a number becomes a figure on screen
 *   hooks/      state and the derivations built on it
 *   components/ the pieces every section draws from
 *   sections/   one file per section, each owning its own header control
 *
 * The view model below is assembled once per render and passed down whole. That is
 * deliberate: a section reaching for `view.trade.visibleRows` says what it needs
 * where it uses it, and adding a figure to a section is not a change to this file.
 *
 * One tab is open at a time, as on the Tourism dashboard, but the derivations are
 * not lazy: the hero reports on the reporting period of series the open tab may not
 * be drawing, and the KPI strip is derived whether or not the Overview tab is the
 * one showing it. So every hook below runs whatever the tab bar says is selected.
 */
import { useMemo } from 'react';
import Loader from '../../components/common/Loader';
import EconomicFooter from './components/EconomicFooter';
import EconomicHero from './components/EconomicHero';
import EconomicTabBar from './components/EconomicTabBar';
import EconomicTabPanel from './components/EconomicTabPanel';
import { buildEconomicCsvRows } from './csvRows';
import { useEconomicData } from './hooks/useEconomicData';
import { useEconomicIndicators } from './hooks/useEconomicIndicators';
import { useEconomicNavigation } from './hooks/useEconomicNavigation';
import { useSectoralGrowth, useEconomyGrowth, useWorldOutput } from './hooks/useGrowthSections';
import { useAppi, useAppiTable, useSalaryIndex } from './hooks/usePriceSections';
import { useProvinceGdpData } from './hooks/useProvinceGdpData';
import { useProvinceGdpView } from './hooks/useProvinceGdpView';
import { useSectionFilters } from './hooks/useSectionFilters';
import { usePartners, useTrade, useTradeBalance } from './hooks/useTradeSections';
export default function Economic() {
  const { data, loading, error, retry } = useEconomicData();
  const provinceRequest = useProvinceGdpData();
  const { activeTab, selectTab, pageRef } = useEconomicNavigation({ loading });
  const actions = useSectionFilters();

  const sectoral = useSectoralGrowth(data, actions.sectorYear, actions.sectorGroup);
  const worldOutput = useWorldOutput(data, actions.growthRange);
  const economy = useEconomyGrowth(data);
  const trade = useTrade(data, actions.tradeRange);
  const partners = usePartners(data, actions.partnerView);
  const balance = useTradeBalance(data, actions.balanceRange);
  const salary = useSalaryIndex(data);
  const appi = useAppi(data);
  const appiTable = useAppiTable(data);
  const province = useProvinceGdpView({
    provinceGdp: provinceRequest.provinceGdp,
    selectedProvince: actions.selectedProvince,
    growthMetric: actions.growthMetric,
    growthField: actions.growthField,
  });

  const view = useMemo(
    () => ({
      sectoral,
      worldOutput,
      economy,
      trade,
      partners,
      balance,
      salary,
      appi,
      appiTable,
      province,
      provinceRequest,
    }),
    [
      sectoral,
      worldOutput,
      economy,
      trade,
      partners,
      balance,
      salary,
      appi,
      appiTable,
      province,
      provinceRequest,
    ]
  );

  const cards = useEconomicIndicators({
    province,
    selectedProvince: actions.selectedProvince,
    growthMetric: actions.growthMetric,
  });

  // Assembled on each render rather than memoised: it is a single pass over the
  // payload, and the footer only reads it when an export is requested.
  const csvRows = buildEconomicCsvRows({
    data,
    worldOutput,
    trade,
    partners,
    balance,
    sectoral,
    provinceGdp: provinceRequest.provinceGdp,
  });

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div ref={pageRef} className="space-y-6">
      <EconomicHero
        sectorYear={sectoral.year}
        tradeYear={trade.year}
        worldYear={worldOutput.latest?.year}
        gdpYear={province.latestYear}
      />

      <EconomicTabBar activeTab={activeTab} onSelect={selectTab} />

      <EconomicTabPanel activeTab={activeTab} view={view} actions={actions} cards={cards} />

      <EconomicFooter csvRows={csvRows} view={view} actions={actions} activeTab={activeTab} />

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="shrink-0 rounded-sm bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-600"
          >
            Try again
          </button>
        </div>
      )}
      {!loading && !error && !data && (
        <p className="text-sm text-onSurface-variant">No economic data is available.</p>
      )}
    </div>
  );
}
