
export default function ToggleControl({ value, onChange, options, ariaLabel, className = '' }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex flex-wrap items-center gap-1 rounded-sm border border-outline-variant bg-white p-1 ${className}`}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={`rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === option.id
              ? 'bg-primary text-white'
              : 'text-onSurface-variant hover:bg-surface-highest'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
