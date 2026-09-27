import { Icon } from '../../../components/ui/Icon';
import { SEMANTIC_COLORS as COLORS } from '../../../theme/colors';

/**
 * The bordered box every chart, ranking and readout sits in.
 *
 * `id` turns the panel into a deep-link target. `scroll-mt-24` reserves room for
 * the sticky tab bar, so scrolling to a panel does not tuck its heading underneath.
 *
 * The hover treatment matches the National dashboard's section cards: a soft
 * shadow with the border picking up the primary colour.
 */
export default function ChartPanel({
  id,
  title,
  subtitle,
  action,
  children,
  note,
  className = '',
}) {
  return (
    <section
      id={id || undefined}
      className={`card-shadow flex min-w-0 flex-col border border-outline-variant bg-surface transition-colors duration-200 hover:border-primary ${id ? 'scroll-mt-24' : ''} ${className}`}
    >
      <div className="flex flex-col gap-2 px-3.5 pb-2.5 pt-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-hanken text-lg font-bold tracking-tight text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm leading-5 text-ink-muted">{subtitle}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3.5 pb-3">{children}</div>
      {note && (
        <div className="flex items-start gap-1.5 border-t border-outline-variant px-3.5 py-2.5 text-xs leading-5 text-caption">
          <Icon name="info" size={13} color={COLORS.secondary} />
          <span className="font-medium">{note}</span>
        </div>
      )}
    </section>
  );
}
