import { useState, useEffect, useMemo } from 'react';
import MetricCard from '../components/cards/MetricCard';
import NewsCard from '../components/cards/NewsCard';
import ProgressBar from '../components/cards/ProgressBar';
import BarChart from '../components/charts/BarChart';
import DataFooter from '../components/common/DataFooter';
import Loader from '../components/common/Loader';
import ErrorMessage from '../components/common/ErrorMessage';
import { Icon } from '../components/ui/Icon';
import ProvinceMap from '../components/national/ProvinceMap';
import NewsModal from '../components/national/NewsModal';
import { PROVINCE_PATHS } from '../data/provincePaths';
import { API_BASE_URL } from '../config';
import { downloadNationalReport } from '../services/reportApi';

const NEWS_API_URL = `${API_BASE_URL}/api/news/`;
const POPULATION_API_URL = `${API_BASE_URL}/api/datasets/population-summary/`;
const PROVINCE_POPULATION_API_URL = `${API_BASE_URL}/api/datasets/province-population-summary/`;
const ECONOMIC_API_URL = `${API_BASE_URL}/api/analytics/economic/?summary=1`;
const ECONOMIC_COMPACT_API_URL = `${API_BASE_URL}/api/analytics/economic/?compact=1`;
const FALLBACK_NEPAL_POPULATION = 29164578;
const PROV_COLORS = ['#b70011', '#0051d5', '#7a5100', '#316bf3', '#9a6800', '#5c403c', '#dc2626'];
const NATIONAL_METRIC_CONFIG = [
  { id: 1, label: 'Total Population', trend: 'up', icon: 'groups', color: '#0051d5' },
  { id: 2, label: 'GDP Growth Rate', trend: 'down', icon: 'trending_up', color: '#0051d5' },
  { id: 3, label: 'Total Exports', trend: 'up', icon: 'north_east', color: '#0f7a3d' },
  { id: 4, label: 'Total Imports', trend: 'down', icon: 'south_west', color: '#b70011' },
];

const formatPublishedDate = (value) => {
  if (!value) return 'Recently';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
};

