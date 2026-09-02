import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { SectionCard } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Tag } from '../components/ui/Tag';
import { BtnOutline } from '../components/ui/Button';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import DataFooter from '../components/common/DataFooter';
import { getPlaceIcon } from '../utils/iconMap';

import { tourismAPI } from '../services/tourismAPI';

const TABS = [
  { id: 'arrivals', label: 'Tourist Arrivals Trend' },
  { id: 'source-markets', label: 'Top Source Markets' },
  { id: 'revenue', label: 'Revenue Trend' },
];

const CHART_META = {
  arrivals: {
    title: 'Tourist Arrivals Trend',
  },
  'source-markets': {
    title: 'Top Source Markets',
  },
  revenue: {
    title: 'Tourism Revenue Trend',
  },
};

export default function Tourism() {
  const [activeTab, setActiveTab] = useState('arrivals');
  const { title: chartTitle } = CHART_META[activeTab];
  const [loading, setLoading] = useState(true);
  const [tourismData, setTourismData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await tourismAPI.getDashboardData();
        if (!mounted) return;
        setTourismData(data);
      } catch (err) {
        console.error('Could not load tourism data', err);
        if (mounted) setError('Tourism data could not be loaded from the database.');
        setTourismData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  const arrivalTrend = tourismData?.arrival_trend || [];
  const sourceMarketYear = arrivalTrend.at(-1)?.year;
  const sourceMarkets = (tourismData?.nationality_trend || [])
    .filter((record) => record.year === sourceMarketYear && record.arrivals !== null && record.arrivals !== undefined)
    .sort((first, second) => second.arrivals - first.arrivals);
  const revenueTrend = (tourismData?.revenue || []).filter(
    (record) => record.metric === 'US$_Million' && record.value !== null && record.value !== undefined,
  );
  const kpis = tourismData?.kpis;
  const arrivalYears = arrivalTrend.map((record) => record.year).filter(Boolean);
  const revenuePeriods = revenueTrend.map((record) => record.fiscal_year).filter(Boolean);
  const latestRevenue = revenueTrend.at(-1);
  const chartSubtitle = activeTab === 'arrivals'
    ? `Annual arrivals${arrivalYears.length ? ` (${Math.min(...arrivalYears)}–${Math.max(...arrivalYears)})` : ''}`
    : activeTab === 'revenue'
      ? `Tourism revenue (US$ millions)${revenuePeriods.length ? ` (${revenuePeriods[0]}–${revenuePeriods.at(-1)})` : ''}`
      : 'Annual visitor counts by site';
  const maxSourceArrivals = Math.max(...sourceMarkets.map((market) => market.arrivals), 0);
  const sourceMarketItems = sourceMarkets.map((market) => ({
    label: market.nationality,
    arrivals: market.arrivals,
    color: '#7a5100',
    province: 'Source market',
    pct: market.percent ?? (maxSourceArrivals ? (market.arrivals / maxSourceArrivals) * 100 : 0),
    trendUp: true,
    trend: '',
  }));

  return (
    <DashboardLayout pageTitle="Tourism">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-2xl font-bold text-onSurface font-hanken">
            Tourism Statistics
          </h3>
          <p className="text-onSurface-variant text-sm font-hanken">
            Source: Department of Tourism and Nepal Rastra Bank
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Tourists', value: kpis?.total_tourists ?? '—', icon: 'flight', up: true, change: '', sub: '' },
            { label: 'Growth %', value: kpis?.growth_percent ?? '—', icon: 'trending_up', up: (kpis?.growth_percent || 0) >= 0, change: '', sub: '' },
            { label: 'Top Source', value: kpis?.top_source_country?.nationality || '—', icon: 'map', up: true, change: '', sub: '' },
            { label: 'Latest Revenue', value: latestRevenue ? `$${latestRevenue.value}M` : '—', icon: 'payments', up: true, change: '', sub: latestRevenue?.fiscal_year || '' },
          ].map((stat, index) => (
            <div
              key={index}
              className="bg-surface border border-outline-variant rounded-sm p-5 card-shadow"
              style={{ borderTop: '3px solid #7a5100' }}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-bold uppercase text-onSurface-variant tracking-wider font-hanken">
                  {stat.label}
                </span>
                <Icon name={stat.icon} size={20} color="#7a5100" />
              </div>
              <p className="text-2xl font-bold text-onSurface font-hanken">{stat.value}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Icon
                  name={stat.up ? 'trending_up' : 'trending_down'}
                  size={14}
                  color={stat.up ? '#0f7a3d' : '#b70011'}
                />
                <span
                  className="text-sm font-bold font-hanken"
                  style={{ color: stat.up ? '#0f7a3d' : '#b70011' }}
                >
                  {stat.change}
                </span>
                <span className="text-xs text-onSurface-variant font-hanken">{stat.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-outline-variant">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-6 py-3 text-sm font-medium font-hanken transition-colors duration-200 border-b-2 ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-onSurface-variant hover:text-onSurface'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Charts and source-market list */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
          {/* Chart Section */}
         
          <SectionCard
            title={chartTitle}
            subtitle={chartSubtitle}
            className="h-full rounded-sm flex flex-col"
          >
            <div className="border border-outline-variant rounded-sm bg-surface flex-1 min-h-[256px]">
              {activeTab === 'arrivals' && (
                <LineChart
                    data={arrivalTrend.map((record) => ({ year: record.year, tourism: record.total_arrivals }))}
                  xKey="year"
                  series={[{ key: 'tourism', color: '#7a5100', label: 'Arrivals' }]}
                  height="100%"
                />
              )}

              {activeTab === 'source-markets' && (
                <BarChart
                  data={sourceMarkets.map((market) => ({ name: market.nationality, arrivals: market.arrivals, color: '#7a5100' }))}
                  labelKey="name"
                  valueKey="arrivals"
                  height="100%"
                  bordered={false}
                />
              )}

              {activeTab === 'revenue' && (
                <LineChart
                  data={revenueTrend.map((record) => ({ year: record.fiscal_year, revenue: record.value }))}
                  xKey="year"
                  series={[{ key: 'revenue', color: '#b70011', label: 'Revenue (US$ millions)' }]}
                  height="100%"
                />
              )}
            </div>
          </SectionCard>
            

          {/* Top Source Markets */}
          <SectionCard
            title="Top Source Markets"
            subtitle={sourceMarketYear ? `Annual arrivals by nationality (${sourceMarketYear})` : 'Annual arrivals by nationality'}
            className="h-full rounded-sm"
          >
            <div className="max-h-[320px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              <div className="space-y-3">
                {sourceMarketItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-surface-lowest rounded-sm border border-outline-variant hover:border-tertiary transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <Icon name={getPlaceIcon(item.label)} size={18} color={item.color} />
                        <span className="text-sm font-bold text-onSurface font-hanken truncate">
                          {item.label}
                        </span>
                        <Tag
                          label={item.province || 'Province'}
                          color={item.color}
                          bg={`${item.color}1A`}
                          className="text-[10px] px-2 py-0.5 rounded-sm font-hanken whitespace-nowrap"
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-lg font-bold text-onSurface font-hanken">
                          {item.arrivals}
                        </span>
                        <span
                          className="text-xs font-semibold font-hanken"
                          style={{ color: item.trendUp ? '#0f7a3d' : '#b70011' }}
                        >
                          {item.trend}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <ProgressBar value={item.pct} color={item.color} total={100} />
                      </div>
                    </div>
                    <div className="ml-3 flex-shrink-0">
                      <Icon name="chevron_right" size={20} color="#916f6b" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <BtnOutline className="text-xs px-4 py-1.5 rounded-sm font-hanken">
                View All →
              </BtnOutline>
            </div>
          </SectionCard>
        </div>

        <DataFooter />
        {error && <p className="text-sm text-danger">{error}</p>}
        {!loading && !error && !tourismData && <p className="text-sm text-onSurface-variant">No tourism data is available.</p>}
      </div>
    </DashboardLayout>
  );
}