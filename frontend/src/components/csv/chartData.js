export const CHART_COLORS = [
  '#16a34a',
  '#dc2626',
  '#2563eb',
  '#eab308',
  '#111827',
  '#f97316',
  '#9333ea',
];

export function getDimensionColumn(headers, names) {
  return names
    .map((name) => headers.find((header) => {
      const normalizedHeader = header.trim().toLowerCase().replace(/[\s-]+/g, '_');
      return normalizedHeader === name
        || normalizedHeader.endsWith(`_${name}`)
        || normalizedHeader.endsWith(`_${name}s`);
    }))
    .find(Boolean) || '';
}

export function groupByDimension(rows, xColumn, dimensionColumn, valueColumn) {
  const dimensions = [...new Set(rows.map((row) => row[dimensionColumn]).filter(Boolean))];
  const groupedRows = [...new Set(rows.map((row) => row[xColumn]))].map((xValue) => {
    const groupedRow = { [xColumn]: xValue };
    dimensions.forEach((dimension) => {
      const record = rows.find((row) => row[xColumn] === xValue && row[dimensionColumn] === dimension);
      groupedRow[dimension] = record?.[valueColumn];
    });
    return groupedRow;
  });

  return { dimensions, groupedRows };
}
