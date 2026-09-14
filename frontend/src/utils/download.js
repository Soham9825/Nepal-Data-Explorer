// Same-page download helpers (Blob + anchor). Nothing here opens a new tab or
// opens a new window — every export is a programmatic <a download="…"> click on
// the current page.

function escapeCsvValue(value) {
  const text = value == null ? '' : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCSV(rows = [], filename = 'data.csv') {
  if (!rows.length) return;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const header = columns.map(escapeCsvValue).join(',');
  const body = rows
    .map((row) => columns.map((column) => escapeCsvValue(row[column])).join(','))
    .join('\r\n');
  downloadBlob(new Blob([`\uFEFF${header}\r\n${body}`], { type: 'text/csv;charset=utf-8;' }), filename);
}

export function downloadJson(object, filename = 'data.json') {
  downloadBlob(new Blob([JSON.stringify(object, null, 2)], { type: 'application/json' }), filename);
}
