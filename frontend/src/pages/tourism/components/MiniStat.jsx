/** A single supporting figure, used in the small stat rows above a ranking. */
export default function MiniStat({ label, value, flag }) {
  return (
    <div className="border border-outline-variant bg-surface p-4 card-shadow transition-colors duration-200 hover:border-primary">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="mt-1.5 text-lg font-bold tabular-nums text-ink">
        {flag && (
          <span aria-hidden="true" className="mr-1.5 text-base leading-none">
            {flag}
          </span>
        )}
        {value}
      </p>
    </div>
  );
}
