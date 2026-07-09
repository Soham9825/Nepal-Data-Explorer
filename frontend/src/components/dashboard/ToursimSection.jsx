import React, { useState } from 'react';
import { TOURISM_STATS, TOURISM_ITEMS, GDP_DATA } from '../../data/dummyData';
import { SectionCard } from '../ui/Card';
import { TabBtn } from '../ui/Tabs';
import { Icon } from '../ui/Icon';
import { ProgBar } from '../ui/ProgressBar';
import AreaChart from '../charts/AreaChart';

export default function TourismSection() {
  const [tourTab, setTourTab] = useState('arrivals');

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[22px] font-extrabold text-onSurface flex items-center gap-2.5">
            <Icon name="flight" size={22} color="#b70011" />
            Tourism Overview
          </div>
          <div className="text-[12px] text-onSurface-variant mt-0.5">
            Source: Department of Tourism (DoT) · Nepal Rastra Bank — FY 2022/23
          </div>
        </div>
        <div className="flex border border-outline-variant">
          {[
            ['arrivals', 'Arrivals Trend'],
            ['destinations', 'Top Destinations'],
            ['revenue', 'Revenue'],
          ].map(([id, lb]) => (
            <TabBtn key={id} active={tourTab === id} onClick={() => setTourTab(id)}>
              {lb}
            </TabBtn>
          ))}
        </div>
      </div>

      {/* Tourism KPI cards */}
      <section className="grid grid-cols-4 gap-4">
        {TOURISM_STATS.map((s, i) => (
          <div
            key={i}
            className="bg-surface border border-outline-variant p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)]"
            style={{ borderTop: `3px solid #7a5100` }}
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-onSurface-variant">
                {s.label}
              </span>
              <Icon name={s.icon} size={20} color="#7a5100" />
            </div>
            <div className="text-[28px] font-bold text-onSurface tracking-[-0.01em]">{s.value}</div>
            <div className="mt-2 flex items-center gap-1.5">
              <Icon
                name={s.up ? 'trending_up' : 'trending_down'}
                size={14}
                color={s.up ? '#0051d5' : '#b70011'}
              />
              <span className="text-[12px] font-bold" style={{ color: s.up ? '#0051d5' : '#b70011' }}>
                {s.change}
              </span>
              <span className="text-[11px] text-onSurface-variant">{s.sub}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Tourism chart / destinations */}
      <section className="grid grid-cols-[3fr_2fr] gap-6">
        <SectionCard
          title={
            tourTab === 'arrivals'
              ? 'Tourist Arrivals (thousands)'
              : tourTab === 'destinations'
              ? 'Top Destinations by Arrivals'
              : 'Tourism Revenue ($M)'
          }
          subtitle="Department of Tourism (DoT) · 2019–2023 actual data"
        >
          <AreaChart 
            data={GDP_DATA} 
            xKey="year" 
            yKey="tourism" 
            color="#7a5100" 
          />
        </SectionCard>

        <SectionCard title="Top 5 Destinations" subtitle="Share of total arrivals · DoT 2023">
          <div className="flex flex-col gap-3.5">
            {TOURISM_ITEMS.map((d, i) => (
              <div key={i}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="flex items-center gap-1.5 text-[13px] font-bold text-onSurface">
                    <Icon name={d.icon} size={16} color={d.color} />
                    {d.label.split('(')[0].trim()}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-secondary">{d.trend}</span>
                    <span className="text-[12px] font-bold text-onSurface-variant">{d.arrivals}</span>
                  </div>
                </div>
                <ProgBar value={d.pct} color={d.color} total={35} />
              </div>
            ))}
          </div>
          <div className="mt-5 p-3 bg-surface-lowest border border-outline-variant" style={{ borderLeft: '3px solid #7a5100' }}>
            <div className="text-[11px] font-bold text-tertiary uppercase tracking-[0.05em] mb-1">
              2024 Forecast
            </div>
            <div className="text-[13px] text-onSurface leading-[1.55]">
              Arrivals projected to reach <strong>1.18M</strong> — up ~17% — as Pokhara International Airport scales operations and Himalayan trekking demand rises.
            </div>
          </div>
        </SectionCard>
      </section>
    </>
  );
}