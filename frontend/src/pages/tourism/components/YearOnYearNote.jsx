import { Icon } from '../../../components/ui/Icon';
import { SEMANTIC_COLORS as COLORS } from '../../../theme/colors';
import { formatSigned, toNumber } from '../format';

/**
 * Extra tooltip row for the arrivals chart, printing the year-on-year change
 * under the value. Passed to `LineChart` as `tooltipExtra`, which calls it with
 * the active row; a row without a change prints nothing.
 */
export default function YearOnYearNote(item) {
  const yearOnYear = toNumber(item?.yoy);
  if (yearOnYear === null) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
      <Icon
        name={yearOnYear >= 0 ? 'trending_up' : 'trending_down'}
        size={13}
        color={COLORS.neutral}
      />
      {formatSigned(yearOnYear, '%')} year-on-year
    </p>
  );
}
