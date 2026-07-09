import React, { useState, useMemo } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { SectionCard } from '../components/ui/Card';
import { BtnPrimary } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import AreaChart from '../components/charts/AreaChart';
import { GDP_DATA } from '../data/dummyData';

function pearsonCorrelation(xs, ys) {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const denom = Math.sqrt(denX * denY);
  return denom === 0 ? 0 : num / denom;
}

function correlationLabel(r) {
  const abs = Math.abs(r);
  if (abs >= 0.7) return 'strong';
  if (abs >= 0.4) return 'moderate';
  if (abs >= 0.2) return 'weak';
  return 'negligible';
}

export default function Compare() {
  const [a, setA] = useState('gdp');
  const [b, setB] = useState('inflation');
  const [done, setDone] = useState(false);

  const inds = {
    gdp: { label: 'GDP Growth %', key: 'value', color: '#0051d5' },
    inflation: { label: 'Inflation %', key: 'inflation', color: '#7a5100' },
    exports: { label: 'Exports $B', key: 'exports', color: '#22C55E' },
    imports: { label: 'Imports $B', key: 'imports', color: '#b70011' },
    tourism: { label: 'Tourism K', key: 'tourism', color: '#316bf3' },
  };

  const correlation = useMemo(() => {
    const xs = GDP_DATA.map((d) => Number(d[inds[a].key]));
    const ys = GDP_DATA.map((d) => Number(d[inds[b].key]));
    return pearsonCorrelation(xs, ys);
  }, [a, b]);

  const direction = correlation >= 0 ? 'positive' : 'inverse';
  const strength = correlationLabel(correlation);
  const barPct = Math.round(((correlation + 1) / 2) * 100);

  const Sel = ({ val, onChange }) => (
    <div className="relative">
      <select
        value={val}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none px-3 py-2 pr-8 border border-outline-variant rounded-sm font-sans text-sm font-bold text-onSurface bg-surface cursor-pointer outline-none"
      >
        {Object.entries(inds).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>
      <Icon name="expand_more" size={14} color="#5c403c" className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );

  return (
    <DashboardLayout pageTitle="Compare Indicators">
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-onSurface">Compare Indicators</h3>
          <p className="text-onSurface-variant text-sm">Side-by-side comparison with correlation analysis</p>
        </div>

        <SectionCard title="Select Indicators" subtitle="Choose two economic indicators to compare" className="rounded-sm">
          <div className="flex items-center gap-5 flex-wrap">
            <div>
              <div className="text-xs font-bold uppercase text-onSurface-variant mb-2">Indicator A</div>
              <Sel val={a} onChange={(v) => { setA(v); setDone(false); }} />
            </div>
            <div className="text-lg text-onSurface-variant font-bold mt-5">vs</div>
            <div>
              <div className="text-xs font-bold uppercase text-onSurface-variant mb-2">Indicator B</div>
              <Sel val={b} onChange={(v) => { setB(v); setDone(false); }} />
            </div>
            <BtnPrimary onClick={() => setDone(true)} className="mt-5 rounded-sm">
              <Icon name="compare_arrows" size={16} color="#fff" />
              Generate Comparison
            </BtnPrimary>
          </div>
        </SectionCard>

        {done && (
          <>
            <div className="grid grid-cols-2 gap-6">
              <SectionCard title={inds[a].label} subtitle="Annual data 2019–2023 · NRB / CBS Nepal" className="rounded-sm">
                <AreaChart data={GDP_DATA} xKey="year" yKey={inds[a].key} color={inds[a].color} />
              </SectionCard>
              <SectionCard title={inds[b].label} subtitle="Annual data 2019–2023 · NRB / CBS Nepal" className="rounded-sm">
                <AreaChart data={GDP_DATA} xKey="year" yKey={inds[b].key} color={inds[b].color} />
              </SectionCard>
            </div>

            <div className="grid grid-cols-[1fr_2fr] gap-6">
              <SectionCard title="Correlation Score" subtitle="Pearson r — 2019 to 2023" className="rounded-sm">
                <div className="text-center py-4">
                  <div className="text-6xl font-extrabold text-onSurface">{correlation.toFixed(2)}</div>
                  <div className="text-sm text-onSurface-variant mb-4 capitalize">
                    {strength} {direction} correlation
                  </div>
                  <div className="h-2 bg-surface-highest rounded-full overflow-hidden mx-4">
                    <div
                      className="h-full bg-secondary rounded-full transition-all duration-300"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-onSurface-variant mt-1 font-bold px-4">
                    <span>−1 (inverse)</span>
                    <span>+1 (perfect)</span>
                  </div>
                </div>
              </SectionCard>
              <SectionCard title="Correlation Analysis" subtitle="Statistical interpretation" className="rounded-sm">
                <div className="flex items-start gap-3 p-1">
                  <Icon name="analytics" size={24} color="#0051d5" />
                  <p className="text-sm text-onSurface leading-relaxed">
                    <strong>{inds[a].label}</strong> and <strong>{inds[b].label}</strong> show a {strength}{' '}
                    {direction} correlation (r = {correlation.toFixed(2)}) over the 2019–2023 period.{' '}
                    {Math.abs(correlation) >= 0.4
                      ? `Movement in one series tends to ${direction === 'positive' ? 'align with' : 'move opposite to'} the other across most years in this range.`
                      : `The relationship is weak enough that other factors likely explain most of the year-to-year variation between these two series.`}
                  </p>
                </div>
              </SectionCard>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}