import { Tag } from '../ui/Tag';
import { Icon } from '../ui/Icon';
import { BtnOutline } from '../ui/Button';
import { typeColors } from '../../data/reportsData';

/**
 * Grid tracks shared by the column headings and every row.
 *
 * The icon is a fixed square so titles all begin at the same offset, the title takes the
 * remaining space, and the badge and action are fixed so they stack into two clean
 * vertical lines down the list no matter how long the dataset titles are.
 */
export const REPORT_COLUMNS = 'grid-cols-[2.25rem_minmax(0,1fr)_5.5rem_7.5rem]';

/**
 * Filenames carry a leading catalogue number and are title-cased from the stem, which
 * leaves titles like "17.Gross Foreign Exchange Earnings…". The number is an artefact of
 * the file listing rather than part of the dataset's name, so it is dropped for display.
 * Underscores become spaces so the title reads the way the column headings do.
 */
function displayTitle(title) {
  return String(title || '')
    .replace(/^\d+\s*\.\s*/, '')
    .replace(/_/g, ' ')
    .trim();
}

export default function ReportRow({ report, isLast, onSelect, onDownload }) {
  // Unknown types fall back to the CSV palette rather than throwing on a lookup miss.
  const colors = typeColors[report.type] || typeColors.CSV;
  const title = displayTitle(report.title);

  // Enter and Space both activate, matching what a real button does. The previous version
  // only handled Enter, so the row could not be opened from the keyboard the normal way.
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(report);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(report)}
      onKeyDown={handleKeyDown}
      className={`grid ${REPORT_COLUMNS} cursor-pointer items-center gap-4 px-6 py-3.5 transition-colors duration-150 hover:bg-surface-lowest focus:bg-surface-lowest focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 ${
        !isLast ? 'border-b border-outline-variant' : ''
      }`}
    >
      <Icon name={report.icon} size={20} color={colors.color} className="shrink-0" />

      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-onSurface" title={title}>
          {title}
        </div>
        {/* `tabular-nums` keeps the file size from shifting as the digits change, and the
            two facts are separated by a middot so the line reads as a list. */}
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-onSurface-variant">
          <span className="tabular-nums">{report.size}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{report.date}</span>
        </div>
      </div>

      <div className="flex justify-end">
        <Tag label={report.type} color={colors.color} bg={colors.bg} />
      </div>

      <div className="flex justify-end">
        <BtnOutline
          className="px-3 py-1.5"
          aria-label={`Download ${title}`}
          onClick={(event) => {
            event.stopPropagation();
            onDownload(report);
          }}
        >
          <Icon name="download" size={14} /> Download
        </BtnOutline>
      </div>
    </div>
  );
}
