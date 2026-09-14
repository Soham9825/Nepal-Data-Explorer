import { useEffect, useMemo, useState } from 'react';
import { SectionCard } from '../ui/Card';
import { BtnPrimary } from '../ui/Button';
import { Icon } from '../ui/Icon';

const PREVIEW_PAGE_SIZE = 10;

export default function CSVPreviewTable({ fileName, headers, rows, totalRowCount, isSampled, onReplace }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [fileName, rows]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PREVIEW_PAGE_SIZE));
  const visibleRows = useMemo(
    () => rows.slice((page - 1) * PREVIEW_PAGE_SIZE, page * PREVIEW_PAGE_SIZE),
    [rows, page],
  );
  const rowCount = totalRowCount ?? rows.length;
  return (
    <SectionCard
      title="Data preview"
      subtitle={fileName
        ? `${headers.length} columns · ${rowCount.toLocaleString()} rows${isSampled ? ` · showing the first ${rows.length.toLocaleString()} for exploration` : ''} · Page ${page} of ${pageCount}`
        : 'Your uploaded data will appear here.'}
      action={fileName && <BtnPrimary onClick={onReplace}>Replace file</BtnPrimary>}
    >
      {!fileName ? (
        <div className="flex min-h-36 flex-1 flex-col items-center justify-center text-center text-onSurface-variant">
          <Icon name="table_view" size={32} />
          <p className="mt-2 text-sm">No dataset selected yet.</p>
        </div>
      ) : (
        <div className="overflow-auto border border-outline-variant">
          <table className="w-full min-w-max border-collapse text-left">
            <thead className="bg-surface-high">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="border-b border-outline-variant px-4 py-3 text-xs font-bold uppercase tracking-wide text-onSurface-variant">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, rowIndex) => (
                <tr key={`${fileName}-${rowIndex}`} className="even:bg-surface-lowest">
                  {headers.map((header) => (
                    <td key={`${rowIndex}-${header}`} className="border-b border-outline-variant px-4 py-3 text-sm text-onSurface">
                      {row[header] !== null && row[header] !== undefined && row[header] !== '' ? row[header] : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-outline-variant bg-surface-low px-4 py-3 text-xs text-onSurface-variant">
            <span>Rows {(page - 1) * PREVIEW_PAGE_SIZE + 1}–{Math.min(page * PREVIEW_PAGE_SIZE, rows.length)} of {rows.length}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded border border-outline-variant px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
              <button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} className="rounded border border-outline-variant px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
