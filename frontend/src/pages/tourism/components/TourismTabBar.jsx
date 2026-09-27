import { Icon } from '../../../components/ui/Icon';
import { TABS } from '../constants';

/**
 * The sticky tab bar under the banner. It stays visible while a tab scrolls, and
 * the active tab is mirrored on the panel below it through `aria-controls`.
 */
export default function TourismTabBar({ activeTab, onSelect }) {
  return (
    <div className="sticky top-0 z-20 border-b border-outline-variant bg-white/95 backdrop-blur">
      <div
        className="-mx-1 flex items-stretch overflow-x-auto px-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0"
        role="tablist"
        aria-label="Tourism dashboard sections"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`tourism-panel-${tab.id}`}
              title={tab.description}
              onClick={() => onSelect(tab.id)}
              className={`flex min-h-[44px] min-w-[9.5rem] shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 font-hanken text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary lg:min-w-0 ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-muted hover:border-hairline-strong hover:bg-surface-container hover:text-ink'
              }`}
            >
              <Icon name={tab.icon} size={18} color="currentColor" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
