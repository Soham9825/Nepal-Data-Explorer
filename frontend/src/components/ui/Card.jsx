/**
 * Shared section card.
 *
 * Carries the hover treatment the National dashboard already uses — a soft
 * shadow with the border picking up the primary colour on hover — so every
 * section reads the same way across pages. `transition-colors` keeps the border
 * change smooth, and callers can still override `className` per instance.
 */
export function SectionCard({
  id,
  title,
  subtitle,
  action,
  className = '',
  contentClassName = '',
  noPad = false,
  children,
}) {
  return (
    <div
      id={id}
      className={`card-shadow flex flex-col border border-outline-variant bg-surface transition-colors duration-200 hover:border-primary ${className}`}
    >
      <div className="flex items-start justify-between gap-4 p-5 pb-0">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-onSurface font-hanken">{title}</h3>
          {subtitle && <p className="text-sm text-onSurface-variant font-hanken">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* `noPad` lets a caller run a list flush to the card edges. The Reports list needs
          it for its column headings to line up with the rows beneath them; without it the
          rows sat inside a second layer of padding, so nothing shared an edge. The
          heading keeps its own padding either way, so the title never touches the border. */}
      <div className={`flex flex-1 flex-col min-h-0 ${noPad ? '' : 'p-5'} ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}
