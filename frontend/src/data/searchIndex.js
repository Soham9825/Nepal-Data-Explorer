import { ECONOMIC_SECTIONS } from '../pages/economic/searchSections';
import { TOURISM_SECTIONS } from './tourismSections';
import { PROVINCES } from './provinces';

/**
 * Whole pages. Kept as data rather than derived from the route table, because a result
 * also wants a description and an icon, which the router does not carry.
 */
export const PAGE_ITEMS = [
  {
    kind: 'page',
    id: 'page:/',
    label: 'National Dashboard',
    path: '/',
    description: 'National indicators and headlines',
    keywords: 'national population gdp dashboard home overview',
    icon: 'dashboard',
  },
  {
    kind: 'page',
    id: 'page:/economic',
    label: 'Economic Data',
    path: '/economic',
    description: 'Trade, salary, and macroeconomic indicators',
    keywords: 'economic economy economywide trade salary wage gdp foreign exchange macro',
    icon: 'payments',
  },
  {
    kind: 'page',
    id: 'page:/tourism',
    label: 'Tourism',
    path: '/tourism',
    description: 'Tourist arrivals, visitors, and destinations',
    keywords: 'tourism tourist visitor arrivals destinations trekking',
    icon: 'flight',
  },
  {
    kind: 'page',
    id: 'page:/provinces',
    label: 'Province Explorer',
    path: '/provinces',
    description: 'Province-level indicators and tourism',
    keywords: 'province provincial gdp destination region',
    icon: 'map',
  },
  {
    kind: 'page',
    id: 'page:/compare',
    label: 'Compare Data',
    path: '/compare',
    description: 'Compare available indicators',
    keywords: 'compare indicators side by side versus',
    icon: 'compare_arrows',
  },
  {
    kind: 'page',
    id: 'page:/predictions',
    label: 'AI Predictions',
    path: '/predictions',
    description: 'Forecast and prediction data',
    keywords: 'ai prediction forecast model projection',
    icon: 'auto_awesome',
  },
  {
    kind: 'page',
    id: 'page:/reports',
    label: 'Reports & Exports',
    path: '/reports',
    description: 'Download reports and exports',
    keywords: 'report export download pdf',
    icon: 'description',
  },
  {
    kind: 'page',
    id: 'page:/research',
    label: 'Research Data',
    path: '/research',
    description: 'Official source datasets and downloads',
    keywords: 'research dataset csv source download',
    icon: 'dataset',
  },
  {
    kind: 'page',
    id: 'page:/csv-explorer',
    label: 'CSV Explorer',
    path: '/csv-explorer',
    description: 'Explore uploaded CSV data',
    keywords: 'csv explorer upload file custom data',
    icon: 'upload_file',
  },
];

/** Group order in the result list, and the heading each group is filed under. */
export const RESULT_GROUPS = [
  { kind: 'section', label: 'Sections' },
  { kind: 'page', label: 'Pages' },
  { kind: 'province', label: 'Provinces' },
  { kind: 'destination', label: 'Tourism destinations' },
  { kind: 'dataset', label: 'Available data' },
];

const TOURISM_TAB_LABELS = {
  overview: 'Tourism · Overview',
  markets: 'Tourism · Source markets',
  profile: 'Tourism · Visitor profile',
  destinations: 'Tourism · Destinations',
};

const TOURISM_SECTION_ITEMS = TOURISM_SECTIONS.map((section) => ({
  kind: 'section',
  id: section.id,
  page: 'tourism',
  label: section.label,
  description: TOURISM_TAB_LABELS[section.tab] || 'Tourism',
  keywords: section.keywords || '',
  icon: section.icon || 'travel_explore',
  path: `/tourism?section=${section.id}`,
}));

const PROVINCE_ITEMS = PROVINCES.map((province) => ({
  kind: 'province',
  id: `province-${province.id}`,
  label: province.name,
  description: `${province.hq} · Province Explorer`,
  keywords: `${province.name} ${province.hq} province provincial region`,
  icon: 'map',
  path: `/provinces/${province.id}`,
  province: province.name,
}));

