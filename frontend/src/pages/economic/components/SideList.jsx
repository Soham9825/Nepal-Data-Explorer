import { ProgressBar } from '../../../components/ui/ProgressBar';
import { CHART_HEIGHT } from '../constants';


export default function SideList({ title, count, items }) {
  return (
    <div className={`${CHART_HEIGHT} flex flex-col`}>
      <div className="flex items-center justify-between border-b border-outline-variant px-1 pb-2">
        <h4 className="text-sm font-bold text-onSurface font-hanken">{title}</h4>
        {count != null && (
          <span className="rounded-sm bg-surface-highest px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-onSurface-variant font-hanken">
            {count}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span
                  className="block break-words text-sm font-bold leading-tight text-onSurface font-hanken"
                  title={item.label}
                >
                  {item.label}
                </span>
                <div className="mt-1">
                  <ProgressBar value={item.pct} color={item.color} total={100} />
                </div>
              </div>
              <span className="text-sm font-bold tabular-nums text-onSurface font-hanken">
                {item.value}
              </span>
              <span className="w-14 text-right text-xs font-bold tabular-nums text-onSurface-variant">
                {item.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
