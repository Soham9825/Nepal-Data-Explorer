import { useRef, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import CSVUploadCard from '../components/csv/CSVUploadCard';
import CSVPreviewTable from '../components/csv/CSVPreviewTable';
import CSVChartEngine from '../components/csv/CSVChartEngine';
import { validateCSV } from '../components/csv/CSVUploadCard';
import { profileDataset, recommendVisualization } from '../components/csv/chartData';
import { Icon } from '../components/ui/Icon';

const EMPTY_DATASET = {
  fileName: '',
  headers: [],
  rows: [],
  loading: false,
  profile: null,
  warning: null,
  error: null,
};

export default function CSVExplorer() {
  const inputRef = useRef(null);
  const [dataset, setDataset] = useState(EMPTY_DATASET);
  const [showPreview, setShowPreview] = useState(false);

  const parseFile = async (file) => {
    if (!file) return;

    setDataset({ ...EMPTY_DATASET, fileName: file.name, loading: true });

    try {
      const result = await validateCSV(file);

      if (!result.valid) {
        setDataset({
          ...EMPTY_DATASET,
          fileName: file.name,
          error: result.message,
        });
        return;
      }

      const headers = (result.meta.fields || [])
        .map((header) => String(header).trim())
        .filter(Boolean);
      const rows = result.data.filter((row) => (
        row && Object.values(row).some((value) => String(value ?? '').trim() !== '')
      ));

      if (!headers.length || !rows.length) {
        setDataset({
          ...EMPTY_DATASET,
          fileName: file.name,
          error: 'The CSV contains column headers but no readable data rows.',
        });
        return;
      }

      const profile = profileDataset(headers, rows);
      setDataset({
        fileName: file.name,
        headers,
        rows,
        loading: false,
        profile,
        warning: result.warning,
        error: null,
      });
      setShowPreview(false);
    } catch {
      setDataset({
        ...EMPTY_DATASET,
        fileName: file.name,
        error: 'Unable to read this file. Please choose a valid CSV file.',
      });
    }
  };

  const handleFileChange = (event) => {
    parseFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const reset = () => {
    setDataset(EMPTY_DATASET);
    setShowPreview(false);
  };

  const { loading, profile } = dataset;
  const hasData = Boolean(profile && dataset.rows.length);

  return (
    <DashboardLayout pageTitle="CSV Explorer">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-onSurface font-hanken">CSV Explorer</h1>
          <p className="mt-1 max-w-3xl text-sm text-onSurface-variant font-hanken">
            Upload a CSV file and a helpful chart is built for you automatically — no setup needed.
          </p>
        </div>

        <CSVUploadCard
          inputRef={inputRef}
          fileName={dataset.fileName}
          error={dataset.error}
          warning={dataset.warning}
          loading={loading}
          onChange={handleFileChange}
          onClear={reset}
        />

        {hasData && (
          <>
            <CSVChartEngine
              fileName={dataset.fileName}
              headers={dataset.headers}
              rows={dataset.rows}
              profile={profile}
              recommendation={recommendVisualization(profile)}
            />
            <button
              type="button"
              onClick={() => setShowPreview((value) => !value)}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface px-4 py-3 text-sm font-semibold text-onSurface transition-colors hover:bg-surface-high"
            >
              <Icon name={showPreview ? 'expand_less' : 'expand_more'} size={18} />
              {showPreview ? 'Hide raw data preview' : 'Show raw data preview'}
            </button>
            {showPreview && (
              <CSVPreviewTable
                fileName={dataset.fileName}
                headers={dataset.headers}
                rows={dataset.rows}
                totalRowCount={dataset.rows.length}
                onReplace={reset}
              />
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}