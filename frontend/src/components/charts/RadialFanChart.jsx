import { useMemo, useState } from 'react';

function polar(cx, cy, radius, angle) {
  const radians = (angle * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy - radius * Math.sin(radians) };
}

function wedgePath(cx, cy, radius, start, end) {
  const first = polar(cx, cy, radius, start);
  const second = polar(cx, cy, radius, end);
  return `M ${cx},${cy} L ${first.x},${first.y} A ${radius},${radius} 0 0 1 ${second.x},${second.y} Z`;
}

function compactLabel(value) {
  const words = String(value).split(/\s+/).filter(Boolean);
  if (words.length > 1)
    return words
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  return String(value).slice(0, 6).toUpperCase();
}

const COLORS = ['#0051D5', '#0F7A3D', '#B45309', '#B70011', '#6A1B9A', '#007C91', '#C2410C'];

export default function RadialFanChart({ data, title, unit = '%' }) {
  const [hoveredYear, setHoveredYear] = useState(null);
  const width = 1200;
  const height = 560;
  const centerX = width / 2;
  const centerY = height * 0.87;
  const maxValue = Math.max(...data.map((item) => Number(item.value) || 0), 1);
  const average =
    data.reduce((total, item) => total + (Number(item.value) || 0), 0) / (data.length || 1);
  const wedges = useMemo(
    () =>
      data.map((item, index) => {
        const step = 180 / data.length;
        const start = 180 - index * step;
        const end = start - step;
        const value = Number(item.value) || 0;
        const radius = 104 + (Math.max(0, value) / maxValue) * 292;
        const fullLabel = String(item.year).replace('Real_', '');
        return {
          ...item,
          label: compactLabel(fullLabel),
          fullLabel,
          value,
          radius,
          start,
          end,
          color: COLORS[index % COLORS.length],
        };
      }),
    [data, maxValue]
  );

  if (!data.length) return null;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-sm bg-surface px-3 py-5 font-sans">
      <svg
        className="min-h-0 w-full flex-1"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={title}
      >
        <defs>
          {wedges.map((wedge, index) => (
            <linearGradient
              key={`gradient-${wedge.year}`}
              id={`fan-gradient-${index}`}
              x1="0"
              y1="1"
              x2="0.8"
              y2="0"
            >
              <stop offset="0%" stopColor={wedge.color} stopOpacity="0.78" />
              <stop offset="100%" stopColor={wedge.color} stopOpacity="1" />
            </linearGradient>
          ))}
        </defs>
        {[104, 200, 296, 396].map((radius) => {
          const left = polar(centerX, centerY, radius, 180);
          const right = polar(centerX, centerY, radius, 0);
          return (
            <path
              key={radius}
              d={`M ${left.x},${left.y} A ${radius},${radius} 0 0 1 ${right.x},${right.y}`}
              fill="none"
              stroke="#94A3B8"
              strokeWidth="1.5"
              strokeDasharray="4 7"
            />
          );
        })}
        <line
          x1={centerX - 410}
          y1={centerY}
          x2={centerX + 410}
          y2={centerY}
          stroke="#DCE3EC"
          strokeWidth="1.5"
        />
        {wedges.map((wedge) => {
          const middle = (wedge.start + wedge.end) / 2;
          const labelPoint = polar(centerX, centerY, wedge.radius + 25, middle);
          const isHovered = hoveredYear === wedge.year;
          return (
            <g
              key={wedge.year}
              className="transition-transform duration-200"
              style={{
                transformOrigin: `${centerX}px ${centerY}px`,
                transform: isHovered ? 'scale(1.025)' : 'scale(1)',
              }}
            >
              <path
                d={wedgePath(centerX, centerY, wedge.radius, wedge.start, wedge.end)}
                fill={`url(#fan-gradient-${wedges.indexOf(wedge)})`}
                opacity="1"
                stroke="#FFFFFF"
                strokeWidth={isHovered ? 4 : 2}
                className="cursor-pointer transition-opacity duration-200"
                onMouseEnter={() => setHoveredYear(wedge.year)}
                onMouseLeave={() => setHoveredYear(null)}
              />
              <line
                x1={polar(centerX, centerY, wedge.radius, middle).x}
                y1={polar(centerX, centerY, wedge.radius, middle).y}
                x2={labelPoint.x}
                y2={labelPoint.y}
                stroke={isHovered ? wedge.color : '#A9B4C6'}
                strokeWidth={isHovered ? 2 : 1}
              />
              <text
                x={labelPoint.x}
                y={labelPoint.y + 4}
                fill={isHovered ? wedge.color : '#4B5563'}
                fontSize={data.length > 8 ? 12 : 15}
                fontWeight="700"
                textAnchor="middle"
              >
                {wedge.label}
              </text>
            </g>
          );
        })}
        <circle cx={centerX} cy={centerY} r="67" fill="#FFFFFF" stroke="#D8DEE8" strokeWidth="2" />
        <circle cx={centerX} cy={centerY} r="57" fill="none" stroke="#EEF2F7" strokeWidth="2" />
        <text
          x={centerX}
          y={centerY - 5}
          fill="#20252D"
          fontSize="25"
          fontWeight="800"
          textAnchor="middle"
        >
          {average.toFixed(1)}
          {unit}
        </text>
        <text
          x={centerX}
          y={centerY + 19}
          fill="#667085"
          fontSize="12"
          fontWeight="600"
          textAnchor="middle"
        >
          Average growth
        </text>
      </svg>
      {hoveredYear && (
        <div className="pointer-events-none absolute right-5 top-20 rounded-sm border border-outline-variant bg-white px-4 py-3 text-xs shadow-lg">
          <p className="font-bold text-onSurface">
            {wedges.find((wedge) => wedge.year === hoveredYear)?.fullLabel}
          </p>
          <p className="mt-1 text-onSurface-variant">
            Growth: {wedges.find((wedge) => wedge.year === hoveredYear)?.value}
            {unit}
          </p>
        </div>
      )}
      <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-x-8 gap-y-2 border-t border-outline-variant px-4 pt-4 text-xs sm:grid-cols-3 lg:grid-cols-4">
        {wedges.map((wedge) => (
          <div
            key={`legend-${wedge.year}`}
            className="flex min-w-0 items-center gap-2 text-onSurface-variant"
          >
            <span
              aria-hidden="true"
              className="shrink-0 rounded-full"
              style={{
                width: 10,
                height: 10,
                minWidth: 10,
                display: 'inline-block',
                backgroundColor: wedge.color,
                border: '1px solid rgba(0, 0, 0, 0.18)',
              }}
            />
            <span className="truncate font-medium">{wedge.fullLabel}</span>
            <strong className="ml-auto text-onSurface">
              {wedge.value}
              {unit}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
