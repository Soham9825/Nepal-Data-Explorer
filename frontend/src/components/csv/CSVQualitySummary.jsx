import { SectionCard } from '../ui/Card';
import { Icon } from '../ui/Icon';

export default function CSVQualitySummary({ quality }) {
  if (!quality || !quality.summary) return null;

  const { summary, detected = {}, columns = [] } = quality;
  const records = summary.records ?? 0;
  const valid = summary.valid ?? 0;
  const warning = summary.warning ?? 0;
  const invalid = summary.invalid ?? 0;
  const duplicates = summary.duplicates ?? 0;
  const missingCells = summary.missing_cells ?? 0;
  const formulaCells = summary.formula_cells ?? 0;

  const validPct = records ? Math.round((valid / records) * 100) : 0;
  const warningPct = records ? Math.round((warning / records) * 100) : 0;
  const invalidPct = records ? Math.round((invalid / records) * 100) : 0;

  const detectedEntries = [
    { label: 'Latitude', cols: detected.latitude_columns, icon: 'location_on' },
    { label: 'Longitude', cols: detected.longitude_columns, icon: 'explore' },
    { label: 'Price / Rate', cols: detected.price_columns, icon: 'payments' },
    { label: 'Rating / Stars', cols: detected.rating_columns, icon: 'star' },
    { label: 'Date', cols: detected.date_columns, icon: 'calendar_today' },
    { label: 'District', cols: detected.district_columns, icon: 'map' },
    { label: 'Province', cols: detected.province_columns, icon: 'public' },
    { label: 'Name / Hotel', cols: detected.name_columns, icon: 'apartment' },
  ].filter((item) => item.cols && item.cols.length > 0);

  return (
    <SectionCard
      title="Data Quality & Schema Health"
      subtitle={`Advisory quality report across ${records.toLocaleString()} rows. Original data remains untouched.`}
    >
      {/* Overview stat badges */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <div className="rounded-lg border border-outline-variant bg-surface-high p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-onSurface-variant">Total Rows</p>
          <p className="mt-1 text-lg font-bold text-onSurface">{records.toLocaleString()}</p>
          <p className="text-[11px] text-onSurface-variant">
            {summary.sampled ? `Sampled from ${summary.sampled_from?.toLocaleString()}` : 'Complete'}
          </p>
        </div>

        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Valid</p>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <p className="mt-1 text-lg font-bold text-emerald-700">{valid.toLocaleString()}</p>
          <p className="text-[11px] text-emerald-600/80">{validPct}% of rows</p>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Warning</p>
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
          <p className="mt-1 text-lg font-bold text-amber-700">{warning.toLocaleString()}</p>
          <p className="text-[11px] text-amber-600/80">{warningPct}% (missing/dups)</p>
        </div>

        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-red-700">Invalid</p>
            <span className="h-2 w-2 rounded-full bg-red-500" />
          </div>
          <p className="mt-1 text-lg font-bold text-red-700">{invalid.toLocaleString()}</p>
          <p className="text-[11px] text-red-600/80">{invalidPct}% blocked</p>
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-onSurface-variant">Duplicates</p>
          <p className="mt-1 text-lg font-bold text-onSurface">{duplicates.toLocaleString()}</p>
          <p className="text-[11px] text-onSurface-variant">Row repeats</p>
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-onSurface-variant">Missing Cells</p>
          <p className="mt-1 text-lg font-bold text-onSurface">{missingCells.toLocaleString()}</p>
          <p className="text-[11px] text-onSurface-variant">Gaps</p>
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-onSurface-variant">Formula Cells</p>
          <p className="mt-1 text-lg font-bold text-onSurface">{formulaCells.toLocaleString()}</p>
          <p className="text-[11px] text-onSurface-variant">Export sanitized</p>
        </div>
      </div>

      {/* Detected semantic columns */}
      {detectedEntries.length > 0 && (
        <div className="mt-4 border-t border-outline-variant pt-3">
          <p className="text-xs font-bold uppercase tracking-wider text-onSurface-variant">
            Detected Semantic Roles
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {detectedEntries.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary"
              >
                <Icon name={item.icon} size={14} />
                <span>{item.label}:</span>
                <span className="font-mono text-[11px] text-onSurface">{item.cols.join(', ')}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Column issue details preview if invalid or formula issues exist */}
      {columns.some((c) => c.invalid > 0 || c.formula > 0) && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50/50 p-3 text-xs text-red-800">
          <p className="font-bold">Column Validation Flags:</p>
          <ul className="mt-1.5 list-inside list-disc space-y-1">
            {columns
              .filter((c) => c.invalid > 0 || c.formula > 0)
              .map((c) => (
                <li key={c.name}>
                  <strong>{c.name}</strong> ({c.role}): {c.invalid} invalid value(s)
                  {c.formula > 0 ? `, ${c.formula} formula-like cell(s)` : ''}.
                  {c.issues?.length > 0 && (
                    <span className="text-red-700/80"> Issues: {c.issues.map((i) => `${i.label} (${i.count})`).join(', ')}</span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
