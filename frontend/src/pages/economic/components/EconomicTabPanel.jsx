import { SectionCard } from '../../../components/ui/Card';
import { TAB_BY_ID, reservedSectionHeight, sectionElementId } from '../constants';
import { SECTION_BY_ID } from '../sections';
import EconomicKpiStrip from './EconomicKpiStrip';
import LazySection from './LazySection';
import SaveViewButton from '../../tourism/components/SaveViewButton';

function sectionParams(id, actions) {
  const params = {
    sectoral: { sectorYear: actions.sectorYear },
    growth: { growthRange: actions.growthRange },
    trade: { tradeRange: actions.tradeRange },
    partners: { partnerView: actions.partnerView },
    balance: { balanceRange: actions.balanceRange },
    province: { selectedProvince: actions.selectedProvince, growthMetric: actions.growthMetric },
  };
  return params[id] || {};
}

function SectionSlot({ id, view, actions, eager, saveButtonFor }) {
  const section = SECTION_BY_ID[id];
  const Body = section.content;
  const saveItem = id === 'appi_table'
    ? null
    : saveButtonFor(id, section.title, section.subtitle(view), sectionParams(id, actions));

  return (
    <div id={sectionElementId(id)} className="scroll-mt-24">
      <LazySection minHeight={reservedSectionHeight(id)} eager={eager}>
        <SectionCard
          title={section.title}
          subtitle={section.subtitle(view)}
          action={
            <div className="flex items-center gap-2">
              {section.action(view, actions)}
              {saveItem && (
                <SaveViewButton
                  item={saveItem}
                  alreadySaved={saveItem.alreadySaved}
                  onSaved={saveItem.onSaved}
                  onRemoved={saveItem.onRemoved}
                />
              )}
            </div>
          }
          className="h-full rounded-sm"
        >
          <Body view={view} actions={actions} />
        </SectionCard>
      </LazySection>
    </div>
  );
}


export default function EconomicTabPanel({ activeTab, view, actions, cards, saveButtonFor }) {
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
                saveButtonFor={saveButtonFor}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
