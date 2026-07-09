import React, { useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { SectionCard } from '../components/ui/Card';
import { TabBtn } from '../components/ui/Tabs';
import { BtnPrimary, BtnOutline } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import LineChart from '../components/charts/LineChart';
import { GDP_DATA, FORECAST_DATA } from '../data/dummyData';

const INDICATOR_LABELS = {
  gdp: 'GDP Growth (%)',
  inflation: 'Inflation (%)',
  tourism: 'Tourist Arrivals (×100K)',
};

const INDICATOR_COLORS = {
  gdp: '#0051d5',
  inflation: '#7a5100',
  tourism: '#b70011',
};

// Forecast line always renders in this color, regardless of indicator,
// so it's visually distinct from the historical line at a glance.
const FORECAST_COLOR = '#1a7a3c';

const HORIZON_TO_COUNT = { 6: 1, 12: 2, 24: 3 };

function downloadCSV(rows, filename) {
  const header = Object.keys(rows[0]).join(',');
  const body = rows.map((r) => Object.values(r).join(',')).join('\n');
  const csv = `${header}\n${body}`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Predictions() {
  const [type, setType] = useState('gdp');
  const [horizon, setHorizon] = useState(12);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handlePredict = () => {
    setLoading(true);
    setDone(false);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
    }, 1800);
  };

  const forecastItems = FORECAST_DATA.slice(0, HORIZON_TO_COUNT[horizon]);

  const historicalRows = GDP_DATA.map((d) => ({
    year: d.year,
    hist: type === 'gdp' ? d.value : type === 'inflation' ? d.inflation : d.tourism / 100,
    forecast: null,
  }));

  const bridgeRow = historicalRows.length
    ? {
        year: historicalRows[historicalRows.length - 1].year,
        hist: null,
        forecast: historicalRows[historicalRows.length - 1].hist,
      }
    : null;

  const forecastRows = forecastItems.map((d) => ({
    year: d.year,
    hist: null,
    forecast: type === 'gdp' ? d.gdp : type === 'inflation' ? d.inflation : d.tourism / 100,
  }));

  const allData = bridgeRow
    ? [...historicalRows.slice(0, -1), bridgeRow, ...forecastRows]
    : [...historicalRows, ...forecastRows];

  const label = INDICATOR_LABELS[type];
  const color = INDICATOR_COLORS[type];

  const handleDownload = () => {
    const exportRows = allData.map((d) => ({
      year: d.year,
      value: d.hist !== null ? d.hist : d.forecast,
      type: d.hist !== null ? 'historical' : 'forecast',
    }));
    downloadCSV(exportRows, `${type}-forecast-${horizon}mo.csv`);
  };

  return (
    <DashboardLayout pageTitle="AI Predictions">
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-onSurface">AI Predictions</h3>
          <p className="text-onSurface-variant text-sm">
            Machine learning forecasts trained on 10+ years of NRB, CBS, and DoT data
          </p>
        </div>

        <SectionCard
          title="Configure Forecast"
          subtitle="Choose what to predict and how far ahead, then generate the model output"
          className="rounded-sm"
        >
          <div className="flex flex-wrap gap-8 items-end mb-4">
            <div>
              <div className="text-xs font-bold uppercase text-onSurface-variant mb-2.5">
                1. What to predict
              </div>
              <div className="flex border border-outline-variant rounded-sm divide-x divide-outline-variant">
                {[
                  ['gdp', 'GDP'],
                  ['inflation', 'Inflation'],
                  ['tourism', 'Tourism'],
                ].map(([v, l]) => (
                  <TabBtn key={v} active={type === v} onClick={() => { setType(v); setDone(false); }}>
                    {l}
                  </TabBtn>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase text-onSurface-variant mb-2.5">
                2. How far ahead
              </div>
              <div className="flex border border-outline-variant rounded-sm divide-x divide-outline-variant">
                {[
                  [6, '6 Mo'],
                  [12, '12 Mo'],
                  [24, '24 Mo'],
                ].map(([v, l]) => (
                  <TabBtn key={v} active={horizon === v} onClick={() => { setHorizon(v); setDone(false); }}>
                    {l}
                  </TabBtn>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-surface-lowest border border-outline-variant rounded-sm">
            <Icon name="info" size={16} color="#5c403c" />
            <p className="text-xs text-onSurface-variant">
              Clicking <strong>Generate Forecast</strong> will run the model for{' '}
              <strong>{label}</strong> over the next <strong>{horizon} months</strong> and plot
              historical data alongside the AI-predicted trend below.
            </p>
          </div>

          <div className="flex items-end gap-3">
            <BtnPrimary onClick={handlePredict} className="gap-2 rounded-sm" disabled={loading}>
              {loading ? (
                <>
                  <Icon name="refresh" size={16} color="#fff" className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Icon name="auto_awesome" size={16} color="#fff" />
                  Generate Forecast
                </>
              )}
            </BtnPrimary>

            {done && (
              <BtnOutline
                onClick={handleDownload}
                className="gap-2 rounded-sm"
                title={`Download ${label} historical + forecast data as CSV`}
              >
                <Icon name="download" size={14} />
                Download Forecast CSV
              </BtnOutline>
            )}
          </div>
        </SectionCard>

        {done && (
          <>
            <SectionCard
              title={`${label} — Historical + AI Forecast`}
              subtitle="Solid line = historical · Dashed green line = AI forecast"
              className="rounded-sm"
            >
              <LineChart
                data={allData}
                xKey="year"
                series={[
                  { key: 'hist', color, label: 'Historical' },
                  { key: 'forecast', color: FORECAST_COLOR, label: 'Forecast', dashed: true },
                ]}
                height={280}
              />
            </SectionCard>

            <div className={`grid grid-cols-1 sm:grid-cols-${forecastItems.length} gap-4`}>
              {forecastItems.map((d, i) => (
                <div
                  key={i}
                  className="bg-surface border border-outline-variant rounded-sm p-5 card-shadow"
                  style={{ borderTop: `3px solid ${FORECAST_COLOR}` }}
                >
                  <div className="text-xs font-bold uppercase text-onSurface-variant mb-1.5">
                    {d.year} Forecast
                  </div>
                  <div className="text-3xl font-bold text-onSurface">
                    {type === 'gdp' ? `${d.gdp}%` : type === 'inflation' ? `${d.inflation}%` : `${d.tourism}K`}
                  </div>
                  {type === 'gdp' && (
                    <div className="text-xs text-onSurface-variant mt-1">
                      Range: {d.low}% – {d.high}%
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    <Icon name="trending_up" size={14} color={FORECAST_COLOR} />
                    <span className="text-xs font-bold" style={{ color: FORECAST_COLOR }}>
                      Positive outlook
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <SectionCard title="Model Reasoning" subtitle="What drives this forecast" className="rounded-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { factor: 'Remittance inflows', impact: '+', detail: 'Steady 10–12% YoY growth supports consumption demand' },
                  { factor: 'Hydropower exports', impact: '+', detail: 'New cross-border transmission agreements coming online' },
                  { factor: 'Trade deficit', impact: '−', detail: 'Import dependency remains structurally elevated' },
                  { factor: 'Monsoon variability', impact: '?', detail: 'Agriculture accounts for 26% of GDP — weather risk persists' },
                ].map((f, i) => (
                  <div
                    key={i}
                    className="p-3.5 bg-surface-lowest border border-outline-variant rounded-sm"
                    style={{ borderLeft: `3px solid ${f.impact === '+' ? FORECAST_COLOR : f.impact === '−' ? '#b70011' : '#7a5100'}` }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-lg font-extrabold"
                        style={{ color: f.impact === '+' ? FORECAST_COLOR : f.impact === '−' ? '#b70011' : '#7a5100' }}
                      >
                        {f.impact}
                      </span>
                      <span className="text-sm font-bold text-onSurface">{f.factor}</span>
                    </div>
                    <p className="text-xs text-onSurface-variant leading-relaxed">{f.detail}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </>
        )}

        {!done && !loading && (
          <div className="border-2 border-dashed border-outline-variant rounded-sm p-16 text-center">
            <Icon name="auto_awesome" size={48} color="#916f6b" className="block mx-auto mb-4" />
            <div className="text-base font-bold text-onSurface-variant mb-1.5">
              Select parameters above and click Generate Forecast
            </div>
            <div className="text-sm text-onSurface-variant opacity-70">
              Models trained on NRB, CBS, and World Bank data (2010–2023)
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}