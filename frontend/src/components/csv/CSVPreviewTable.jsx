import React from 'react';
import { SectionCard } from '../ui/Card';
import { BtnPrimary } from '../ui/Button';
import { Icon } from '../ui/Icon';

const MAX_PREVIEW_ROWS = 8;

export default function CSVPreviewTable({ fileName, headers, rows, onReplace }) {
  return (
    <SectionCard
      title="Data preview"
      subtitle={fileName
        ? `${headers.length} columns · ${rows.length} rows · First ${Math.min(rows.length, MAX_PREVIEW_ROWS)} visible · Scroll to view all`
        : 'Your uploaded data will appear here.'}
      action={fileName && <BtnPrimary onClick={onReplace}>Replace file</BtnPrimary>}
    >
      {!fileName ? (
        <div className="flex min-h-36 flex-1 flex-col items-center justify-center text-center text-onSurface-variant">
          <Icon name="table_view" size={32} />
          <p className="mt-2 text-sm">No dataset selected yet.</p>
        </div>
      ) : (
        <div className="max-h-[24rem] overflow-auto border border-outline-variant">
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
              {rows.map((row, rowIndex) => (
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
        </div>
      )}
    </SectionCard>
  );
}
