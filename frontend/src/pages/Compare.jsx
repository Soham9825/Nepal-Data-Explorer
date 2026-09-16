import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadCSV } from '../utils/download';
import { API_BASE_URL } from '../config';
import DashboardLayout from '../components/layout/DashboardLayout';
import { SectionCard } from '../components/ui/Card';
import { BtnPrimary } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import LineChart from '../components/charts/LineChart';
import Loader from '../components/common/Loader';

function pearsonCorrelation(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
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
  return denom === 0 ? null : num / denom;
}

function correlationLabel(r) {
  const abs = Math.abs(r);
  if (abs >= 0.7) return 'strong';
  if (abs >= 0.4) return 'moderate';
  if (abs >= 0.2) return 'weak';
  return 'negligible';
}

export default function Compare() {
  const [catalog, setCatalog] = useState([]);
  const [datasetId, setDatasetId] = useState('nationality');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [filters, setFilters] = useState({});
  const [comparison, setComparison] = useState(null);
  const [done, setDone] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [overlay, setOverlay] = useState(false); // Normalized overlay (both series scaled to start = 100).
  const chartAreaRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const apiBaseUrl = API_BASE_URL;
  const dataset = catalog.find((item) => item.id === datasetId) || null;
  const seriesLabel = (value) => String(value).replaceAll('_', ' ');
  const availableSeries = dataset?.series_by_filters?.statistic_type?.[filters.statistic_type]
    || dataset?.series
    || [];

  const correlation = useMemo(() => {
    if (!comparison?.data?.length) return null;
    const xs = comparison.data.map((d) => Number(d.a));
    const ys = comparison.data.map((d) => Number(d.b));
    return pearsonCorrelation(xs, ys);
  }, [comparison]);

  const hasCorrelation = correlation !== null && Number.isFinite(correlation);
  const direction = hasCorrelation && correlation >= 0 ? 'positive' : 'inverse';
  const strength = hasCorrelation ? correlationLabel(correlation) : 'unavailable';
  const barPct = hasCorrelation ? Math.round(((correlation + 1) / 2) * 100) : 0;
  const periodDescription = comparison?.data?.length
    ? `${comparison.data[0].period} to ${comparison.data.at(-1).period}`
    : 'the selected periods';

  // Index both series to a common base (start = 100) so trends are comparable
  // even when the two series have very different magnitudes.
  const normalizedData = useMemo(() => {
    const rows = comparison?.data || [];
    if (!rows.length) return [];
    const baseA = Number(rows.find((d) => Number(d.a))?.a) || 1;
    const baseB = Number(rows.find((d) => Number(d.b))?.b) || 1;
    return rows.map((d) => ({
      period: d.period,
      a: (Number(d.a) / baseA) * 100,
      b: (Number(d.b) / baseB) * 100,
    }));
  }, [comparison]);

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/analytics/compare/catalog/`)
      .then((response) => {
        if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const datasets = data.datasets || [];
        setCatalog(datasets);
        const initial = datasets.find((item) => item.id === 'nationality') || datasets[0];
        if (initial) {
          setDatasetId(initial.id);
          setA(initial.series[0] || '');
          setB(initial.series[1] || initial.series[0] || '');
          setFilters(Object.fromEntries((initial.filters || []).map((filter) => [filter.field, filter.options[0] || ''])));
        }
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [apiBaseUrl]);

  const changeDataset = (value) => {
    const next = catalog.find((item) => item.id === value);
    setDatasetId(value);
    setA(next?.series[0] || '');
    setB(next?.series[1] || next?.series[0] || '');
    setFilters(Object.fromEntries((next?.filters || []).map((filter) => [filter.field, filter.options[0] || ''])));
    setDone(false);
    setComparison(null);
  };

  const Sel = ({ val, onChange }) => (
    <div className="relative">
      <select
        value={val}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none px-3 py-2 pr-8 border border-outline-variant rounded-sm font-sans text-sm font-bold text-onSurface bg-surface cursor-pointer outline-none"
      >
        {availableSeries.map((value) => (
          <option key={value} value={value}>{seriesLabel(value)}</option>
        ))}
      </select>
      <Icon name="expand_more" size={14} color="#5c403c" className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );

  const generateComparison = () => {
    if (!dataset || !a || !b) return;
    const params = new URLSearchParams({ dataset: dataset.id, a, b, ...filters });
    setLoading(true);
    setError('');
    fetch(`${apiBaseUrl}/api/analytics/compare/data/?${params}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Comparison request failed: ${response.status}`);
        return response.json();
      })
      .then((data) => { setComparison(data); setDone(true); })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  };

  return (
    <DashboardLayout pageTitle="Compare Indicators">
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-onSurface">Compare Indicators</h3>
          <p className="text-onSurface-variant text-sm">Side-by-side comparison with correlation analysis</p>
        </div>

        <SectionCard title="Select data to compare" subtitle="Choose two series from the same real dataset" className="rounded-sm">
          <div className="flex items-center gap-5 flex-wrap">
            <div>
              <div className="text-xs font-bold uppercase text-onSurface-variant mb-2">Dataset</div>
              <div className="relative">
                <select value={datasetId} onChange={(event) => changeDataset(event.target.value)} className="appearance-none px-3 py-2 pr-8 border border-outline-variant rounded-sm font-sans text-sm font-bold text-onSurface bg-surface cursor-pointer outline-none">
                  {catalog.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                <Icon name="expand_more" size={14} color="#5c403c" className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase text-onSurface-variant mb-2">Series A</div>
              <Sel val={a} onChange={(v) => { setA(v); setDone(false); }} />
            </div>
            <div className="text-lg text-onSurface-variant font-bold mt-5">vs</div>
            <div>
              <div className="text-xs font-bold uppercase text-onSurface-variant mb-2">Series B</div>
              <Sel val={b} onChange={(v) => { setB(v); setDone(false); }} />
            </div>
            {(dataset?.filters || []).map((filter) => (
              <div key={filter.field}>
                <div className="text-xs font-bold uppercase text-onSurface-variant mb-2">{seriesLabel(filter.field)}</div>
                <select value={filters[filter.field] || ''} onChange={(event) => {
                  const nextFilters = { ...filters, [filter.field]: event.target.value };
                  const nextSeries = dataset?.series_by_filters?.[filter.field]?.[event.target.value] || dataset?.series || [];
                  setFilters(nextFilters);
                  if (nextSeries.length > 1 && (!nextSeries.includes(a) || !nextSeries.includes(b))) {
                    setA(nextSeries[0]);
                    setB(nextSeries[1]);
                  }
                  setDone(false);
                }} className="px-3 py-2 border border-outline-variant rounded-sm font-sans text-sm font-bold text-onSurface bg-surface cursor-pointer outline-none">
                  {filter.options.map((option) => <option key={option} value={option}>{seriesLabel(option)}</option>)}
                </select>
              </div>
            ))}
            <BtnPrimary onClick={generateComparison} disabled={loading || !a || !b} className="mt-5 rounded-sm">
              <Icon name="compare_arrows" size={16} color="#fff" />
              Generate Comparison
            </BtnPrimary>
          </div>
        </SectionCard>

        {loading && (
          <SectionCard title="Loading comparison data" className="rounded-sm">
            <div className="flex min-h-[220px] items-center justify-center">
              <Loader size="lg" />
            </div>
          </SectionCard>
        )}

        {done && (
          <div ref={chartAreaRef} className={isFullscreen ? 'fixed inset-0 z-50 overflow-y-auto bg-background p-6 lg:p-10' : 'space-y-6'}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-onSurface">Comparison Visualization</h3>
                <p className="text-sm text-onSurface-variant">{seriesLabel(a)} vs {seriesLabel(b)}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => downloadCSV(comparison?.data || [], `compare-${a}-${b}.csv`)}
                  className="flex items-center gap-2 rounded-sm border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-onSurface transition-colors hover:bg-surface-container-highest"
                  title="Download comparison data as CSV"
                >
                  <Icon name="download" size={18} color="#007a4d" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => setOverlay((value) => !value)}
                  className="flex items-center gap-2 rounded-sm border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-onSurface transition-colors hover:bg-surface-container-highest"
                  aria-pressed={overlay}
                  title="Overlay both series on one chart, scaled to start = 100"
                >
                  <Icon name="show_chart" size={18} color="#0051d5" />
                  {overlay ? 'Separate charts' : 'Overlay (start = 100)'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen((value) => !value)}
                  className="flex items-center gap-2 rounded-sm border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-onSurface transition-colors hover:bg-surface-container-highest"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'View comparison fullscreen'}
                >
                  <Icon name={isFullscreen ? 'fullscreen_exit' : 'fullscreen'} size={18} color="#0051d5" />
                  {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                </button>
              </div>
            </div>
            {overlay ? (
              <SectionCard
                title={`${seriesLabel(a)} vs ${seriesLabel(b)} — normalized overlay`}
                subtitle="Both series scaled to start = 100 so trends are directly comparable"
                className="rounded-sm"
              >
                <LineChart
                  data={normalizedData}
                  xKey="period"
                  series={[
                    { key: 'a', color: '#0051d5', label: seriesLabel(a) },
                    { key: 'b', color: '#b70011', label: seriesLabel(b) },
                  ]}
                  height={384}
                />
              </SectionCard>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <SectionCard title={seriesLabel(a)} subtitle={`${dataset?.period_label} · ${dataset?.value_label}`} className="rounded-sm">
                  <LineChart data={comparison?.data || []} xKey="period" series={[{ key: 'a', color: '#0051d5', label: seriesLabel(a) }]} height={384} />
                </SectionCard>
                <SectionCard title={seriesLabel(b)} subtitle={`${dataset?.period_label} · ${dataset?.value_label}`} className="rounded-sm">
                  <LineChart data={comparison?.data || []} xKey="period" series={[{ key: 'b', color: '#b70011', label: seriesLabel(b) }]} height={384} />
                </SectionCard>
              </div>
            )}

            <div className="grid grid-cols-[1fr_2fr] gap-6">
              <SectionCard title="Correlation Score" subtitle={`Pearson r · ${comparison?.data?.length || 0} shared periods`} className="rounded-sm">
                <div className="text-center py-4">
                  <div className="text-6xl font-extrabold text-onSurface">{hasCorrelation ? correlation.toFixed(2) : 'N/A'}</div>
                  <div className="text-sm text-onSurface-variant mb-4 capitalize">
                    {hasCorrelation ? `${strength} ${direction} correlation` : 'insufficient variation for correlation'}
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
                    <strong>{seriesLabel(a)}</strong> and <strong>{seriesLabel(b)}</strong>{' '}
                    {hasCorrelation
                      ? `show a ${strength} ${direction} correlation (r = ${correlation.toFixed(2)}) over ${periodDescription}. `
                      : `do not have enough shared variation to calculate a reliable correlation over ${periodDescription}. `}
                    {hasCorrelation && Math.abs(correlation) >= 0.4
                      ? `Movement in one series tends to ${direction === 'positive' ? 'align with' : 'move opposite to'} the other across most periods in this range.`
                      : hasCorrelation
                        ? `The relationship is weak enough that other factors likely explain most of the variation between these two series.`
                        : ''}
                  </p>
                </div>
              </SectionCard>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        {!loading && !done && catalog.length === 0 && <p className="text-sm text-onSurface-variant">No comparison datasets are available.</p>}
      </div>
    </DashboardLayout>
  );
}