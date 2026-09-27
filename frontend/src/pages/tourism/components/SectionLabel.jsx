/** Small uppercase caption used to label the blocks inside a panel. */
export default function SectionLabel({ children, className = '' }) {
  return (
    <p className={`text-sm font-semibold uppercase tracking-[0.08em] text-ink-muted ${className}`}>
      {children}
    </p>
  );
}
