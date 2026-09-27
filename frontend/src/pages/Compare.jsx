import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadCSV } from '../utils/download';
import { API_BASE_URL } from '../config';
import { SectionCard } from '../components/ui/Card';
import { BtnPrimary } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import LineChart from '../components/charts/LineChart';
import ScatterChart from '../components/charts/ScatterChart';

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

function seriesStats(rows, key) {
  // Index the *period* alongside each value: `values` is filtered for
  // finiteness, so an index into it does not line up with `rows` once any row is
  // dropped and the reported peak/trough period is silently wrong.
  const pairs = rows
    .map((d) => ({ period: d?.period, value: Number(d?.[key]) }))
    .filter((p) => Number.isFinite(p.value));
  if (!pairs.length) return null;
  const first = pairs[0].value;
  const last = pairs[pairs.length - 1].value;
  const change = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
  const lowest = pairs.reduce((acc, p) => (p.value < acc.value ? p : acc), pairs[0]);
  const highest = pairs.reduce((acc, p) => (p.value > acc.value ? p : acc), pairs[0]);
  return {
    first,
    last,
    change,
    min: lowest.value,
    max: highest.value,
    troughPeriod: lowest.period ?? null,
    peakPeriod: highest.period ?? null,
  };
}

function fmt(n) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// Hoisted out of Compare: defining it inside the component made its type a new
// function on every render, so React unmounted and remounted both Series
// <select>s each time — dropping the open dropdown and any in-flight
// interaction state.
function SeriesSelect({ value, options, onChange, label, format }) {
  return (
    <div className="relative">
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none px-3 py-2 pr-8 border border-outline-variant rounded-sm font-sans text-sm font-bold text-onSurface bg-surface cursor-pointer outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {format(option)}
          </option>
        ))}
      </select>
      <Icon
        name="expand_more"
        size={14}
        color="#5c403c"
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
      />
    </div>
  );
}

function SeriesStats({ label, stats, color }) {
  if (!stats) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
      <span className="flex items-center gap-1.5 font-bold" style={{ color }}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      {stats.change != null && (
        <span className="rounded-sm border border-outline-variant bg-surface-container-highest px-2 py-0.5 font-semibold text-onSurface-variant">
          {stats.change >= 0 ? '+' : ''}
          {stats.change.toFixed(1)}% over full range
        </span>
      )}
      {stats.peakPeriod != null && (
        <span className="rounded-sm border border-outline-variant bg-surface-container-highest px-2 py-0.5 font-semibold text-onSurface-variant">
          Peak {stats.peakPeriod} · {fmt(stats.max)}
        </span>
      )}
      {stats.troughPeriod != null && (
        <span className="rounded-sm border border-outline-variant bg-surface-container-highest px-2 py-0.5 font-semibold text-onSurface-variant">
          Low {stats.troughPeriod} · {fmt(stats.min)}
        </span>
      )}
    </div>
  );
}

