import React, { useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import ActionCard from '../components/reports/ActionCard';
import ReportsList from '../components/reports/ReportsList';
import ReportPreviewModal from '../components/reports/ReportPreviewModal';
import CitationBlock from '../components/reports/CitationBlock';
import { quickActions } from '../data/reportsData';

export default function Reports() {
  const [activeReport, setActiveReport] = useState(null);

  const handleDownload = (report) => {
    // wire up real download logic here
    console.log('downloading', report.title);
  };

  return (
    <DashboardLayout pageTitle="Reports & Exports">
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-onSurface">Reports & Exports</h3>
          <p className="text-onSurface-variant text-sm">Download datasets, AI forecasts, and compiled reports for research or policy use</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {quickActions.map((a) => (
            <ActionCard key={a.title} {...a} />
          ))}
        </div>

        <ReportsList onSelect={setActiveReport} onDownload={handleDownload} />
        <CitationBlock />
      </div>

      <ReportPreviewModal
        report={activeReport}
        onClose={() => setActiveReport(null)}
        onDownload={handleDownload}
      />
    </DashboardLayout>
  );
}