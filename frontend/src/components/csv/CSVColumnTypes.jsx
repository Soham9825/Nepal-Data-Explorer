
import { SectionCard } from '../ui/Card';
import { Icon } from '../ui/Icon';

const TYPE_OPTIONS = [
  ['numeric', 'Number'],
  ['date', 'Date / time'],
  ['categorical', 'Category'],
  ['text', 'Text'],
  ['boolean', 'Yes / No'],
  ['identifier', 'ID / code'],
];

const TYPE_LABELS = new Map([
  ['numeric', 'Number'],
  ['date', 'Date / time'],
  ['categorical', 'Category'],
  ['text', 'Text'],
  ['boolean', 'Yes / No'],
  ['identifier', 'ID / code'],
  ['empty', 'Empty'],
]);

const inputClass =
  'rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-onSurface outline-none focus:border-primary';

export default function CSVColumnTypes({ columns = [], overrides = {}, onOverride, warning }) {
  const issues = [];
  columns.forEach((column) => {
    if (column.type === 'empty') {
      issues.push({ column: column.name, text: 'contains no values', severity: 'warn' });
      return;
    }
    if (column.missing > 0) {
      issues.push({
        column: column.name,
        text: `${column.missing} missing cell${column.missing === 1 ? '' : 's'}`,
        severity: 'warn',
      });
    }
    if (column.confidence < 0.7) {
      issues.push({
        column: column.name,
        text: 'mixed formats — verify the detected type below',
        severity: 'warn',
      });
    }
  });

  return (
    <SectionCard
      title="Column types & issues"
      subtitle="How each column will be interpreted when you build a chart. Change any type that looks wrong."
    >
      {warning && (
        <p
          className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          role="alert"
        >
          <Icon name="warning" size={17} />
          {warning}
        </p>
      )}
      {issues.length > 0 ? (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          role="alert"
        >
          <Icon name="warning" size={17} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">
              {issues.length} issue{issues.length === 1 ? '' : 's'} to review
            </p>
            <ul className="mt-1 list-disc pl-4">
              {issues.map((issue) => (
                <li key={`${issue.column}-${issue.text}`}>
                  <strong>{issue.column}</strong>: {issue.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          <Icon name="check_circle" size={17} />
          No issues detected — the type inference is confident.
        </p>
      )}
      <div className="overflow-auto border border-outline-variant">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead className="bg-surface-high">
            <tr>
              <th className="border-b border-outline-variant px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-onSurface-variant">
                Column
              </th>
              <th className="border-b border-outline-variant px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-onSurface-variant">
                Detected type
              </th>
              <th className="border-b border-outline-variant px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-onSurface-variant">
                Confidence
              </th>
              <th className="border-b border-outline-variant px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-onSurface-variant">
                Override to
              </th>
              <th className="border-b border-outline-variant px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-onSurface-variant">
                Unique
              </th>
              <th className="border-b border-outline-variant px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-onSurface-variant">
                Missing
              </th>
              <th className="border-b border-outline-variant px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-onSurface-variant">
                Sample
              </th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => {
              const override = overrides[column.name] || '';
              const overridden = Boolean(override);
              return (
                <tr key={column.name} className="even:bg-surface-lowest">
                  <td className="border-b border-outline-variant px-4 py-2.5 font-semibold">
                    {column.name}
                  </td>
                  <td className="border-b border-outline-variant px-4 py-2.5 capitalize">
                    {TYPE_LABELS.get(column.type) || column.type}
                    {overridden && (
                      <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">
                        manual
                      </span>
                    )}
                  </td>
                  <td className="border-b border-outline-variant px-4 py-2.5">
                    <span
                      className={
                        column.confidence < 0.7
                          ? 'font-semibold text-amber-600'
                          : 'text-onSurface-variant'
                      }
                    >
                      {Math.round((overridden ? 1 : column.confidence) * 100)}%
                    </span>
                  </td>
                  <td className="border-b border-outline-variant px-4 py-2.5">
                    <select
                      aria-label={`Override type for ${column.name}`}
                      value={override}
                      onChange={(event) => onOverride(column.name, event.target.value || null)}
                      className={`${inputClass} w-40 normal-case font-normal`}
                    >
                      <option value="">Keep detected</option>
                      {TYPE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b border-outline-variant px-4 py-2.5 text-onSurface-variant">
                    {column.unique}
                  </td>
                  <td className="border-b border-outline-variant px-4 py-2.5 text-onSurface-variant">
                    {column.missing}
                  </td>
                  <td className="max-w-60 truncate border-b border-outline-variant px-4 py-2.5 text-onSurface-variant">
                    {column.sample.join(', ') || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
