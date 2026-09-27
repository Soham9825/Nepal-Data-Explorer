import { Icon } from '../../../components/ui/Icon';

/**
 * One headline figure for the key indicator row: a label, the value, an optional
 * change badge and a supporting detail line.
 */
export default function SummaryCard({ label, value, detail, badge, icon, accent, flag }) {
  return (
    <article className="border border-outline-variant bg-surface p-4 card-shadow transition-colors duration-200 hover:border-primary">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-ink-muted">{label}</p>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm"
          style={{ backgroundColor: `${accent}14`, color: accent }}
        >
          <Icon name={icon} size={15} color={accent} />
        </span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xl font-bold leading-tight tracking-tight tabular-nums text-ink">
        {flag && (
          <span aria-hidden="true" className="text-lg leading-none">
            {flag}
          </span>
        )}
        <span>{value}</span>
      </p>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-0.5">
        {badge}
        {detail && <span className="text-xs leading-5 text-ink-muted">{detail}</span>}
      </div>
    </article>
  );
}
