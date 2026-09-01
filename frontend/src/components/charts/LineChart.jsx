import React, { useMemo, useState } from "react";

export default function LineChart({
  data = [],
  xKey = "year",
  labelKey = xKey,
  tooltipKey = labelKey,
  timeScale = false,
  xDomainStart,
  xDomainEnd,
  series = [{ key: "value", color: "#b70011", label: "Value" }],
  height = 300,
}) {
  const [activeIndex, setActiveIndex] = useState(null);

  const VB_WIDTH = 1000;
  const VB_HEIGHT = 400;
  const PADDING_X = 60;
  const PADDING_Y = 40;

  const chart = useMemo(() => {
    if (!data.length) return null;

    const allValues = series.flatMap((s) =>
      data.map((d) => d[s.key]).filter((v) => v !== null && v !== undefined)
    ).map(Number);

    const max = Math.max(...allValues);
    const min = Math.min(...allValues);
    const range = max - min || 1;

    const toTimeValue = (value) => {
      if (typeof value === "number") return value;
      const timestamp = Date.parse(String(value));
      return Number.isNaN(timestamp) ? null : timestamp;
    };
    const timeValues = timeScale
      ? data.map((item) => toTimeValue(item[xKey])).filter((value) => value !== null)
      : [];
    const firstPeriod = timeScale ? (xDomainStart ?? Math.min(...timeValues)) : null;
    const lastPeriod = timeScale ? (xDomainEnd ?? Math.max(...timeValues)) : null;
    const periodRange = Math.max((lastPeriod || 0) - (firstPeriod || 0), 1);
    const xForValue = (value, index) => {
      const period = timeScale ? toTimeValue(value) : null;
      const position = timeScale
        ? (period - firstPeriod) / periodRange
        : index / Math.max(data.length - 1, 1);
      return PADDING_X + position * (VB_WIDTH - PADDING_X * 2);
    };

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

    return { min, max, seriesData, xForValue };
  }, [data, series, xKey, timeScale, xDomainStart, xDomainEnd]);

  if (!data.length || !chart || chart.seriesData.every((s) => s.points.length === 0)) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{
          height,
          border: "1px solid #e2e2e2",
          color: "#8a8a8a",
          fontFamily: "'Hanken Grotesk', sans-serif",
        }}
      >
        No data available
      </div>
    );
  }

  const allPointsSorted = chart.seriesData
    .flatMap((s) => s.points.map((p) => ({ ...p, seriesKey: s.key })))
    .sort((a, b) => a.index - b.index);

  const uniqueIndices = [...new Set(allPointsSorted.map((p) => p.index))];

  return (
    <div
      className="w-full bg-white p-5"
      style={{ border: "1px solid #e2e2e2", fontFamily: "'Hanken Grotesk', sans-serif" }}
    >
      <svg
        viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        style={{ height, display: "block" }}
      >
        <defs>
          {chart.seriesData.map((s) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Horizontal Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PADDING_Y + t * (VB_HEIGHT - PADDING_Y * 2);
          return (
            <line key={t} x1={PADDING_X} y1={y} x2={VB_WIDTH - PADDING_X} y2={y} stroke="#ececec" strokeWidth="1" />
          );
        })}

        {/* Areas + Lines per series */}
        {chart.seriesData.map((s) => (
          <g key={s.key}>
            {s.area && <path d={s.area} fill={`url(#fill-${s.key})`} />}
            <path
              d={s.path}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={s.dashed ? "6 5" : undefined}
            />
          </g>
        ))}

        {/* Points + hover interactions, keyed by original data index */}
        {uniqueIndices.map((idx) => {
          const x = chart.xForValue(data[idx][xKey], idx);
          const pointsAtIdx = allPointsSorted.filter((p) => p.index === idx);

          return (
            <g
              key={idx}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={x - (VB_WIDTH / data.length) / 2}
                y={PADDING_Y}
                width={VB_WIDTH / data.length}
                height={VB_HEIGHT - PADDING_Y * 2}
                fill="transparent"
              />

              {pointsAtIdx.map((p) => (
                <circle
                  key={p.seriesKey}
                  cx={p.x}
                  cy={p.y}
                  r={activeIndex === idx ? 6 : 4}
                  fill="white"
                  stroke={chart.seriesData.find((s) => s.key === p.seriesKey).color}
                  strokeWidth="2.5"
                />
              ))}

              {activeIndex === idx && (
                <>
                  <line x1={x} y1={PADDING_Y} x2={x} y2={VB_HEIGHT - PADDING_Y} stroke="#999" strokeDasharray="4 4" strokeOpacity="0.5" />
                  {pointsAtIdx.map((p, i) => {
                    const valueLabel = String(p.value.toLocaleString());
                    const dateLabel = String(data[idx][tooltipKey]);
                    const boxWidth = Math.max(100, dateLabel.length * 8 + 20, valueLabel.length * 9 + 20);
                    const boxHeight = 46;
                    let boxX = p.x - boxWidth / 2;
                    boxX = Math.max(PADDING_X - 10, Math.min(boxX, VB_WIDTH - PADDING_X - boxWidth + 10));
                    const boxY = p.y - boxHeight - 10 - i * (boxHeight + 6);

                    return (
                      <g key={p.seriesKey}>
                        <rect x={boxX} y={boxY} width={boxWidth} height={boxHeight} fill="#1a1a1a" />
                        <text x={boxX + boxWidth / 2} y={boxY + 18} fontSize="11" fill="#d5d5d5" textAnchor="middle">
                          {dateLabel}
                        </text>
                        <text x={boxX + boxWidth / 2} y={boxY + 36} fontSize="15" fontWeight="600" fill="white" textAnchor="middle">
                          {valueLabel}
                        </text>
                      </g>
                    );
                  })}
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* X Labels */}
      <div className="relative mt-4 h-5 text-xs" style={{ color: "#6b6b6b" }}>
        {data.map((item, index) => {
          const period = String(item[xKey]);
          const year = timeScale ? new Date(item[xKey]).getUTCFullYear() : Number(period.slice(0, 4));
          const firstYear = timeScale ? new Date(data[0][xKey]).getUTCFullYear() : Number(String(data[0][xKey]).slice(0, 4));
          const isMilestone = timeScale
            ? new Date(item[xKey]).getUTCMonth() === 0 && (year - firstYear) % 2 === 0
            : period.endsWith("-01") && (year - firstYear) % 2 === 0;
          if (!isMilestone && index !== data.length - 1) return null;
          const left = `${(chart.xForValue(item[xKey], index) / VB_WIDTH) * 100}%`;
          return (
            <span
              key={index}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left }}
            >
              {item[labelKey]}
            </span>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex gap-4 text-sm" style={{ color: "#4a4a4a" }}>
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span style={{ display: "inline-block", width: 14, height: 2, backgroundColor: s.color, opacity: s.dashed ? 0.6 : 1 }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}