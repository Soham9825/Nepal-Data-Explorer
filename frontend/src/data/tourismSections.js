/**
 * Every panel inside the Tourism tabs, declared once.
 *
 * This exists to solve a discoverability problem: the dashboard splits metrics
 * across four tabs by data source, so someone looking for "purpose of visit" or
 * "length of stay" has no way to know which tab holds it. Rather than guess from
 * the tab name, both the page and the top bar search read this list.
 *
 * - Tourism places each `id` on the matching panel so a deep link can scroll to it.
 * - The top bar search offers every entry as its own result and links to
 *   `/tourism?section=<id>`, which switches to the owning tab and scrolls there.
 *
 * The `id` values are the contract between the two. If a panel is renamed or
 * moved, update the `id` here and on the panel together, or search results will
 * land on the wrong tab.
 */
export const TOURISM_SECTIONS = [
  {
    id: 'tourism-section-indicators',
    tab: 'overview',
    label: 'Key indicators',
    description: 'Headline totals for arrivals, revenue, and stay',
    keywords: 'summary kpi headline totals cards figures overview',
    icon: 'insights',
  },
  {
    id: 'tourism-section-stay',
    tab: 'overview',
    label: 'Average length of stay',
    description: 'How long visitors stay in Nepal, by year',
    keywords: 'stay length duration nights days how long average',
    icon: 'hourglass_bottom',
  },
  {
    id: 'tourism-section-trends',
    tab: 'overview',
    label: 'Tourism trends',
    description: 'Arrivals and revenue over time',
    keywords: 'arrivals revenue trend over time year on year growth',
    icon: 'trending_up',
  },
  {
    id: 'tourism-section-markets',
    tab: 'markets',
    label: 'Source markets',
    description: 'Where visitors come from, by country',
    keywords: 'source market country countries nationality origin where from abroad',
    icon: 'public',
  },
  {
    id: 'tourism-section-purpose',
    tab: 'profile',
    label: 'Purpose of visit',
    description: 'Why visitors travel to Nepal',
    keywords: 'purpose reason why visit holiday business trekking visiting friends',
    icon: 'query_stats',
  },
  {
    id: 'tourism-section-age',
    tab: 'profile',
    label: 'Visitor age groups',
    description: 'Arrivals by age band',
    keywords: 'age age groups young adults senior old generation',
    icon: 'cake',
  },
  {
    id: 'tourism-section-gender',
    tab: 'profile',
    label: 'Visitor gender',
    description: 'Arrivals by gender, with yearly trend',
    keywords: 'gender sex male female men women composition',
    icon: 'wc',
  },
  {
    id: 'tourism-section-trekking',
    tab: 'profile',
    label: 'Trekking areas',
    description: 'Trekker counts by area',
    keywords: 'trekking trekkers hiking trails area mountain',
    icon: 'hiking',
  },
  {
    id: 'tourism-section-destinations',
    tab: 'destinations',
    label: 'Ranked destinations',
    description: 'Destinations within the selected province',
    keywords: 'destination destinations province places visit ranked top',
    icon: 'location_on',
  },
  {
    id: 'tourism-section-destination-trend',
    tab: 'destinations',
    label: 'Destination trend',
    description: 'Destination visits by year',
    keywords: 'destination trend over time year yearly growth',
    icon: 'show_chart',
  },
];

export const TOURISM_SECTION_IDS = TOURISM_SECTIONS.map((section) => section.id);

export function findTourismSection(id) {
  return TOURISM_SECTIONS.find((section) => section.id === id) || null;
}
