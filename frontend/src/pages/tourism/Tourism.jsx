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
import { useEffect, useState } from 'react';
import ErrorMessage from '../../components/common/ErrorMessage';
import Loader from '../../components/common/Loader';
import EmptyPanel from './components/EmptyPanel';
import SaveViewButton from './components/SaveViewButton';
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
import { collectionsApi } from '../../services/auth';
import DestinationsTab from './tabs/DestinationsTab';
import MarketsTab from './tabs/MarketsTab';
import OverviewTab from './tabs/OverviewTab';
import ProfileTab from './tabs/ProfileTab';

// Each chart inside the Visitor behavior tab is bookmarked on its own — a user
// picks the specific reading they want, not the whole tab.
const SECTION_SAVE_META = {
  stay: { key: 'tourism-overview-stay', title: 'Average length of stay' },
  arrivals: { key: 'tourism-overview-arrivals', title: 'Tourist arrivals' },
  revenue: { key: 'tourism-overview-revenue', title: 'Tourism revenue' },
  markets: { key: 'tourism-markets-source', title: 'Source markets' },
  destinations: { key: 'tourism-destinations-ranking', title: 'Province destinations' },
  destinationTrend: { key: 'tourism-destinations-trend', title: 'Destination trend' },
  purpose: { key: 'tourism-profile-purpose', title: 'Purpose of visit' },
  age: { key: 'tourism-profile-age', title: 'Visitor age groups' },
  gender: { key: 'tourism-profile-gender', title: 'Visitor gender' },
  trekking: { key: 'tourism-profile-trekking', title: 'Trekking areas' },
};

const yearLabel = (value) => (value ? `Year ${value}` : 'Latest');

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

  // Chart keys already saved in any of the user's collections, so the bookmark
  // can reflect the current view's saved state without a second round-trip.
  const [savedKeys, setSavedKeys] = useState(() => new Set());
  useEffect(() => {
    let mounted = true;
    collectionsApi
      .list()
      .then((payload) => {
        if (!mounted) return;
        const keys = new Set();
        (payload.collections || []).forEach((collection) =>
          collection.items.forEach((item) => keys.add(item.chart_key))
        );
        setSavedKeys(keys);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Summary line and filter snapshot for each savable chart, built from the
  // currently-selected years so a bookmark restores the exact reading later.
  const paramsForSection = {
    stay: { stayRange: filters.stayRange },
    arrivals: { arrivalRange: filters.arrivalRange },
    revenue: { arrivalRange: filters.revenueRange },
    markets: { sourceYear: filters.selectedSourceYear },
    destinations: { province: destinations.activeProvince, visitorScope: destinations.activeScope },
    destinationTrend: { province: destinations.activeProvince, visitorScope: destinations.activeScope },
    purpose: { purposeYear: filters.purposeYear },
    age: { ageYear: filters.ageYear },
    gender: { sexYear: filters.sexYear },
    trekking: { trekkingYear: filters.trekkingYear },
  };
  const subtitleForSection = {
    stay: `Average visitor stay · ${filters.stayRange} year range`,
    arrivals: `Tourist arrivals · ${filters.arrivalRange} year range`,
    revenue: `Tourism revenue · ${filters.revenueRange} year range`,
    markets: `Ranked source markets in ${yearLabel(filters.selectedSourceYear || markets.year)}`,
    destinations: `${destinations.activeProvince} · ${destinations.activeScopeRecord?.label || 'selected scope'} · ${destinations.latestYear || 'latest year'}`,
    destinationTrend: `${destinations.activeProvince} · ${destinations.activeScopeRecord?.label || 'selected scope'}`,
    purpose: `Recorded arrivals by purpose in ${yearLabel(filters.purposeYear)}`,
    age: `Reported arrivals and shares in ${yearLabel(filters.ageYear)}`,
    gender: `Arrival counts by year · composition for ${yearLabel(filters.sexYear)}`,
    trekking: `Reported trekkers by area in ${yearLabel(filters.trekkingYear)}`,
  };
  const saveButtonFor = (section) => (
    <SaveViewButton
      item={{
        chart_key: SECTION_SAVE_META[section].key,
        title: SECTION_SAVE_META[section].title,
        subtitle: subtitleForSection[section],
        params: paramsForSection[section],
      }}
      alreadySaved={savedKeys.has(SECTION_SAVE_META[section].key)}
      onSaved={(key) => setSavedKeys((previous) => new Set(previous).add(key))}
      onRemoved={(key) =>
        setSavedKeys((previous) => {
          const next = new Set(previous);
          next.delete(key);
          return next;
        })
      }
    />
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
            saveButtonFor={saveButtonFor}
          />
        )}

        {activeTab === 'markets' && (
          <MarketsTab markets={markets} onYearChange={filters.setSelectedSourceYear} saveButton={saveButtonFor('markets')} />
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
            purposeSave={saveButtonFor('purpose')}
            ageSave={saveButtonFor('age')}
            genderSave={saveButtonFor('gender')}
            trekkingSave={saveButtonFor('trekking')}
          />
        )}

        {activeTab === 'destinations' && (
          <DestinationsTab
            destinations={destinations}
            onProvinceChange={filters.setSelectedProvince}
            onScopeChange={filters.setSelectedProvinceScope}
            rankingSave={saveButtonFor('destinations')}
            trendSave={saveButtonFor('destinationTrend')}
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
