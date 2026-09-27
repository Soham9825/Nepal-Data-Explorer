/**
 * Tourism dashboard.
 *
 * This file is the wiring, nothing else. It loads the payload, holds the filter
 * and tab state, asks each dataset for its derived view, and hands those views
 * to the tab that draws them. Every other concern lives one level down:
 *
 *   series.js   how the raw payload is parsed
 *   hooks/      state and the derivations built on it
 *   components/ the pieces every tab draws from
 *   tabs/       one file per tab
 *
 * The hook calls below are unconditional even though a tab only draws one
 * dataset at a time: the filters can name a year or province belonging to another
 * tab, and resolving them up front is what keeps a tab from snapping its
 * selection when it is opened.
 */
import ErrorMessage from '../../components/common/ErrorMessage';
import Loader from '../../components/common/Loader';
import EmptyPanel from './components/EmptyPanel';
import TourismFooter from './components/TourismFooter';
import TourismHero from './components/TourismHero';
import TourismTabBar from './components/TourismTabBar';
import { buildTourismCsvRows } from './csvRows';
import { useAgeBreakdown } from './hooks/useAgeBreakdown';
import { useDestinations } from './hooks/useDestinations';
import { useTourismFilters } from './hooks/useTourismFilters';
import { useGenderBreakdown } from './hooks/useGenderBreakdown';
import { usePurposeBreakdown, useTrekkingBreakdown } from './hooks/useVisitorBreakdowns';
import { useSourceMarkets } from './hooks/useSourceMarkets';
import { useTourismData } from './hooks/useTourismData';
import { useTourismNavigation } from './hooks/useTourismNavigation';
import { useTourismTrends } from './hooks/useTourismTrends';
import { selectProvinceTourism } from './series';
import DestinationsTab from './tabs/DestinationsTab';
import MarketsTab from './tabs/MarketsTab';
import OverviewTab from './tabs/OverviewTab';
import ProfileTab from './tabs/ProfileTab';

export default function Tourism() {
  const { data, loading, error, retry } = useTourismData();
  const { activeTab, selectTab, pageRef, requestedProvince } = useTourismNavigation({ loading });
  const filters = useTourismFilters(requestedProvince);

  const trends = useTourismTrends(data, filters);
  const markets = useSourceMarkets(data, trends.arrivalTrend, filters.selectedSourceYear);
  const purpose = usePurposeBreakdown(data, filters.purposeYear);
  const age = useAgeBreakdown(data, filters.ageYear);
  const gender = useGenderBreakdown(data, filters.sexYear);
  const trekking = useTrekkingBreakdown(data, filters.trekkingYear);
  const destinations = useDestinations(
    data,
    filters.selectedProvince,
    filters.selectedProvinceScope
  );

  // Assembled on each render rather than memoised: it is a single pass over rows
  // the hooks have already derived, and the footer only reads it when an export
  // is requested.
  const csvRows = buildTourismCsvRows({
    provinceTourism: selectProvinceTourism(data),
    trends,
    topSource: data?.kpis?.top_source_country,
    markets,
    purpose,
    trekking,
    gender,
    age,
    destinations,
  });

  if (loading) {
    return (
      <div className="flex min-h-[560px] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-ink-muted">Tourism</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-ink">Tourism performance</h1>
        </div>
        <ErrorMessage title="Tourism data is unavailable" message={error} onRetry={retry} />
      </div>
    );
  }

  if (!data) {
    return <EmptyPanel message="No tourism data is available." />;
  }

  return (
    <div ref={pageRef} className="space-y-6">
      <TourismHero
        arrivalYear={trends.latestArrival?.year}
        revenueFiscalYear={trends.latestRevenue?.fiscal_year}
        destinationYear={destinations.latestYear}
      />

      <TourismTabBar activeTab={activeTab} onSelect={selectTab} />

      <div id={`tourism-panel-${activeTab}`} role="tabpanel">
        {activeTab === 'overview' && (
          <OverviewTab
            trends={trends}
            topSource={data.kpis?.top_source_country}
            topMarket={markets.topMarket}
            arrivalRange={filters.arrivalRange}
            stayRange={filters.stayRange}
            setTrendRange={filters.setTrendRange}
            setStayRange={filters.setStayRange}
          />
        )}

        {activeTab === 'markets' && (
          <MarketsTab markets={markets} onYearChange={filters.setSelectedSourceYear} />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            purpose={purpose}
            age={age}
            gender={gender}
            trekking={trekking}
            onPurposeYearChange={filters.setPurposeYear}
            onAgeYearChange={filters.setAgeYear}
            onSexYearChange={filters.setSexYear}
            onTrekkingYearChange={filters.setTrekkingYear}
          />
        )}

        {activeTab === 'destinations' && (
          <DestinationsTab
            destinations={destinations}
            onProvinceChange={filters.setSelectedProvince}
            onScopeChange={filters.setSelectedProvinceScope}
          />
        )}
      </div>

      <TourismFooter
        csvRows={csvRows}
        activeTab={activeTab}
        filters={filters}
        trends={trends}
        markets={markets}
        purpose={purpose}
        trekking={trekking}
        gender={gender}
        age={age}
        destinations={destinations}
      />
    </div>
  );
}