export default function Compare() {
  const [catalog, setCatalog] = useState([]);
  const [datasetId, setDatasetId] = useState('nationality');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [filters, setFilters] = useState({});
  const [comparison, setComparison] = useState(null);
  const [done, setDone] = useState(false);
  const [overlay, setOverlay] = useState(false); // Normalized overlay (both series scaled to start = 100).
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Race-guardable request ids so a slow old response never overwrites a
  // newer selection's results.
  const requestIdRef = useRef(0);
  // Only auto-refresh after the user has generated a comparison at least once.
  const hasGeneratedRef = useRef(false);
  const refreshTimerRef = useRef(null);

  const apiBaseUrl = API_BASE_URL;
  const dataset = catalog.find((item) => item.id === datasetId) || null;
  const seriesLabel = (value) => String(value).replaceAll('_', ' ');

  // Only offer series that actually exist for the current filter selection.
  // The catalog names its own filter fields per dataset (`statistic_type` for
  // tourism-statistics, `series_type` for global-economy), so this has to be
  // derived from the dataset rather than hardcoding one field name — previously
  // it did, so changing the filter left stale series in the dropdowns and the
  // charts silently rendered empty.
  const availableSeries = useMemo(() => {
    const all = Array.isArray(dataset?.series) ? dataset.series : [];
    if (!all.length) return [];
    const activeLists = (dataset?.filters || [])
      .map((filter) => dataset?.series_by_filters?.[filter.field]?.[filters[filter.field]])
      .filter((list) => Array.isArray(list));
    if (!activeLists.length) return all;
    // Intersect, so a series is offered only when it exists for every active
    // filter rather than for any one of them.
    return all.filter((series) => activeLists.every((list) => list.includes(series)));
  }, [dataset, filters]);

  // Changing a filter can invalidate the current A/B pick. Re-point it at
  // something that exists instead of leaving a pair that returns no rows.
  useEffect(() => {
    if (!availableSeries.length) return;
    const nextA = availableSeries.includes(a) ? a : availableSeries[0];
    const nextB = availableSeries.includes(b)
      ? b
      : availableSeries.find((series) => series !== nextA) || availableSeries[0];
    if (nextA !== a) setA(nextA);
    if (nextB !== b) setB(nextB);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSeries]);

  const correlation = useMemo(() => {
    if (!comparison?.data?.length) return null;
    const xs = comparison.data.map((d) => Number(d.a));
    const ys = comparison.data.map((d) => Number(d.b));
    return pearsonCorrelation(xs, ys);
  }, [comparison]);

  const hasCorrelation = correlation !== null && Number.isFinite(correlation);
  const direction = hasCorrelation && correlation >= 0 ? 'positive' : 'inverse';
  const strength = hasCorrelation ? correlationLabel(correlation) : 'unavailable';
  const periodDescription = comparison?.data?.length
    ? `${comparison.data[0]?.period} to ${comparison.data.at(-1)?.period}`
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

  // Shared Y-axis domain for the side-by-side (non-overlay) charts, so line
  // height is directly comparable between the two cards instead of each
  // chart silently autoscaling to its own data.
  const sharedYDomain = useMemo(() => {
    const rows = comparison?.data || [];
    if (!rows.length) return undefined;
    const values = rows.flatMap((d) => [Number(d.a), Number(d.b)]).filter(Number.isFinite);
    if (!values.length) return undefined;
    const max = Math.max(...values);
    if (max <= 0) return undefined;
    return [0, Math.ceil(max * 1.05)];
  }, [comparison]);

  const statsA = useMemo(() => seriesStats(comparison?.data || [], 'a'), [comparison]);
  const statsB = useMemo(() => seriesStats(comparison?.data || [], 'b'), [comparison]);

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
          setFilters(
            Object.fromEntries(
              (initial.filters || []).map((filter) => [filter.field, filter.options[0] || ''])
            )
          );
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
    setFilters(
      Object.fromEntries(
        (next?.filters || []).map((filter) => [filter.field, filter.options[0] || ''])
      )
    );
  };

  const generateComparison = () => {
    if (!dataset || !a || !b) return;
    // Cancel any pending debounced auto-refresh first. Without this, clicking
    // "Generate Comparison" within 350 ms of touching a dropdown fired the
    // identical request twice: once from the click and once again when the
    // timer from the useEffect below came due.
    clearTimeout(refreshTimerRef.current);
    hasGeneratedRef.current = true;
    const id = ++requestIdRef.current;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ dataset: dataset.id, a, b, ...filters });
    fetch(`${apiBaseUrl}/api/analytics/compare/data/?${params}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Comparison request failed: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (id !== requestIdRef.current) return;
        // Only trust a payload that actually has a row array — a shape change
        // downstream would otherwise reach the charts as undefined and throw
        // during render.
        setComparison(Array.isArray(data?.data) ? data : { ...data, data: [] });
        setDone(true);
      })
      .catch((requestError) => {
        if (id !== requestIdRef.current) return;
        setError(requestError.message);
      })
      .finally(() => {
        if (id === requestIdRef.current) setLoading(false);
      });
  };

  // After the first generation, any change to the dataset/series/filters
  // refreshes the comparison in place (debounced) rather than tearing the
  // results down and requiring a manual regenerate.
  useEffect(() => {
    if (!hasGeneratedRef.current) return undefined;
    clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      generateComparison();
    }, 350);
    return () => clearTimeout(refreshTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, a, b, filters]);

  const showResults = Boolean(comparison);
  const updating = loading && showResults;

  return (
    <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-onSurface">Compare Indicators</h3>
          <p className="text-onSurface-variant text-sm">
            Side-by-side comparison with correlation analysis
          </p>
        </div>

        <SectionCard
          title="Select data to compare"
          subtitle="Choose two series from the same real dataset"
          className="rounded-sm"
        >
          <div className="flex items-end gap-5 flex-wrap">
            <div>
              <div className="text-xs font-bold uppercase text-onSurface-variant mb-2">Dataset</div>
              <div className="relative">
                <select
                  value={datasetId}
                  onChange={(event) => changeDataset(event.target.value)}
                  className="appearance-none px-3 py-2 pr-8 border border-outline-variant rounded-sm font-sans text-sm font-bold text-onSurface bg-surface cursor-pointer outline-none"
                >
                  {catalog.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <Icon
                  name="expand_more"
                  size={14}
                  color="#5c403c"
                  className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase text-onSurface-variant mb-2">
                Series A
              </div>
              <SeriesSelect label="Series A" value={a} options={availableSeries} onChange={setA} format={seriesLabel} />
            </div>
            <div className="text-lg text-onSurface-variant font-bold pb-2">vs</div>
            <div>
              <div className="text-xs font-bold uppercase text-onSurface-variant mb-2">
                Series B
              </div>
              <SeriesSelect label="Series B" value={b} options={availableSeries} onChange={setB} format={seriesLabel} />
            </div>
            {(dataset?.filters || []).map((filter) => (
              <div key={filter.field}>
                <div className="text-xs font-bold uppercase text-onSurface-variant mb-2">
                  {seriesLabel(filter.field)}
                </div>
                <select
                  value={filters[filter.field] || ''}
                  aria-label={seriesLabel(filter.field)}
                  onChange={(event) => {
                    // Just record the filter: `availableSeries` recomputes and the
                    // effect above re-points A/B at a valid pair. Doing that
                    // remapping here as well meant the dropdowns and the charts
                    // could disagree.
                    setFilters({ ...filters, [filter.field]: event.target.value });
                  }}
                  className="px-3 py-2 border border-outline-variant rounded-sm font-sans text-sm font-bold text-onSurface bg-surface cursor-pointer outline-none"
                >
                  {filter.options.map((option) => (
                    <option key={option} value={option}>
                      {seriesLabel(option)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <BtnPrimary
              onClick={generateComparison}
              disabled={loading || !a || !b}
              className="rounded-sm"
            >
              <Icon name="compare_arrows" size={16} color="#fff" />
              Generate Comparison
            </BtnPrimary>
          </div>
        </SectionCard>

        {/* Loading skeleton — matches the eventual two-chart grid so the page
            doesn't jump/reflow once data arrives. */}
        {loading && !comparison && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[0, 1].map((i) => (
              <div key={i} className="bg-surface border border-outline-variant rounded-sm p-5">
                <div className="animate-pulse h-4 w-32 bg-slate-200/70 rounded-sm mb-2" />
                <div className="animate-pulse h-3 w-48 bg-slate-200/50 rounded-sm mb-4" />
                <div className="animate-pulse h-[384px] w-full bg-slate-200/50 rounded-sm" />
              </div>
            ))}
          </div>
        )}

        {showResults && (
          <div className="space-y-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-onSurface">Comparison Visualization</h3>
                <p className="text-sm text-onSurface-variant">
                  {seriesLabel(a)} vs {seriesLabel(b)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {updating && (
                  <span className="flex items-center gap-2 text-xs font-semibold text-onSurface-variant">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-outline-variant border-t-secondary animate-spin" />
                    Updating comparison…
                  </span>
                )}
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
              </div>
            </div>

            {overlay && (
              <SectionCard
                title={`${seriesLabel(a)} vs ${seriesLabel(b)} — normalized overlay`}
                subtitle="Both series scaled to start = 100 so trends are directly comparable"
                className="rounded-sm"
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <SeriesStats label={seriesLabel(a)} stats={statsA} color="#0051d5" />
                  <SeriesStats label={seriesLabel(b)} stats={statsB} color="#b70011" />
                </div>
                <div className="h-[520px]">
                  <LineChart
                    data={normalizedData}
                    xKey="period"
                    series={[
                      { key: 'a', color: '#0051d5', label: seriesLabel(a) },
                      { key: 'b', color: '#b70011', label: seriesLabel(b) },
                    ]}
                    height="100%"
                  />
                </div>
              </SectionCard>
            )}
            {!overlay && (
              // Both cards share a single Y domain (LineChart honors yDomain)
              // and stretch to equal heights, so the two charts use identical
              // scales and pixel geometry — a period on one chart lands at
              // exactly the same place as the same period on the other.
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                <SectionCard
                  title={seriesLabel(a)}
                  subtitle={`${dataset?.period_label} · ${dataset?.value_label}`}
                  className="rounded-sm h-full flex flex-col"
                >
                  <SeriesStats label={seriesLabel(a)} stats={statsA} color="#0051d5" />
                  <div className="min-h-[384px] flex-1">
                    <LineChart
                      data={comparison?.data || []}
                      xKey="period"
                      series={[{ key: 'a', color: '#0051d5', label: seriesLabel(a) }]}
                      yDomain={sharedYDomain}
                      height="100%"
                    />
                  </div>
                </SectionCard>
                <SectionCard
                  title={seriesLabel(b)}
                  subtitle={`${dataset?.period_label} · ${dataset?.value_label}`}
                  className="rounded-sm h-full flex flex-col"
                >
                  <SeriesStats label={seriesLabel(b)} stats={statsB} color="#b70011" />
                  <div className="min-h-[384px] flex-1">
                    <LineChart
                      data={comparison?.data || []}
                      xKey="period"
                      series={[{ key: 'b', color: '#b70011', label: seriesLabel(b) }]}
                      yDomain={sharedYDomain}
                      height="100%"
                    />
                  </div>
                </SectionCard>
              </div>
            )}

            <SectionCard
              title={`Scatter Plot — ${seriesLabel(a)} vs ${seriesLabel(b)}`}
              subtitle="One dot per shared period · dashed red line is the trend fit · hover a dot for details"
              className="rounded-sm"
            >
              <ScatterChart
                data={comparison?.data || []}
                xKey="a"
                yKey="b"
                labelKey="period"
                xLabel={seriesLabel(a)}
                yLabel={seriesLabel(b)}
              />
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 items-stretch">
              <SectionCard
                title="Correlation Score"
                subtitle={`Pearson r · ${comparison?.data?.length || 0} shared periods`}
                className="rounded-sm h-full flex flex-col"
              >
                <div className="flex-1 flex flex-col justify-center text-center py-4">
                  <div className="text-6xl font-extrabold text-onSurface">
                    {hasCorrelation ? correlation.toFixed(2) : 'N/A'}
                  </div>
                  <div className="text-sm text-onSurface-variant mb-4 capitalize">
                    {hasCorrelation
                      ? `${strength} ${direction} correlation`
                      : 'insufficient variation for correlation'}
                  </div>

                  {/* Diverging bar: fills outward from a center zero-point in
                      either direction, so a weak r visibly stays near center
                      instead of the old left-fill which made r = 0.1 look
                      like it filled roughly half the bar. */}
                  <div className="h-2 bg-surface-highest rounded-full mx-4 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-onSurface-variant/40" />
                    {hasCorrelation && (
                      <div
                        className="absolute top-0 h-full bg-secondary rounded-full transition-all duration-300"
                        style={
                          correlation >= 0
                            ? { left: '50%', width: `${Math.abs(correlation) * 50}%` }
                            : { right: '50%', width: `${Math.abs(correlation) * 50}%` }
                        }
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-onSurface-variant mt-1 font-bold px-4">
                    <span>−1 (inverse)</span>
                    <span>0</span>
                    <span>+1 (perfect)</span>
                  </div>
                </div>
              </SectionCard>
              <SectionCard
                title="Correlation Analysis"
                subtitle="Statistical interpretation"
                className="rounded-sm h-full flex flex-col"
              >
                <div className="flex-1 flex items-start gap-3 p-1">
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
        {!loading && !done && catalog.length === 0 && (
          <p className="text-sm text-onSurface-variant">No comparison datasets are available.</p>
        )}
      </div>
  );
}
