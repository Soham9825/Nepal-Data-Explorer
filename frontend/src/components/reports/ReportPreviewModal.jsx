import { useEffect, useRef } from 'react';
import { Icon } from '../ui/Icon';
import { BtnOutline } from '../ui/Button';
import DataTable from './DataTable';
import { typeColors } from '../../data/reportsData';

/**
 * Preview of a dataset before downloading it.
 *
 * Reads as a dialog and behaves like one: Escape closes it, the close button takes focus
 * on open so the keyboard lands somewhere sensible, and focus returns to the page behind
 * on close. Previously it was a bare overlay with an unlabelled X and no Escape handler,
 * so it could only be dismissed by clicking the backdrop.
 */
export default function ReportPreviewModal({ report, onClose, onDownload }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!report) return undefined;
    closeRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    // The page behind must not scroll while the dialog is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [report, onClose]);

  if (!report) return null;
  const colors = typeColors[report.type] || typeColors.CSV;
  const isTable = report.preview?.kind === 'table';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview of ${report.title}`}
        className="card-shadow flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-sm border border-outline-variant bg-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Icon name={report.icon} size={20} color={colors.color} className="shrink-0" />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-onSurface" title={report.title}>
                {report.title}
              </div>
              {/* The three facts are laid out in a fixed-width row so they form a tidy
                  strip under the title rather than a run-on line. */}
              <div className="mt-0.5 flex items-center gap-2 text-xs text-onSurface-variant">
                <span
                  className="rounded-[2px] px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.05em]"
                  style={{ background: colors.bg, color: colors.color }}
                >
                  {report.type}
                </span>
                <span className="tabular-nums">{report.size}</span>
                <span aria-hidden="true">·</span>
                <span>{report.date}</span>
              </div>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="shrink-0 rounded-sm p-1 text-onSurface-variant transition-colors duration-150 hover:bg-surface-high hover:text-onSurface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isTable ? (
            <DataTable columns={report.preview.columns} rows={report.preview.rows || []} />
          ) : (
            <p className="text-sm leading-relaxed text-onSurface-variant">
              {report.preview?.summary ||
                'No preview is available for this file. Download it to view the contents.'}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-outline-variant px-5 py-3.5">
          <p className="text-xs text-onSurface-variant">
            Preview only — the download contains every row.
          </p>
          <BtnOutline className="px-4 py-2" onClick={() => onDownload(report)}>
            <Icon name="download" size={14} /> Download Full File
          </BtnOutline>
        </div>
      </div>
    </div>
  );
}
