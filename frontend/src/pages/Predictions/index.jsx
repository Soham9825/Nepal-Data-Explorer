import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionCard } from '../../components/ui/Card';
import { TabBtn } from '../../components/ui/Tabs';
import { BtnPrimary, BtnOutline } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { downloadCSV } from '../../utils/download';
import LineChart from '../../components/charts/LineChart';
import BarChart from '../../components/charts/BarChart';
import { formatCountryName } from '../../utils/countryFlags';
import { API_BASE_URL } from '../../config';
import {
  CHART_DOMAIN_END,
  CHART_DOMAIN_START,
  FORECAST_COLOR,
  HIST_COLOR,
  INDICATOR_LABELS,
  MONTHS_SHORT,
  MONTH_NUMBERS,
  TREND_UI,
  formatModelName,
  formatValue,
  mean,
  overallTrend,
  percentChange,
  shortMonth,
  toMonthTimestamp,
} from './helpers';

// Skeleton placeholder shown while the APIs are loading.
function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded-sm bg-slate-200/70 ${className}`} />;
}

// Themed select: surface background, 1px outline border and a custom chevron,
// keeping dropdowns visually consistent with the rest of the dashboard.
function ThemedSelect({ value, onChange, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="appearance-none border border-outline-variant bg-surface px-3 py-2 pr-8 font-sans text-sm font-semibold normal-case text-onSurface outline-none cursor-pointer transition-colors hover:bg-surface-highest focus:border-onSurface-variant"
      >
        {children}
      </select>
      <Icon
        name="expand_more"
        size={14}
        color="#6b7280"
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
      />
    </div>
  );
}

export default function Predictions() {
  const [type, setType] = useState('monthly');
  const [nationality, setNationality] = useState('India');
  const [monthlyYear, setMonthlyYear] = useState('');
  const [fullTimeline, setFullTimeline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const [monthlyHistory, setMonthlyHistory] = useState([]);
  const [monthlyForecast, setMonthlyForecast] = useState([]);
  const [nationalityHistory, setNationalityHistory] = useState([]);
  const [nationalityForecast, setNationalityForecast] = useState([]);
  const [arrivalTrend, setArrivalTrend] = useState([]);

  const requestId = useRef(0);

  const apiBaseUrl = API_BASE_URL;

  // Initial load of both the tourism history and the forecasts for the default horizon.
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${apiBaseUrl}/api/analytics/tourism/`).then((r) => r.json()),
      fetch(`${apiBaseUrl}/api/analytics/forecasts/`).then((r) => r.json()),
    ])
      .then(([tourismData, forecasts]) => {
        if (id !== requestId.current) return;
        setArrivalTrend(tourismData.arrival_trend || []);
        setMonthlyHistory((tourismData.monthly_trend || []).filter((item) => item.year >= 2015));
        setNationalityHistory(
          (tourismData.nationality_trend || []).filter(
            (item) => item.year >= 2015 && item.nationality !== 'Total'
          )
        );
        setMonthlyForecast(forecasts.monthly || []);
        setNationalityForecast(forecasts.nationality || []);
      })
      .catch((err) => {
        console.error('Unable to load prediction data:', err);
        if (id === requestId.current) setError('Could not load forecast data. Please try again.');
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = () => {
    setLoading(true);
    setError(null);
    const id = ++requestId.current;
    Promise.all([
      fetch(`${apiBaseUrl}/api/analytics/tourism/`).then((r) => r.json()),
      fetch(`${apiBaseUrl}/api/analytics/forecasts/`).then((r) => r.json()),
    ])
      .then(([tourismData, forecasts]) => {
        if (id !== requestId.current) return;
        setArrivalTrend(tourismData.arrival_trend || []);
        setMonthlyHistory((tourismData.monthly_trend || []).filter((item) => item.year >= 2015));
        setNationalityHistory(
          (tourismData.nationality_trend || []).filter(
            (item) => item.year >= 2015 && item.nationality !== 'Total'
          )
        );
        setMonthlyForecast(forecasts.monthly || []);
        setNationalityForecast(forecasts.nationality || []);
      })
      .catch((err) => {
        console.error('Unable to load prediction data:', err);
        if (id === requestId.current) setError('Could not load forecast data. Please try again.');
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  };

  const selectedNationalityForecast = nationalityForecast
    .filter((item) => item.topic === nationality)
    .sort(
      (a, b) =>
        Date.UTC(a.target_year, a.target_month - 1, 1) -
        Date.UTC(b.target_year, b.target_month - 1, 1)
    );
  const selectedNationalityHistory = nationalityHistory
    .filter((item) => item.nationality === nationality)
    .sort((a, b) => a.year - b.year);

  const monthlyForecastSorted = useMemo(
    () =>
      [...monthlyForecast].sort(
        (a, b) => toMonthTimestamp(a.year, a.month) - toMonthTimestamp(b.year, b.month)
      ),
    [monthlyForecast]
  );

  const monthlyYears = [
    ...new Set([
      ...monthlyHistory.map((item) => String(item.year)),
      ...monthlyForecastSorted.map((item) => String(item.year)),
    ]),
  ].sort();
  const selectedMonthlyYear = monthlyYears.includes(monthlyYear)
    ? monthlyYear
    : monthlyYears.at(-1) || '';
  const selectedMonthlyHistory = monthlyHistory.filter(
    (item) => String(item.year) === selectedMonthlyYear
  );
  const selectedMonthlyForecast = monthlyForecastSorted.filter(
    (item) => String(item.year) === selectedMonthlyYear
  );

  const isMonthly = type === 'monthly';
  const label = isMonthly ? INDICATOR_LABELS.monthly : `${nationality} Arrivals`;

  // Active dataset behind the chart: history rows + forecast rows (with bounds).
  const chartRows = useMemo(() => {
    const historicalRows = isMonthly
      ? (fullTimeline ? monthlyHistory : selectedMonthlyHistory).map((item) => ({
          period: toMonthTimestamp(item.year, item.month),
          label: String(item.year),
          tooltipLabel: `${item.month} ${item.year}`,
          hist: item.arrivals,
          forecast: null,
        }))
      : selectedNationalityHistory.map((item) => ({
          period: Date.UTC(item.year, 0, 1),
          label: String(item.year),
          tooltipLabel: String(item.year),
          hist: item.arrivals,
          forecast: null,
        }));

    const forecastSource = isMonthly
      ? fullTimeline
        ? monthlyForecastSorted
        : selectedMonthlyForecast
      : selectedNationalityForecast;
    const forecastRows = forecastSource.map((item) => ({
      period: isMonthly
        ? toMonthTimestamp(item.year, item.month)
        : Date.UTC(item.target_year, item.target_month - 1, 1),
      label: isMonthly ? String(item.year) : String(item.target_year),
      tooltipLabel: isMonthly
        ? `${item.month} ${item.year}`
        : `${item.target_year}-${String(item.target_month).padStart(2, '0')}`,
      hist: null,
      forecast: item.predicted_value,
      lower: item.lower_bound,
      upper: item.upper_bound,
      model: item.model_name,
    }));

    return {
      rows: [...historicalRows, ...forecastRows].sort((a, b) => a.period - b.period),
      hasForecast: forecastRows.length > 0,
      forecastRows,
    };
  }, [
    isMonthly,
    fullTimeline,
    monthlyHistory,
    selectedMonthlyHistory,
    selectedMonthlyForecast,
    monthlyForecastSorted,
    selectedNationalityForecast,
    selectedNationalityHistory,
  ]);

  const chartStart =
    isMonthly && !fullTimeline && selectedMonthlyYear
      ? Date.UTC(Number(selectedMonthlyYear), 0, 1)
      : CHART_DOMAIN_START;
  const chartEnd =
    isMonthly && !fullTimeline && selectedMonthlyYear
      ? Date.UTC(Number(selectedMonthlyYear), 11, 31)
      : CHART_DOMAIN_END;
  const chartZoneStart = chartRows.hasForecast
    ? Math.min(...chartRows.forecastRows.map((row) => row.period))
    : undefined;

  // KPIs — every card is computed from live API data (history + forecast).
  const kpis = useMemo(() => {
    const cards = [];

    if (isMonthly) {
      const lastTrend = arrivalTrend[arrivalTrend.length - 1];
      const latestArrivals = lastTrend?.total_arrivals != null ? lastTrend.total_arrivals : null;
      const ninetiesLatest = monthlyHistory[monthlyHistory.length - 1]?.arrivals ?? null;
      cards.push({
        key: 'latest',
        icon: 'flight',
        label: 'Latest Arrivals',
        value: latestArrivals != null ? formatValue(latestArrivals) : formatValue(ninetiesLatest),
        sub: lastTrend?.year != null ? `Year ${lastTrend.year}` : 'Latest year',
        color: HIST_COLOR,
      });

      const forecastValues = monthlyForecastSorted
        .map((item) => Number(item.predicted_value))
        .filter(Number.isFinite);
      const forecastYears = [...new Set(monthlyForecastSorted.map((item) => item.year))].sort();
      cards.push({
        key: 'forecast',
        icon: 'auto_graph',
        label: 'AI Forecast Total',
        value: formatValue(forecastValues.reduce((s, v) => s + v, 0)),
        sub: forecastYears.length
          ? `Monthly total, ${forecastYears[0]}–${forecastYears.at(-1)}`
          : 'Forecast window total',
        color: FORECAST_COLOR,
      });

      const fAvg = forecastValues.length ? mean(forecastValues) : null;
      const trailing = monthlyHistory
        .slice(-Math.max(forecastValues.length, 1))
        .map((item) => Number(item.arrivals));
      const hAvg = trailing.length ? mean(trailing) : null;
      const growth = fAvg != null && hAvg ? percentChange(hAvg, fAvg) : null;
      cards.push({
        key: 'growth',
        icon: 'speed',
        label: 'Forecast Growth',
        value: growth != null ? `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%` : '—',
        sub: growth == null ? 'vs prior period' : 'vs prior period avg',
        color: growth != null && growth < 0 ? '#b70011' : FORECAST_COLOR,
      });

      const histValues = monthlyHistory
        .map((item) => Number(item.arrivals))
        .filter(Number.isFinite);
      const histMinYear = monthlyHistory.length
        ? Math.min(...monthlyHistory.map((i) => i.year))
        : null;
      const histMaxYear = monthlyHistory.length
        ? Math.max(...monthlyHistory.map((i) => i.year))
        : null;
      cards.push({
        key: 'avg',
        icon: 'show_chart',
        label: 'Historical Average',
        value: formatValue(mean(histValues)),
        sub: histMinYear != null ? `Monthly avg ${histMinYear}–${histMaxYear}` : 'Monthly avg',
        color: '#5c403c',
      });

      const peak = monthlyHistory.reduce(
        (best, item) => (!best || Number(item.arrivals) > Number(best.arrivals) ? item : best),
        null
      );
      cards.push({
        key: 'peak',
        icon: 'star',
        label: 'Peak Month',
        value: peak ? `${shortMonth(peak.month)} ${peak.year}` : '—',
        sub: peak ? `${formatValue(peak.arrivals)} arrivals` : 'All-time record',
        color: '#7a5100',
      });
    } else {
      const hist = selectedNationalityHistory;
      const last = hist[hist.length - 1];
      cards.push({
        key: 'latest',
        icon: 'flight',
        label: 'Latest Arrivals',
        value: last ? formatValue(last.arrivals) : '—',
        sub: last ? `Year ${last.year}` : 'Latest year',
        color: HIST_COLOR,
      });

      const sortedForecast = [...selectedNationalityForecast].sort(
        (x, y) => x.target_year - y.target_year || x.target_month - y.target_month
      );
      const firstForecast = sortedForecast[0];
      const lastForecast = sortedForecast[sortedForecast.length - 1];
      const lastActual = last ? Number(last.arrivals) : null;
      cards.push({
        key: 'forecast',
        icon: 'auto_graph',
        label: 'AI Projected Arrivals',
        value: lastForecast ? formatValue(lastForecast.predicted_value) : '—',
        sub: lastForecast ? `AI forecast for ${lastForecast.target_year}` : 'Forecast',
        color: FORECAST_COLOR,
      });

      const growth =
        lastActual != null && firstForecast
          ? percentChange(lastActual, Number(firstForecast.predicted_value))
          : null;
      cards.push({
        key: 'growth',
        icon: 'speed',
        label: 'Forecast Growth',
        value: growth != null ? `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%` : '—',
        sub:
          firstForecast?.target_year && last?.year
            ? `Year ${last.year} actual → ${firstForecast.target_year} forecast`
            : 'vs last year actual',
        color: growth != null && growth < 0 ? '#b70011' : FORECAST_COLOR,
      });

      const avg = hist.length ? mean(hist.map((i) => i.arrivals)) : 0;
      cards.push({
        key: 'avg',
        icon: 'show_chart',
        label: 'Historical Average',
        value: formatValue(avg),
        sub: 'Yearly avg arrivals',
        color: '#5c403c',
      });

      const peak = hist.reduce(
        (best, item) => (!best || Number(item.arrivals) > Number(best.arrivals) ? item : best),
        null
      );
      cards.push({
        key: 'peak',
        icon: 'star',
        label: 'Peak Year',
        value: peak ? String(peak.year) : '—',
        sub: peak ? `${formatValue(peak.arrivals)} arrivals` : 'All-time record',
        color: '#7a5100',
      });
    }

    return cards;
  }, [
    isMonthly,
    arrivalTrend,
    monthlyHistory,
    monthlyForecastSorted,
    selectedNationalityHistory,
    selectedNationalityForecast,
  ]);

  // Seasonality (monthly only): calendar-month averages for history vs forecast.
  const seasonality = useMemo(() => {
    if (!isMonthly) return null;
    const byMonthHist = MONTHS_SHORT.map((_, i) => {
      const rows = monthlyHistory.filter(
        (item) => MONTH_NUMBERS[String(item.month).slice(0, 3).toLowerCase()] === i
      );
      return { index: i, avg: mean(rows.map((r) => r.arrivals)) };
    });
    const byMonthFcast = MONTHS_SHORT.map((_, i) => {
      const rows = monthlyForecastSorted.filter(
        (item) => MONTH_NUMBERS[String(item.month).slice(0, 3).toLowerCase()] === i
      );
      return { index: i, avg: mean(rows.map((r) => r.predicted_value)) };
    });
    return {
      data: MONTHS_SHORT.map((name, i) => ({
        name,
        histAvg: byMonthHist[i].avg,
        fcastAvg: byMonthFcast[i].avg,
      })),
      hasFcast: byMonthFcast.some((m) => m.avg > 0),
    };
  }, [isMonthly, monthlyHistory, monthlyForecastSorted]);

  // Annual comparison: real years bar with forecast-only years highlighted in green.
  const annual = useMemo(() => {
    if (isMonthly) {
      const hist = arrivalTrend.map((item) => ({
        year: Number(item.year),
        value: Number(item.total_arrivals),
        forecast: false,
      }));
      const fcastTotals = {};
      monthlyForecastSorted.forEach((item) => {
        fcastTotals[Number(item.year)] =
          (fcastTotals[Number(item.year)] || 0) + Number(item.predicted_value || 0);
      });
      const years = [
        ...new Set([...hist.map((h) => h.year), ...Object.keys(fcastTotals).map(Number)]),
      ].sort((a, b) => a - b);
      return years.map((year) => {
        const real = hist.find((h) => h.year === year);
        if (real) return { year, arrivals: real.value, color: HIST_COLOR };
        return { year, arrivals: fcastTotals[year], color: FORECAST_COLOR };
      });
    }

    const hist = selectedNationalityHistory.map((item) => ({
      year: Number(item.year),
      value: Number(item.arrivals),
      forecast: false,
    }));
    const fcastTotals = {};
    selectedNationalityForecast.forEach((item) => {
      fcastTotals[Number(item.target_year)] =
        (fcastTotals[Number(item.target_year)] || 0) + Number(item.predicted_value || 0);
    });
    const years = [
      ...new Set([...hist.map((h) => h.year), ...Object.keys(fcastTotals).map(Number)]),
    ].sort((a, b) => a - b);
    return years.map((year) => {
      const real = hist.find((h) => h.year === year);
      if (real) return { year, arrivals: real.value, color: HIST_COLOR };
      return { year, arrivals: fcastTotals[year], color: FORECAST_COLOR };
    });
  }, [
    isMonthly,
    arrivalTrend,
    monthlyForecastSorted,
    selectedNationalityHistory,
    selectedNationalityForecast,
  ]);

  // Dynamic insights derived from the actual forecast values.
  const insights = useMemo(() => {
    const forecastValues = (isMonthly ? monthlyForecastSorted : selectedNationalityForecast)
      .map((item) => Number(item.predicted_value))
      .filter(Number.isFinite);
    if (!forecastValues.length) return [];

    const trend = overallTrend(forecastValues);
    const peakIndex = forecastValues.reduce(
      (best, v, i) => (v > forecastValues[best] ? i : best),
      0
    );
    const slowIndex = forecastValues.reduce(
      (best, v, i) => (v < forecastValues[best] ? i : best),
      0
    );
    const rows = isMonthly ? monthlyForecastSorted : selectedNationalityForecast;

    const trailing = isMonthly
      ? monthlyHistory
          .slice(-Math.max(forecastValues.length, 1))
          .map((item) => Number(item.arrivals))
      : selectedNationalityHistory
          .slice(-Math.max(forecastValues.length, 1))
          .map((item) => Number(item.arrivals));
    const growth = percentChange(mean(trailing), mean(forecastValues));

    const widths = rows
      .map((item) => ({
        lo: Number(item.lower_bound),
        hi: Number(item.upper_bound),
        v: Number(item.predicted_value),
      }))
      .filter(
        (w) => Number.isFinite(w.lo) && Number.isFinite(w.hi) && Number.isFinite(w.v) && w.v !== 0
      );
    const avgBand = widths.length
      ? mean(widths.map((w) => (Math.abs(w.hi - w.lo) / Math.abs(w.v)) * 100))
      : null;

    const result = [];
    result.push({
      icon: TREND_UI[trend].icon,
      color: TREND_UI[trend].color,
      title: `${TREND_UI[trend].label} trend through the horizon`,
      detail: `Forecast moves from ${formatValue(forecastValues[0])} to ${formatValue(forecastValues[forecastValues.length - 1])} arrivals`,
    });
    result.push({
      icon: 'star',
      color: FORECAST_COLOR,
      title: 'Forecast peak',
      detail: `${rows[peakIndex]?.tooltipLabel || formatPeriod(rows[peakIndex], isMonthly)} at ${formatValue(forecastValues[peakIndex])} arrivals`,
    });
    result.push({
      icon: 'low_priority',
      color: '#b70011',
      title: 'Forecast trough',
      detail: `${rows[slowIndex]?.tooltipLabel || formatPeriod(rows[slowIndex], isMonthly)} at ${formatValue(forecastValues[slowIndex])} arrivals`,
    });
    if (growth != null) {
      result.push({
        icon: growth >= 0 ? 'trending_up' : 'trending_down',
        color: growth >= 0 ? FORECAST_COLOR : '#b70011',
        title: 'Against recent history',
        detail: `Forecast averaged ${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% ${growth >= 0 ? 'above' : 'below'} the trailing ${forecastValues.length} ${isMonthly ? 'months' : 'years'}`,
      });
    }
    if (avgBand != null) {
      result.push({
        icon: 'tune',
        color: '#5c403c',
        title: 'Model confidence',
        detail: `Typical prediction band spans ±${(avgBand / 2).toFixed(1)}% of the forecast value`,
      });
    }
    result.push({
      icon: 'functions',
      color: HIST_COLOR,
      title: 'Cumulative outlook',
      detail: `${formatValue(forecastValues.reduce((s, v) => s + v, 0))} total arrivals projected across the ${forecastValues.length}-${isMonthly ? 'month' : 'year'} forecast window`,
    });

    return result;
  }, [
    isMonthly,
    monthlyForecastSorted,
    selectedNationalityForecast,
    monthlyHistory,
    selectedNationalityHistory,
  ]);

  function formatPeriod(item, monthly) {
    if (!item) return 'N/A';
    return monthly
      ? `${item.month} ${item.year}`
      : `${item.target_year}-${String(item.target_month).padStart(2, '0')}`;
  }

  const forecastItems = isMonthly ? monthlyForecastSorted : selectedNationalityForecast;
  const forecastValues = forecastItems
    .map((item) => Number(item.predicted_value))
    .filter(Number.isFinite);
  const availableNationalities = [...new Set(nationalityForecast.map((item) => item.topic))].sort();
  const forecastModels = [...new Set(forecastItems.map((item) => item.model_name).filter(Boolean))];

  const zoneLabelText = isMonthly
    ? `Forecast from ${
        chartZoneStart
          ? new Date(chartZoneStart).toLocaleString('en', { month: 'short', year: 'numeric' })
          : ''
      }`.trim()
    : chartZoneStart
      ? `Forecast from ${new Date(chartZoneStart).getUTCFullYear()}`
      : 'Forecast';

  const handleDownload = () => {
    if (isMonthly) {
      const historicalRows = monthlyHistory.map((item) => ({
        period: `${item.month} ${item.year}`,
        year: item.year,
        month: item.month,
        type: 'actual',
        arrivals: item.arrivals,
        predicted_value: '',
        lower_bound: '',
        upper_bound: '',
        model: '',
      }));
      const forecastRows = monthlyForecastSorted.map((item) => ({
        period: item.date,
        year: item.year,
        month: item.month,
        type: 'forecast',
        arrivals: '',
        predicted_value: item.predicted_value,
        lower_bound: item.lower_bound || '',
        upper_bound: item.upper_bound || '',
        model: '',
      }));
      const monthlyRows = [...historicalRows, ...forecastRows].sort(
        (a, b) => toMonthTimestamp(a.year, a.month) - toMonthTimestamp(b.year, b.month)
      );
      downloadCSV(monthlyRows, 'monthly-tourism-arrivals-history-forecast.csv');
      return;
    }

    const historicalRows = nationalityHistory.map((item) => ({
      nationality: item.nationality,
      year: item.year,
      month: '',
      type: 'actual',
      arrivals: item.arrivals,
      percent: item.percent != null ? item.percent : '',
      predicted_value: '',
      lower_bound: '',
      upper_bound: '',
      model: '',
    }));
    const forecastRows = nationalityForecast.map((item) => ({
      nationality: item.topic,
      year: item.target_year,
      month: item.target_month,
      type: 'forecast',
      arrivals: '',
      percent: '',
      predicted_value: item.predicted_value,
      lower_bound: item.lower_bound || '',
      upper_bound: item.upper_bound || '',
      model: formatModelName(item.model_name),
    }));
    const nationalityRows = [...historicalRows, ...forecastRows].sort((a, b) => {
      const nameDiff = String(a.nationality).localeCompare(String(b.nationality));
      return nameDiff !== 0 ? nameDiff : Number(a.year) - Number(b.year);
    });
    downloadCSV(nationalityRows, 'nationality-tourism-arrivals-history-forecast.csv');
  };

  const showContent = done && forecastItems.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold text-onSurface">AI Predictions</h3>
        <p className="text-onSurface-variant text-sm">
          Machine learning forecasts trained on 10+ years of NRB, CBS, and DoT tourism data
        </p>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-3 border border-red-200 bg-red-50 p-4 rounded-sm">
          <Icon name="error" size={22} color="#b70011" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <BtnOutline onClick={retry} className="gap-2 rounded-sm">
            <Icon name="refresh" size={14} /> Retry
          </BtnOutline>
        </div>
      )}

      {/* KPI summary cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-surface border border-outline-variant rounded-sm p-5">
              <SkeletonBlock className="h-4 w-24 mb-2" />
              <SkeletonBlock className="h-8 w-28 mb-2" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
          ))}
        </div>
      ) : !error ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {kpis.map((card) => (
            <div
              key={card.key}
              className="bg-surface border border-outline-variant rounded-sm p-5 card-shadow"
              style={{ borderTop: `3px solid ${card.color}` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase text-onSurface-variant">
                  {card.label}
                </div>
                <Icon name={card.icon} size={18} color={card.color} />
              </div>
              <div className="text-3xl font-bold text-onSurface font-hanken">{card.value}</div>
              <div className="text-xs text-onSurface-variant mt-1">{card.sub}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Configure */}
      <SectionCard
        title="Configure Forecast"
        subtitle="Explore the tourism forecasts produced by the trained models"
        className="rounded-sm"
      >
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <div className="text-xs font-bold uppercase text-onSurface-variant mb-2.5">
              Forecast dataset
            </div>
            <div className="flex gap-2 rounded-sm border border-outline-variant p-1">
              {[
                ['monthly', 'Monthly arrivals'],
                ['nationality', 'By nationality'],
              ].map(([v, l]) => (
                <TabBtn key={v} active={type === v} onClick={() => setType(v)}>
                  {l}
                </TabBtn>
              ))}
            </div>
          </div>

          {!isMonthly && (
            <label className="text-xs font-bold uppercase text-onSurface-variant">
              Nationality
              <span className="mt-2 block">
                <ThemedSelect
                  value={nationality}
                  onChange={(event) => setNationality(event.target.value)}
                >
                  {(availableNationalities.length ? availableNationalities : ['India']).map(
                    (item) => (
                      <option key={item} value={item}>
                        {formatCountryName(item)}
                      </option>
                    )
                  )}
                </ThemedSelect>
              </span>
            </label>
          )}

          {isMonthly && (
            <>
              <label className="text-xs font-bold uppercase text-onSurface-variant">
                Year
                <span className="mt-2 block">
                  <ThemedSelect
                    value={selectedMonthlyYear}
                    onChange={(event) => setMonthlyYear(event.target.value)}
                  >
                    {monthlyYears.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </ThemedSelect>
                </span>
              </label>
              <label className="flex h-[38px] cursor-pointer select-none items-center gap-2 text-xs font-bold uppercase text-onSurface-variant">
                <input
                  type="checkbox"
                  checked={fullTimeline}
                  onChange={(event) => setFullTimeline(event.target.checked)}
                  className="size-4 accent-[#0051d5] cursor-pointer"
                />
                Full timeline
              </label>
            </>
          )}

          <div className="flex items-center gap-3 ml-auto">
            <BtnPrimary
              onClick={() => setDone(true)}
              className="gap-2 rounded-sm"
              disabled={loading || !forecastItems.length}
            >
              <Icon name="auto_awesome" size={16} color="#fff" />
              View Forecast
            </BtnPrimary>
            {showContent && (
              <BtnOutline
                onClick={handleDownload}
                className="gap-2 rounded-sm"
                title={`Download ${label} historical + forecast data as CSV`}
              >
                <Icon name="download" size={14} />
                Download CSV
              </BtnOutline>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Main forecast chart */}
      {showContent && (
        <SectionCard
          title={`${label} — Historical + AI Forecast`}
          subtitle={
            isMonthly
              ? 'Solid blue line = historical arrivals · Green line with shaded band = model prediction'
              : 'Solid blue = actual arrivals · Green = AI annual projections with confidence band'
          }
          className="rounded-sm"
          contentClassName="min-h-[320px]"
        >
          <LineChart
            data={chartRows.rows}
            xKey="period"
            labelKey="label"
            tooltipKey="tooltipLabel"
            timeScale
            xDomainStart={chartStart}
            xDomainEnd={chartEnd}
            zoneStart={chartZoneStart}
            zoneLabel={zoneLabelText === 'Forecast' ? 'Forecast starts' : zoneLabelText}
            bands={[{ keyMin: 'lower', keyMax: 'upper', color: FORECAST_COLOR, opacity: 0.12 }]}
            series={[
              { key: 'hist', color: HIST_COLOR, label: 'Historical' },
              { key: 'forecast', color: FORECAST_COLOR, label: 'AI Forecast', dashed: true },
            ]}
            height={440}
          />
        </SectionCard>
      )}

      {/* Seasonality + Annual comparison */}
      {showContent && (
        <div className="grid grid-cols-1 gap-6">
          {seasonality && (
            <SectionCard
              title="Seasonality"
              subtitle="Average arrivals by calendar month — history vs forecast"
              className="rounded-sm h-full"
            >
              <div className="h-80">
                <BarChart
                  data={seasonality.data}
                  xKey="name"
                  series={[
                    { key: 'histAvg', color: HIST_COLOR, label: 'Historical avg' },
                    { key: 'fcastAvg', color: FORECAST_COLOR, label: 'Forecast avg' },
                  ]}
                  height="100%"
                  bordered={false}
                  tooltipFormatter={(month) => `${month} month average`}
                />
              </div>
            </SectionCard>
          )}

          <SectionCard
            title="Annual Tourist Arrivals"
            subtitle="Real arrivals by year with the forecast period highlighted in green"
            className="rounded-sm h-full"
          >
            <div className={!isMonthly ? 'h-[28rem]' : 'h-96'}>
              <BarChart
                data={annual}
                xKey="year"
                labelKey="year"
                valueKey="arrivals"
                height="100%"
                bordered={false}
                tooltipFormatter={(year) => `Arrivals ${year}`}
              />
            </div>
          </SectionCard>
        </div>
      )}

      {/* Forecast detail cards */}
      {showContent && (
        <SectionCard
          title="Forecast Detail"
          subtitle={
            isMonthly
              ? `Model outputs for the ${forecastItems.length}-month forecast window — scroll to see all`
              : `Model outputs for ${forecastItems.length} annual projections for ${nationality} — scroll to see all`
          }
          className="rounded-sm"
        >
          <div className="max-h-[34rem] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {forecastItems.map((item, i) => {
                const trend = overallTrend(forecastValues.slice(0, i + 1));
                const tr = TREND_UI[trend];
                return (
                  <div
                    key={`${isMonthly ? item.date : item.topic}-${i}`}
                    className="bg-surface-lowest border border-outline-variant rounded-sm p-4"
                    style={{ borderTop: `3px solid ${FORECAST_COLOR}` }}
                  >
                    <div className="text-xs font-bold uppercase text-onSurface-variant mb-1.5">
                      {isMonthly
                        ? `${item.month} ${item.year}`
                        : `${item.target_year}-${String(item.target_month).padStart(2, '0')}`}
                    </div>
                    <div className="text-2xl font-bold text-onSurface font-hanken">
                      {formatValue(item.predicted_value)}
                    </div>
                    {item.lower_bound != null && (
                      <div className="text-xs text-onSurface-variant mt-1">
                        Range: {formatValue(item.lower_bound)} – {formatValue(item.upper_bound)}
                      </div>
                    )}
                    {item.model_name && (
                      <div className="text-xs text-onSurface-variant mt-1">
                        Model: {formatModelName(item.model_name)}
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-2">
                      <Icon name={tr.icon} size={14} color={tr.color} />
                      <span className="text-xs font-bold" style={{ color: tr.color }}>
                        {tr.label} {i > 0 ? 'vs prior' : 'to start'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>
      )}

      {/* AI Forecast Insights */}
      {showContent && insights.length > 0 && (
        <SectionCard
          title="AI Forecast Insights"
          subtitle="What the numbers say about the horizon ahead"
          className="rounded-sm"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights.map((insight, i) => (
              <div
                key={i}
                className="p-4 bg-surface-lowest border border-outline-variant rounded-sm"
                style={{ borderLeft: `3px solid ${insight.color}` }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon name={insight.icon} size={18} color={insight.color} />
                  <span className="text-sm font-bold text-onSurface">{insight.title}</span>
                </div>
                <p className="text-xs text-onSurface-variant leading-relaxed">{insight.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Model Information — only when the backend actually provides per-row model metadata */}
      {showContent && forecastModels.length > 0 && (
        <SectionCard
          title="Model Information"
          subtitle="Forecast algorithms reported by the ML pipeline"
          className="rounded-sm"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {forecastModels.map((model, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3.5 bg-surface-lowest border border-outline-variant rounded-sm"
              >
                <Icon name="memory" size={18} color={FORECAST_COLOR} />
                <div>
                  <div className="text-sm font-bold text-onSurface">{formatModelName(model)}</div>
                  <div className="text-xs text-onSurface-variant">Model ID {model}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Empty pre-generation prompt */}
      {!done && !loading && !error && (
        <div className="border-2 border-dashed border-outline-variant rounded-sm p-16 text-center">
          <Icon name="auto_awesome" size={48} color="#916f6b" className="block mx-auto mb-4" />
          <div className="text-base font-bold text-onSurface-variant mb-1.5">
            Select parameters above and click View Forecast
          </div>
          <div className="text-sm text-onSurface-variant opacity-70">
            Historical data shown from 2015 with model forecasts through 2026
          </div>
        </div>
      )}
    </div>
  );
}
