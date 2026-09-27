import { Icon } from '../ui/Icon';

export default function MetricCard({
  label,
  value,
  unit, // explicit unit printed next to the (often abbreviated) value
  tooltip, // full unformatted readout, revealed on hover/focus
  change,
  trend = 'up',
  subtitle,
  icon,
  color = '#0051d5',
}) {
  const isUp = trend === 'up';
  const trendColor = isUp ? '#0f7a3d' : '#b70011';

  return (
    <div
      className={`bg-surface border border-outline-variant rounded-sm p-5 hover:border-primary transition-colors duration-200 ${
        tooltip ? 'group relative' : ''
      }`}
      style={{ borderTop: `3px solid ${color}`, fontFamily: "'Hanken Grotesk', sans-serif" }}
      tabIndex={tooltip ? 0 : undefined}
      aria-label={tooltip ? `${label}: ${tooltip}` : undefined}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-[11px] font-bold uppercase text-onSurface-variant tracking-wider">
          {label}
        </span>
        {icon && (
          <span
            className="flex items-center justify-center rounded-sm"
            style={{ width: 32, height: 32, backgroundColor: `${color}1A` }}
          >
            <Icon name={icon} size={18} color={color} />
          </span>
        )}
      </div>

      <p className="text-2xl font-bold text-onSurface">
        {value}
        {unit && (
          <span className="ml-1.5 align-middle text-sm font-semibold text-onSurface-variant">
            {unit}
          </span>
        )}
      </p>

      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        <Icon name={isUp ? 'trending_up' : 'trending_down'} size={14} color={trendColor} />
        <span className="text-sm font-bold" style={{ color: trendColor }}>
          {change}
        </span>
        {subtitle && <span className="text-xs text-onSurface-variant">{subtitle}</span>}
      </div>

      {/* Full-precision readout. The headline number is abbreviated to stay on
          one line, so the exact figure stays available on hover and on keyboard
          focus. */}
      {tooltip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute left-5 right-5 top-full z-30 mt-1 rounded-sm border border-outline-variant bg-white px-3 py-2 text-xs font-semibold text-onSurface opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}
