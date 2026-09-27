// ============================================================
// src/components/cards/ProgressBar.jsx
// ============================================================

export default function ProgressBar({ name, population, pct, color }) {
  return (
    <div className="cursor-pointer hover:bg-surface-lowest p-2 rounded-sm transition-colors duration-150">
      <div className="flex justify-between text-[13px] font-bold text-onSurface mb-1.5">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
          {name} Province
        </span>
        <span className="text-onSurface-variant">
          {population} ({pct}%)
        </span>
      </div>
      <div className="h-2 bg-surface-highest rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-600"
          style={{
            width: `${(pct / 25) * 100}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}
