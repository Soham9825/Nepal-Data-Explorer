import { useMemo, useState, useRef, useLayoutEffect, useCallback } from 'react';

const MS_MONTH = 30.44 * 24 * 60 * 60 * 1000;
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TOOLTIP_MARGIN = 10;
const TOOLTIP_GAP = 12;
const ARROW_SIZE = 8;

// Module-level defaults so the memoized `chart` stays stable across renders —
// inline/literal defaults would create a new array reference every render and
// invalidate the chart memo (which caused an infinite tooltip update loop).
const NO_DATA = [];
const NO_BANDS = [];
const DEFAULT_SERIES = [{ key: "value", color: "#b70011", label: "Value" }];

// Compact axis labels: 81234 -> "81.2K", 2400000 -> "2.4M", 0.25 -> "0.3".
function formatTick(value) {
  const trim = (text) => text.replace(/\.0+$/, "");
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${trim((value / 1e6).toFixed(2))}M`;
  if (abs >= 1e3) return `${trim((value / 1e3).toFixed(1))}K`;
  return Number(value.toFixed(1)).toLocaleString();
}

// Tooltip values keep decimals for small numbers so e.g. 0.25 doesn't read "0".
function formatValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
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
  xKey = "year",
  labelKey = xKey,
  tooltipKey = labelKey,
  timeScale = false,
  xDomainStart,
  xDomainEnd,
  yDomain = [null, null], // Optional fixed [min, max]; null/undefined bounds auto-scale
  zoneStart,
  zoneLabel = "Forecast",
  bands = NO_BANDS, // Shaded min/max range bands: [{ keyMin, keyMax, color, opacity }]
  series = DEFAULT_SERIES,
  height = 380,
  unit = "",
  showZeroLine = false,
  fillArea = true,
}) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [tip, setTip] = useState(null);

  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

  // Latest values seen through refs so the tooltip-position effect only re-runs
  // when the active index actually changes, never on incidental re-renders.
  const chartRef = useRef(null);
  const dataRef = useRef(data);
  const xKeyRef = useRef(xKey);
  dataRef.current = data;
  xKeyRef.current = xKey;

  const VB_WIDTH = 1000;
  const VB_HEIGHT = 500;
  const PADDING_X = 70;
  const PADDING_Y = 52;

  const toTimeValue = useCallback((value) => {
    if (typeof value === "number") return value;
    const timestamp = Date.parse(String(value));
    return Number.isNaN(timestamp) ? null : timestamp;
  }, []);

  const chart = useMemo(() => {
    if (!data.length) return null;

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
    ].map(Number).filter(Number.isFinite);

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
      return PADDING_X + clamped * (VB_WIDTH - PADDING_X * 2);
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
        const y =
          VB_HEIGHT - PADDING_Y - ((value - min) / range) * (VB_HEIGHT - PADDING_Y * 2);
        return { x, y, value, index };
      });

      const path = points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
        .join(" ");

      const area = points.length
        ? path +
          ` L ${points[points.length - 1].x} ${VB_HEIGHT - PADDING_Y} L ${points[0].x} ${VB_HEIGHT - PADDING_Y} Z`
        : "";

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
      const step = Math.max(1, Math.ceil((data.length - 1) / 10));
      data.forEach((item, index) => {
        if (index % step === 0 || index === data.length - 1) {
          labelTicks.push({ index, label: String(item[labelKey]) });
        }
      });
    }
    if (!labelTicks.length) labelTicks.push({ index: 0, label: String(data[0][labelKey]) });

    return { min, max, ticks, zoneX, seriesData, xForValue, labelTicks, bandKeys };
  }, [data, series, xKey, labelKey, timeScale, xDomainStart, xDomainEnd, yDomain, zoneStart, bands, toTimeValue]);

  chartRef.current = chart;

  // Indices with at least one visible (non-faint) series value -> hover targets.
  const hoverableIndices = chart
    ? data
        .map((_, idx) => idx)
        .filter((idx) =>
          chart.seriesData.some(
            (s) => !s.faint && s.points.some((p) => p.index === idx)
          )
        )
    : [];

  const activePoints =
    activeIndex != null && chart
      ? chart.seriesData.flatMap((s) =>
          !s.faint
            ? s.points
                .filter((p) => p.index === activeIndex)
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
    const containerRect = containerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const points = c.seriesData.flatMap((s) =>
      !s.faint ? s.points.filter((p) => p.index === activeIndex) : []
    );
    if (!points.length) {
      setTip((prev) => (prev === null ? prev : null));
      return;
    }

    const xPct = (c.xForValue(d[activeIndex][xk], activeIndex) / VB_WIDTH) * 100;
    const markerTopY = Math.min(...points.map((p) => p.y));
    const markerX = (xPct / 100) * containerRect.width;
    const markerY = (markerTopY / VB_HEIGHT) * containerRect.height;

    const half = tooltipRect.width / 2;
    const clampedLeft = Math.min(
      Math.max(markerX, half + TOOLTIP_MARGIN),
      Math.max(half + TOOLTIP_MARGIN, containerRect.width - half - TOOLTIP_MARGIN)
    );

    const flipBelow = markerY - tooltipRect.height - TOOLTIP_GAP - ARROW_SIZE < TOOLTIP_MARGIN;
    const rawTop = flipBelow
      ? markerY + TOOLTIP_GAP
      : markerY - tooltipRect.height - TOOLTIP_GAP;
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

  useLayoutEffect(() => {
    if (activeIndex == null) return undefined;
    const handle = () => recomputeTooltipPosition();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [activeIndex, recomputeTooltipPosition]);

  if (!data.length || !chart || chart.seriesData.every((s) => s.points.length === 0)) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{
          height,
          width: "100%",
          border: "1px solid #e2e2e2",
          color: "#8a8a8a",
          fontFamily: "'Hanken Grotesk', sans-serif",
        }}
      >
        No data available
      </div>
    );
  }

  const activeItem = activeIndex != null ? data[activeIndex] : null;
  const activeX = activeIndex != null ? chart.xForValue(data[activeIndex][xKey], activeIndex) : null;
  const hasHover = activeIndex != null && activePoints.length > 0;

  return (
    <div
      className={`flex w-full min-h-0 flex-col ${typeof height === "number" ? "" : "h-full"}`}
      style={{
        height: typeof height === "number" ? height : undefined,
        backgroundColor: "#ffffff",
        fontFamily: "'Hanken Grotesk', sans-serif",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Plot area. position:relative so the HTML tooltip can be measured/placed in real pixels. */}
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1"
        style={{ position: "relative", flex: "1 1 auto" }}
      >
        <svg
          viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
          preserveAspectRatio="none"
          width="100%"
          height="100%"
          style={{ display: "block" }}
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
          {chart.ticks.map((tick) => {
            const y = VB_HEIGHT - PADDING_Y - ((tick - chart.min) / (chart.max - chart.min || 1)) * (VB_HEIGHT - PADDING_Y * 2);
            const isEdgemost = tick === chart.ticks[chart.ticks.length - 1];
            return (
              <g key={tick}>
                <line
                  x1={PADDING_X}
                  y1={y}
                  x2={VB_WIDTH - PADDING_X}
                  y2={y}
                  stroke={isEdgemost ? "#CBD5E1" : "#EDEFF3"}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <text x={PADDING_X - 12} y={y + 4} fontSize="11" fill="#5A6472" fontWeight="600" textAnchor="end">
                  {formatTick(tick)}{unit}
                </text>
              </g>
            );
          })}

          {/* Baseline axis */}
          <line
            x1={PADDING_X}
            y1={VB_HEIGHT - PADDING_Y}
            x2={VB_WIDTH - PADDING_X}
            y2={VB_HEIGHT - PADDING_Y}
            stroke="#CBD5E1"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />

          {showZeroLine && chart.min <= 0 && chart.max >= 0 && (
            <line
              x1={PADDING_X}
              y1={VB_HEIGHT - PADDING_Y - ((0 - chart.min) / (chart.max - chart.min || 1)) * (VB_HEIGHT - PADDING_Y * 2)}
              x2={VB_WIDTH - PADDING_X}
              y2={VB_HEIGHT - PADDING_Y - ((0 - chart.min) / (chart.max - chart.min || 1)) * (VB_HEIGHT - PADDING_Y * 2)}
              stroke="#64748B"
              strokeWidth="1"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Forecast zone: subtle tint + clean dashed divider + label chip */}
          {chart.zoneX != null && (
            <g>
              <rect
                x={chart.zoneX}
                y={PADDING_Y}
                width={VB_WIDTH - PADDING_X - chart.zoneX}
                height={VB_HEIGHT - PADDING_Y * 2}
                fill="#F4F7F6"
              />
              <line
                x1={chart.zoneX}
                y1={PADDING_Y}
                x2={chart.zoneX}
                y2={VB_HEIGHT - PADDING_Y}
                stroke="#94A3B8"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
              <g>
                {(() => {
                  const chipWidth = zoneLabel.length * 7.2 + 18;
                  const chipX = Math.min(chart.zoneX + 8, VB_WIDTH - PADDING_X - chipWidth);
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
                      <text x={chipX + 9} y={PADDING_Y + 24} fontSize="11" fontWeight="700" fill="#ffffff">
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
                  yHi: VB_HEIGHT - PADDING_Y - ((bandHi - chart.min) / (chart.max - chart.min || 1)) * (VB_HEIGHT - PADDING_Y * 2),
                  yLo: VB_HEIGHT - PADDING_Y - ((bandLo - chart.min) / (chart.max - chart.min || 1)) * (VB_HEIGHT - PADDING_Y * 2),
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
              d += " Z";
              return <path key={`${bi}-${ri}`} d={d} fill={b.color} fillOpacity={b.opacity} />;
            });
          })}

          {/* Areas + lines (faint series first so bold ones sit on top) */}
          {[...chart.seriesData.filter((s) => s.faint), ...chart.seriesData.filter((s) => !s.faint)].map((s) => (
            <g key={s.key}>
              {s.area && !s.faint && fillArea && <path d={s.area} fill={`url(#fill-${s.key})`} />}
              <path
                d={s.path}
                fill="none"
                stroke={s.color}
                strokeWidth={s.bold ? 3 : s.faint ? 1.2 : 2}
                strokeOpacity={s.faint ? 0.35 : 1}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={s.dashed ? "6 5" : undefined}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}

          {/* Hover slabs: transparent hit areas covering each data index */}
          {hoverableIndices.map((idx) => {
            const x = chart.xForValue(data[idx][xKey], idx);
            const prevX = idx > 0 ? chart.xForValue(data[idx - 1][xKey], idx - 1) : PADDING_X;
            const nextX =
              idx < data.length - 1 ? chart.xForValue(data[idx + 1][xKey], idx + 1) : VB_WIDTH - PADDING_X;
            const left = Math.max(PADDING_X, (x + prevX) / 2);
            const right = Math.min(VB_WIDTH - PADDING_X, (x + nextX) / 2);
            return (
              <rect
                key={idx}
                x={left}
                y={PADDING_Y - 4}
                width={Math.max(right - left, 1)}
                height={VB_HEIGHT - PADDING_Y * 2 + 8}
                fill="transparent"
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                style={{ cursor: "pointer" }}
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
                height={VB_HEIGHT - PADDING_Y * 2}
                fill="#0051d5"
                opacity="0.07"
              />
              <line
                x1={activeX}
                y1={PADDING_Y}
                x2={activeX}
                y2={VB_HEIGHT - PADDING_Y}
                stroke="#64748B"
                strokeWidth="1"
                strokeDasharray="3 4"
                strokeOpacity="0.5"
                vectorEffect="non-scaling-stroke"
              />
              {activePoints.map((p) => (
                <g key={p.seriesKey}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.bold ? 10 : 8}
                    fill={p.color}
                    fillOpacity="0.18"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.bold ? 5.5 : 4.5}
                    fill="#ffffff"
                    stroke={p.color}
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ))}
            </g>
          )}
        </svg>

        {/* Crisp HTML tooltip, pinned to the active marker */}
        {activeItem && hasHover && (
          <div
            ref={tooltipRef}
            className="pointer-events-none absolute z-10 bg-white px-4 py-3 text-sm shadow-xl"
            style={{
              left: tip ? tip.left : "50%",
              top: tip ? tip.top : "50%",
              transform: tip ? "translate(-50%, 0)" : "translate(-50%, -50%)",
              opacity: tip ? 1 : 0,
              transition: "opacity 120ms ease, left 120ms ease, top 120ms ease",
              whiteSpace: "nowrap",
              borderRadius: 6,
              border: "1px solid #e6e8ec",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.14)",
            }}
          >
            <p className="text-xs font-bold text-onSurface">{String(activeItem[tooltipKey])}</p>
            {activePoints.map((p) => (
              <p key={p.seriesKey} className="mt-1 text-xs text-onSurface-variant">
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ backgroundColor: p.color }}
                />
                {p.seriesLabel || p.seriesKey}:{" "}
                <strong className="text-onSurface">{formatValue(p.value)}</strong>
              </p>
            ))}
            {activeItem[chart.bandKeys?.[0]] != null && activeItem[chart.bandKeys?.[1]] != null && (
              <p className="mt-1 text-xs text-onSurface-variant">
                Forecast range:{" "}
                <strong className="text-onSurface">
                  {formatValue(activeItem[chart.bandKeys[0]])}
                  {" – "}
                  {formatValue(activeItem[chart.bandKeys[1]])}
                </strong>
              </p>
            )}
            {tip && (
              <span
                style={{
                  position: "absolute",
                  left: tip.arrowLeft,
                  [tip.flipBelow ? "top" : "bottom"]: -ARROW_SIZE / 2,
                  width: ARROW_SIZE,
                  height: ARROW_SIZE,
                  background: "#fff",
                  borderRight: "1px solid #e6e8ec",
                  borderBottom: "1px solid #e6e8ec",
                  transform: `translateX(-50%) rotate(${tip.flipBelow ? 225 : 45}deg)`,
                  transition: "transform 120ms ease",
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* X Labels. The container spans the full chart width (same coordinate
          space as the SVG plot) so each label's left% lands exactly on its
          data point; any left/right inset here would shift labels away from
          the plotted positions. */}
      <div
        className="relative mt-2 h-6 flex-shrink-0 text-xs"
        style={{
          color: "#5A6472",
          fontWeight: 600,
        }}
      >
        {chart.labelTicks.map((tick, i) => {
          const left = `${(chart.xForValue(data[tick.index][xKey], tick.index) / VB_WIDTH) * 100}%`;
          return (
            <span
              key={i}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left }}
            >
              {tick.label}
            </span>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-shrink-0 flex-wrap gap-4 text-sm" style={{ color: "#39424E" }}>
        {series.filter((s) => !s.hideInLegend).map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span
              style={{
                display: "inline-block",
                width: s.bold ? 22 : 16,
                height: s.bold ? 3 : 2,
                backgroundColor: s.color,
                opacity: s.dashed || s.faint ? 0.6 : 1,
              }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}