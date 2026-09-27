import SectionLabel from './SectionLabel';

/**
 * The year-in-review card used beside a chart: one headline figure, a short
 * table of supporting figures, and a sentence of interpretation.
 *
 * Reading order is deliberate — the hero number is the only large thing on the
 * card, the supporting figures sit in a ruled table so the eye can track a row
 * across to its value instead of hunting, and the narrative is separated by
 * whitespace as a conclusion rather than sitting inline with the figures.
 *
 * `justify-between` distributes the blocks when the card is stretched to match
 * a taller chart beside it, so leftover space falls between blocks instead of
 * pooling into one gap under the last row.
 */
export default function YearSummaryCard({
  label,
  heroLabel,
  heroValue,
  stats = [],
  extra = null,
  note,
}) {
  return (
    <div className="flex flex-col justify-between border border-outline-variant bg-surface p-4 card-shadow transition-colors duration-200 hover:border-primary">
      <div>
        <SectionLabel>{label}</SectionLabel>
        <p className="mt-3 text-sm font-medium text-ink-muted">{heroLabel}</p>
        <p className="mt-1 font-hanken text-3xl font-bold leading-tight tabular-nums text-ink">
          {heroValue}
        </p>
      </div>

      {stats.length > 0 && (
        <dl className="mt-4 divide-y divide-outline-variant border-y border-outline-variant">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink-muted">
                {stat.color && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: stat.color }}
                  />
                )}
                <span className="truncate">{stat.label}</span>
              </dt>
              <dd className="flex shrink-0 items-baseline gap-2">
                <span className="text-sm font-bold tabular-nums text-ink">{stat.value}</span>
                {stat.suffix && (
                  <span className="w-12 text-right text-xs tabular-nums text-ink-muted">
                    {stat.suffix}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {extra}
      {note && <p className="mt-4 text-xs leading-5 text-ink-muted">{note}</p>}
    </div>
  );
}
