import { useMemo, useState } from 'react';
import { SectionCard } from '../ui/Card';
import ReportRow, { REPORT_COLUMNS } from './ReportRow';
import { Icon } from '../ui/Icon';

const CATEGORY_FILTERS = [
  { key: 'tourism', label: 'Tourism', icon: 'flight_takeoff' },
  { key: 'economic', label: 'Economic', icon: 'query_stats' },
  { key: 'all', label: 'Tourism and Economic', icon: 'layers' },
];

/**
 * The report list as a real table, filterable by Tourism / Economic / both. The default
 * view shows every dataset, since some are neither tourism nor economic.
 */
export default function ReportsList({ reports = [], onSelect, onDownload, loading = false }) {
  const [category, setCategory] = useState('all');

  // Files with no `category` field still show in the default view, never silently hidden.
  const visible = useMemo(() => {
    if (category === 'all') return reports;
    return reports.filter((report) => report.category === category);
  }, [reports, category]);

  const count = visible.length;
  const filtered = category !== 'all';

  const subtitle = loading
    ? 'Loading the dataset catalogue…'
    : count === 0
      ? filtered
        ? `No ${category} datasets are available right now`
        : 'No datasets are available right now'
      : filtered
        ? `${count} of ${reports.length} dataset${reports.length === 1 ? '' : 's'} available · select a row to preview`
        : `${count} dataset${count === 1 ? '' : 's'} available · select a row to preview`;

  // Rides in the card's `action` slot so it shares the title line.
  const categoryFilter = (
    <div
      role="group"
      aria-label="Filter datasets by category"
      className="flex flex-wrap items-center justify-end gap-1 rounded-sm border border-outline-variant bg-surface-container p-1"
    >
      {CATEGORY_FILTERS.map((filter) => {
        const active = category === filter.key;
        return (
          <button
            key={filter.key}
            type="button"
            onClick={() => setCategory(filter.key)}
            aria-pressed={active}
            className={`flex items-center gap-1.5 rounded-sm px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] transition-colors ${
              active
                ? 'bg-primary text-white'
                : 'text-onSurface-variant hover:bg-white hover:text-onSurface'
            }`}
          >
            <Icon name={filter.icon} size={16} />
            {filter.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <SectionCard title="All Available Reports & Datasets" subtitle={subtitle} action={categoryFilter} noPad>
      {/* Gap lives outside the scroller: as padding here it left a transparent strip
          above the pinned heading that the rows scrolled through. */}
      <div className="pt-4">
        <div className="max-h-[30rem] overflow-y-auto">
          <div
            className={`sticky top-0 z-20 grid items-center gap-4 border-b border-outline-variant bg-surface-container px-6 py-2.5 text-[10px] font-bold uppercase tracking-wider text-onSurface-variant ${REPORT_COLUMNS}`}
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
                {filtered
                  ? 'Try the “Tourism and Economic” view to see every dataset.'
                  : 'Datasets placed in the backend data folders will appear here.'}
              </p>
            </div>
          )}

          {visible.map((report, index) => (
            <ReportRow
              key={report.id || report.title}
              report={report}
              isLast={index === count - 1}
              onSelect={onSelect}
              onDownload={onDownload}
            />
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