export default function National() {
  const [loading, setLoading] = useState(true);
  const [error] = useState(null);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedNews, setSelectedNews] = useState(null);
  const [populationTotal, setPopulationTotal] = useState(FALLBACK_NEPAL_POPULATION);
  const [populationGrowth, setPopulationGrowth] = useState(0.92);
  const [gdpTrend, setGdpTrend] = useState([]);
  const [provincePopulation, setProvincePopulation] = useState([]);
  const [exportsValue, setExportsValue] = useState(null);
  const [importsValue, setImportsValue] = useState(null);
  const [latestTradeYear, setLatestTradeYear] = useState('');

  useEffect(() => {
    const fetchPopulation = async () => {
      try {
        const response = await fetch(POPULATION_API_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Population API error: ${response.status}`);
        }

        const data = await response.json();
        if (data && data.total_population != null) {
          setPopulationTotal(Number(data.total_population));
        }
        if (data && data.growth_rate != null) {
          setPopulationGrowth(Number(data.growth_rate));
        }
      } catch (err) {
        console.error('Failed to load population summary:', err);
        setPopulationTotal(FALLBACK_NEPAL_POPULATION);
        setPopulationGrowth(0.92);
      }
    };

    const fetchProvincePopulation = async () => {
      try {
        const response = await fetch(PROVINCE_POPULATION_API_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Province population API error: ${response.status}`);
        }

        const data = await response.json();
        const provinces = Array.isArray(data?.provinces) ? data.provinces : [];

        if (provinces.length > 0) {
          const mapped = provinces.map((province, index) => ({
            id: Number(province.province_code),
            name: province.name,
            population: Number(province.total_population || 0).toLocaleString(),
            pct: Number(province.pct || 0),
            density:
              province.population_density != null ? Number(province.population_density) : null,
            color: PROV_COLORS[index % PROV_COLORS.length],
          }));
          setProvincePopulation(mapped);
        }
      } catch (err) {
        console.error('Failed to load province population summary:', err);
        setProvincePopulation([]);
      }
    };

    const fetchEconomicData = async () => {
      try {
        const response = await fetch(ECONOMIC_API_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Economic API error: ${response.status}`);
        }

        const data = await response.json();
        const macroSeries = Array.isArray(data?.macro_series) ? data.macro_series : [];

        const latestByYear = macroSeries
          .filter((item) => item.context === 'World Output' && item.series_type === 'real')
          .filter((item) => Number.isFinite(Number(item.value)))
          .map((item) => {
            const yearMatch = String(item.period_label || item.published_year || '').match(
              /(19|20)\d{2}/
            );
            return {
              year: yearMatch ? yearMatch[0] : String(item.published_year || 'N/A'),
              value: Number(item.value),
              publishedYear: Number(item.published_year) || 0,
            };
          })
          .filter((item) => item.year !== 'N/A')
          .reduce((series, item) => {
            const existing = series.get(item.year);
            if (!existing || item.publishedYear > existing.publishedYear) {
              series.set(item.year, item);
            }
            return series;
          }, new Map());

        const parsedTrend = [...latestByYear.values()]
          .sort((first, second) => Number(first.year) - Number(second.year))
          .slice(-5)
          .map(({ year, value }) => ({ year, value }));

        if (parsedTrend.length > 0) {
          setGdpTrend(parsedTrend);
        }
      } catch (err) {
        console.error('Failed to load economic GDP data:', err);
        setGdpTrend([]);
      }
    };

    const fetchEconomicTrade = async () => {
      try {
        const response = await fetch(ECONOMIC_COMPACT_API_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Economic trade API error: ${response.status}`);
        }

        const data = await response.json();
        const trade = Array.isArray(data?.trade) ? data.trade : [];
        if (trade.length === 0) return;

        const byYear = {};
        trade.forEach((item) => {
          const entry = byYear[item.year] || (byYear[item.year] = {});
          if (item.group === 'Export') entry.exports = Number(item.value);
          if (item.group === 'Import') entry.imports = Number(item.value);
        });
        const years = Object.keys(byYear);
        if (years.length > 0) setLatestTradeYear(years.at(-1));
        const latestTrade = byYear[years.at(-1)];
        if (latestTrade?.exports != null) setExportsValue(latestTrade.exports);
        if (latestTrade?.imports != null) setImportsValue(latestTrade.imports);
      } catch (err) {
        console.error('Failed to load foreign trade data:', err);
      }
    };

    const fetchNews = async () => {
      try {
        const response = await fetch(NEWS_API_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`News API error: ${response.status}`);
        }

        const data = await response.json();
        setNews(Array.isArray(data.articles) ? data.articles : []);
      } catch (err) {
        console.error('Failed to load national news:', err);
        setNews([]);
      } finally {
        setNewsLoading(false);
      }
    };

    // Core metrics below should never be blocked by the (slower) RSS news
    // fetch. Render the page as soon as the data-driven sections resolve, and
    // give up waiting after a few seconds so a slow API cannot hang the page.
    const coreData = Promise.allSettled([
      fetchPopulation(),
      fetchProvincePopulation(),
      fetchEconomicData(),
      fetchEconomicTrade(),
    ]);
    const waitTimeout = new Promise((resolve) => setTimeout(resolve, 5000));
    Promise.race([coreData, waitTimeout]).finally(() => setLoading(false));

    fetchNews();
  }, []);

  const handleProvinceClick = (provinceId) => {
    const province =
      provincePopulation.find((p) => p.id === provinceId) ||
      PROVINCE_PATHS.find((p) => p.id === provinceId);
    setSelectedProvince(province);
  };

  const metrics = NATIONAL_METRIC_CONFIG.map((metric) => {
    if (metric.label === 'Total Population') {
      const totalPopulation = populationTotal ?? FALLBACK_NEPAL_POPULATION;
      const growthLabel = `${populationGrowth >= 0 ? '+' : ''}${Number(populationGrowth || 0).toFixed(2)}%`;
      return {
        ...metric,
        value: `${(totalPopulation / 1000000).toFixed(2)}M`,
        change: growthLabel,
        subtitle: 'Growth rate from Nepal census dataset',
      };
    }
    if (metric.label === 'GDP Growth Rate') {
      const latestGdp = gdpTrend.at(-1);
      return {
        ...metric,
        value: latestGdp ? `${Number(latestGdp.value).toFixed(1)}%` : 'N/A',
        change: latestGdp?.year || 'Unavailable',
        subtitle: 'World Output real growth from economic API',
      };
    }
    if (metric.label === 'Total Exports' || metric.label === 'Total Imports') {
      const value = metric.label === 'Total Exports' ? exportsValue : importsValue;
      return {
        ...metric,
        value:
          value != null
            ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })
            : 'N/A',
        change: latestTradeYear || 'Unavailable',
        subtitle: `${metric.label.toLowerCase()} by fiscal year`,
      };
    }
    return metric;
  });

  const csvData = useMemo(
    () => [
      {
        Dataset: 'Key indicators',
        Indicator: 'Total Population',
        Value: `${(populationTotal / 1000000).toFixed(2)}M`,
        Period: `${populationGrowth >= 0 ? '+' : ''}${Number(populationGrowth || 0).toFixed(2)}% growth`,
      },
      {
        Dataset: 'Key indicators',
        Indicator: 'GDP Growth Rate',
        Value: gdpTrend.at(-1) ? `${Number(gdpTrend.at(-1).value).toFixed(1)}%` : 'N/A',
        Period: gdpTrend.at(-1)?.year || 'N/A',
      },
      {
        Dataset: 'Key indicators',
        Indicator: 'Total Exports',
        Value:
          exportsValue != null
            ? Number(exportsValue).toLocaleString(undefined, { maximumFractionDigits: 2 })
            : 'N/A',
        Period: latestTradeYear || 'N/A',
      },
      {
        Dataset: 'Key indicators',
        Indicator: 'Total Imports',
        Value:
          importsValue != null
            ? Number(importsValue).toLocaleString(undefined, { maximumFractionDigits: 2 })
            : 'N/A',
        Period: latestTradeYear || 'N/A',
      },
      ...gdpTrend.map((record) => ({
        Dataset: 'GDP trend',
        Year: record.year,
        Value: record.value,
        Unit: '%',
      })),
      ...provincePopulation.map((record) => ({
        Dataset: 'Population distribution',
        Province: record.name,
        Population: String(record.population).replace(/,/g, ''),
        Percentage: record.pct,
        Unit: 'people',
      })),
    ],
    [
      gdpTrend,
      provincePopulation,
      populationTotal,
      populationGrowth,
      exportsValue,
      importsValue,
      latestTradeYear,
    ]
  );

  const handleDownloadReport = () =>
    downloadNationalReport({
      fiscal_year: '',
      selected_indicators: ['population', 'gdp', 'gdp_growth'],
      selected_province: selectedProvince,
      filters: {},
    });

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage
        title="Failed to load data"
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <>
    <div className="space-y-6">
        {/* Hero Metrics */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((m) => (
            <MetricCard key={m.id} {...m} />
          ))}
        </section>

        {/* Map + News */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ProvinceMap
            selectedProvince={selectedProvince}
            onProvinceClick={handleProvinceClick}
            populationData={provincePopulation}
          />

          {/* News Feed */}
          <div className="bg-surface border border-outline-variant rounded-sm flex flex-col card-shadow hover:border-primary transition-colors duration-200">
            <div className="p-6 border-b border-outline-variant bg-surface-container-lowest">
              <h3 className="font-bold text-on-surface text-xl font-sans flex items-center gap-2">
                <Icon name="newspaper" size={24} color="#b70011" />
                National Headlines
              </h3>
              <p className="text-on-surface-variant text-[12px] font-sans">
                Latest policy updates &amp; reports
              </p>
            </div>

<div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              {newsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader size="sm" />
                </div>
              ) : news.length === 0 ? (
                <div className="p-4 text-sm text-onSurface-variant">
                  No recent headlines available right now.
                </div>
              ) : (
                news.map((article, index) => (
                  <NewsCard
                    key={`${article.url || article.title}-${index}`}
                    tag={article.source || 'News'}
                    tagColor="#b70011"
                    tagBg="#f0f0f0"
                    time={formatPublishedDate(article.published)}
                    headline={article.title}
                    onClick={() => {
                      if (article.url) {
                        window.open(article.url, '_blank', 'noopener,noreferrer');
                        return;
                      }

                      setSelectedNews({
                        ...article,
                        headline: article.title,
                        tag: article.source || 'News',
                        tagColor: '#b70011',
                        tagBg: '#f0f0f0',
                        time: formatPublishedDate(article.published),
                      });
                    }}
                  />
                ))
              )}
            </div>

            <button className="w-full py-4 bg-surface-container-lowest border-t border-outline-variant text-[12px] font-bold text-primary hover:bg-surface-container-high transition-colors font-sans flex items-center justify-center gap-2">
              <Icon name="arrow_forward" size={16} color="#b70011" />
            </button>
          </div>
        </section>

        {/* Secondary Analytics */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* GDP Trend Chart */}
          <div className="bg-surface border border-outline-variant rounded-sm p-6 card-shadow hover:border-primary transition-colors duration-200">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-lg font-bold text-on-surface font-sans">GDP Trend (5 Years)</h3>
                <p className="text-on-surface-variant text-[12px] font-sans">
                  Annual growth percentage (%)
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-primary rounded-full" />
                <span className="text-[10px] text-on-surface-variant font-bold uppercase font-sans">
                  Growth Rate
                </span>
              </div>
            </div>

            <div className="h-[300px]">
              <BarChart
                data={gdpTrend.map((record) => ({
                  ...record,
                  color: Number(record.value) < 0 ? '#b70011' : '#0051d5',
                }))}
                xKey="year"
                valueKey="value"
                color="#0051d5"
                bordered={false}
                height="100%"
              />
            </div>
          </div>

          {/* Population Distribution */}
          <div className="bg-surface border border-outline-variant rounded-sm p-6 card-shadow hover:border-primary transition-colors duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-on-surface font-sans">
                  Population Distribution
                </h3>
                <p className="text-on-surface-variant text-[12px] font-sans">
                  By Province (2021 Census)
                </p>
              </div>
              <span className="text-xs bg-surface-container-lowest px-3 py-1 rounded-sm border border-outline-variant text-on-surface-variant font-sans">
                Total:{' '}
                {populationTotal ? `${(populationTotal / 1000000).toFixed(2)}M` : 'Loading...'}
              </span>
            </div>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {provincePopulation.map((p) => (
                <ProgressBar
                  key={p.name}
                  name={p.name}
                  population={p.population}
                  pct={p.pct}
                  color={p.color}
                />
              ))}
            </div>
          </div>
        </section>

        <DataFooter
          csvData={csvData}
          csvFilename="national-dataset.csv"
          datasetLabel="National"
          reportTitle="National Dashboard Report"
          onDownloadReport={handleDownloadReport}
          reportMeta={{
            fiscalYear: latestTradeYear || gdpTrend.at(-1)?.year || '',
            selectedProvince: selectedProvince?.name || '',
            indicators: 'Population, GDP & trade',
          }}
        />
      </div>

      <NewsModal news={selectedNews} onClose={() => setSelectedNews(null)} />

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.3s ease-out; }
        .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </>
  );
}
