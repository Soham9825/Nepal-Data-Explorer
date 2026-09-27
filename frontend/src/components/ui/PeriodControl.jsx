
export default function PeriodControl({ value, onChange, options, ariaLabel, label = null }) {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-xs font-semibold text-onSurface-variant font-hanken">{label}</span>
      )}
      <div
        role="group"
        aria-label={ariaLabel}
        className="flex items-center gap-1 rounded-sm border border-outline-variant bg-white p-1"
      >
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={`rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-primary text-white'
                  : 'text-onSurface-variant hover:bg-surface-container hover:text-onSurface'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
