import { useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { SectionCard } from '../ui/Card';
import { Icon } from '../ui/Icon';
import CSVTooltip from './CSVTooltip';
import { CHART_COLORS, runChartQuery } from './chartData';

const inputClass = 'rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-onSurface outline-none focus:border-primary';
const chartLabels = {
  bar: ['bar_chart', 'Bar'],
  line: ['show_chart', 'Line'],
  area: ['area_chart', 'Area'],
  pie: ['pie_chart', 'Pie'],
  histogram: ['bar_chart', 'Histogram'],
  table: ['table_view', 'Table'],
};
const AGGREGATIONS = [
  ['sum', 'Sum'],
  ['avg', 'Average'],
  ['count', 'Count'],
  ['min', 'Min'],
  ['max', 'Max'],
];

function Histogram({ data, valueKey }) {
  const values = data.map((row) => Number(row[valueKey])).filter(Number.isFinite);
  if (!values.length) return <EmptyChart message="No numeric values are available for this view." />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return <SimpleChart data={[{ range: String(min), count: values.length }]} />;
  const bins = Math.min(12, Math.max(5, Math.ceil(Math.sqrt(values.length))));
  const size = (max - min) / bins;
  const histogram = Array.from({ length: bins }, (_, index) => ({
    range: `${(min + index * size).toPrecision(4)}–${(min + (index + 1) * size).toPrecision(4)}`,
    count: 0,
  }));
  values.forEach((value) => {
    histogram[Math.min(bins - 1, Math.floor((value - min) / size))].count += 1;
  });
  return <SimpleChart data={histogram} />;
}

function SimpleChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="range" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="count" name="Rows" fill="#0051d5" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="flex h-full min-h-52 flex-col items-center justify-center text-center text-onSurface-variant">
      <Icon name="bar_chart" size={32} />
      <p className="mt-2 text-sm">{message}</p>
    </div>
  );
}

export default function CSVChartEngine({ fileName, rows, profile, recommendation }) {
  const dimensions = profile.dimensionColumns;
  const numericColumns = profile.numericColumns;
  const [chartType, setChartType] = useState(recommendation.chartType);
  const [xColumn, setXColumn] = useState(dimensions[0] || '');
  const [yColumn, setYColumn] = useState(numericColumns[0] || '');
  const [seriesColumn, setSeriesColumn] = useState('');
  const [aggregation, setAggregation] = useState('sum');

  const chartData = useMemo(() => runChartQuery(rows, {
    xColumn, yColumn, seriesColumn, aggregation,
  }), [rows, xColumn, yColumn, seriesColumn, aggregation]);

  if (!fileName) return null;
  const seriesKeys = seriesColumn
    ? [...new Set(rows.map((row) => String(row[seriesColumn] ?? '')).filter(Boolean))].slice(0, 10)
    : ['value'];
  const dataKey = xColumn || 'label';

  const renderChart = () => {
    if (chartType === 'table') {
      return (
        <div className="max-h-96 overflow-auto border border-outline-variant">
          <table className="w-full min-w-max border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-surface-high"><tr>
              <th className="border-b border-outline-variant px-3 py-2">Group</th>
              <th className="border-b border-outline-variant px-3 py-2">Value</th>
            </tr></thead>
            <tbody>{chartData.map((row, index) => (
              <tr key={`${row[dataKey]}-${index}`} className="even:bg-surface-lowest">
                <td className="border-b border-outline-variant px-3 py-2">{String(row[dataKey] ?? '—')}</td>
                <td className="border-b border-outline-variant px-3 py-2">{row.value ?? '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      );
    }
    if (chartType === 'histogram') return <Histogram data={rows} valueKey={yColumn} />;
    if (!chartData.length) return <EmptyChart message="No rows are available for this view." />;
    if (chartType === 'pie') {
      const pieKey = seriesColumn ? seriesKeys[0] : 'value';
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey={pieKey} nameKey={dataKey} outerRadius="75%" label>
              {chartData.map((entry, index) => <Cell key={`${entry[dataKey]}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<CSVTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    const common = {
      data: chartData,
      margin: { top: 10, right: 20, left: 10, bottom: 10 },
    };
    const lines = seriesColumn ? seriesKeys : ['value'];
    const series = (kind) => lines.map((key, index) => {
      const color = CHART_COLORS[index % CHART_COLORS.length];
      if (kind === 'bar') return <Bar key={key} dataKey={key} name={key} fill={color} />;
      if (kind === 'area') return <Area key={key} type="monotone" dataKey={key} name={key} stroke={color} fill={color} fillOpacity={0.2} />;
      return <Line key={key} type="monotone" dataKey={key} name={key} stroke={color} strokeWidth={2} dot={{ r: 3 }} />;
    });
    const Chart = chartType === 'bar' ? BarChart : chartType === 'area' ? AreaChart : LineChart;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <Chart {...common}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={dataKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip content={<CSVTooltip />} />
          {seriesColumn && <Legend />}
          {series(chartType)}
        </Chart>
      </ResponsiveContainer>
    );
  };

  return (
    <SectionCard
      title="Your chart"
      subtitle={recommendation.reason}
      className="overflow-visible"
    >
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-bold uppercase tracking-wide text-onSurface-variant">Chart
          <select value={chartType} onChange={(event) => setChartType(event.target.value)} className={`${inputClass} mt-2 block w-full normal-case font-normal`}>
            {Object.entries(chartLabels).map(([value, [, label]]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-onSurface-variant">Group by
          <select value={xColumn} onChange={(event) => setXColumn(event.target.value)} className={`${inputClass} mt-2 block w-full normal-case font-normal`}>
            <option value="">Each row</option>{dimensions.map((column) => <option key={column} value={column}>{column}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-onSurface-variant">Value
          <select value={yColumn} onChange={(event) => setYColumn(event.target.value)} className={`${inputClass} mt-2 block w-full normal-case font-normal`}>
            <option value="">Count rows</option>{numericColumns.map((column) => <option key={column} value={column}>{column}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-onSurface-variant">Aggregation
          <select value={aggregation} onChange={(event) => setAggregation(event.target.value)} className={`${inputClass} mt-2 block w-full normal-case font-normal`}>
            {AGGREGATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-onSurface-variant">Color by (optional)
          <select value={seriesColumn} onChange={(event) => setSeriesColumn(event.target.value)} className={`${inputClass} mt-2 block w-full normal-case font-normal`}>
            <option value="">None</option>{dimensions.map((column) => <option key={column} value={column}>{column}</option>)}
          </select>
        </label>
      </div>
      <div className="h-[25rem] w-full">{renderChart()}</div>
      <p className="mt-3 text-xs text-onSurface-variant">{chartData.length} chart group{chartData.length === 1 ? '' : 's'} · Hover a point or bar for its values.</p>
    </SectionCard>
  );
}