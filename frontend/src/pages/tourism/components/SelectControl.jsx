import { Icon } from '../../../components/ui/Icon';

/**
 * Option picker for the per-chart filters.
 *
 * Styled to match the dashboard's other option controls (see
 * pages/economic/components/YearSelect.jsx): a square hairline box on `bg-surface` that fills with `surface-highest`
 * on hover and marks focus with the on-surface border, rather than a rounded,
 * pill-like control. The native select is kept so keyboard and mobile pickers
 * behave normally; only the chrome is restyled.
 */
export default function SelectControl({
  label,
  value,
  onChange,
  options,
  ariaLabel = label,
  className = '',
}) {
  if (!options.length) return null;
  return (
    <label className={`inline-flex min-w-0 items-center gap-2 ${className}`} title={ariaLabel}>
      <span className="shrink-0 text-xs font-semibold text-caption">{label}</span>
      <span className="group relative inline-flex min-w-0">
        <select
          aria-label={ariaLabel}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 min-h-[44px] min-w-[7.5rem] cursor-pointer appearance-none border border-outline-variant bg-surface py-0 pl-3 pr-8 font-sans text-xs font-semibold text-onSurface outline-none transition-colors duration-150 hover:bg-surface-highest focus:border-onSurface-variant [&>option]:bg-surface [&>option]:text-ink [&>option]:font-medium"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-onSurface-variant transition-colors duration-150 group-hover:text-onSurface"
        >
          <Icon name="expand_more" size={18} color="currentColor" />
        </span>
      </span>
    </label>
  );
}
