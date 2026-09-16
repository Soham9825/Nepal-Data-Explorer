
import { Icon } from '../ui/Icon';
import { BtnOutline } from '../ui/Button';
import DataTable from './DataTable';
import { typeColors } from '../../data/reportsData';

export default function ReportPreviewModal({ report, onClose, onDownload }) {
  if (!report) return null;
  const colors = typeColors[report.type];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6" onClick={onClose}>
      <div
        className="bg-surface border border-outline-variant rounded-sm w-full max-w-2xl max-h-[80vh] overflow-y-auto card-shadow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <Icon name={report.icon} size={20} color={colors.color} />
            <div>
              <div className="text-sm font-bold text-onSurface">{report.title}</div>
              <div className="text-xs text-onSurface-variant">{report.date} · {report.size}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-onSurface-variant hover:text-onSurface">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="p-6">
          {report.preview.kind === 'pdf' && (
            <p className="text-sm text-onSurface-variant leading-relaxed">{report.preview.summary}</p>
          )}
          {report.preview.kind === 'table' && (
            <DataTable columns={report.preview.columns} rows={report.preview.rows} />
          )}
        </div>

        <div className="px-6 py-4 border-t border-outline-variant flex justify-end">
          <BtnOutline className="px-4 py-2" onClick={() => onDownload(report)}>
            <Icon name="download" size={14} /> Download Full File
          </BtnOutline>
        </div>
      </div>
    </div>
  );
}