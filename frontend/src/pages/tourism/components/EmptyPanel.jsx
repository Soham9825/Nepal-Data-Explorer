import { Icon } from '../../../components/ui/Icon';
import { SEMANTIC_COLORS as COLORS } from '../../../theme/colors';

/** Stand-in for a panel with nothing to draw, so the layout keeps its shape. */
export default function EmptyPanel({ message = 'No data is available for this selection.' }) {
  return (
    <div className="flex min-h-56 flex-1 items-center justify-center border border-dashed border-outline bg-background px-6 text-center text-sm text-ink-muted">
      <div>
        <Icon name="query_stats" size={28} color={COLORS.neutral} />
        <p className="mt-2 font-semibold">{message}</p>
      </div>
    </div>
  );
}
