/**
 * The CSV page deliberately does not know anything about a particular
 * dataset.  This module contains the small, pure data layer used by the UI
 * and is also useful for consumers that want to render a CSV elsewhere.
 */
export const CHART_COLORS = [
  '#0051d5', '#16a34a', '#dc2626', '#eab308', '#9333ea',
  '#f97316', '#0891b2', '#db2777', '#111827',
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

export const normalizeHeader = (header) => String(header ?? '').trim().toLowerCase()
  .replace(/[\s-]+/g, '_').replace(/[^\w]/g, '_').replace(/_+/g, '_');

export const isBlank = (value) => value === null || value === undefined || String(value).trim() === '';

export function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (isBlank(value)) return null;
  const text = String(value).trim().replace(/,/g, '').replace(/[$€£₹%]/g, '');
  const negative = /^\(.*\)$/.test(text);
  const parsed = Number(text.replace(/[()]/g, ''));
  return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : null;
}

export function parseDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (isBlank(value)) return null;
  const text = String(value).trim();
  // Plain numbers are measurements, not dates (except a four digit year).
  if (/^\d{4}$/.test(text)) return new Date(Number(text), 0, 1);
  if (!/[/-]|[a-z]/i.test(text)) return null;
  const month = MONTH_NAMES.indexOf(text.toLowerCase());
  if (month >= 0) return new Date(2000, month, 1);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function compareValues(first, second) {
  const firstDate = parseDateValue(first);
  const secondDate = parseDateValue(second);
  if (firstDate && secondDate) return firstDate.getTime() - secondDate.getTime();
  const firstNumber = parseNumber(first);
  const secondNumber = parseNumber(second);
  if (firstNumber !== null && secondNumber !== null) return firstNumber - secondNumber;
  return String(first ?? '').localeCompare(String(second ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

export function inferColumnType(values) {
  const present = values.filter((value) => !isBlank(value));
  if (present.length === 0) return 'empty';
  const boolCount = present.filter((value) => /^(true|false|yes|no)$/i.test(String(value).trim())).length;
  if (boolCount / present.length >= 0.9) return 'boolean';
  const numberCount = present.filter((value) => parseNumber(value) !== null).length;
  if (numberCount / present.length >= 0.9) return 'numeric';
  const dateCount = present.filter((value) => parseDateValue(value) !== null).length;
  if (dateCount / present.length >= 0.8) return 'date';
  const uniqueCount = new Set(present.map(String)).size;
  return uniqueCount <= Math.max(20, Math.ceil(present.length * 0.25)) ? 'categorical' : 'text';
}

export function profileDataset(headers = [], rows = []) {
  const columns = headers.map((name) => {
    const values = rows.map((row) => row?.[name]);
    const nonEmpty = values.filter((value) => !isBlank(value));
    const type = inferColumnType(values);
    const numbers = nonEmpty.map(parseNumber).filter((value) => value !== null);
    const uniqueValues = [...new Set(nonEmpty.map(String))];
    return {
      name,
      type,
      count: values.length,
      missing: values.length - nonEmpty.length,
      unique: uniqueValues.length,
      sample: uniqueValues.slice(0, 5),
      min: numbers.length ? Math.min(...numbers) : null,
      max: numbers.length ? Math.max(...numbers) : null,
      mean: numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null,
    };
  });
  const numericColumns = columns.filter((column) => column.type === 'numeric').map((column) => column.name);
  const dateColumns = columns.filter((column) => column.type === 'date').map((column) => column.name);
  const dimensionColumns = columns
    .filter((column) => ['date', 'categorical', 'text', 'boolean'].includes(column.type))
    .map((column) => column.name);
  return {
    rowCount: rows.length,
    columnCount: headers.length,
    missingCells: columns.reduce((total, column) => total + column.missing, 0),
    columns,
    numericColumns,
    dateColumns,
    dimensionColumns,
    categoricalColumns: columns.filter((column) => column.type === 'categorical').map((column) => column.name),
    textColumns: columns.filter((column) => column.type === 'text').map((column) => column.name),
  };
}

export function getDimensionColumn(headers, names) {
  return names.map((name) => headers.find((header) => {
    const normalized = normalizeHeader(header);
    return normalized === name || normalized.endsWith(`_${name}`) || normalized.endsWith(`_${name}s`);
  })).find(Boolean) || '';
}

export function sortDimensionValues(values, direction = 'asc') {
  const sorted = [...values].sort(compareValues);
  return direction === 'desc' ? sorted.reverse() : sorted;
}

const matchesFilter = (value, filter = {}) => {
  const candidate = String(value ?? '').toLowerCase();
  const expected = String(filter.value ?? '').toLowerCase();
  const numericValue = parseNumber(value);
  const numericExpected = parseNumber(filter.value);
  switch (filter.operator || 'contains') {
    case 'equals': return candidate === expected;
    case 'not_equals': return candidate !== expected;
    case 'starts_with': return candidate.startsWith(expected);
    case 'ends_with': return candidate.endsWith(expected);
    case 'gt': return numericValue !== null && numericExpected !== null && numericValue > numericExpected;
    case 'gte': return numericValue !== null && numericExpected !== null && numericValue >= numericExpected;
    case 'lt': return numericValue !== null && numericExpected !== null && numericValue < numericExpected;
    case 'lte': return numericValue !== null && numericExpected !== null && numericValue <= numericExpected;
    default: return candidate.includes(expected);
  }
};

export function applyFilters(rows = [], filters = []) {
  return rows.filter((row) => filters.every((filter) => (
    !filter?.column || !String(filter.value ?? '').trim() || matchesFilter(row[filter.column], filter)
  )));
}

const aggregateValues = (values, aggregation) => {
  if (aggregation === 'count') return values.length;
  const numbers = values.map(parseNumber).filter((value) => value !== null);
  if (numbers.length === 0) return null;
  if (aggregation === 'min') return Math.min(...numbers);
  if (aggregation === 'max') return Math.max(...numbers);
  if (aggregation === 'avg') return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  if (aggregation === 'median') {
    const ordered = [...numbers].sort((a, b) => a - b);
    return ordered[Math.floor(ordered.length / 2)];
  }
  return numbers.reduce((sum, value) => sum + value, 0);
};

/**
 * Produce rows safe to hand to Recharts. Raw rows are never mutated and the
 * chart result is intentionally separate from the preview dataset.
 */
export function runChartQuery(rows = [], {
  xColumn = '',
  yColumn = '',
  seriesColumn = '',
  aggregation = 'sum',
  filters = [],
  sortBy = 'x',
  sortDirection = 'asc',
  limit = 25,
} = {}) {
  const filteredRows = applyFilters(rows, filters);
  const groups = new Map();
  filteredRows.forEach((row, index) => {
    const xValue = xColumn ? row[xColumn] : `Row ${index + 1}`;
    const key = String(xValue ?? '');
    if (!groups.has(key)) groups.set(key, { xValue, rows: [] });
    groups.get(key).rows.push(row);
  });
  const output = [...groups.values()].map(({ xValue, rows: groupRows }) => {
    const result = { [xColumn || 'label']: xValue };
    const series = seriesColumn
      ? [...new Set(groupRows.map((row) => String(row[seriesColumn] ?? '')).filter(Boolean))]
      : ['value'];
    series.forEach((seriesName) => {
      const selected = seriesColumn
        ? groupRows.filter((row) => String(row[seriesColumn] ?? '') === seriesName)
        : groupRows;
      result[seriesName] = aggregateValues(
        yColumn ? selected.map((row) => row[yColumn]) : selected,
        yColumn ? aggregation : 'count',
      );
    });
    const detailRow = groupRows[0] || {};
    result.__details = Object.fromEntries(Object.entries(detailRow).filter(([key]) => (
      key !== xColumn && key !== yColumn && key !== seriesColumn
    )));
    return result;
  });
  const valueKey = seriesColumn ? null : 'value';
  output.sort((first, second) => {
    const comparison = sortBy === 'value' && valueKey
      ? compareValues(first[valueKey], second[valueKey])
      : compareValues(first[xColumn || 'label'], second[xColumn || 'label']);
    return sortDirection === 'desc' ? -comparison : comparison;
  });
  return output.slice(0, Math.max(1, Number(limit) || 25));
}

export function groupByDimension(rows, xColumn, dimensionColumn, valueColumn) {
  const chartRows = runChartQuery(rows, {
    xColumn, yColumn: valueColumn, seriesColumn: dimensionColumn, aggregation: 'sum', limit: rows.length || 25,
  });
  const dimensions = [...new Set(rows.map((row) => row[dimensionColumn]).filter((value) => !isBlank(value)).map(String))];
  return { dimensions, groupedRows: chartRows };
}

export function recommendVisualization(profile) {
  if (!profile || profile.rowCount === 0) return { chartType: 'table', reason: 'Upload rows to begin exploring.' };
  if (profile.numericColumns.length === 0) {
    return { chartType: 'table', reason: 'This dataset has no numeric measure; use the searchable table to explore it.' };
  }
  if (profile.dateColumns.length > 0) return { chartType: 'line', reason: 'A date column and numeric measure make a time trend.' };
  if (profile.dimensionColumns.length > 0) return { chartType: 'bar', reason: 'A categorical dimension and numeric measure make a comparison.' };
  return { chartType: 'histogram', reason: 'A numeric-only dataset is best explored as a distribution.' };
}
