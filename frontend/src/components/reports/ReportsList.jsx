import React from 'react';
import { SectionCard } from '../ui/Card';
import ReportRow from './ReportRow';
import { reports } from '../../data/reportsData';

export default function ReportsList({ onSelect, onDownload }) {
  return (
    <SectionCard title="All Available Reports & Datasets" subtitle="Click a row to preview · click Download to save" noPad>
      <div>
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