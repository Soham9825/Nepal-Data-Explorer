/**
 * The CSV page deliberately does not know anything about a particular
 * dataset.  This module contains the small, pure data layer used by the UI
 * and is also useful for consumers that want to render a CSV elsewhere.
 */
export const CHART_COLORS = [
  '#0051d5', '#16a34a', '#dc2626', '#eab308', '#9333ea',
  '#f97316', '#0891b2', '#db2777', '#111827', '#059669',
  '#7c3aed', '#ea580c', '#0284c7', '#c026d3', '#65a30d',
  '#e11d48', '#2563eb', '#16a34a', '#ca8a04', '#9333ea',
];

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export const normalizeHeader = (header) => String(header ?? '').trim().toLowerCase()
  .replace(/[\s-]+/g, '_').replace(/[^\w]/g, '_').replace(/_+/g, '_');

export const isBlank = (value) => value === null || value === undefined || String(value).trim() === '';

const CURRENCY_SYMBOLS = /[$€£₹¥₺₽₴₸₨₩₪₫₦₡₣₤₧₯₰₱₲¥\u20b9]/g;
const CURRENCY_CODES = /\b(?:usd|eur|gbp|inr|npr|cny|jpy|krw|aud|cad|chf|aed|qar|sar|thb|myr|sgd|nzd|brl|rub|zar)\b/gi;

export function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (isBlank(value)) return null;
  let text = String(value).trim();
  // Strip currency symbols
  text = text.replace(CURRENCY_SYMBOLS, '');
  // Strip currency codes at end (e.g. "100 USD", "$1.2m")
  text = text.replace(CURRENCY_CODES, '');
  // Strip percentage signs
  text = text.replace(/[%‰]/g, '');
  // Commas are thousands separators (Indian numbering too: 1,23,456)
  text = text.replace(/,/g, '');
  // Parentheses mean negative: (123) → -123
  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/[()]/g, '').trim();
  // Handle magnitude suffixes (e.g. "1.5M", "2Cr", "500K")
  const magnitude = text.match(/^([\d.]+)\s*([kmbt])$/i);
  if (magnitude) {
    const num = Number(magnitude[1]);
    if (!Number.isFinite(num)) return null;
    const suffix = magnitude[2].toLowerCase();
    const multipliers = {
      k: 1e3, m: 1e6, b: 1e9, t: 1e12,
    };
    const result = num * multipliers[suffix];
    return negative ? -result : result;
  }
  // Handle lakh/crore words (e.g. "1.5 lakh", "2 crore")
  const indianSuffix = text.match(/^([\d.]+)\s*(lakh|lac|crore|cr)$/i);
  if (indianSuffix) {
    const num = Number(indianSuffix[1]);
    if (!Number.isFinite(num)) return null;
    const multiplier = /crore|cr/i.test(indianSuffix[2]) ? 1e7 : 1e5;
    const result = num * multiplier;
    return negative ? -result : result;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : null;
}

export function parseDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (isBlank(value)) return null;
  const text = String(value).trim();

  // FY patterns: "FY2024", "FY 2024/25", "2024/25", "2024-25"
  const fyMatch = text.match(/^(?:fy\s?)?(\d{2,4})\s*[/\-]\s*(\d{2,4})$/i);
  if (fyMatch) {
    const startYear = fyMatch[1].length === 2 ? 2000 + Number(fyMatch[1]) : Number(fyMatch[1]);
    return new Date(startYear, 3, 1); // April 1 of start year (Indian FY)
  }
  const fySingle = text.match(/^fy\s?(\d{2,4})$/i);
  if (fySingle) {
    const year = fySingle[1].length === 2 ? 2000 + Number(fySingle[1]) : Number(fySingle[1]);
    return new Date(year, 3, 1);
  }

  // Quarter patterns: "Q1", "Q1 2024", "Q1-2024", "Q1FY2024"
  const qMatch = text.match(/^q([1-4])\s*(?:fy\s?)?(\d{2,4})?$/i);
  if (qMatch) {
    const quarter = Number(qMatch[1]) - 1;
    const year = qMatch[2]
      ? (qMatch[2].length === 2 ? 2000 + Number(qMatch[2]) : Number(qMatch[2]))
      : 2000;
    return new Date(year, quarter * 3, 1);
  }

  // Plain 4-digit year
  if (/^\d{4}$/.test(text)) {
    const n = Number(text);
    return n >= 1900 && n <= 2100 ? new Date(n, 0, 1) : null;
  }

  // Bare month name: "January", "Jan"
  const lower = text.toLowerCase();
  let monthIdx = MONTH_NAMES.indexOf(lower);
  if (monthIdx < 0) monthIdx = MONTH_ABBR.indexOf(lower);
  if (monthIdx >= 0) return new Date(2000, monthIdx, 1);

  // Month + Year: "Jan 2024", "January 2024", "Jan-2024"
  const monthYearMatch = text.match(/^([a-z]{3,9})\s*[\-/]?\s*(\d{4})$/i);
  if (monthYearMatch) {
    const mi = MONTH_NAMES.indexOf(monthYearMatch[1].toLowerCase());
    const mi2 = MONTH_ABBR.indexOf(monthYearMatch[1].toLowerCase().slice(0, 3));
    const idx = mi >= 0 ? mi : mi2;
    if (idx >= 0) return new Date(Number(monthYearMatch[2]), idx, 1);
  }

  // ISO-like: "2024-01-15", "2024/01/15"
  if (/^\d{4}[/\-]\d{1,2}[/\-]\d{1,2}$/.test(text)) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // US-style: "01/15/2024", "1/15/2024" (only if clearly month/day/year)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // General Date.parse fallback for free-form text dates ("15 Jan 2024",
  // "January 15, 2024"). Only trust it when a plausible 4-digit year is
  // present; JS lenient parsing misinterprets strings like "Province 1".
  const yearParts = text.match(/(190\d|19[1-9]\d|20\d\d)/);
  if (/[a-z]/i.test(text) && yearParts) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

