import React, { useState } from 'react';
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

import {
  TOURISM_STATS,
  TOURISM_ITEMS,
  ARRIVALS_HISTORY,
  REVENUE_HISTORY,
} from '../data/tourismData';

const TABS = [
  { id: 'arrivals', label: 'Tourist Arrivals Trend' },
  { id: 'destinations', label: 'Top Destinations' },
  { id: 'revenue', label: 'Revenue Trend' },
];

const CHART_META = {
  arrivals: {
    title: 'Tourist Arrivals Trend',
    subtitle: 'Annual arrivals (2019–2023)',
  },
  destinations: {
    title: 'Top Destinations',
    subtitle: 'Annual visitor counts by site',
  },
  revenue: {
    title: 'Tourism Revenue Trend',
    subtitle: 'Annual revenue, USD millions (2018–2025)',
  },
};

export default function Tourism() {
  const [activeTab, setActiveTab] = useState('arrivals');
  const { title: chartTitle, subtitle: chartSubtitle } = CHART_META[activeTab];

  return (
    <DashboardLayout pageTitle="Tourism">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-2xl font-bold text-onSurface font-hanken">
            Tourism Statistics
          </h3>
          <p className="text-onSurface-variant text-sm font-hanken">
            Source: Dept. of Tourism (DoT) · Nepal Rastra Bank — FY 2022/23
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TOURISM_STATS.map((stat, index) => (
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

        {/* Charts and Destinations Grid */}
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
                  data={ARRIVALS_HISTORY}
                  xKey="year"
                  series={[{ key: 'tourism', color: '#7a5100', label: 'Arrivals (K)' }]}
                  height="100%"
                />
              )}

              {activeTab === 'destinations' && (
                <BarChart
                  data={TOURISM_ITEMS.map((d) => ({
                    name: d.label,
                    arrivals: parseInt(d.arrivals.replace(/,/g, ''), 10),
                    color: d.color,
                  }))}
                  labelKey="name"
                  valueKey="arrivals"
                  height="100%"
                  bordered={false}
                />
              )}

              {activeTab === 'revenue' && (
                <LineChart
                  data={REVENUE_HISTORY}
                  xKey="year"
                  series={[{ key: 'revenue', color: '#b70011', label: 'Revenue (USD M)' }]}
                  height="100%"
                />
              )}
            </div>
          </SectionCard>
            

          {/* Top Destinations */}
          <SectionCard
            title="Top Destinations"
            subtitle="Annual visitor counts by site"
            className="h-full rounded-sm"
          >
            <div className="max-h-[320px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              <div className="space-y-3">
                {TOURISM_ITEMS.map((item, index) => (
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
      </div>
    </DashboardLayout>
  );
}