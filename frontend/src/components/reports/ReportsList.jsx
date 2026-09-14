
import { SectionCard } from '../ui/Card';
import ReportRow from './ReportRow';

export default function ReportsList({ reports, onSelect, onDownload }) {
  return (
    <SectionCard title="All Available Reports & Datasets" subtitle="Showing 6 reports · scroll to view more · click a row to preview" noPad>
      <div className="max-h-[30rem] overflow-y-auto">
        {reports.map((r, i) => (
          <ReportRow
            key={r.title}
            report={r}
            isLast={i === reports.length - 1}
            onSelect={onSelect}
            onDownload={onDownload}
          />
        ))}
      </div>
    </SectionCard>
  );
}