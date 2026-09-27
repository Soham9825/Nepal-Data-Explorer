/**
 * Province switcher that mirrors the Province Explorer's tab bar: canonical
 * order, an underline on the active province, one navigation model across both
 * pages.
 *
 * The row is wrapped in a full border so the whole group reads as one control
 * rather than a loose line of labels. The border stays square, matching the
 * hairline boxes used elsewhere in the dashboard, and `overflow-hidden` clips
 * the row while it scrolls sideways.
 *
 * The seven tabs share the full width inside the border. From `xl` up that is a
 * seven-column grid, so each province owns an equal slice and the underline spans
 * the full column; seven inline labels plus counts only fit from `xl`, and below
 * that the row keeps its natural widths and scrolls sideways rather than
 * truncating province names.
 *
 * The count sits inline after the name, so every tab stays a single compact line
 * rather than growing to two.
 */
export default function ProvinceSelector({
  provinces,
  activeProvince,
  onChange,
  destinationCounts,
}) {
  if (!provinces.length) return null;
  return (
    <div className="overflow-hidden border border-outline-variant bg-surface">
      <div
        className="flex items-stretch overflow-x-auto xl:grid xl:grid-cols-7 xl:overflow-visible"
        role="tablist"
        aria-label="Select province"
      >
        {provinces.map((province) => {
          const active = province.province === activeProvince;
          const count = destinationCounts?.[province.province];
          return (
            <button
              key={province.province}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(province.province)}
              className={`flex min-w-[8rem] shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-2.5 font-hanken text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary xl:min-w-0 ${
                active
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-transparent text-ink-muted hover:border-hairline-strong hover:bg-surface-low hover:text-ink'
              }`}
            >
              <span className="truncate">{province.province}</span>
              {count != null && (
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    active ? 'text-primary' : 'text-ink-faint'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
