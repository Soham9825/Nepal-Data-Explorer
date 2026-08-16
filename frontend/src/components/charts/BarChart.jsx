import React, { useState } from "react";

const DEFAULT_PALETTE = [
  "#b70011", "#0051d5", "#7a5100", "#316bf3",
  "#9a6800", "#5c403c", "#0f7a3d", "#dc2626",
];

export default function BarChart({
  data = [],
  xKey,
  labelKey = "name",
  valueKey = "arrivals",
  series,
  color, // fallback uniform color, used only when data has no per-item color
  colors = DEFAULT_PALETTE,
  height = "100%", // fills whatever height the parent wrapper establishes
  showLegend = true,
  bordered = true,
}) {
  const [active, setActive] = useState(null);

  const VB_WIDTH = 1000;
  const VB_HEIGHT = 400;
  const PADDING_X = 40;
  const PADDING_Y = 30;

  const xField = xKey || labelKey;
  const isMultiSeries = Array.isArray(series) && series.length > 0;

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-sm w-full h-full"
        style={{
          border: bordered ? "1px solid #e2e2e2" : "none",
          color: "#8a8a8a",
          fontFamily: "'Hanken Grotesk', sans-serif",
        }}
      >
        No data available
      </div>
    );
  }

  const seriesConfig = isMultiSeries
    ? series.map((s, i) => ({ ...s, color: s.color || colors[i % colors.length] }))
    : [{ key: valueKey, color: null, label: null }];

  const max = Math.max(
    ...data.flatMap((d) => seriesConfig.map((s) => Number(d[s.key]) || 0))
  );

  const barSlot = (VB_WIDTH - PADDING_X * 2) / data.length;
  const groupPadding = barSlot * 0.18;
  const groupWidth = barSlot - groupPadding;
  const barGap = isMultiSeries ? 4 : 0;
  const barWidth = isMultiSeries
    ? (groupWidth - barGap * (seriesConfig.length - 1)) / seriesConfig.length
    : groupWidth * 0.55;

  const paddingPct = (PADDING_X / VB_WIDTH) * 100;
  const plotWidthPct = 100 - paddingPct * 2;

  return (
    <div
      className={`w-full h-full flex flex-col ${bordered ? "bg-white p-5" : ""}`}
      style={{
        border: bordered ? "1px solid #e2e2e2" : "none",
        fontFamily: "'Hanken Grotesk', sans-serif",
        height,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* SVG fills whatever space is left after labels/legend take their natural height */}
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        <svg
          viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
          preserveAspectRatio="none"
          width="100%"
          height="100%"
          style={{ display: "block" }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = PADDING_Y + t * (VB_HEIGHT - PADDING_Y * 2);
            return (
              <line
                key={t}
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
                  const value = Number(item[s.key]) || 0;
                  let barHeight = max ? (value / max) * (VB_HEIGHT - PADDING_Y * 2) : 0;
                  // Ensure bar height is non-negative to avoid invalid SVG rect dimensions
                  if (!Number.isFinite(barHeight) || barHeight < 0) barHeight = 0;
                  const x = groupX + sIndex * (barWidth + barGap);
                  const y = VB_HEIGHT - PADDING_Y - barHeight;
                  const barColor = isMultiSeries
                    ? s.color
                    : item.color || color || colors[groupIndex % colors.length];
                  const isActive =
                    active && active.groupIndex === groupIndex && active.seriesIndex === sIndex;
                  const dimmed = active !== null && !isActive;

                  return (
                    <g
                      key={s.key}
                      onMouseEnter={() => setActive({ groupIndex, seriesIndex: sIndex })}
                      onMouseLeave={() => setActive(null)}
                      style={{ cursor: "pointer" }}
                    >
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        rx="3"
                        fill={barColor}
                        opacity={dimmed ? 0.45 : 1}
                      />

                      {isActive && (
                        <text
                          x={x + barWidth / 2}
                          y={y - 10}
                          fontSize="14"
                          fontWeight="bold"
                          fill="#222"
                          textAnchor="middle"
                        >
                          {value.toLocaleString()}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* X labels — padded to match the SVG's internal bar padding so they align under the bars */}
      <div
        className="mt-3 flex justify-between text-xs flex-shrink-0"
        style={{
          color: "#6b6b6b",
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
              title={item[xField]}
            >
              {!isMultiSeries && (
                <span
                  style={{ width: 6, height: 6, backgroundColor: barColor, display: "inline-block" }}
                />
              )}
              <span className="truncate w-full">{item[xField]}</span>
            </span>
          );
        })}
      </div>

      {isMultiSeries && showLegend && (
        <div
          className="flex flex-wrap items-center justify-center gap-5 border-t pt-3 mt-2 flex-shrink-0"
          style={{ borderColor: "#ececec" }}
        >
          {seriesConfig.map((s) => (
            <span key={s.key} className="flex items-center gap-2 text-xs" style={{ color: "#6b6b6b" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: s.color,
                  display: "inline-block",
                  borderRadius: 2,
                }}
              />
              {s.label || s.key}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}