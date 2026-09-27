import { SectionCard } from '../ui/Card';
import { Icon } from '../ui/Icon';

const STRATEGY_OPTIONS = [
  ['none', 'Leave as gaps'],
  ['forward', 'Forward fill'],
  ['mean', 'Fill with mean'],
  ['median', 'Fill with median'],
  ['drop', 'Remove missing rows'],
];

const STRATEGY_HINTS = {
  none: 'Missing cells stay empty; charts draw a gap.',
  forward: 'Carry the previous value down the column (good for time series).',
  mean: 'Replace gaps with the column average (numeric columns only).',
  median: 'Replace gaps with the column median (numeric columns only).',
  drop: 'Remove every row that is still missing this value.',
};

const inputClass =
  'rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-onSurface outline-none focus:border-primary';

export default function CSVMissingStrategy({ columns = [], strategies = {}, onStrategy }) {
  const columnsWithMissing = columns.filter(
    (column) => column.missing > 0 && column.type !== 'empty'
  );
  if (columnsWithMissing.length === 0) return null;

  const numericOnly = (column) => column.type === 'numeric';

  const planCount = Object.values(strategies).filter(
    (strategy) => strategy && strategy !== 'none'
  ).length;
  const options = (column) =>
    STRATEGY_OPTIONS.filter(
      ([value]) =>
        value === 'none' ||
        value === 'forward' ||
        value === 'drop' ||
        (value !== 'none' && numericOnly(column))
    );

  return (
    <SectionCard
      title="Missing value handling"
      subtitle="Fill or drop the gaps before you build the chart. Every column with missing cells is shown; skip ones you want to keep as gaps."
      action={
        planCount > 0 ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Icon name="check_circle" size={16} />
            {planCount} column{planCount === 1 ? '' : 's'} to prepare
          </span>
        ) : null
      }
    >
      <div className="overflow-auto border border-outline-variant">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead className="bg-surface-high">
            <tr>
              <th className="border-b border-outline-variant px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-onSurface-variant">
                Column
              </th>
              <th className="border-b border-outline-variant px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-onSurface-variant">
                Missing
              </th>
              <th className="border-b border-outline-variant px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-onSurface-variant">
                Strategy
              </th>
              <th className="border-b border-outline-variant px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-onSurface-variant">
                Effect
              </th>
            </tr>
          </thead>
          <tbody>
            {columnsWithMissing.map((column) => {
              const strategy = strategies[column.name] || 'none';
              const hint = STRATEGY_HINTS[strategy] || '';
              return (
                <tr key={column.name} className="even:bg-surface-lowest">
                  <td className="border-b border-outline-variant px-4 py-2.5 font-semibold">
                    {column.name}
                  </td>
                  <td className="border-b border-outline-variant px-4 py-2.5 text-onSurface-variant">
                    {column.missing.toLocaleString()}
                  </td>
                  <td className="border-b border-outline-variant px-4 py-2.5">
                    <select
                      aria-label={`Missing value strategy for ${column.name}`}
                      value={strategy}
                      onChange={(event) => onStrategy?.(column.name, event.target.value || 'none')}
                      className={`${inputClass} w-44 normal-case font-normal`}
                    >
                      {options(column).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="max-w-72 border-b border-outline-variant px-4 py-2.5 text-onSurface-variant">
                    {strategy !== 'none' && hint}
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
