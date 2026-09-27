import { Icon } from '../../../components/ui/Icon';
import { SEMANTIC_COLORS as COLORS } from '../../../theme/colors';
import { formatSigned } from '../format';

/** A signed change with a trend arrow, as used on the key indicator cards. */
export default function ChangeBadge({ value, suffix = '%', label }) {
  if (value === null || value === undefined) return null;
  const positive = Number(value) >= 0;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-canvas px-1.5 py-0.5 text-xs font-semibold tabular-nums text-ink-muted">
      <Icon name={positive ? 'trending_up' : 'trending_down'} size={14} color={COLORS.neutral} />
      {formatSigned(value, suffix)}
      {label && <span className="font-medium text-ink-faint">{label}</span>}
    </span>
  );
}
