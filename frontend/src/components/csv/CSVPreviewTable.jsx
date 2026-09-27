import { useEffect, useMemo, useState } from 'react';
import { SectionCard } from '../ui/Card';
import { BtnPrimary } from '../ui/Button';
import { Icon } from '../ui/Icon';

const PREVIEW_PAGE_SIZE = 10;

function sanitizeCellForCSV(val) {
  if (val === null || val === undefined) return '';
  let str = String(val);
  // Protect against CSV formula injection: prepend single quote if starts with formula trigger
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function CSVPreviewTable({
  fileName,
  headers = [],
  rows = [],
  totalRowCount,
  isSampled,
  onReplace,
  quality,
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    setPage(1);
    setSearch('');
    setStatusFilter('ALL');
    setSortCol(null);
  }, [fileName]);

  const rowReports = quality?.rows || [];

  // Pair each row with its index and advisory quality report
  const augmentedRows = useMemo(() => {
    return rows.map((row, index) => {
      const report = rowReports[index] || {};
      return {
        __row: row,
        __index: index,
        __status: report.status || 'VALID',
        __issues: report.issues || [],
      };
    });
  }, [rows, rowReports]);

  // Filtering
  const filteredRows = useMemo(() => {
    let result = augmentedRows;

    if (statusFilter !== 'ALL') {
      result = result.filter((item) => item.__status === statusFilter);
    }

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter((item) => {
        return headers.some((h) => {
          const val = item.__row[h];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(term);
        });
      });
    }

    if (sortCol) {
      result = [...result].sort((a, b) => {
        const valA = a.__row[sortCol];
        const valB = b.__row[sortCol];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined || valA === '') return 1;
        if (valB === null || valB === undefined || valB === '') return -1;
        const numA = Number(valA);
        const numB = Number(valB);
        let cmp;
        if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
          cmp = numA - numB;
        } else {
          cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true });
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [augmentedRows, statusFilter, search, sortCol, sortDir, headers]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PREVIEW_PAGE_SIZE));

  const visibleRows = useMemo(() => {
    const start = (page - 1) * PREVIEW_PAGE_SIZE;
    return filteredRows.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [filteredRows, page]);

  const handleSort = (col) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortCol(null);
        setSortDir('asc');
      }
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const handleExportCSV = () => {
    if (!filteredRows.length || !headers.length) return;
    const headerLine = ['#', 'Status', ...headers].map(sanitizeCellForCSV).join(',');
    const lines = filteredRows.map((item) => {
      const rowVals = headers.map((h) => sanitizeCellForCSV(item.__row[h]));
      return [item.__index + 1, item.__status, ...rowVals].join(',');
    });
    const blob = new Blob([[headerLine, ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preview_export_${fileName || 'data'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rowCount = totalRowCount ?? rows.length;

  return (
    <SectionCard
      title="Data preview & Quality Inspection"
      subtitle={
        fileName
          ? `${headers.length} columns · ${rowCount.toLocaleString()} rows${isSampled ? ` · showing first ${rows.length.toLocaleString()}` : ''} · Filtered: ${filteredRows.length.toLocaleString()} rows · Page ${page} of ${pageCount}`
          : 'Your uploaded data will appear here.'
      }
      action={
        <div className="flex items-center gap-2">
          {fileName && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs font-semibold text-onSurface shadow-sm hover:bg-surface-high transition-colors"
              title="Export current filtered view to sanitized CSV"
            >
              <Icon name="download" size={14} />
              Export View
            </button>
          )}
          {fileName && <BtnPrimary onClick={onReplace}>Replace file</BtnPrimary>}
        </div>
      }
    >
      {!fileName ? (
        <div className="flex min-h-36 flex-1 flex-col items-center justify-center text-center text-onSurface-variant">
          <Icon name="table_view" size={32} />
          <p className="mt-2 text-sm">No dataset selected yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Controls bar: search + status filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-onSurface-variant">Filter Status:</span>
              {(['ALL', 'VALID', 'WARNING', 'INVALID']).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => { setStatusFilter(st); setPage(1); }}
                  className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all ${
                    statusFilter === st
                      ? st === 'VALID'
                        ? 'bg-emerald-600 text-white'
                        : st === 'WARNING'
                        ? 'bg-amber-600 text-white'
                        : st === 'INVALID'
                        ? 'bg-red-600 text-white'
                        : 'bg-primary text-white'
                      : 'bg-surface-high text-onSurface-variant hover:bg-outline-variant'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search in preview..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-48 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 pl-8 text-xs text-onSurface outline-none focus:border-primary"
                />
                <span className="absolute left-2.5 top-2 text-onSurface-variant">
                  <Icon name="search" size={14} />
                </span>
                {search && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setPage(1); }}
                    className="absolute right-2 top-2 text-onSurface-variant hover:text-onSurface"
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-auto border border-outline-variant rounded-lg">
            <table className="w-full min-w-max border-collapse text-left">
              <thead className="bg-surface-high select-none">
                <tr>
                  <th className="border-b border-outline-variant px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-onSurface-variant w-12 text-center">
                    #
                  </th>
                  {rowReports.length > 0 && (
                    <th className="border-b border-outline-variant px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-onSurface-variant w-24">
                      Status
                    </th>
                  )}
                  {headers.map((header) => {
                    const isSorted = sortCol === header;
                    return (
                      <th
                        key={header}
                        onClick={() => handleSort(header)}
                        className="cursor-pointer border-b border-outline-variant px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-onSurface-variant hover:text-primary transition-colors"
                        title={`Click to sort by ${header}`}
                      >
                        <div className="flex items-center gap-1">
                          <span>{header}</span>
                          <span className="text-onSurface-variant/50">
                            {isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length + 2} className="px-4 py-8 text-center text-sm text-onSurface-variant">
                      No rows match your search/filter criteria.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((item) => {
                    const st = item.__status;
                    const issues = item.__issues;
                    const statusBadgeClass =
                      st === 'VALID'
                        ? 'border-emerald-500/30 bg-emerald-50 text-emerald-700'
                        : st === 'WARNING'
                        ? 'border-amber-500/30 bg-amber-50 text-amber-800'
                        : 'border-red-500/30 bg-red-50 text-red-700 font-bold';

                    return (
                      <tr key={item.__index} className="even:bg-surface-lowest hover:bg-surface-high/50 transition-colors">
                        <td className="border-b border-outline-variant px-3 py-2.5 text-xs text-onSurface-variant text-center font-mono">
                          {item.__index + 1}
                        </td>
                        {rowReports.length > 0 && (
                          <td className="border-b border-outline-variant px-3 py-2.5 text-xs">
                            <span
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] border ${statusBadgeClass}`}
                              title={issues.length ? issues.join(', ') : 'Valid record'}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${st === 'VALID' ? 'bg-emerald-500' : st === 'WARNING' ? 'bg-amber-500' : 'bg-red-500'}`} />
                              {st}
                            </span>
                          </td>
                        )}
                        {headers.map((header) => {
                          const val = item.__row[header];
                          return (
                            <td key={`${item.__index}-${header}`} className="border-b border-outline-variant px-4 py-2.5 text-sm text-onSurface">
                              {val !== null && val !== undefined && val !== '' ? String(val) : <span className="text-onSurface-variant/40">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-outline-variant bg-surface-low px-4 py-3 text-xs text-onSurface-variant">
              <span>
                Showing {filteredRows.length > 0 ? (page - 1) * PREVIEW_PAGE_SIZE + 1 : 0}–
                {Math.min(page * PREVIEW_PAGE_SIZE, filteredRows.length)} of {filteredRows.length} filtered rows
                {filteredRows.length !== rows.length ? ` (total ${rows.length})` : ''}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((v) => v - 1)}
                  className="rounded border border-outline-variant px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40 hover:bg-surface-high"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page === pageCount || pageCount === 0}
                  onClick={() => setPage((v) => v + 1)}
                  className="rounded border border-outline-variant px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40 hover:bg-surface-high"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
