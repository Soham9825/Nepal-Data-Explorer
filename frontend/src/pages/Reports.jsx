import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import ActionCard from '../components/reports/ActionCard';
import ReportsList from '../components/reports/ReportsList';
import ReportPreviewModal from '../components/reports/ReportPreviewModal';
import CitationBlock from '../components/reports/CitationBlock';
import { quickActions } from '../data/reportsData';
import { API_BASE_URL } from '../config';

export default function Reports() {
  const [activeReport, setActiveReport] = useState(null);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/datasets/files/`)
      .then((response) => {
        if (!response.ok) throw new Error(`Reports API error: ${response.status}`);
        return response.json();
      })
      .then((data) => setReports(data.reports))
      .catch((error) => console.error('Unable to load reports:', error));
  }, []);

  const handleDownload = (report) => {
    window.open(`${API_BASE_URL}${report.download_url}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <DashboardLayout pageTitle="Reports & Exports">
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-onSurface">Reports & Exports</h3>
          <p className="text-onSurface-variant text-sm">Download datasets, AI forecasts, and compiled reports for research or policy use</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <ActionCard
              key={action.title}
              {...action}
            />
          ))}
        </div>

        <ReportsList reports={reports} onSelect={setActiveReport} onDownload={handleDownload} />
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