import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { SectionCard } from '../components/ui/Card';
import { TabBtn } from '../components/ui/Tabs';
import { BtnPrimary, BtnOutline } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import LineChart from '../components/charts/LineChart';
import { formatCountryName } from '../utils/countryFlags';

const INDICATOR_LABELS = {
  monthly: 'Monthly Tourist Arrivals',
  nationality: 'Tourist Arrivals by Nationality',
};

const INDICATOR_COLOR = '#0051d5';
const CHART_DOMAIN_START = Date.UTC(2015, 0, 1);
const CHART_DOMAIN_END = Date.UTC(2026, 11, 31);

// Forecast line always renders in this color, regardless of indicator,
// so it's visually distinct from the historical line at a glance.
const FORECAST_COLOR = '#72b982';

function downloadCSV(rows, filename) {
  if (!rows.length) return;
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
  const [type, setType] = useState('monthly');
  const [nationality, setNationality] = useState('India');
  const [monthlyYear, setMonthlyYear] = useState('');
  const [monthlyHistory, setMonthlyHistory] = useState([]);
  const [monthlyForecast, setMonthlyForecast] = useState([]);
  const [nationalityHistory, setNationalityHistory] = useState([]);
  const [nationalityForecast, setNationalityForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    Promise.all([
      fetch(`${apiBaseUrl}/api/analytics/forecasts/`).then((response) => response.json()),
      fetch(`${apiBaseUrl}/api/analytics/tourism/`).then((response) => response.json()),
    ])
      .then(([forecastData, tourismData]) => {
        setMonthlyForecast(forecastData.monthly || []);
        setNationalityForecast(forecastData.nationality || []);
        setMonthlyHistory((tourismData.monthly_trend || []).filter((item) => item.year >= 2015));
        setNationalityHistory((tourismData.nationality_trend || []).filter((item) => item.year >= 2015 && item.nationality !== 'Total'));
        setDone(true);
      })
      .catch((error) => console.error('Unable to load forecasts:', error))
      .finally(() => setLoading(false));
  }, []);

  const selectedNationalityForecast = nationalityForecast
    .filter((item) => item.topic === nationality)
    .sort((a, b) => Date.UTC(a.target_year, a.target_month - 1, 1) - Date.UTC(b.target_year, b.target_month - 1, 1));
  const selectedNationalityHistory = nationalityHistory
    .filter((item) => item.nationality === nationality)
    .sort((a, b) => a.year - b.year);
  const monthlyYears = [...new Set([
    ...monthlyHistory.map((item) => String(item.year)),
    ...monthlyForecast.map((item) => String(item.year)),
  ])].sort();
  const selectedMonthlyYear = monthlyYears.includes(monthlyYear) ? monthlyYear : monthlyYears.at(-1) || '';
  const selectedMonthlyHistory = monthlyHistory.filter((item) => String(item.year) === selectedMonthlyYear);
  const selectedMonthlyForecast = monthlyForecast.filter((item) => String(item.year) === selectedMonthlyYear);
  const forecastItems = type === 'monthly' ? selectedMonthlyForecast : selectedNationalityForecast;
  const monthNumbers = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const toMonthTimestamp = (year, month) => Date.UTC(year, Number(monthNumbers[month.slice(0, 3)] || month) - 1, 1);
  const historicalRows = type === 'monthly'
    ? selectedMonthlyHistory.map((item) => ({ period: toMonthTimestamp(item.year, item.month), label: String(item.year), tooltipLabel: `${item.month} ${item.year}`, hist: item.arrivals, forecast: null }))
    : selectedNationalityHistory.map((item) => ({ period: Date.UTC(item.year, 0, 1), label: String(item.year), tooltipLabel: String(item.year), hist: item.arrivals, forecast: null }));
  const forecastRows = forecastItems.map((item) => ({
    period: type === 'monthly' ? toMonthTimestamp(item.year, item.month) : Date.UTC(item.target_year, item.target_month - 1, 1),
    label: type === 'monthly' ? String(item.year) : String(item.target_year),
    tooltipLabel: type === 'monthly' ? `${item.month} ${item.year}` : `${item.target_year}-${String(item.target_month).padStart(2, '0')}`,
    hist: null,
    forecast: item.predicted_value,
  }));
  const allData = [...historicalRows, ...forecastRows].sort((a, b) => a.period - b.period);
  const chartStart = type === 'monthly' && selectedMonthlyYear
    ? Date.UTC(Number(selectedMonthlyYear), 0, 1)
    : CHART_DOMAIN_START;
  const chartEnd = type === 'monthly' && selectedMonthlyYear
    ? Date.UTC(Number(selectedMonthlyYear), 11, 31)
    : CHART_DOMAIN_END;

  const handleDownload = () => {
    const exportRows = forecastItems.map((item) => ({
      period: type === 'monthly' ? item.date : `${item.target_year}-${item.target_month}`,
      value: item.predicted_value,
      lower_bound: item.lower_bound || '',
      upper_bound: item.upper_bound || '',
      type: 'forecast',
    }));
    downloadCSV(exportRows, `${type}-tourism-forecast-2025-2026.csv`);
  };

  const label = type === 'monthly' ? INDICATOR_LABELS.monthly : `${nationality} Arrivals`;
  const color = INDICATOR_COLOR;
  const availableNationalities = [...new Set(nationalityForecast.map((item) => item.topic))].sort();

  const formatValue = (value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });

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
          subtitle="Explore the two-year tourism forecasts produced by the trained models"
          className="rounded-sm"
        >
          <div className="flex flex-wrap gap-8 items-end mb-4">
            <div>
              <div className="text-xs font-bold uppercase text-onSurface-variant mb-2.5">
                Forecast dataset
              </div>
              <div className="flex gap-2 rounded-sm border border-outline-variant p-1">
                {[
                  ['monthly', 'Monthly arrivals'],
                  ['nationality', 'By nationality'],
                ].map(([v, l]) => (
                  <TabBtn key={v} active={type === v} onClick={() => { setType(v); setDone(false); }}>
                    {l}
                  </TabBtn>
                ))}
              </div>
            </div>

            {type === 'nationality' && (
              <label className="text-xs font-bold uppercase text-onSurface-variant">
                Nationality
                <select
                  value={nationality}
                  onChange={(event) => setNationality(event.target.value)}
                  className="block mt-2 border border-outline-variant rounded-sm bg-surface px-3 py-2 text-sm normal-case font-normal text-onSurface"
                >
                  {availableNationalities.map((item) => <option key={item} value={item}>{formatCountryName(item)}</option>)}
                </select>
              </label>
            )}
            {type === 'monthly' && (
              <label className="text-xs font-bold uppercase text-onSurface-variant">
                Year
                <select
                  value={selectedMonthlyYear}
                  onChange={(event) => setMonthlyYear(event.target.value)}
                  className="block mt-2 border border-outline-variant rounded-sm bg-surface px-3 py-2 text-sm normal-case font-normal text-onSurface"
                >
                  {monthlyYears.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-surface-lowest border border-outline-variant rounded-sm">
            <Icon name="info" size={16} color="#5c403c" />
            <p className="text-xs text-onSurface-variant">
              Showing the trained <strong>{label}</strong> model output for the full{' '}
              <strong>24-month</strong> forecast horizon, with historical data for context.
            </p>
          </div>

          <div className="flex items-end gap-3">
            <BtnPrimary onClick={() => setDone(true)} className="gap-2 rounded-sm" disabled={loading || !forecastItems.length}>
              {loading ? (
                <>
                  <Icon name="refresh" size={16} color="#fff" className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Icon name="auto_awesome" size={16} color="#fff" />
                  View Forecast
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
              subtitle="Solid blue line = historical · Dashed light-green line = AI forecast"
              className="rounded-sm"
            >
              <LineChart
                data={allData}
                xKey="period"
                labelKey="label"
                tooltipKey="tooltipLabel"
                timeScale
                xDomainStart={chartStart}
                xDomainEnd={chartEnd}
                series={[
                  { key: 'hist', color, label: 'Historical' },
                  { key: 'forecast', color: FORECAST_COLOR, label: 'Forecast', dashed: true },
                ]}
                height={280}
              />
            </SectionCard>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {forecastItems.map((d, i) => (
                <div
                  key={i}
                  className="bg-surface border border-outline-variant rounded-sm p-5 card-shadow"
                  style={{ borderTop: `3px solid ${FORECAST_COLOR}` }}
                >
                  <div className="text-xs font-bold uppercase text-onSurface-variant mb-1.5">
                    {type === 'monthly' ? `${d.month} ${d.year}` : `${d.target_year}-${String(d.target_month).padStart(2, '0')}`} Forecast
                  </div>
                  <div className="text-3xl font-bold text-onSurface">
                    {formatValue(d.predicted_value)}
                  </div>
                  {d.lower_bound !== undefined && (
                    <div className="text-xs text-onSurface-variant mt-1">
                      Range: {formatValue(d.lower_bound)} – {formatValue(d.upper_bound)}
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
              Historical data shown from 2015 with model forecasts through 2026
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}