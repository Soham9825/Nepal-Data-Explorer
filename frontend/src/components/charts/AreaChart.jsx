import { useMemo, useState } from 'react';

// Internal SVG coordinate space. Independent of the `height` prop, which
// controls the rendered CSS pixel height.
const WIDTH = 1000;
const HEIGHT = 420;

const PADDING = {
  top: 40,
  right: 40,
  bottom: 50,
  left: 70,
};

export default function AreaChart({
  data = [],
  xKey = 'year',
  yKey = 'value',
  color = '#0051d5',
  height = 420,
}) {
  const [activeIndex, setActiveIndex] = useState(null);

  const chart = useMemo(() => {
    if (!data.length) return null;

    const values = data.map((d) => Number(d[yKey]));

    const max = Math.max(...values);
    const min = Math.min(...values);

    const range = max - min || 1;

    const points = values.map((value, index) => ({
      value,
      x:
        PADDING.left +
        (index * (WIDTH - PADDING.left - PADDING.right)) / Math.max(data.length - 1, 1),

      y:
        HEIGHT - PADDING.bottom - ((value - min) / range) * (HEIGHT - PADDING.top - PADDING.bottom),
    }));

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    const area =
      line +
      `
      L ${points.at(-1).x} ${HEIGHT - PADDING.bottom}
      L ${points[0].x} ${HEIGHT - PADDING.bottom}
      Z
      `;

    return {
      points,
      line,
      area,
      max,
      min,
    };
  }, [data, yKey]);

  if (!chart) {
    return <div className="flex items-center justify-center h-full">No Data Available</div>;
  }

  const active = activeIndex !== null ? chart.points[activeIndex] : null;

  return (
    <div className="w-full h-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{
          height,
          overflow: 'visible',
        }}
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />

            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* GRID */}
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = PADDING.top + step * (HEIGHT - PADDING.top - PADDING.bottom);

          const value = (chart.max - step * (chart.max - chart.min)).toFixed(1);

          return (
            <g key={step}>
              <line x1={PADDING.left} y1={y} x2={WIDTH - PADDING.right} y2={y} stroke="#e5e5e5" />

              <text x="20" y={y + 5} fontSize="13" fill="#777">
                {value}
              </text>
            </g>
          );
        })}

        {/* AXIS */}
        <line
          x1={PADDING.left}
          y1={HEIGHT - PADDING.bottom}
          x2={WIDTH - PADDING.right}
          y2={HEIGHT - PADDING.bottom}
          stroke="#ccc"
          strokeWidth="2"
        />

        {/* AREA */}
        <path d={chart.area} fill="url(#areaGradient)" />

        {/* LINE */}
        <path d={chart.line} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />

        {/* POINTS */}
        {chart.points.map((p, index) => (
          <g key={index}>
            <circle
              cx={p.x}
              cy={p.y}
              r={activeIndex === index ? 8 : 5}
              fill="white"
              stroke={color}
              strokeWidth="3"
            />

            <rect
              x={p.x - 40}
              y={PADDING.top}
              width="80"
              height={HEIGHT - PADDING.top - PADDING.bottom}
              fill="transparent"
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            />
          </g>
        ))}

        {/* TOOLTIP */}
        {active && (
          <g>
            <rect x={active.x - 35} y={active.y - 45} width="70" height="32" rx="6" fill="#222" />

            <text
              x={active.x}
              y={active.y - 24}
              textAnchor="middle"
              fill="white"
              fontSize="14"
              fontWeight="600"
            >
              {active.value}
            </text>
          </g>
        )}
      </svg>

      {/* X LABEL */}
      <div className="flex justify-between px-12 text-xs text-gray-500">
        {data.map((d, i) => (
          <span key={i}>{d[xKey]}</span>
        ))}
      </div>
    </div>
  );
}
