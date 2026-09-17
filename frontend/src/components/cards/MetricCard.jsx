
import { Icon } from "../ui/Icon";

export default function MetricCard({
  label,
  value,
  change,
  trend = "up",
  subtitle,
  icon,
  color = "#0051d5",
}) {
  const isUp = trend === "up";
  const trendColor = isUp ? "#0f7a3d" : "#b70011";

  return (
    <div
      className="bg-surface border border-outline-variant rounded-sm p-5 hover:border-primary transition-colors duration-200"
      style={{ borderTop: `3px solid ${color}`, fontFamily: "'Hanken Grotesk', sans-serif" }}
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

      <p className="text-2xl font-bold text-onSurface">{value}</p>

      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        <Icon name={isUp ? "trending_up" : "trending_down"} size={14} color={trendColor} />
        <span className="text-sm font-bold" style={{ color: trendColor }}>
          {change}
        </span>
        {subtitle && (
          <span className="text-xs text-onSurface-variant">{subtitle}</span>
        )}
      </div>
    </div>
  );
}