import { SectionCard } from '../ui/Card';
import ReportRow, { REPORT_COLUMNS } from './ReportRow';
import { Icon } from '../ui/Icon';

/**
 * The report list, laid out as a real table.
 *
 * The column widths live in `REPORT_COLUMNS` and are shared by the heading row and every
 * data row. Previously each row was a flex box whose parts were sized by their own
 * content, so a row titled "Annual Global Economics" put its type badge and Download
 * button further right than a row with a short title — the columns visibly staircased down
 * the list. Fixed tracks make every badge and button share one vertical line.
 *
 * The heading is sticky inside the scroll box so the columns stay labelled for all 22
 * datasets rather than scrolling out of view after the first few rows.
 */
export default function ReportsList({ reports = [], onSelect, onDownload, loading = false }) {
  const count = reports.length;

  const subtitle = loading
    ? 'Loading the dataset catalogue…'
    : count === 0
      ? 'No datasets are available right now'
      : `${count} dataset${count === 1 ? '' : 's'} available · select a row to preview`;

  return (
    <SectionCard title="All Available Reports & Datasets" subtitle={subtitle} noPad>
      <div className="max-h-[30rem] overflow-y-auto">
        {/* Column headings. The empty cell under the icon keeps the headings on the same
            grid as the rows, so title, type and action all start at one x position. */}
        <div
          className={`sticky top-0 z-10 grid items-center gap-4 border-b border-outline-variant bg-surface-container px-6 py-2.5 text-[10px] font-bold uppercase tracking-wider text-onSurface-variant ${REPORT_COLUMNS}`}
        >
          <span aria-hidden="true" />
          <span>Dataset</span>
          <span className="text-right">Type</span>
          <span className="text-right">Action</span>
        </div>

        {loading && (
          <p className="px-6 py-8 text-center text-sm text-onSurface-variant">Loading datasets…</p>
        )}

        {!loading && count === 0 && (
          <div className="px-6 py-10 text-center">
            <Icon name="folder_off" size={26} className="mx-auto mb-2 text-onSurface-variant" />
            <p className="text-sm font-semibold text-onSurface">No datasets to show</p>
            <p className="mt-1 text-xs text-onSurface-variant">
              Datasets placed in the backend data folders will appear here.
            </p>
          </div>
        )}

        {reports.map((report, index) => (
          <ReportRow
            key={report.id || report.title}
            report={report}
            isLast={index === count - 1}
            onSelect={onSelect}
            onDownload={onDownload}
          />
        ))}
      </div>
    </SectionCard>
  );
}
