import React from 'react';

export default function CSVTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload || {};
  const detailRow = row.__details || row;
  const series = payload.filter((entry) => entry.value !== null && entry.value !== undefined);
  const seriesKeys = new Set(series.map((entry) => entry.dataKey));
  const details = Object.entries(detailRow).filter(([key, value]) => (
    key !== '__details'
    && !seriesKeys.has(key)
    && key !== label
    && value !== null
    && value !== undefined
    && value !== ''
  ));
  const formatValue = (value) => typeof value === 'number'
    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : String(value);

  return (
    <div className="w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded border border-gray-300 bg-white text-xs text-gray-800 shadow-md">
      <div className="border-b border-gray-200 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase text-gray-500">Period</p>
        <p className="mt-0.5 truncate font-bold text-gray-900">
          {label !== undefined && label !== null ? String(label) : 'Selected data'}
        </p>
      </div>
      <div className="max-h-72 overflow-y-auto px-4 py-3">
        {series.length > 0 && (
          <div className="space-y-2">
            {series.map((entry) => (
              <div key={entry.dataKey} className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 last:border-0">
                <span className="flex min-w-0 items-center gap-2 truncate font-medium text-gray-600">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color || '#2563eb' }} />
                  <span className="truncate">{entry.name || entry.dataKey}</span>
                </span>
                <span className="shrink-0 font-bold text-gray-900">{formatValue(entry.value)}</span>
              </div>
            ))}
          </div>
        )}
        {details.length > 0 && (
          <div className={`${series.length > 0 ? 'border-t border-gray-200' : ''} divide-y divide-gray-100`}>
            {details.map(([key, value]) => (
              <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0 break-words text-gray-500">{key}</span>
                <span className="max-w-32 break-words text-right font-semibold text-gray-900">
                  {formatValue(value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {details.length > 8 && (
        <p className="border-t border-gray-200 px-3 py-2 text-[10px] text-gray-500">
          Scroll to view all details
        </p>
      )}
    </div>
  );
}
