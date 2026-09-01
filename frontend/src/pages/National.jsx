import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
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
import {
  nationalMetrics,
  GDP_DATA,
  PROVINCES,
} from '../data/dummyData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const NEWS_API_URL = `${API_BASE_URL}/api/news/`;
const POPULATION_API_URL = `${API_BASE_URL}/api/datasets/population-summary/`;
const PROVINCE_POPULATION_API_URL = `${API_BASE_URL}/api/datasets/province-population-summary/`;
const ECONOMIC_API_URL = `${API_BASE_URL}/api/analytics/economic/`;
const FALLBACK_GDP_TREND = GDP_DATA.map((d) => ({ year: d.year, value: d.value }));
const FALLBACK_NEPAL_POPULATION = 29164578;
const PROV_COLORS = ['#b70011', '#0051d5', '#7a5100', '#316bf3', '#9a6800', '#5c403c', '#dc2626'];
const FALLBACK_PROVINCE_POPULATION = [
  { name: 'Province-1', population: '4,961,412', pct: 17.0, color: PROV_COLORS[0] },
  { name: 'Madhesh', population: '6,114,600', pct: 21.0, color: PROV_COLORS[1] },
  { name: 'Bagmati', population: '6,116,866', pct: 21.0, color: PROV_COLORS[2] },
  { name: 'Gandaki', population: '2,466,427', pct: 8.5, color: PROV_COLORS[3] },
  { name: 'Lumbini', population: '5,122,078', pct: 17.5, color: PROV_COLORS[4] },
  { name: 'Karnali', population: '1,688,412', pct: 5.8, color: PROV_COLORS[5] },
  { name: 'Sudur Paschim', population: '2,694,783', pct: 9.2, color: PROV_COLORS[6] },
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
  const [error, setError] = useState(null);
  const [news, setNews] = useState([]);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedNews, setSelectedNews] = useState(null);
  const [populationTotal, setPopulationTotal] = useState(FALLBACK_NEPAL_POPULATION);
  const [populationGrowth, setPopulationGrowth] = useState(0.92);
  const [gdpTrend, setGdpTrend] = useState(FALLBACK_GDP_TREND);
  const [provincePopulation, setProvincePopulation] = useState(FALLBACK_PROVINCE_POPULATION);

  useEffect(() => {
    const fetchPopulation = async () => {
      try {
        const response = await fetch(POPULATION_API_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
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
            'Accept': 'application/json',
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
            name: province.name,
            population: Number(province.total_population || 0).toLocaleString(),
            pct: Number(province.pct || 0),
            density: province.population_density != null ? Number(province.population_density) : null,
            color: PROV_COLORS[index % PROV_COLORS.length],
          }));
          setProvincePopulation(mapped);
        }
      } catch (err) {
        console.error('Failed to load province population summary:', err);
        setProvincePopulation(FALLBACK_PROVINCE_POPULATION);
      }
    };

    const fetchEconomicData = async () => {
      try {
        const response = await fetch(ECONOMIC_API_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Economic API error: ${response.status}`);
        }

        const data = await response.json();
        const macroSeries = Array.isArray(data?.macro_series) ? data.macro_series : [];

        const parsedTrend = macroSeries
          .filter((item) => Number.isFinite(Number(item.value)))
          .map((item) => {
            const yearMatch = String(item.period_label || item.published_year || '').match(/(19|20)\d{2}/);
            return {
              year: yearMatch ? yearMatch[0] : String(item.published_year || 'N/A'),
              value: Number(item.value),
            };
          })
          .filter((item) => item.year !== 'N/A')
          .slice(-5);

        if (parsedTrend.length > 0) {
          setGdpTrend(parsedTrend);
        }
      } catch (err) {
        console.error('Failed to load economic GDP data:', err);
        setGdpTrend(FALLBACK_GDP_TREND);
      }
    };

    const fetchNews = async () => {
      try {
        const response = await fetch(NEWS_API_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
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
        setError(err.message || 'Unable to load national headlines.');
        setNews([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPopulation();
    fetchProvincePopulation();
    fetchEconomicData();
    fetchNews();
  }, []);

  const handleProvinceClick = (provinceId) => {
    const province = PROVINCES.find((p) => p.id === provinceId);
    setSelectedProvince(province);
  };

  const metrics = nationalMetrics.map((metric) => {
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
    return metric;
  });

  if (loading) {
    return (
      <DashboardLayout pageTitle="National Dashboard">
        <Loader fullScreen />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout pageTitle="National Dashboard">
        <ErrorMessage
          title="Failed to load data"
          message={error}
          onRetry={() => window.location.reload()}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout pageTitle="National Dashboard" breadcrumbs={['Dashboard']}>
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
              <p className="text-on-surface-variant text-[12px] font-sans">Latest policy updates &amp; reports</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              {news.length === 0 ? (
                <div className="p-4 text-sm text-on-surface-variant">No recent headlines available right now.</div>
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
              View All Feed
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
                <p className="text-on-surface-variant text-[12px] font-sans">Annual growth percentage (%)</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-primary rounded-full" />
                <span className="text-[10px] text-on-surface-variant font-bold uppercase font-sans">Growth Rate</span>
              </div>
            </div>

            <div className="h-[300px]">
              <BarChart
                data={gdpTrend}
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
                <h3 className="text-lg font-bold text-on-surface font-sans">Population Distribution</h3>
                <p className="text-on-surface-variant text-[12px] font-sans">By Province (2021 Census)</p>
              </div>
              <span className="text-xs bg-surface-container-lowest px-3 py-1 rounded-sm border border-outline-variant text-on-surface-variant font-sans">
                Total: {populationTotal ? `${(populationTotal / 1000000).toFixed(2)}M` : 'Loading...'}
              </span>
            </div>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {provincePopulation.map((p) => (
                <ProgressBar key={p.name} name={p.name} population={p.population} pct={p.pct} color={p.color} />
              ))}
            </div>
          </div>
        </section>

        <DataFooter />
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
    </DashboardLayout>
  );
}