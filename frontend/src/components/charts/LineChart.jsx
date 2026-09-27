import { useMemo, useState, useRef, useLayoutEffect, useCallback } from 'react';
import { MUTED_SERIES_COLOR } from '../../theme/chartPalette';

const MS_MONTH = 30.44 * 24 * 60 * 60 * 1000;
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const TOOLTIP_MARGIN = 10;
const TOOLTIP_GAP = 12;
const ARROW_SIZE = 8;

// Module-level defaults so the memoized `chart` stays stable across renders —
// inline/literal defaults would create a new array reference every render and
// invalidate the chart memo (which caused an infinite tooltip update loop).
const NO_DATA = [];
const NO_BANDS = [];
const DEFAULT_SERIES = [{ key: 'value', color: '#b70011', label: 'Value' }];

// Charts with at least this many overlapping lines get hover-to-isolate by
// default: below it the lines stay readable side by side, above it tracing a
// single series through the crossings is the problem worth solving.
const HIGHLIGHT_SERIES_THRESHOLD = 5;
const MUTED_OPACITY = 0.9;

/** Left gutter: tick labels need ~46px, a y-axis caption needs a wider one. */
const yGutter = (yAxisTitle) => (yAxisTitle ? 76 : 46);

// Compact axis labels: 81234 -> "81.2K", 2400000 -> "2.4M", 0.25 -> "0.3".
function formatTick(value) {
  const trim = (text) => text.replace(/\.0+$/, '');
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${trim((value / 1e6).toFixed(2))}M`;
  if (abs >= 1e3) return `${trim((value / 1e3).toFixed(1))}K`;
  return Number(value.toFixed(1)).toLocaleString();
}

// Tooltip values keep decimals for small numbers so e.g. 0.25 doesn't read "0".
function formatValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString(undefined, {
    maximumFractionDigits: Math.abs(num) < 100 ? 2 : 0,
  });
}

// Round a raw step up to a "nice" value (1/2/2.5/5 * power of ten) so tick
// labels read cleanly instead of showing long decimal fragments.
function niceStep(rawVal) {
  if (!(rawVal > 0) || !Number.isFinite(rawVal)) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawVal)));
  const normalized = rawVal / magnitude;
  const multiplier =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return multiplier * magnitude;
}

export default function LineChart({
  data = NO_DATA,
  xKey = 'year',
  labelKey = xKey,
  tooltipKey = labelKey,
  timeScale = false,
  xDomainStart,
  xDomainEnd,
  yDomain = [null, null], // Optional fixed [min, max]; null/undefined bounds auto-scale
  yAxisTitle = '', // Optional rotated y-axis caption, e.g. "Real growth (%)"
  showZeroGridline = false, // Light solid line at 0% alongside the dashed zero line
  zoneStart,
  zoneLabel = 'Forecast',
  bands = NO_BANDS, // Shaded min/max range bands: [{ keyMin, keyMax, color, opacity }]
  series = DEFAULT_SERIES,
  height = 380,
  unit = '',
  showZeroLine = false,
  fillArea = true,
  valueFormatter = null,
  showLegend = true,
  highlightOnHover, // Defaults to on for charts with 5+ series
  ariaLabel,
  tooltipExtra = null, // Optional render prop: (activeItem) => extra tooltip rows
}) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [tip, setTip] = useState(null);
  const [plotWidth, setPlotWidth] = useState(0);
  const [plotHeight, setPlotHeight] = useState(0);
  const [highlightedKey, setHighlightedKey] = useState(null);

  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

  // Latest values seen through refs so the tooltip-position effect only re-runs
  // when the active index actually changes, never on incidental re-renders.
  const chartRef = useRef(null);
  const dataRef = useRef(data);
  const xKeyRef = useRef(xKey);
  dataRef.current = data;
  xKeyRef.current = xKey;

  // The viewBox mirrors the measured plot box in CSS pixels (1 viewBox unit = 1px),
  // so geometry, strokes, markers and text keep a 1:1 scale at any container size.
  // Using the measured box as the viewBox (instead of a fixed 1000x500 one) is what
  // prevents wide/short charts from stretching glyphs and markers.
  const VB_WIDTH_FALLBACK = 1000;
  const VB_HEIGHT_FALLBACK = 380;
  const vbWidth = plotWidth || VB_WIDTH_FALLBACK;
  const vbHeight = plotHeight || VB_HEIGHT_FALLBACK;
  const PADDING_Y = 34;
  const PADDING_X = yGutter(yAxisTitle);
  const highlightEnabled = highlightOnHover ?? series.length >= HIGHLIGHT_SERIES_THRESHOLD;

  const toTimeValue = useCallback((value) => {
    if (typeof value === 'number') return value;
    const timestamp = Date.parse(String(value));
    return Number.isNaN(timestamp) ? null : timestamp;
  }, []);

  const chart = useMemo(() => {
    if (!data.length) return null;
    const PADDING_X = yGutter(yAxisTitle);

    // Include band values (e.g. forecast confidence bounds) in the domain so
    // the shaded range never clips against the plot edges.
    const bandKeys = bands.flatMap((b) => [b.keyMin, b.keyMax]);
    const allValues = [
      ...series.flatMap((s) =>
        data.map((d) => d[s.key]).filter((v) => v !== null && v !== undefined)
      ),
      ...bandKeys.flatMap((k) =>
        data.map((d) => d[k]).filter((v) => v !== null && v !== undefined)
      ),
    ]
      .map(Number)
      .filter(Number.isFinite);

    // Optional fixed [min, max] bounds override the data-derived domain so
    // multiple charts can share one scale (used by the Compare page).
    const domainMin = Number.isFinite(yDomain?.[0]) ? yDomain[0] : null;
    const domainMax = Number.isFinite(yDomain?.[1]) ? yDomain[1] : null;
    const max = domainMax ?? (allValues.length ? Math.max(...allValues) : 1);
    const min = domainMin ?? (allValues.length ? Math.min(...allValues) : 0);
    const range = max - min || 1;

    const timeValues = timeScale
      ? data.map((item) => toTimeValue(item[xKey])).filter((value) => value !== null)
      : [];
    const firstPeriod = timeScale
      ? (xDomainStart ?? (timeValues.length ? Math.min(...timeValues) : null))
      : null;
    const lastPeriod = timeScale
      ? (xDomainEnd ?? (timeValues.length ? Math.max(...timeValues) : null))
      : null;
    const periodRange = Math.max((lastPeriod || 0) - (firstPeriod || 0), 1);
    const xForValue = (value, index) => {
      const period = timeScale ? toTimeValue(value) : null;
      const position = timeScale
        ? (period - firstPeriod) / periodRange
        : index / Math.max(data.length - 1, 1);
      const clamped = Math.max(0, Math.min(1, position));
      return PADDING_X + clamped * (vbWidth - PADDING_X * 2);
    };

    // Nice, evenly-spaced Y ticks within the data min..max range.
    const step = niceStep((max - min) / (5 - 1));
    const firstTick = Math.ceil(min / step) * step;
    const ticks = [];
    for (let value = firstTick; value <= max + step * 1e-6; value += step) {
      ticks.push(value);
      if (ticks.length > 12) break;
    }
    if (ticks.length < 2) ticks.push(min, max);

    const zoneX = timeScale && zoneStart != null ? xForValue(zoneStart) : null;

    const seriesData = series.map((s) => {
      const rawPoints = data
        .map((d, index) => ({ raw: d[s.key], index }))
        .filter((p) => p.raw !== null && p.raw !== undefined);

      const points = rawPoints.map(({ raw, index }) => {
        const value = Number(raw);
        const x = xForValue(data[index][xKey], index);
        const y = vbHeight - PADDING_Y - ((value - min) / range) * (vbHeight - PADDING_Y * 2);
        return { x, y, value, index };
      });

      const pointRuns = [];
      let currentRun = [];
      data.forEach((item, index) => {
        const raw = item[s.key];
        if (raw !== null && raw !== undefined && Number.isFinite(Number(raw))) {
          const value = Number(raw);
          const x = xForValue(item[xKey], index);
          const y = vbHeight - PADDING_Y - ((value - min) / range) * (vbHeight - PADDING_Y * 2);
          currentRun.push({ x, y, value, index });
        } else if (currentRun.length) {
          pointRuns.push(currentRun);
          currentRun = [];
        }
      });
      if (currentRun.length) pointRuns.push(currentRun);

      const path = pointRuns
        .map((run) =>
          run.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
        )
        .join(' ');

      const area = pointRuns
        .map(
          (run) =>
            `${run.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')} L ${run[run.length - 1].x} ${vbHeight - PADDING_Y} L ${run[0].x} ${vbHeight - PADDING_Y} Z`
        )
        .join(' ');

      return { ...s, points, path, area };
    });

    // Readable x-axis plan: ~8 evenly spaced labels. Time series step in whole
    // months (1/2/3/6/12/24...) so labels read "Jan 2021", "Jul 2021", ...
    const labelTicks = [];
    if (timeScale && timeValues.length && firstPeriod != null && lastPeriod != null) {
      const months = Math.max((lastPeriod - firstPeriod) / MS_MONTH, 1);
      const stepMonths = [1, 2, 3, 6, 12, 24, 48, 96].find((s) => months / s <= 8.5) || 96;
      const startDate = new Date(firstPeriod);
      const y0 = startDate.getUTCFullYear();
      const m0 = startDate.getUTCMonth();
      data.forEach((item, index) => {
        const t = toTimeValue(item[xKey]);
        if (t == null) return;
        const d = new Date(t);
        const elapsed = (d.getUTCFullYear() - y0) * 12 + (d.getUTCMonth() - m0);
        if (elapsed % stepMonths === 0) {
          labelTicks.push({
            index,
            label: `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
          });
        }
      });
      // Always end on the last point so the edge label never truncates.
      const lastIndex = data.length - 1;
      if (!labelTicks.length || labelTicks[labelTicks.length - 1].index !== lastIndex) {
        const lastT = toTimeValue(data[lastIndex][xKey]);
        const d = new Date(lastT);
        const lastLabel = `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
        if (!labelTicks.some((t) => t.index === lastIndex)) {
          labelTicks.push({ index: lastIndex, label: lastLabel });
        }
      }
    } else {
      // Evenly spread labels across the whole axis including both endpoints.
      // The category axis is ordinal, so points sit at equal x positions and
      // the readout is cleanest when every point is labeled when it fits. We
      // estimate label width from the longest label to cap the count, and
      // enforce a minimum index gap of 2 when sub-sampling so rounded tick
      // positions never land two labels on neighbouring points (which collided
      // on dense series such as the salary index).
      const maxLabelLength = Math.max(...data.map((item) => String(item[labelKey]).length), 1);
      const plotWidthPx = plotWidth || 760;
      const labelPx = maxLabelLength * 7.1 + 6; // ~56px for "2012/13" at 12px semibold
      const spanPx = plotWidthPx * (1 - (2 * PADDING_X) / vbWidth);
      const maxLabels = Math.max(3, Math.min(10, Math.floor(spanPx / labelPx) + 1));
      if (data.length <= maxLabels) {
        for (let i = 0; i < data.length; i++) {
          labelTicks.push({ index: i, label: String(data[i][labelKey]) });
        }
      } else {
        const lastIndex = data.length - 1;
        let previous = 0;
        labelTicks.push({ index: 0, label: String(data[0][labelKey]) });
        for (let i = 1; i <= maxLabels - 1; i++) {
          const index = Math.round((i * lastIndex) / (maxLabels - 1));
          if (index - previous >= 2) {
            labelTicks.push({ index, label: String(data[index][labelKey]) });
            previous = index;
          }
        }
        if (labelTicks[labelTicks.length - 1].index !== lastIndex) {
          labelTicks[labelTicks.length - 1] = {
            index: lastIndex,
            label: String(data[lastIndex][labelKey]),
          };
        }
      }
      if (!labelTicks.length) labelTicks.push({ index: 0, label: String(data[0][labelKey]) });
    }
    if (!labelTicks.length) labelTicks.push({ index: 0, label: String(data[0][labelKey]) });

    return {
      min,
      max,
      ticks,
      zoneX,
      seriesData,
      xForValue,
      labelTicks,
      bandKeys,
      vbWidth,
      vbHeight,
    };
  }, [
    data,
    series,
    xKey,
    labelKey,
    timeScale,
    xDomainStart,
    xDomainEnd,
    yDomain,
    yAxisTitle,
    zoneStart,
    bands,
    toTimeValue,
    plotWidth,
    vbWidth,
    vbHeight,
  ]);

  chartRef.current = chart;

  // Hover state can outlive the data it was captured against: a new response can
  // arrive with fewer rows while the pointer is still over the old chart (the
  // Compare page swaps in whatever two series currently share periods, so the
  // row count changes on every filter/series change). `activeIndex` is only
  // cleared by onMouseLeave, so it can point past the end of the new `data` and
  // every `data[activeIndex]` dereference below would throw. Clamp it once here
  // and use the clamped value everywhere.
  const safeIndex = activeIndex != null && activeIndex >= 0 && activeIndex < data.length ? activeIndex : null;

  // Indices with at least one visible (non-faint) series value -> hover targets.
  const hoverableIndices = chart
    ? data
        .map((_, idx) => idx)
        .filter((idx) =>
          chart.seriesData.some((s) => !s.faint && s.points.some((p) => p.index === idx))
        )
    : [];

  const activePoints =
    safeIndex != null && chart
      ? chart.seriesData.flatMap((s) =>
          !s.faint
            ? s.points
                .filter((p) => p.index === safeIndex)
                .map((p) => ({ ...p, seriesKey: s.key, seriesLabel: s.label, color: s.color }))
            : []
        )
      : [];

  // Measure the HTML tooltip in real pixels against the plot box, then clamp it
  // fully inside the container (same pattern as BarChart) for crisp, edge-safe text.
  const recomputeTooltipPosition = useCallback(() => {
    const c = chartRef.current;
    const d = dataRef.current;
    const xk = xKeyRef.current;
    if (activeIndex == null || !c || !containerRef.current || !tooltipRef.current) {
      setTip((prev) => (prev === null ? prev : null));
      return;
    }
    const active = d[activeIndex];
    if (!active) {
      setTip((prev) => (prev === null ? prev : null));
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const points = c.seriesData.flatMap((s) =>
      !s.faint ? s.points.filter((p) => p.index === activeIndex) : []
    );
    if (!points.length) {
      setTip((prev) => (prev === null ? prev : null));
      return;
    }

    const xPct = (c.xForValue(active[xk], activeIndex) / c.vbWidth) * 100;
    const markerTopY = Math.min(...points.map((p) => p.y));
    const markerX = (xPct / 100) * containerRect.width;
    const markerY = (markerTopY / c.vbHeight) * containerRect.height;

    const half = tooltipRect.width / 2;
    const clampedLeft = Math.min(
      Math.max(markerX, half + TOOLTIP_MARGIN),
      Math.max(half + TOOLTIP_MARGIN, containerRect.width - half - TOOLTIP_MARGIN)
    );

    const flipBelow = markerY - tooltipRect.height - TOOLTIP_GAP - ARROW_SIZE < TOOLTIP_MARGIN;
    const rawTop = flipBelow ? markerY + TOOLTIP_GAP : markerY - tooltipRect.height - TOOLTIP_GAP;
    const clampedTop = Math.min(
      Math.max(rawTop, TOOLTIP_MARGIN),
      Math.max(TOOLTIP_MARGIN, containerRect.height - tooltipRect.height - TOOLTIP_MARGIN)
    );

    const arrowLeft = Math.min(
      Math.max(markerX - (clampedLeft - half), 14),
      tooltipRect.width - 14
    );

    const next = { left: clampedLeft, top: clampedTop, arrowLeft, flipBelow };
    setTip((prev) =>
      prev &&
      prev.left === next.left &&
      prev.top === next.top &&
      prev.arrowLeft === next.arrowLeft &&
      prev.flipBelow === next.flipBelow
        ? prev
        : next
    );
  }, [activeIndex]);

  useLayoutEffect(() => {
    recomputeTooltipPosition();
  }, [recomputeTooltipPosition, data, chart]);

  // Keep x-axis tick density accurate by measuring the plot box. The chart
  // container only mounts once data arrives, so re-observe once it exists.
  const hasChartLayout = !!chart;
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const update = () => {
      setPlotWidth(node.clientWidth);
      setPlotHeight(node.clientHeight);
    };
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasChartLayout]);

  useLayoutEffect(() => {
    if (activeIndex == null) return undefined;
    const handle = () => recomputeTooltipPosition();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [activeIndex, recomputeTooltipPosition]);

  if (!data.length || !chart || chart.seriesData.every((s) => s.points.length === 0)) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{
          height,
          width: '100%',
          border: '1px solid #e2e2e2',
          color: '#8a8a8a',
          fontFamily: "'Hanken Grotesk', sans-serif",
        }}
      >
        No data available
      </div>
    );
  }

  // `safeIndex` (clamped against the current row count) is used instead of the
  // raw `activeIndex` here: the old `data[activeIndex][xKey]` threw
  // "Cannot read properties of undefined" whenever a shorter dataset landed
  // under a still-hovered point, which unmounted the whole app. The ErrorBoundary
  // in main.jsx now contains such a throw, but it should never be needed.
  const activeItem = safeIndex != null ? data[safeIndex] : null;
  const activeX = safeIndex != null ? chart.xForValue(activeItem[xKey], safeIndex) : null;
  const hasHover = safeIndex != null && activePoints.length > 0;

  // Hover-to-isolate: with 5+ overlapping lines only the hovered series keeps
  // its colour and weight, everything else drops to light grey.
  const focusedSeries =
    highlightEnabled && highlightedKey != null
      ? chart.seriesData.find((s) => s.key === highlightedKey) || null
      : null;
  const isMuted = (s) => focusedSeries != null && s.key !== focusedSeries.key;
  const hoverColor =
    focusedSeries?.color || chart.seriesData.find((s) => !s.faint)?.color || '#0051d5';
  const zeroInRange = chart.min <= 0 && chart.max >= 0;
  const zeroY =
    vbHeight -
    PADDING_Y -
    ((0 - chart.min) / (chart.max - chart.min || 1)) * (vbHeight - PADDING_Y * 2);
  const isTickAtZero = chart.ticks.some((tick) => Math.abs(tick) < 1e-9);

  return (
    <div
      className={`flex w-full min-h-0 flex-col ${typeof height === 'number' ? '' : 'h-full'}`}
      style={{
        height: typeof height === 'number' ? height : undefined,
        backgroundColor: '#ffffff',
        fontFamily: "'Hanken Grotesk', sans-serif",
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Plot area. position:relative so the HTML tooltip can be measured/placed in real pixels. */}
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1"
        style={{ position: 'relative', flex: '1 1 auto' }}
      >
        <svg
          viewBox={`0 0 ${chart.vbWidth} ${chart.vbHeight}`}
          role={ariaLabel ? 'img' : undefined}
          aria-label={ariaLabel}
          preserveAspectRatio="xMidYMid meet"
          width="100%"
          height="100%"
          style={{ display: 'block' }}
        >
          <defs>
            {chart.seriesData.map((s) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.16" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Horizontal grid + y tick labels */}
          {chart.ticks.map((tick, tickIndex) => {
            const y =
              vbHeight -
              PADDING_Y -
              ((tick - chart.min) / (chart.max - chart.min || 1)) * (vbHeight - PADDING_Y * 2);
            const isEdgemost = tick === chart.ticks[chart.ticks.length - 1];
            return (
              <g key={`${tick}-${tickIndex}`}>
                <line
                  x1={PADDING_X}
                  y1={y}
                  x2={chart.vbWidth - PADDING_X}
                  y2={y}
                  stroke={isEdgemost ? '#D0D5DD' : '#E4E7EC'}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={PADDING_X - 12}
                  y={y + 4}
                  fontSize={11}
                  fill="#667085"
                  fontWeight="600"
                  textAnchor="end"
                >
                  {formatTick(tick)}
                  {unit}
                </text>
              </g>
            );
          })}

          {/* Zero reference: a light solid gridline for reading the 0% mark,
              plus the existing dashed line when the caller asks for it. */}
          {showZeroGridline && zeroInRange && !isTickAtZero && (
            <line
              x1={PADDING_X}
              y1={zeroY}
              x2={chart.vbWidth - PADDING_X}
              y2={zeroY}
              stroke="#D0D5DD"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Baseline axis */}
          <line
            x1={PADDING_X}
            y1={vbHeight - PADDING_Y}
            x2={chart.vbWidth - PADDING_X}
            y2={vbHeight - PADDING_Y}
            stroke="#D0D5DD"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />

          {showZeroLine && zeroInRange && (
            <line
              x1={PADDING_X}
              y1={zeroY}
              x2={chart.vbWidth - PADDING_X}
              y2={zeroY}
              stroke="#64748B"
              strokeWidth="1"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Y-axis caption */}
          {yAxisTitle && (
            <text
              transform={`translate(14 ${vbHeight / 2}) rotate(-90)`}
              x={0}
              y={0}
              textAnchor="middle"
              fontSize={11}
              fontWeight="700"
              fill="#475467"
              style={{ letterSpacing: '0.04em' }}
            >
              {yAxisTitle}
            </text>
          )}

          {/* Forecast zone: subtle tint + clean dashed divider + label chip */}
          {chart.zoneX != null && (
            <g>
              <rect
                x={chart.zoneX}
                y={PADDING_Y}
                width={chart.vbWidth - PADDING_X - chart.zoneX}
                height={vbHeight - PADDING_Y * 2}
                fill="#F4F7F6"
              />
              <line
                x1={chart.zoneX}
                y1={PADDING_Y}
                x2={chart.zoneX}
                y2={vbHeight - PADDING_Y}
                stroke="#94A3B8"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
              <g>
                {(() => {
                  const chipWidth = zoneLabel.length * 7.2 + 18;
                  const chipX = Math.min(chart.zoneX + 8, chart.vbWidth - PADDING_X - chipWidth);
                  return (
                    <>
                      <rect
                        x={chipX}
                        y={PADDING_Y + 10}
                        width={chipWidth}
                        height={20}
                        rx={4}
                        fill="#334155"
                        opacity="0.92"
                      />
                      <text
                        x={chipX + 9}
                        y={PADDING_Y + 24}
                        fontSize={11}
                        fontWeight="700"
                        fill="#ffffff"
                      >
                        {zoneLabel}
                      </text>
                    </>
                  );
                })()}
              </g>
            </g>
          )}

          {/* Bands: shaded min..max range between two keys (e.g. forecast confidence) */}
          {bands.map((b, bi) => {
            const runs = [];
            let current = [];
            data.forEach((d, idx) => {
              const bandLo = Number(d[b.keyMin]);
              const bandHi = Number(d[b.keyMax]);
              if (Number.isFinite(bandLo) && Number.isFinite(bandHi)) {
                current.push({
                  x: chart.xForValue(data[idx][xKey], idx),
                  yHi:
                    vbHeight -
                    PADDING_Y -
                    ((bandHi - chart.min) / (chart.max - chart.min || 1)) *
                      (vbHeight - PADDING_Y * 2),
                  yLo:
                    vbHeight -
                    PADDING_Y -
                    ((bandLo - chart.min) / (chart.max - chart.min || 1)) *
                      (vbHeight - PADDING_Y * 2),
                });
              } else if (current.length) {
                runs.push(current);
                current = [];
              }
            });
            if (current.length) runs.push(current);
            return runs.map((run, ri) => {
              let d = `M ${run[0].x} ${run[0].yHi}`;
              for (let i = 1; i < run.length; i++) d += ` L ${run[i].x} ${run[i].yHi}`;
              for (let i = run.length - 1; i >= 0; i--) d += ` L ${run[i].x} ${run[i].yLo}`;
              d += ' Z';
              return <path key={`${bi}-${ri}`} d={d} fill={b.color} fillOpacity={b.opacity} />;
            });
          })}

          {/* Areas + lines (faint series first so bold ones sit on top). Area
              fills are only drawn for single-series charts: stacked fills on
              multi-line charts turn the plot muddy and hide the other lines. */}
          {[
            ...chart.seriesData.filter((s) => s.faint),
            ...chart.seriesData.filter((s) => !s.faint),
          ].map((s) => {
            const muted = isMuted(s);
            return (
              <g key={s.key} style={{ transition: 'opacity 150ms ease' }}>
                {s.area && !s.faint && fillArea && chart.seriesData.length === 1 && (
                  <path d={s.area} fill={`url(#fill-${s.key})`} />
                )}
                <path
                  d={s.path}
                  fill="none"
                  stroke={muted ? MUTED_SERIES_COLOR : s.color}
                  strokeWidth={s.bold ? 3 : s.faint ? 1.2 : focusedSeries?.key === s.key ? 3 : 2}
                  strokeOpacity={muted ? MUTED_OPACITY * 0.35 : s.faint ? 0.35 : 1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={s.dashed ? '6 5' : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}

          {/* Hover slabs: transparent hit areas covering each data index */}
          {hoverableIndices.map((idx) => {
            const x = chart.xForValue(data[idx][xKey], idx);
            const prevX = idx > 0 ? chart.xForValue(data[idx - 1][xKey], idx - 1) : PADDING_X;
            const nextX =
              idx < data.length - 1
                ? chart.xForValue(data[idx + 1][xKey], idx + 1)
                : chart.vbWidth - PADDING_X;
            const left = Math.max(PADDING_X, (x + prevX) / 2);
            const right = Math.min(chart.vbWidth - PADDING_X, (x + nextX) / 2);
            return (
              <rect
                key={idx}
                x={left}
                y={PADDING_Y - 4}
                width={Math.max(right - left, 1)}
                height={vbHeight - PADDING_Y * 2 + 8}
                fill="transparent"
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                style={{ cursor: 'pointer' }}
              />
            );
          })}

          {/* Hover feedback: soft highlight band, guide line and halo markers */}
          {hasHover && activeX != null && (
            <g>
              <rect
                x={activeX - 1}
                y={PADDING_Y}
                width={2}
                height={vbHeight - PADDING_Y * 2}
                fill={hoverColor}
                opacity="0.07"
              />
              <line
                x1={activeX}
                y1={PADDING_Y}
                x2={activeX}
                y2={vbHeight - PADDING_Y}
                stroke="#98A2B3"
                strokeWidth="1"
                strokeDasharray="3 4"
                strokeOpacity="0.5"
                vectorEffect="non-scaling-stroke"
              />
              {activePoints.map((p) => {
                const muted = focusedSeries != null && p.seriesKey !== focusedSeries.key;
                const dotColor = muted ? MUTED_SERIES_COLOR : p.color;
                return (
                  <g key={p.seriesKey}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={muted ? 6 : p.bold ? 10 : 8}
                      fill={dotColor}
                      fillOpacity={muted ? 0.12 : 0.18}
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={muted ? 3 : p.bold ? 5.5 : 4.5}
                      fill="#ffffff"
                      stroke={dotColor}
                      strokeWidth={muted ? 1.5 : 2.5}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
            </g>
          )}
        </svg>

        {/* Crisp HTML tooltip, pinned to the active marker */}
        {activeItem && hasHover && (
          <div
            ref={tooltipRef}
            className="pointer-events-none absolute z-10 bg-white px-4 py-3 text-sm shadow-xl"
            style={{
              left: tip ? tip.left : '50%',
              top: tip ? tip.top : '50%',
              transform: tip ? 'translate(-50%, 0)' : 'translate(-50%, -50%)',
              opacity: tip ? 1 : 0,
              transition: 'opacity 120ms ease, left 120ms ease, top 120ms ease',
              whiteSpace: 'nowrap',
              borderRadius: 8,
              border: '1px solid #E4E7EC',
              boxShadow: '0 6px 20px rgba(16, 24, 40, 0.12)',
            }}
          >
            <p className="text-xs font-bold text-onSurface">{String(activeItem[tooltipKey])}</p>
            {activePoints.map((p) => {
              const muted = focusedSeries != null && p.seriesKey !== focusedSeries.key;
              return (
                <p
                  key={p.seriesKey}
                  className="mt-1 text-xs"
                  style={{ color: muted ? '#98A2B3' : undefined }}
                >
                  <span
                    className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ backgroundColor: muted ? MUTED_SERIES_COLOR : p.color }}
                  />
                  {p.seriesLabel || p.seriesKey}:{' '}
                  <strong
                    style={{ color: muted ? '#98A2B3' : undefined }}
                    className="text-onSurface"
                  >
                    {valueFormatter ? valueFormatter(p.value) : formatValue(p.value)}
                    {unit}
                  </strong>
                </p>
              );
            })}
            {tooltipExtra && tooltipExtra(activeItem)}
            {activeItem[chart.bandKeys?.[0]] != null && activeItem[chart.bandKeys?.[1]] != null && (
              <p className="mt-1 text-xs text-onSurface-variant">
                Forecast range:{' '}
                <strong className="text-onSurface">
                  {formatValue(activeItem[chart.bandKeys[0]])}
                  {' – '}
                  {formatValue(activeItem[chart.bandKeys[1]])}
                </strong>
              </p>
            )}
            {tip && (
              <span
                style={{
                  position: 'absolute',
                  left: tip.arrowLeft,
                  [tip.flipBelow ? 'top' : 'bottom']: -ARROW_SIZE / 2,
                  width: ARROW_SIZE,
                  height: ARROW_SIZE,
                  background: '#fff',
                  borderRight: '1px solid #E4E7EC',
                  borderBottom: '1px solid #E4E7EC',
                  transform: `translateX(-50%) rotate(${tip.flipBelow ? 225 : 45}deg)`,
                  transition: 'transform 120ms ease',
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* The x axis: a rule under the plot, with a tick crossing it at every year in
          the data. The tick runs 5px above the rule and 5px below, so it reads as a
          tick on a scale rather than as another gridline, and it is positioned in the
          same coordinate space as the labels below it so each tick lands on the year
          it belongs to.

          A tick per year rather than a tick per label, because the labels are
          subsampled to whatever fits and the ticks are not. The salary index prints
          a year every other one, and a tick that only appeared under a printed label
          left the skipped years as bare stretches of rule — the axis looked like it
          had no data there, when in fact the line runs straight through. The gap in
          the labels is honest about space; the gap in the ticks was not honest at
          all. */}
      <div aria-hidden="true" className="relative mt-1 h-2.5 flex-shrink-0">
        <div className="absolute inset-x-0 top-1/2 border-t-2 border-hairline-axis" />
        {data.map((row, index) => {
          const left = `${(chart.xForValue(row[xKey], index) / chart.vbWidth) * 100}%`;
          return (
            <div
              key={index}
              className="absolute top-1/2 h-2.5 w-[1.5px] -translate-x-1/2 -translate-y-1/2 bg-hairline-axis"
              style={{ left }}
            />
          );
        })}
      </div>

      {/* X Labels. The container spans the full chart width (same coordinate
          space as the SVG plot) so each label's left% lands exactly on its
          data point; any left/right inset here would shift labels away from
          the plotted positions. */}
      <div
        className="relative mt-2 h-6 flex-shrink-0 text-xs"
        style={{
          color: '#667085',
          fontWeight: 600,
        }}
      >
        {chart.labelTicks.map((tick, i) => {
          const left = `${(chart.xForValue(data[tick.index][xKey], tick.index) / chart.vbWidth) * 100}%`;
          return (
            <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left }}>
              {tick.label}
            </span>
          );
        })}
      </div>

      {showLegend && (
        <div
          className="mt-2 flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-sm"
          style={{ color: '#39424E' }}
        >
          {series
            .filter((s) => !s.hideInLegend)
            .map((s) => {
              const muted = isMuted(s);
              return (
                <span
                  key={s.key}
                  className="flex items-center gap-1.5 whitespace-nowrap transition-opacity duration-150"
                  style={{
                    opacity: muted ? 0.45 : 1,
                    cursor: highlightEnabled ? 'pointer' : 'default',
                  }}
                  title={s.label}
                  onMouseEnter={highlightEnabled ? () => setHighlightedKey(s.key) : undefined}
                  onMouseLeave={highlightEnabled ? () => setHighlightedKey(null) : undefined}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: s.bold ? 22 : 16,
                      height: s.bold ? 3 : 2,
                      backgroundColor: muted ? MUTED_SERIES_COLOR : s.color,
                      opacity: s.dashed || s.faint ? 0.6 : 1,
                    }}
                  />
                  {s.label}
                </span>
              );
            })}
        </div>
      )}
    </div>
  );
}
