import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import DashboardLayout from '../components/layout/DashboardLayout';
import CSVUploadCard from '../components/csv/CSVUploadCard';
import CSVPreviewTable from '../components/csv/CSVPreviewTable';
import CSVBarChart from '../components/csv/CSVBarChart';
import CSVLineChart from '../components/csv/CSVLineChart';
import CSVHistogram from '../components/csv/CSVHistogram';
import { SectionCard } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { getDimensionColumn } from '../components/csv/chartData';

export default function CSVExplorer() {
  const inputRef = useRef(null);
  const [dataset, setDataset] = useState({
    fileName: '',
    headers: [],
    rows: [],
    chartData: [],
    xColumn: '',
    xOptions: [],
    yColumn: '',
    dimensionColumn: '',
    chartType: 'bar',
  });
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
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: ({ data, meta, errors }) => {
        if (errors.length > 0) {
          setError('This CSV could not be read. Please check its formatting and try again.');
          return;
        }

        const headers = meta.fields || [];
        if (headers.length === 0 || data.length === 0) {
          setError('The selected CSV does not contain any data to preview.');
          return;
        }

        const xOptions = ['year', 'province', 'country', 'county']
          .map((candidate) => getDimensionColumn(headers, [candidate]))
          .filter(Boolean);
        const xColumn = xOptions[0] || headers[0] || '';
        const dimensionColumn = getDimensionColumn(headers, ['province']);
        const numericColumn = headers.find((header) => !xOptions.includes(header) && data.some(
          (row) => typeof row[header] === 'number' && !Number.isNaN(row[header]),
        ));

        setDataset({
          fileName: file.name,
          headers,
          rows: data,
          chartData: data,
          xColumn,
          xOptions,
          yColumn: numericColumn || '',
          dimensionColumn: dimensionColumn !== xColumn && xColumn === getDimensionColumn(headers, ['year'])
            ? dimensionColumn
            : '',
          chartType: 'bar',
        });
      },
      error: () => setError('Unable to read this file. Please choose a valid CSV file.'),
    });
  };

  const handleFileChange = (event) => {
    parseFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const clearPreview = () => {
    setDataset({
      fileName: '',
      headers: [],
      rows: [],
      chartData: [],
      xColumn: '',
      xOptions: [],
      yColumn: '',
      dimensionColumn: '',
      chartType: 'bar',
    });
    setError('');
  };

  const updateDataset = (key) => (value) => {
    setDataset((current) => ({ ...current, [key]: value }));
  };

  const handleXColumnChange = (value) => {
    setDataset((current) => ({
      ...current,
      xColumn: value,
      dimensionColumn: getDimensionColumn(current.headers, ['year']) === value
        ? getDimensionColumn(current.headers, ['province'])
        : '',
      yColumn: current.yColumn === value
        ?         current.headers.find((header) => !current.xOptions.includes(header) && current.chartData.some(
          (row) => typeof row[header] === 'number' && !Number.isNaN(row[header]),
        )) || ''
        : current.yColumn,
    }));
  };

  return (
    <DashboardLayout pageTitle="CSV Explorer">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-onSurface font-hanken">CSV Explorer</h1>
          <p className="mt-1 max-w-2xl text-sm text-onSurface-variant font-hanken">
            Upload a CSV file to inspect its structure and visualize your data by year, province, or county.
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
        {dataset.fileName && (
          <SectionCard title="Visualization" subtitle="Choose how you want to visualize your data.">
            <div className="flex flex-wrap gap-3">
              {[
                { value: 'bar', label: 'Bar chart', icon: 'bar_chart' },
                { value: 'line', label: 'Line chart', icon: 'show_chart' },
                { value: 'histogram', label: 'Histogram', icon: 'bar_chart' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={dataset.chartType === option.value}
                  onClick={() => updateDataset('chartType')(option.value)}
                  className={`flex items-center gap-2 rounded-sm border px-4 py-2.5 text-sm font-bold transition-colors ${
                    dataset.chartType === option.value
                      ? 'border-primary bg-primary text-white'
                      : 'border-outline-variant bg-surface text-onSurface hover:bg-surface-high'
                  }`}
                >
                  <Icon name={option.icon} size={18} />
                  {option.label}
                </button>
              ))}
            </div>
          </SectionCard>
        )}
        {dataset.chartType === 'bar' ? (
          <CSVBarChart
            fileName={dataset.fileName}
            headers={dataset.headers}
            chartData={dataset.chartData}
            xColumn={dataset.xColumn}
            xOptions={dataset.xOptions}
            onXColumnChange={handleXColumnChange}
            dimensionColumn={dataset.dimensionColumn}
            yColumn={dataset.yColumn}
            onYColumnChange={updateDataset('yColumn')}
          />
        ) : dataset.chartType === 'line' ? (
          <CSVLineChart
            fileName={dataset.fileName}
            headers={dataset.headers}
            chartData={dataset.chartData}
            xColumn={dataset.xColumn}
            xOptions={dataset.xOptions}
            onXColumnChange={handleXColumnChange}
            dimensionColumn={dataset.dimensionColumn}
            yColumn={dataset.yColumn}
            onYColumnChange={updateDataset('yColumn')}
          />
        ) : (
          <CSVHistogram
            fileName={dataset.fileName}
            headers={dataset.headers}
            chartData={dataset.chartData}
            xColumn={dataset.xColumn}
            xOptions={dataset.xOptions}
            dimensionColumn={dataset.dimensionColumn}
            yColumn={dataset.yColumn}
            onYColumnChange={updateDataset('yColumn')}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
