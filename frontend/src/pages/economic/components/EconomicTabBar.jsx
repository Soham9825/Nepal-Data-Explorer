import { Icon } from '../../../components/ui/Icon';
import { TABS } from '../constants';


const ONE_ROW = {
  2: 'lg:grid lg:grid-cols-2',
  3: 'lg:grid lg:grid-cols-3',
  4: 'lg:grid lg:grid-cols-4',
  5: 'lg:grid lg:grid-cols-5',
  6: 'lg:grid lg:grid-cols-6',
};


export default function EconomicTabBar({ activeTab, onSelect }) {
  return (
    <div className="sticky top-0 z-20 border-b border-outline-variant bg-white/95 backdrop-blur">
      <div
        className={`-mx-1 flex items-stretch overflow-x-auto px-1 lg:mx-0 lg:overflow-visible lg:px-0 ${ONE_ROW[TABS.length] ?? ''}`}
        role="tablist"
        aria-label="Economic dashboard sections"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`economic-panel-${tab.id}`}
              title={tab.description}
              onClick={() => onSelect(tab.id)}
              className={`flex min-h-[44px] min-w-[8.5rem] shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2.5 font-hanken text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary lg:min-w-0 ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-onSurface-variant hover:border-hairline-strong hover:bg-surface-container hover:text-onSurface'
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
