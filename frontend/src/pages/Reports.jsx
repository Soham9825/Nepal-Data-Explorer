import { useEffect, useState } from 'react';
import ActionCard from '../components/reports/ActionCard';
import ReportsList from '../components/reports/ReportsList';
import ReportPreviewModal from '../components/reports/ReportPreviewModal';
import CitationBlock from '../components/reports/CitationBlock';
import { quickActions } from '../data/reportsData';
import { API_BASE_URL } from '../config';
import { Icon } from '../components/ui/Icon';

export default function Reports() {
  const [activeReport, setActiveReport] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE_URL}/api/datasets/files/`)
      .then((response) => {
        if (!response.ok) throw new Error(`Reports API error: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        // The endpoint can answer with no `reports` key, and `reports.map` on undefined
        // took the whole page down with it.
        if (mounted) setReports(Array.isArray(data.reports) ? data.reports : []);
      })
      .catch((requestError) => {
        console.error('Unable to load reports:', requestError);
        if (mounted) setError('The dataset catalogue could not be loaded.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleDownload = (report) => {
    window.open(`${API_BASE_URL}${report.download_url}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-onSurface">Reports &amp; Exports</h3>
          <p className="text-onSurface-variant text-sm">
            Download datasets, AI forecasts, and compiled reports for research or policy use
          </p>
        </div>

        {/* The track count follows the list rather than being fixed at three. A hard
            `grid-cols-3` around two cards left a visible empty third column, which read as
            a third card that failed to load. */}
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(quickActions.length, 3)}, minmax(0, 1fr))`,
          }}
        >
          {quickActions.map((action) => (
            <ActionCard key={action.title} {...action} />
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-3 border border-outline-variant bg-surface px-4 py-3">
            <Icon name="error" size={18} className="mt-0.5 shrink-0 text-nepal-crimson" />
            <div>
              <p className="text-sm font-bold text-onSurface">{error}</p>
              <p className="mt-0.5 text-xs text-onSurface-variant">
                Reload the page to try again. Individual dashboard exports still work.
              </p>
            </div>
          </div>
        )}

        <ReportsList
          reports={reports}
          loading={loading}
          onSelect={setActiveReport}
          onDownload={handleDownload}
        />
        <CitationBlock />
      </div>

      <ReportPreviewModal
        report={activeReport}
        onClose={() => setActiveReport(null)}
        onDownload={handleDownload}
      />
    </>
  );
}
