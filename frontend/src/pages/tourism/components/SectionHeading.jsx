/** A titled band across a section, with an optional control group on the right. */
export default function SectionHeading({ title, description, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="font-hanken text-xl font-bold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm leading-5 text-ink-muted">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
