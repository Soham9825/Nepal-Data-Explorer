
export default function DataTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-outline-variant">
            {columns.map((col) => (
              <th key={col} className="text-left font-bold text-onSurface-variant uppercase tracking-[0.04em] py-2 pr-4">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-outline-variant last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="py-2 pr-4 text-onSurface">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-onSurface-variant mt-3">
        Showing a preview — download the file for the full dataset.
      </p>
    </div>
  );
}