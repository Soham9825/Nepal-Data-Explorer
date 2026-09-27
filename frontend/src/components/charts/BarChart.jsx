import { useState, useRef, useLayoutEffect, useCallback } from 'react';

const DEFAULT_PALETTE = [
  '#b70011',
  '#0051d5',
  '#7a5100',
  '#316bf3',
  '#9a6800',
  '#5c403c',
  '#0f7a3d',
  '#dc2626',
];

const TOOLTIP_MARGIN = 10; // min gap between tooltip and container edge, px
const TOOLTIP_GAP = 14; // gap between tooltip and bar, px
const ARROW_SIZE = 8; // px, diagonal of the rotated pointer square
const Y_AXIS_GUTTER = 46; // px reserved for the value labels beside the plot

// Round a raw step up to a "nice" value (1/2/2.5/5 * power of ten) so the value
// axis reads cleanly instead of showing long decimal fragments.
function niceStep(rawValue) {
  if (!(rawValue > 0) || !Number.isFinite(rawValue)) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawValue)));
  const normalized = rawValue / magnitude;
  const multiplier =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return multiplier * magnitude;
}

// Compact value labels: 81234 -> "81.2K", 2400000 -> "2.4M".
function formatTick(value) {
  const trim = (text) => text.replace(/\.0+$/, '');
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${trim((value / 1e6).toFixed(2))}M`;
  if (abs >= 1e3) return `${trim((value / 1e3).toFixed(1))}K`;
  return Number(value.toFixed(1)).toLocaleString();
}

export default function BarChart({
  data = [],
  xKey,
  labelKey = 'name',
  valueKey = 'arrivals',
  series,
  color, // fallback uniform color, used only when data has no per-item color
  colors = DEFAULT_PALETTE,
  height = '100%', // fills whatever height the parent wrapper establishes
  showLegend = true,
  legendPosition = 'bottom', // "top" keeps the key readable without scrolling past the plot
  showYAxis = true, // value labels beside the plot, so magnitude is readable at a glance
  showValueLabels = false, // the figure on every bar, so a short bar is not a less readable one
  yAxisWidth = Y_AXIS_GUTTER,
  bordered = true,
  labelFormatter = (value) => value,
  tooltipFormatter = (value) => value,
}) {
  const [active, setActive] = useState(null); // { groupIndex, seriesIndex, xPct, yPct }
  const [tip, setTip] = useState(null); // computed pixel-accurate tooltip placement

  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

  const VB_WIDTH = 1000;
  const VB_HEIGHT = 500;
  const PADDING_X = 40;
  const PADDING_Y = 52;

  const xField = xKey || labelKey;
  const isMultiSeries = Array.isArray(series) && series.length > 0;

  const numericValue = (value) => {
    const parsed = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const formatValue = (value) =>
    numericValue(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const seriesConfig = isMultiSeries
    ? series.map((s, i) => ({ ...s, color: s.color || colors[i % colors.length] }))
    : [{ key: valueKey, color: null, label: null }];
  const activeItem = active ? data[active.groupIndex] : null;
  const activeSeries = active ? seriesConfig[active.seriesIndex] : null;
  const values = data.flatMap((d) => seriesConfig.map((s) => numericValue(d[s.key])));
  const maxValue = values.length ? Math.max(...values, 0) : 0;
  const minValue = values.length ? Math.min(...values, 0) : 0;
  const chartMax = Math.max(maxValue, 1);
  const chartRange = chartMax - minValue || 1;
  const plotHeight = VB_HEIGHT - PADDING_Y * 2;
  const zeroY = PADDING_Y + (chartMax / chartRange) * plotHeight;
  // Where a value sits, as a percentage of the plot box height. The SVG stretches
  // (preserveAspectRatio="none") while the value labels are HTML, so the labels
  // are positioned from this shared scale rather than from SVG coordinates.
  const yPercentOf = (value) =>
    ((PADDING_Y + ((chartMax - value) / chartRange) * plotHeight) / VB_HEIGHT) * 100;

  // Value axis ticks, so bar magnitude is readable without hovering.
  const yTicks = (() => {
    const step = niceStep(chartRange / 4);
    const ticks = [];
    for (
      let value = Math.ceil(minValue / step) * step;
      value <= chartMax + step * 1e-6;
      value += step
    ) {
      ticks.push(value);
      if (ticks.length > 8) break;
    }
    if (ticks.length < 2) ticks.push(minValue, chartMax);
    return ticks;
  })();

  const barSlot = data.length ? (VB_WIDTH - PADDING_X * 2) / data.length : 0;
  const groupPadding = barSlot * 0.18;
  const groupWidth = barSlot - groupPadding;
  const barGap = isMultiSeries ? 4 : 0;
  // Single-series bars shrink as the number of bars grows, so dense charts
  // (e.g. all 19 source markets) fit the same plot area as a top-10 view.
  const denseShrink = isMultiSeries ? 1 : Math.max(0.7, 1 - (data.length - 10) * 0.015);
  const barWidth = isMultiSeries
    ? (groupWidth - barGap * (seriesConfig.length - 1)) / seriesConfig.length
    : groupWidth * 0.55 * denseShrink;
  const cornerRadius = Math.max(1, Math.min(3, barWidth * 0.1));

  const paddingPct = (PADDING_X / VB_WIDTH) * 100;
  const plotWidthPct = 100 - paddingPct * 2;

  // Recompute exact pixel placement whenever the active bar changes (and on resize),
  // measured against the real rendered box rather than guessed percentages.
  const recomputeTooltipPosition = useCallback(() => {
    if (!active || !containerRef.current || !tooltipRef.current) {
      setTip(null);
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    const barCenterX = (active.xPct / 100) * containerRect.width;
    const barTopY = (active.yPct / 100) * containerRect.height;

    const half = tooltipRect.width / 2;
    const clampedLeft = Math.min(
      Math.max(barCenterX, half + TOOLTIP_MARGIN),
      Math.max(half + TOOLTIP_MARGIN, containerRect.width - half - TOOLTIP_MARGIN)
    );

    const flipBelow = barTopY - tooltipRect.height - TOOLTIP_GAP - ARROW_SIZE < TOOLTIP_MARGIN;
    const rawTop = flipBelow ? barTopY + TOOLTIP_GAP : barTopY - tooltipRect.height - TOOLTIP_GAP;
    const clampedTop = Math.min(
      Math.max(rawTop, TOOLTIP_MARGIN),
      Math.max(TOOLTIP_MARGIN, containerRect.height - tooltipRect.height - TOOLTIP_MARGIN)
    );

    // Arrow stays glued to the bar's true x position, even if the box got clamped away from center.
    const arrowLeft = Math.min(
      Math.max(barCenterX - (clampedLeft - half), 14),
      tooltipRect.width - 14
    );

    setTip({ left: clampedLeft, top: clampedTop, arrowLeft, flipBelow });
  }, [active]);

  useLayoutEffect(() => {
    recomputeTooltipPosition();
  }, [recomputeTooltipPosition]);

  useLayoutEffect(() => {
    if (!active) return undefined;
    const handle = () => recomputeTooltipPosition();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [active, recomputeTooltipPosition]);

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-sm w-full h-full"
        style={{
          border: bordered ? '1px solid #e2e2e2' : 'none',
          color: '#8a8a8a',
          fontFamily: "'Hanken Grotesk', sans-serif",
        }}
      >
        No data available
      </div>
    );
  }

  const legend = isMultiSeries && showLegend && (
    <div
      className={`flex flex-wrap items-center gap-x-5 gap-y-1.5 flex-shrink-0 ${
        legendPosition === 'top' ? 'mb-2' : 'mt-2 border-t pt-3'
      }`}
      style={legendPosition === 'top' ? undefined : { borderColor: '#ececec' }}
    >
      {seriesConfig.map((s) => (
        <span
          key={s.key}
          className="flex items-center gap-2 text-xs"
          style={{ color: '#273142', fontWeight: 600 }}
          title={s.label || s.key}
        >
          <span
            style={{
              width: 8,
              height: 8,
              backgroundColor: s.color,
              display: 'inline-block',
              borderRadius: 2,
            }}
          />
          {s.label || s.key}
        </span>
      ))}
    </div>
  );

  return (
    <div
      className={`relative w-full h-full flex flex-col ${bordered ? 'bg-white p-5' : ''}`}
      style={{
        border: bordered ? '1px solid #e2e2e2' : 'none',
        fontFamily: "'Hanken Grotesk', sans-serif",
        height,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {legendPosition === 'top' && legend}

      <div className="flex min-h-0 flex-1">
        {/* Value axis. Kept as HTML rather than SVG <text> because the plot uses
            preserveAspectRatio="none", which would stretch any label drawn in it. */}
        {showYAxis && (
          <div className="relative shrink-0" style={{ width: yAxisWidth }} aria-hidden="true">
            {yTicks.map((tick) => (
              <span
                key={tick}
                className="absolute right-1.5 -translate-y-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums"
                style={{ top: `${yPercentOf(tick)}%`, color: '#667085' }}
              >
                {formatTick(tick)}
              </span>
            ))}
          </div>
        )}

        {/* Chart plot area. position:relative + ref so the HTML tooltip can be measured
            and placed in real pixels against this exact box. */}
        <div ref={containerRef} className="relative min-w-0 flex-1" style={{ minHeight: 0 }}>
          <svg
            viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
            preserveAspectRatio="none"
            width="100%"
            height="100%"
            style={{ display: 'block', overflow: 'visible' }}
          >
            {yTicks.map((tick) => {
              const y = PADDING_Y + ((chartMax - tick) / chartRange) * plotHeight;
              return (
                <line
                  key={tick}
                  x1={PADDING_X}
                  y1={y}
                  x2={VB_WIDTH - PADDING_X}
                  y2={y}
                  stroke="#ececec"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {data.map((item, groupIndex) => {
              const groupX =
                PADDING_X + groupIndex * barSlot + groupPadding / 2 + (barSlot - groupWidth) / 2;

              return (
                <g key={groupIndex}>
                  {seriesConfig.map((s, sIndex) => {
                    const value = numericValue(item[s.key]);
                    const barHeight = (Math.abs(value) / chartRange) * plotHeight;
                    const x = groupX + sIndex * (barWidth + barGap);
                    const y = value >= 0 ? zeroY - barHeight : zeroY;
                    const barColor = isMultiSeries
                      ? s.color
                      : item.color || color || colors[groupIndex % colors.length];
                    const isActive =
                      active && active.groupIndex === groupIndex && active.seriesIndex === sIndex;
                    return (
                      <g
                        key={s.key}
                        onMouseEnter={() =>
                          setActive({
                            groupIndex,
                            seriesIndex: sIndex,
                            xPct: ((x + barWidth / 2) / VB_WIDTH) * 100,
                            yPct: (y / VB_HEIGHT) * 100,
                          })
                        }
                        onMouseLeave={() => setActive(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Dashed guideline from bar top to the axis — only while hovered, for a clean focus cue */}
                        {isActive && (
                          <line
                            x1={x + barWidth / 2}
                            y1={y}
                            x2={x + barWidth / 2}
                            y2={zeroY}
                            stroke={barColor}
                            strokeWidth="1"
                            strokeDasharray="3 3"
                            opacity="0.75"
                            vectorEffect="non-scaling-stroke"
                          />
                        )}
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          rx={cornerRadius}
                          fill={barColor}
                          opacity="1"
                          stroke={isActive ? barColor : 'none'}
                          strokeWidth={isActive ? 2 : 0}
                          style={{ transition: 'stroke-width 150ms ease' }}
                        />
                      </g>
                    );
                  })}
                </g>
              );
            })}
            <line
              x1={PADDING_X}
              y1={zeroY}
              x2={VB_WIDTH - PADDING_X}
              y2={zeroY}
              stroke="#c8c8c8"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Value on every bar. HTML rather than SVG <text>, for the same reason as the
              axis: the plot stretches with preserveAspectRatio="none", which would distort
              label glyphs. Each label takes its bar's colour so a reader can tie a figure
              to a series without going back to the legend. */}
          {showValueLabels &&
            data.flatMap((item, groupIndex) => {
              const groupX =
                PADDING_X + groupIndex * barSlot + groupPadding / 2 + (barSlot - groupWidth) / 2;
              return seriesConfig.map((s, sIndex) => {
                const value = numericValue(item[s.key]);
                const x = groupX + sIndex * (barWidth + barGap);
                return (
                  <span
                    key={`${groupIndex}-${s.key}`}
                    className="pointer-events-none absolute text-[10px] font-bold tabular-nums"
                    style={{
                      left: `${((x + barWidth / 2) / VB_WIDTH) * 100}%`,
                      top: `${yPercentOf(value)}%`,
                      transform:
                        value >= 0 ? 'translate(-50%, calc(-100% - 3px))' : 'translate(-50%, 3px)',
                      color: isMultiSeries
                        ? s.color
                        : item.color || color || colors[groupIndex % colors.length],
                    }}
                  >
                    {formatValue(value)}
                  </span>
                );
              });
            })}

          {/* Tooltip: measured in real pixels against the plot box above, so it always
            sits fully inside the chart, floats clear of the bar, and its pointer
            arrow tracks the bar's true position even when the box is edge-clamped. */}
          {activeItem && activeSeries && (
            <div
              ref={tooltipRef}
              className="pointer-events-none absolute z-10 bg-white px-4 py-3 text-sm shadow-lg"
              style={{
                left: tip ? tip.left : active.xPct + '%',
                top: tip ? tip.top : active.yPct + '%',
                transform: tip ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
                opacity: tip ? 1 : 0,
                transition: 'opacity 120ms ease, left 120ms ease, top 120ms ease',
                whiteSpace: 'nowrap',
                borderRadius: 0,
                border: '1px solid #e2e2e2',
              }}
            >
              <p className="font-bold text-onSurface">{tooltipFormatter(activeItem[xField])}</p>
              <p className="mt-1 text-onSurface-variant">
                {activeSeries.label || activeSeries.key}:{' '}
                <strong className="text-onSurface">
                  {formatValue(activeItem[activeSeries.key])}
                </strong>
              </p>

              {/* Pointer arrow — glued to the bar's true x, flips to the opposite edge when placed below */}
              {tip && (
                <span
                  style={{
                    position: 'absolute',
                    left: tip.arrowLeft,
                    [tip.flipBelow ? 'top' : 'bottom']: -ARROW_SIZE / 2,
                    width: ARROW_SIZE,
                    height: ARROW_SIZE,
                    background: '#fff',
                    borderRight: '1px solid #e2e2e2',
                    borderBottom: '1px solid #e2e2e2',
                    transform: `translateX(-50%) rotate(${tip.flipBelow ? 225 : 45}deg)`,
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* X labels — padded to match the SVG's internal bar padding so they align under the bars */}
      <div className="mt-3 flex flex-shrink-0">
        {showYAxis && <div className="shrink-0" style={{ width: yAxisWidth }} aria-hidden="true" />}
        <div
          className="flex min-w-0 flex-1 justify-between text-xs"
          style={{
            color: '#273142',
            fontWeight: 600,
            paddingLeft: `${paddingPct}%`,
            paddingRight: `${paddingPct}%`,
          }}
        >
          {data.map((item, index) => {
            const barColor = !isMultiSeries
              ? item.color || color || colors[index % colors.length]
              : null;
            return (
              <span
                key={index}
                className="flex flex-col items-center gap-1 text-center font-hanken"
                style={{ width: `${plotWidthPct / data.length}%` }}
                title={labelFormatter(item[xField])}
              >
                {!isMultiSeries && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      backgroundColor: barColor,
                      display: 'inline-block',
                    }}
                  />
                )}
                {/* Long category names wrap onto a second line instead of being ellipsised. */}
                <span className="line-clamp-2 w-full break-words leading-4">{item[xField]}</span>
              </span>
            );
          })}
        </div>
      </div>

      {legendPosition === 'bottom' && legend}
    </div>
  );
}
