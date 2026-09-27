import { SectionCard } from '../../../components/ui/Card';
import { TAB_BY_ID, reservedSectionHeight, sectionElementId } from '../constants';
import { SECTION_BY_ID } from '../sections';
import EconomicKpiStrip from './EconomicKpiStrip';
import LazySection from './LazySection';


function SectionSlot({ id, view, actions, eager }) {
  const section = SECTION_BY_ID[id];
  const Body = section.content;

  return (
    <div id={sectionElementId(id)} className="scroll-mt-24">
      <LazySection minHeight={reservedSectionHeight(id)} eager={eager}>
        <SectionCard
          title={section.title}
          subtitle={section.subtitle(view)}
          action={section.action(view, actions)}
          className="h-full rounded-sm"
        >
          <Body view={view} actions={actions} />
        </SectionCard>
      </LazySection>
    </div>
  );
}


export default function EconomicTabPanel({ activeTab, view, actions, cards }) {
  const tab = TAB_BY_ID[activeTab];
  if (!tab) return null;

  // The opening section of the tab is above the fold, so it mounts straight away
  // rather than waiting on the observer's first callback.
  const [firstRow] = tab.rows;
  const firstSectionId = firstRow?.[0];

  return (
    <div id={`economic-panel-${tab.id}`} role="tabpanel" aria-label={tab.label}>
      <div className="space-y-6">
        {tab.showKpis && <EconomicKpiStrip cards={cards} />}

        {tab.rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`grid grid-cols-1 items-stretch gap-6 ${row.length > 1 ? 'lg:grid-cols-2' : ''}`}
          >
            {row.map((id) => (
              <SectionSlot
                key={id}
                id={id}
                view={view}
                actions={actions}
                eager={id === firstSectionId}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