const YEAR_RE = /^\d{4}$/;
const isPlausibleYear = (value) => {
  if (!YEAR_RE.test(String(value).trim())) return false;
  const n = Number(value);
  return n >= 1900 && n <= 2100;
};

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
  if (present.length === 0) return { type: 'empty', confidence: 1 };
  const total = present.length;
  const boolCount = present.filter((value) => /^(true|false|yes|no)$/i.test(String(value).trim())).length;
  if (boolCount / total >= 0.9) return { type: 'boolean', confidence: boolCount / total };
  const numericValues = present.map(parseNumber);
  const numberCount = numericValues.filter((value) => value !== null).length;
  const numericShare = numberCount / total;
  const uniqueCount = new Set(present.map(String)).size;
  // Almost all values numeric and unique ≈ row count → identifier (IDs, codes)
  if (numericShare >= 0.95 && uniqueCount / present.length >= 0.9 && present.length >= 20) {
    return { type: 'identifier', confidence: Math.min(0.99, numericShare) };
  }
  // A column of 4-digit values in the plausible year range is a time
  // dimension, not a numeric measure (e.g. "Year": 2015, 2016, …).
  const yearShare = present.filter(isPlausibleYear).length / total;
  if (numericShare >= 0.9 && yearShare >= 0.9 && uniqueCount > 1) return { type: 'date', confidence: yearShare };
  if (numericShare >= 0.9) return { type: 'numeric', confidence: numericShare };
  const dateCount = present.filter((value) => parseDateValue(value) !== null).length;
  const dateShare = dateCount / total;
  if (dateShare >= 0.6) return { type: 'date', confidence: dateShare };
  if (boolCount / total >= 0.6 && boolCount < 0.9) {
    return { type: 'boolean', confidence: boolCount / total };
  }
  if (numericShare >= 0.6 && numericShare < 0.9) {
    return { type: 'numeric', confidence: numericShare };
  }
  return uniqueCount <= Math.max(30, Math.ceil(present.length * 0.3))
    ? { type: 'categorical', confidence: Math.max(0.5, 1 - uniqueCount / present.length) }
    : { type: 'text', confidence: 1 - (dateShare > 0.5 ? dateShare : 0) };
}

export function profileDataset(headers = [], rows = [], typeOverrides = {}) {
  const columns = headers.map((name) => {
    const values = rows.map((row) => row?.[name]);
    const nonEmpty = values.filter((value) => !isBlank(value));
    const override = typeOverrides?.[name];
    const { type, confidence } = override
      ? { type: override, confidence: 1 }
      : inferColumnType(values);
    const numbers = nonEmpty.map(parseNumber).filter((value) => value !== null);
    const uniqueValues = [...new Set(nonEmpty.map(String))];
    const sortedNumbers = numbers.sort((a, b) => a - b);
    return {
      name,
      type,
      confidence: Number(confidence.toFixed(2)),
      count: values.length,
      missing: values.length - nonEmpty.length,
      unique: uniqueValues.length,
      sample: uniqueValues.slice(0, 5),
      min: sortedNumbers.length ? sortedNumbers[0] : null,
      max: sortedNumbers.length ? sortedNumbers[sortedNumbers.length - 1] : null,
      mean: sortedNumbers.length ? sortedNumbers.reduce((sum, value) => sum + value, 0) / sortedNumbers.length : null,
      median: sortedNumbers.length ? sortedNumbers[Math.floor(sortedNumbers.length / 2)] : null,
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

const minMax = (numbers, kind) => {
  if (numbers.length === 0) return null;
  let value = numbers[0];
  for (let i = 1; i < numbers.length; i += 1) {
    if (kind === 'max' ? numbers[i] > value : numbers[i] < value) value = numbers[i];
  }
  return value;
};

const aggregateValues = (values, aggregation) => {
  if (aggregation === 'count') return values.length;
  const numbers = values.map(parseNumber).filter((value) => value !== null);
  if (numbers.length === 0) return null;
  if (aggregation === 'min') return minMax(numbers, 'min');
  if (aggregation === 'max') return minMax(numbers, 'max');
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
