import React from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { SectionCard } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { CHART_COLORS, groupByDimension } from './chartData';

export default function CSVLineChart({
  fileName,
  headers,
  chartData,
  xColumn,
  xOptions,
  yColumn,
  dimensionColumn,
  onXColumnChange,
  onYColumnChange,
}) {
  if (!fileName) return null;
  const numericHeaders = headers.filter((header) => !xOptions.includes(header) && chartData.some(
    (row) => typeof row[header] === 'number' && !Number.isNaN(row[header]),
  ));
  const grouped = dimensionColumn ? groupByDimension(chartData, xColumn, dimensionColumn, yColumn) : null;

  if (!yColumn) {
    return (
      <SectionCard title="Line Chart" subtitle="Unable to create a line chart.">
        <div className="flex min-h-32 flex-col items-center justify-center text-center text-onSurface-variant">
          <Icon name="show_chart" size={32} />
          <p className="mt-2 text-sm">No numeric column was found in this CSV.</p>
          <p className="mt-1 text-xs">A numeric column is required for the Y-axis.</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Line Chart" subtitle={`${yColumn} by ${xColumn}`}>
      <div className="mb-6 flex flex-wrap gap-5">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-onSurface-variant">X-Axis</label>
          <select value={xColumn} onChange={(event) => onXColumnChange(event.target.value)} className="min-w-48 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-onSurface outline-none focus:border-primary">
            {xOptions.map((header) => <option key={header} value={header}>{header}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-onSurface-variant">Y-Axis</label>
          <select
            value={yColumn}
            onChange={(event) => onYColumnChange(event.target.value)}
            className="min-w-48 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-onSurface outline-none focus:border-primary"
          >
            {numericHeaders.map((header) => <option key={header} value={header}>{header}</option>)}
          </select>
        </div>
      </div>
      <div className="h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={grouped?.groupedRows || chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xColumn} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            {grouped && <Legend />}
            {grouped ? grouped.dimensions.map((dimension, index) => (
              <Line key={dimension} type="monotone" dataKey={dimension} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
            )) : <Line type="monotone" dataKey={yColumn} stroke="#0051d5" strokeWidth={2} dot={{ r: 3 }} />}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
