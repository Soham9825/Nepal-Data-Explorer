import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { SectionCard } from '../ui/Card';
import { Icon } from '../ui/Icon';

const BIN_COUNT = 10;

export default function CSVHistogram({
  fileName,
  headers,
  chartData,
  xColumn,
  xOptions = [],
  yColumn,
  onYColumnChange,
}) {
  const numericHeaders = headers.filter((header) => !xOptions.includes(header) && chartData.some(
    (row) => typeof row[header] === 'number' && !Number.isNaN(row[header]),
  ));

  const histogramData = useMemo(() => {
    const values = chartData
      .map((row) => Number(row[yColumn]))
      .filter((value) => Number.isFinite(value));

    if (values.length === 0) return [];

    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const range = maximum - minimum;

    if (range === 0) {
      return [{ range: String(minimum), count: values.length }];
    }

    const binSize = range / BIN_COUNT;
    const bins = Array.from({ length: BIN_COUNT }, (_, index) => {
      const start = minimum + index * binSize;
      const end = index === BIN_COUNT - 1 ? maximum : start + binSize;
      return {
        range: `${start.toFixed(1)}–${end.toFixed(1)}`,
        start,
        end,
        count: 0,
      };
    });

    values.forEach((value) => {
      const index = Math.min(Math.floor((value - minimum) / binSize), BIN_COUNT - 1);
      bins[index].count += 1;
    });

    return bins;
  }, [chartData, yColumn]);

  if (!fileName) return null;

  if (!yColumn || numericHeaders.length === 0) {
    return (
      <SectionCard title="Histogram" subtitle="Unable to create a histogram.">
        <div className="flex min-h-32 flex-col items-center justify-center text-center text-onSurface-variant">
          <Icon name="bar_chart" size={32} />
          <p className="mt-2 text-sm">No numeric column was found in this CSV.</p>
          <p className="mt-1 text-xs">A numeric column is required for a histogram.</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Histogram" subtitle={`Distribution of ${yColumn}`}>
      <div className="mb-6">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-onSurface-variant">
          Values
        </label>
        <select
          value={yColumn}
          onChange={(event) => onYColumnChange(event.target.value)}
          className="min-w-48 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-onSurface outline-none focus:border-primary"
        >
          {numericHeaders.map((header) => <option key={header} value={header}>{header}</option>)}
        </select>
      </div>
      <div className="h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={histogramData} margin={{ top: 10, right: 20, left: 10, bottom: 35 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" angle={-30} textAnchor="end" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" name="Rows" fill="#0051d5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
