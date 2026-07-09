export function SectionCard({ title, subtitle, className = "", contentClassName = "", children }) {
  return (
    <div className={`bg-surface border border-outline-variant flex flex-col ${className}`}>
      <div className="p-5 pb-0">
        <h3 className="text-lg font-bold text-onSurface font-hanken">{title}</h3>
        {subtitle && (
          <p className="text-sm text-onSurface-variant font-hanken">{subtitle}</p>
        )}
      </div>

      {/* This is the div that must flex to fill remaining height */}
      <div className={`p-5 flex-1 flex flex-col min-h-0 ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}