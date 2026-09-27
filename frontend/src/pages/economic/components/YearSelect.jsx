
export default function YearSelect({ value, onChange, years, ariaLabel }) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-sm border border-outline-variant bg-white px-3 py-1.5 text-xs font-semibold text-onSurface"
    >
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  );
}
