/** Placeholders that stand in for "no figure" rather than being text. */
const BLANK_CELLS = new Set(['', '-', '–', '—', 'n/a', 'na', 'null', 'none', '.']);

const isBlankCell = (value) =>
  BLANK_CELLS.has(
    String(value ?? '')
      .trim()
      .toLowerCase()
  );

const isNumeric = (value) => /^[+-]?[\d,]*\.?\d+\s*%?$/.test(String(value).trim());

/**
 * Work out which columns hold figures, so they can be right-aligned.
 *
 * Placeholders are skipped rather than treated as text, so a column of years with one
 * missing entry stays a column of figures. Decimals are detected per column and the
 * figures are padded to a common width, which lines the decimal points up instead of
 * leaving them to hang at the end of each cell.
 */
function profileColumns(columns, rows) {
  return columns.map((column, index) => {
    const values = rows.map((row) => String(row?.[index] ?? '').trim());
    const present = values.filter((value) => !isBlankCell(value));
    const figures = present.filter(isNumeric);
    const numeric = present.length > 0 && figures.length === present.length;
    if (!numeric) return { numeric: false };

    const decimals = figures.map((value) => {
      const match = value.replace(/,/g, '').match(/\.(\d+)$/);
      return match ? match[1].length : 0;
    });
    const widths = figures.map((value) => value.replace(/,/g, '').split('.')[0].length);
    return {
      numeric: true,
      decimals: decimals.length ? Math.max(...decimals) : 0,
      intWidth: widths.length ? Math.max(...widths) : 0,
    };
  });
}

/** Pad a figure to the column's shape so digits stack down the column. */
function alignNumeric(value, column) {
  const text = String(value).trim();
  if (isBlankCell(text)) return text;
  const [int, dec] = text.replace(/,/g, '').split('.');
  const suffix = /%\s*$/.test(text) ? '%' : '';
  const intText = int.padStart(column.intWidth, ' ');
  const decText = column.decimals ? `.${(dec || '').padEnd(column.decimals, '0')}` : '';
  return `${intText}${decText}${suffix}`;
}

/**
 * A preview of the first rows of a dataset.
 *
 * Column widths are shared across the table by a fixed layout rather than left to the
 * browser's auto layout, and figures are right-aligned against a decimal rule while text
 * stays left. Rows in the source CSVs are not always the same width as the header, so
 * cells are read defensively and short rows are padded out rather than collapsing the
 * columns beneath them.
 */
export default function DataTable({ columns = [], rows = [] }) {
  if (!columns.length) {
    return (
      <p className="py-6 text-center text-sm text-onSurface-variant">
        This file has no readable columns.
      </p>
    );
  }

  const profile = profileColumns(columns, rows);
  // `table-fixed` with an explicit width is what makes the header and the cells beneath it
  // share one set of column edges; auto layout lets a long first cell shove everything
  // sideways.
  const gridTemplate = { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` };

  return (
    <div>
      <div className="overflow-x-auto">
        <div role="table" aria-rowcount={rows.length + 1} className="w-full min-w-[28rem] text-xs">
          <div
            role="row"
            className="grid border-b-2 border-nepal-crimson/70 bg-surface-container"
            style={gridTemplate}
          >
            {columns.map((column, index) => (
              <div
                key={column + index}
                role="columnheader"
                title={String(column)}
                className={`truncate px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.04em] text-onSurface-variant ${
                  profile[index].numeric ? 'text-right' : 'text-left'
                }`}
              >
                {String(column).replace(/_/g, ' ')}
              </div>
            ))}
          </div>

          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              role="row"
              className="grid border-b border-outline-variant last:border-0 hover:bg-surface-lowest"
              style={gridTemplate}
            >
              {columns.map((column, cellIndex) => {
                const raw = row?.[cellIndex];
                const empty = raw === undefined || raw === null || String(raw).trim() === '';
                const text = empty
                  ? '—'
                  : profile[cellIndex].numeric
                    ? alignNumeric(raw, profile[cellIndex])
                    : String(raw).replace(/_/g, ' ');
                return (
                  <div
                    key={column + cellIndex}
                    role="cell"
                    title={empty ? '' : String(raw)}
                    className={`truncate px-3 py-2 ${
                      profile[cellIndex].numeric
                        ? 'text-right tabular-nums text-onSurface'
                        : 'text-left text-onSurface'
                    } ${empty ? 'text-onSurface-variant' : ''}`}
                  >
                    {text}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-onSurface-variant">
        Showing the first {rows.length} row{rows.length === 1 ? '' : 's'} — download the file for
        the full dataset.
      </p>
    </div>
  );
}