// A province has two useful destinations: the province itself, and its tourism
// destinations. Searching "koshi" is ambiguous between them, so both are offered
// rather than guessing — the descriptions say which is which.
const DESTINATION_ITEMS = PROVINCE_ITEMS.map((province) => ({
  ...province,
  kind: 'destination',
  id: `destination-${province.province}`,
  label: `${province.province} tourism destinations`,
  description: `Tourism · Destinations · ${province.label}`,
  icon: 'place',
  path: `/tourism?section=tourism-section-destinations&province=${encodeURIComponent(
    province.province
  )}`,
}));

/** Everything searchable that is known without asking the server. */
export const STATIC_INDEX = [
  ...TOURISM_SECTION_ITEMS,
  ...ECONOMIC_SECTIONS.map((section) => ({ ...section, kind: 'section' })),
  ...PAGE_ITEMS,
  ...PROVINCE_ITEMS,
  ...DESTINATION_ITEMS,
];

/** Fold a CSV catalog into the same shape, so datasets rank with everything else. */
export function datasetItems(datasets) {
  return (Array.isArray(datasets) ? datasets : []).map((dataset) => ({
    kind: 'dataset',
    id: `dataset-${dataset.id}`,
    label: dataset.title || dataset.id,
    description: dataset.size ? `${dataset.size} · Open CSV` : 'CSV dataset',
    keywords: `${dataset.title || ''} ${dataset.id || ''} csv download dataset`,
    icon: 'table_chart',
    path: dataset.download_url,
    external: true,
  }));
}

const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .trim();

/**
 * How well one field matched, and why.
 *
 * `index` is folded into the score so that, among equally good matches, the one whose
 * hit sits earliest in the label wins — "trade" should prefer "Foreign Trade" over
 * "Trade by Partner" for the query "trade", because the word leads the first label.
 */
function scoreField(value, query, weight) {
  const text = normalize(value);
  if (!text || !query) return 0;
  if (text === query) return weight * 4;
  if (text.startsWith(query)) return weight * 3 - Math.min(text.indexOf(query), 40) / 100;
  // A hit at a word boundary counts for more than one buried mid-word, so "price"
  // prefers "Producer Price Data" over "Price Index by Subgroup".
  const boundary = new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  if (boundary.test(text)) return weight * 2;
  if (text.includes(query)) return weight;
  return 0;
}

/** Score one candidate against one already-lowercased token. */
function scoreToken(item, token) {
  const label = scoreField(item.label, token, 100);
  if (label) return label;
  const keywords = scoreField(item.keywords, token, 30);
  if (keywords) return keywords;
  const description = scoreField(item.description, token, 20);
  if (description) return description;
  return scoreField(item.path, token, 5);
}

/**
 * Rank `items` against a raw query.
 *
 * Every whitespace-separated token has to match somewhere on the same item, which is
 * what makes "producer price" narrow instead of matching every chart that mentions
 * either word. The tokens are scored independently and summed, so a candidate matching
 * one token in its label and the other in its keywords still beats a candidate that
 * matches both only in a description.
 */
export function rankResults(items, rawQuery) {
  const tokens = normalize(rawQuery).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  return items
    .map((item) => {
      let score = 0;
      for (const token of tokens) {
        const tokenScore = scoreToken(item, token);
        // One unmatched token disqualifies the item outright.
        if (!tokenScore) return null;
        score += tokenScore;
      }
      return { item, score };
    })
    .filter(Boolean)
    .sort(
      (first, second) =>
        second.score - first.score || first.item.label.localeCompare(second.item.label)
    )
    .map((entry) => ({ ...entry.item, score: entry.score }));
}

/**
 * Group ranked results for display, dropping kinds with nothing in them.
 *
 * Groups are ordered by their own best result, not by a fixed kind order. A fixed order
 * would bury a correct answer: searching "tourism" ranks the Tourism *page* above every
 * section, but a fixed Sections-before-Pages order would still print ten sections above
 * the page the reader asked for. Ordering each group by its top hit means the group most
 * likely to hold the answer comes first, while `RESULT_GROUPS` still breaks ties, so a
 * query matching a section and a page equally keeps sections ahead of pages.
 */
export function groupResults(results) {
  return RESULT_GROUPS.map((group) => ({
    ...group,
    items: results.filter((result) => result.kind === group.kind),
  }))
    .filter((group) => group.items.length > 0)
    .map((group, index) => ({ ...group, best: group.items[0].score, rank: index }))
    .sort((first, second) => second.best - first.best || first.rank - second.rank)
    .map(({ best: _best, rank: _rank, ...group }) => group);
}
