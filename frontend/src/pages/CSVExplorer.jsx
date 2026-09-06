import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import DashboardLayout from '../components/layout/DashboardLayout';
import CSVUploadCard from '../components/csv/CSVUploadCard';
import CSVPreviewTable from '../components/csv/CSVPreviewTable';
import CSVChartEngine from '../components/csv/CSVChartEngine';
import { SectionCard } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import {
  profileDataset, recommendVisualization,
} from '../components/csv/chartData';

const EMPTY_DATASET = {
  fileName: '', headers: [], rows: [], profile: null, recommendation: null,
};

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString() : '—';
}

export default function CSVExplorer() {
  const inputRef = useRef(null);
  const [dataset, setDataset] = useState(EMPTY_DATASET);
  const [error, setError] = useState('');

  const parseFile = (file) => {
    if (!file) return;
    setError('');
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a valid CSV file.');
      return;
    }
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      complete: ({ data, meta, errors }) => {
        if (errors.length > 0 && !data.length) {
          setError('This CSV could not be read. Please check its formatting and try again.');
          return;
        }
        const headers = (meta.fields || []).map((header) => String(header).trim()).filter(Boolean);
        const rows = data.filter((row) => row && Object.values(row).some((value) => String(value ?? '').trim() !== ''));
        if (!headers.length || !rows.length) {
          setError('The selected CSV does not contain any data to preview.');
          return;
        }
        const profile = profileDataset(headers, rows);
        setDataset({
          fileName: file.name,
          headers,
          rows,
          profile,
          recommendation: recommendVisualization(profile),
        });
        if (errors.length) setError('Some malformed rows were skipped while reading this CSV.');
      },
      error: () => setError('Unable to read this file. Please choose a valid CSV file.'),
    });
  };

  const handleFileChange = (event) => {
    parseFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const clearPreview = () => {
    setDataset(EMPTY_DATASET);
    setError('');
  };

  const { profile } = dataset;
  return (
    <DashboardLayout pageTitle="CSV Explorer">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-onSurface font-hanken">CSV Explorer</h1>
          <p className="mt-1 max-w-3xl text-sm text-onSurface-variant font-hanken">
            Upload any CSV to profile its columns, inspect metadata, and build a chart with generic filter, grouping, aggregation, sorting, and limit controls.
          </p>
        </div>
        <CSVUploadCard
          inputRef={inputRef}
          fileName={dataset.fileName}
          error={error}
          onClear={clearPreview}
          onChange={handleFileChange}
        />
        <CSVPreviewTable
          fileName={dataset.fileName}
          headers={dataset.headers}
          rows={dataset.rows}
          onReplace={() => inputRef.current?.click()}
        />
        {profile && (
          <>
            <SectionCard title="Dataset profile" subtitle="Automatically inferred from the uploaded values.">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ['Rows', formatNumber(profile.rowCount)],
                  ['Columns', formatNumber(profile.columnCount)],
                  ['Missing cells', formatNumber(profile.missingCells)],
                  ['Numeric fields', formatNumber(profile.numericColumns.length)],
                ].map(([label, value]) => (
                  <div key={label} className="border border-outline-variant bg-surface-lowest p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-onSurface-variant">{label}</p>
                    <p className="mt-1 text-xl font-bold text-onSurface">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 overflow-auto border border-outline-variant">
                <table className="w-full min-w-[42rem] border-collapse text-left text-xs">
                  <thead className="bg-surface-high"><tr><th className="px-3 py-2">Column</th><th className="px-3 py-2">Detected type</th><th className="px-3 py-2">Unique</th><th className="px-3 py-2">Missing</th><th className="px-3 py-2">Range / sample</th></tr></thead>
                  <tbody>{profile.columns.map((column) => (
                    <tr key={column.name} className="even:bg-surface-lowest">
                      <td className="border-t border-outline-variant px-3 py-2 font-semibold">{column.name}</td>
                      <td className="border-t border-outline-variant px-3 py-2 capitalize">{column.type}</td>
                      <td className="border-t border-outline-variant px-3 py-2">{column.unique}</td>
                      <td className="border-t border-outline-variant px-3 py-2">{column.missing}</td>
                      <td className="border-t border-outline-variant px-3 py-2">{column.type === 'numeric' ? `${column.min} – ${column.max} (mean ${column.mean?.toFixed(2)})` : column.sample.join(', ') || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </SectionCard>
            <SectionCard title="Suggested starting point" subtitle={dataset.recommendation.reason}>
              <div className="flex items-center gap-3 text-sm text-onSurface">
                <Icon name={dataset.recommendation.chartType === 'table' ? 'table_view' : 'auto_graph'} size={24} color="#0051d5" />
                <span>Recommended view: <strong className="capitalize">{dataset.recommendation.chartType}</strong>. All controls remain available below.</span>
              </div>
            </SectionCard>
            <CSVChartEngine
              key={dataset.fileName}
              fileName={dataset.fileName}
              headers={dataset.headers}
              rows={dataset.rows}
              profile={profile}
              recommendation={dataset.recommendation}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
