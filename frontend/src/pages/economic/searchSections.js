/**
 * Every panel inside the Economic tabs, declared for search.
 *
 * `tourismSections.js` does this for Tourism, and the reason is the same: the Economic
 * dashboard splits eleven charts across three tabs, so someone who wants "producer
 * price" or "trade balance" has no way to know which tab holds it. The top bar search
 * reads this list and links to `/economic?section=<id>`; `useEconomicNavigation` looks
 * the id up, switches to the owning tab, and scrolls to it.
 *
 * The owning tab is read off `TABS` rather than written here, because `TABS` is already
 * the one place that says which tab holds what. A tab spelled out in this file could
 * disagree with the tab that actually renders the section, and the search would then
 * deep-link to a tab that is not showing it. Adding a section to a tab therefore needs
 * no change here at all.
 *
 * `keywords` carries the words a reader would actually type that are not in the label —
 * the abbreviations and the plain-English phrasings. It is matched, but never ranked as
 * highly as the label, so a broad keyword cannot outrank the chart actually named.
 */
import { SECTION_CATALOG, TABS } from './constants';

const tabForSection = (sectionId) =>
  TABS.find((tab) => tab.rows.some((row) => row.includes(sectionId)))?.id || '';

const KEYWORDS = {
  sectoral:
    'sector sectoral growth industry services agriculture subsector composition breakdown kpi',
  overall:
    'economy economy-wide economywide growth gdp components aggregate headline agriculture industry services',
  growth: 'world output world bank global growth international real gdp world',
  economies:
    'global economies economy blocs advanced emerging developing countries country comparison real growth',
  trade: 'trade exports imports total trade value foreign exchange total',
  partners: 'trade partner trading partner country bilateral china india exports imports flow',
  balance: 'balance trade deficit surplus exports minus imports net',
  salary: 'salary wage wages index earnings remuneration labour labor worker pay',
  appi: 'appi agriculture agricultural producer price index farm crop farmgate wholesale',
  appi_table:
    'producer price data table product wheat paddy maize cereals crop weight full list reference',
  province:
    'province provincial gdp regional koshi bagmati gandaki lumbini karnali madhesh sudurpashchim',
};

const ICONS = {
  sectoral: 'donut_small',
  overall: 'monitoring',
  growth: 'public',
  economies: 'language',
  trade: 'swap_horiz',
  partners: 'handshake',
  balance: 'balance',
  salary: 'payments',
  appi: 'agriculture',
  appi_table: 'table_rows',
  province: 'map',
};

export const ECONOMIC_SECTIONS = SECTION_CATALOG.map((section) => ({
  id: section.id,
  page: 'economic',
  pageLabel: 'Economic Data',
  tab: tabForSection(section.id),
  label: section.label,
  keywords: KEYWORDS[section.id] || '',
  icon: ICONS[section.id] || 'insert_chart',
  path: `/economic?section=${section.id}`,
}));
