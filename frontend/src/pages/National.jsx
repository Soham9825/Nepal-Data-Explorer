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
  nationalNews,
  gdpTrend,
  provincePopulation,
  PROVINCES,
} from '../data/dummyData';

export default function National() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedNews, setSelectedNews] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleProvinceClick = (provinceId) => {
    const province = PROVINCES.find((p) => p.id === provinceId);
    setSelectedProvince(province);
  };

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
          {nationalMetrics.map((m) => (
            <MetricCard key={m.id} {...m} />
          ))}
        </section>

        {/* Map + News */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ProvinceMap selectedProvince={selectedProvince} onProvinceClick={handleProvinceClick} />

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
              {nationalNews.map((news) => (
                <NewsCard
                  key={news.id}
                  tag={news.tag || news.category}
                  tagColor={news.tagColor || '#b70011'}
                  tagBg={news.tagBg || '#f0f0f0'}
                  time={news.time || news.date}
                  headline={news.headline || news.title}
                  icon={news.icon}
                  description={news.description}
                  readTime={news.readTime}
                  onClick={() => setSelectedNews(news)}
                />
              ))}
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
                Total: 29.16M
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