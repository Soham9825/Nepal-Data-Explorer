/**
 * Static configuration for the Economic dashboard.
 *
 * Nothing here depends on data or React state, so it is kept in one place and
 * imported by whichever module needs it. See `format.js` for the pure formatting
 * helpers, `series.js` for how the payload is parsed, and `hooks/` for state.
 */
import { CATEGORICAL_PALETTE, SEMANTIC_SERIES } from '../../theme/chartPalette';
import { API_BASE_URL } from '../../config';

/** One request returns every economic series the page draws. */
export const ECONOMIC_API = `${API_BASE_URL}/api/analytics/economic/?compact=1`;

/**
 * Series colours.
 *
 * Exports and imports borrow the shared semantic tokens so a trade flow keeps its
 * meaning on the bar chart, the KPI cards and the trade balance alike. The rest
 * are page-local hues with no meaning attached to them, only separation.
 */
export const COLORS = {
  primary: '#0051d5',
  accent: '#7a5100',
  danger: SEMANTIC_SERIES.imports,
  success: SEMANTIC_SERIES.exports,
};

/** Accent tops for the GDP KPI cards, which are read as a group rather than as series. */
export const GDP_CARD_COLORS = {
  current: '#0051d5',
  constant: '#316bf3',
  perCapita: '#0f7a3d',
  growth: '#b70011',
};

/** Product bars on the producer-price section cycle the shared categorical ramp. */
export const SECTOR_PALETTE = CATEGORICAL_PALETTE;

/**
 * The height every ordinary chart is drawn at.
 *
 * One height for the whole page is what lets two sections share a row: paired cards
 * stretch to the taller of the two, so a pair only lines up if the charts inside
 * them agree. The two sections that genuinely need more room take the full row to
 * themselves and override this.
 */
export const CHART_HEIGHT = 'h-[380px]';

/**
 * The ten sections, in reading order.
 *
 * Which tab a section belongs to is not stated here — `TABS` below owns that, by
 * listing the section ids each tab draws. This list only names them and supplies
 * the card title, so a section is never titled twice in two places.
 */
export const SECTION_CATALOG = [
  { id: 'sectoral', label: 'Sectoral Growth' },
  { id: 'overall', label: 'Economy-wide Growth' },
  { id: 'growth', label: 'World Output Growth' },
  { id: 'economies', label: 'Global Economies' },
  { id: 'trade', label: 'Foreign Trade' },
  { id: 'partners', label: 'Trade by Partner' },
  { id: 'balance', label: 'Trade Balance' },
  { id: 'salary', label: 'Salary & Wage Rate' },
  { id: 'appi', label: 'Agri Producer Prices' },
  { id: 'appi_table', label: 'Producer Price Data' },
  { id: 'province', label: 'Province GDP' },
];

/**
 * The four tabs of the dashboard, in the order they appear in the tab bar.
 *
 * A tab is a set of `rows` of section ids, and the tab panel draws them in order.
 * Rows never straddle two tabs, which is what lets a tall section own a full row
 * without unbalancing a pair, and it means a reader who opens a tab finds the whole
 * of that subject together rather than one part of it stranded elsewhere.
 *
 * Two sections share a row only when both are drawn at `CHART_HEIGHT` and both
 * read at half width. `sectoral` (18 long sector names) and `province` (a
 * seven-series panel) are taller, so they sit alone on height alone; the trade
 * partner and balance charts are standard height but are paired on neither, because
 * half of the tab's width is what makes the grouped partner bars and their legend
 * unreadable. A section that would rather have the width asks for its own row, and
 * a row is a layout decision rather than a height one.
 */
export const TABS = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Headline growth, sector by sector and in total',
    icon: 'space_dashboard',
    // The KPI strip belongs to this tab alone: it summarises the whole economy,
    // which is what the Overview tab is for.
    showKpis: true,
    // Domestic only. World output and the global economies are context for the
    // whole planet rather than a reading of Nepal's own economy, and on this tab
    // they sat below the domestic charts as the last two rows, where they looked
    // like more Nepal. They have their own tab now.
    //
    // Economy-wide growth leads, because it is the tab's headline: the four
    // components of the whole economy, each on its own axis, read at a glance.
    // Sectoral growth is the same story broken down, and it asks the reader to pick
    // a group before it says anything, so it reads as the detail under the summary
    // rather than as the first thing on the page.
    rows: [['overall'], ['sectoral']],
  },
  {
    id: 'trade',
    label: 'Trade',
    description: 'Exports, imports and the balance between them',
    icon: 'swap_horiz',
    // The partner chart and the balance chart each take a full row rather than
    // sharing one. The partner chart is three partners across every fiscal year as
    // grouped bars under a top legend, and at half width the year labels collided
    // and the legend had nowhere to go; the balance chart is a single line whose
    // whole reading is how far below zero it sits, which is worth the width. Pairing
    // them put the tab's two most-read charts at their worst size to save one row.
    rows: [['trade'], ['partners'], ['balance']],
  },
  {
    id: 'prices',
    label: 'Prices & Wages',
    description: 'What things cost and what workers earn',
    icon: 'payments',
    rows: [['salary'], ['appi'], ['appi_table']],
  },
  {
    id: 'regions',
    label: 'Regions',
    description: 'Province-wise output and growth',
    icon: 'public',
    rows: [['province']],
  },
  {
    id: 'global',
    label: 'Global',
    description: 'How the world and its economies are growing',
    icon: 'language',
    // Each chart takes a full row rather than sharing one. Both are multi-series
    // line charts of foreign economies, and at half width the series labels crowd
    // each other and the year axis has too little room to stay readable; the
    // economies chart alone carries a dozen-odd series.
    rows: [['growth'], ['economies']],
  },
];

export const DEFAULT_TAB = 'overview';

export const TAB_BY_ID = TABS.reduce((byId, tab) => {
  byId[tab.id] = tab;
  return byId;
}, {});

/**
 * The DOM id a section carries, so a deep link can scroll to it.
 *
 * Only the panel needs this: with one tab open at a time there is no in-page
 * navigation to keep in step, so the ids exist purely for `?section=` links.
 */
export const SECTION_ELEMENT_PREFIX = 'economic-';

export const sectionElementId = (sectionId) => `${SECTION_ELEMENT_PREFIX}${sectionId}`;

/** Period picker shared by the three time series that offer one. */
export const RANGE_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: '10', label: '10 years' },
  { id: '5', label: '5 years' },
];

export const DEFAULT_RANGE = 'all';

/** Export / import toggle on the trade-by-partner section. */
export const PARTNER_VIEWS = [
  { id: 'exports', label: 'Exports' },
  { id: 'imports', label: 'Imports' },
];

export const DEFAULT_PARTNER_VIEW = 'exports';

/** Partner columns of the trade-by-partner series, in source order. */
export const PARTNER_KEYS = ['India', 'China', 'Other Countries'];

/** Components the economy-wide growth chart plots, in legend order. */
export const ECONOMY_WIDE_SERIES = [
  { key: 'agriculture', label: 'Agriculture' },
  { key: 'nonagriculture', label: 'Non-agriculture' },
  { key: 'industry', label: 'Industry' },
  { key: 'service', label: 'Service' },
];

/**
 * The same four components, one panel each.
 *
 * The source's "Overall" rows are two overlapping cuts, not four parts of a total:
 * agriculture and non-agriculture partition the economy between them, while
 * industry and service sit *inside* non-agriculture. Drawn as four lines on one
 * axis the chart implied they were peers, and that shared scale also hid the one
 * thing worth reading. Agriculture only ever moves between 2.35% and 5.16% while
 * the other three reach 10.7% and fall to -4.53%, so agriculture was drawn across
 * 15-34% of the plot height and read as inert when it was in fact the steadiest
 * series on the page. Giving it a panel of its own takes it to 46-100%, which is
 * the difference between a flat line and a readable one.
 *
 * Pairing agriculture with non-agriculture instead of isolating it does not work:
 * non-agriculture is 13.9 points wide against agriculture's 2.8, so a shared axis
 * leaves agriculture at 19-37% — no better than the four-line chart it replaced.
 *
 * The 2x2 grid is what carries the structure. Row one is the partition, row two is
 * the composition inside non-agriculture, so the nesting is readable without a
 * legend or an explanation. Keys are shared with ECONOMY_WIDE_SERIES so the CSV and
 * PDF export is unaffected.
 */
export const ECONOMY_WIDE_PANELS = [
  {
    id: 'agriculture',
    key: 'agriculture',
    label: 'Agriculture',
    note: 'Half of GDP. Never contracted in this period.',
  },
  {
    id: 'nonagriculture',
    key: 'nonagriculture',
    label: 'Non-agriculture',
    note: 'The other half. Contracted in 2019/20.',
  },
  {
    id: 'industry',
    key: 'industry',
    label: 'Industry',
    note: 'Inside non-agriculture. The most volatile of the four.',
  },
  {
    id: 'service',
    key: 'service',
    label: 'Service',
    note: 'Inside non-agriculture.',
  },
];

/**
 * Salary categories charted together.
 *
 * The source carries eleven groups but only these five are shown, because a line
 * chart stops separating them past roughly five and a chart that cannot tell its
 * lines apart is worse than a shorter one. The six not listed here — agricultural
 * labour, construction labour, industrial labour, army and police, private
 * organisations and public institutions — are still exported in the CSV.
 */
export const SALARY_GROUPS = [
  'Overall Index',
  'Wage Rate Index',
  'Government Service',
  'Education',
  'Bank & Financial Institutions',
];

/** Province panel loads and empties are centred in a box this tall. */ export const PROVINCE_PANEL_MIN_H =
  'min-h-[380px]';

export const PROVINCE_CHART_HEIGHT = 'h-[640px]';

/**
 * Compact room for the group summary and the ranked sector list.
 *
 * Sized for eighteen sectors in two columns of nine, which is what the source reports
 * today. The list scrolls inside the box if a year ever reports more, so a longer one
 * costs a scrollbar rather than a clipped sector.
 */
export const SECTORAL_SECTION_HEIGHT = 'h-[460px]';

/**
 * Colour per sectoral group, scoped to this section.
 *
 * Deliberately not the shared `ENTITY_COLOR_HINTS` steps. Those sit fine beside other
 * charts at line weight, but a sectoral bar is ten pixels tall on white, and at that
 * size #FF7F0E is 2.53:1 against the background — under the 3:1 that graphics are
 * meant to clear, so it reads as bright colour rather than as a measured value.
 *
 * Crimson, navy and amber are all at least 5:1 on white and stay at least 1.29 apart
 * from one another. They also survive a red/green split, which is why Agriculture is
 * amber here and not the green the shared palette gives it: crimson and green land on
 * nearly the same tone once red is not perceived, which is the commonest form of
 * colour blindness and would have made the two bars indistinguishable.
 */
export const SECTORAL_GROUP_COLORS = {
  Services: '#9F1239',
  Industry: '#1E3A8A',
  Agriculture: '#B45309',
};

/**
 * The summary strip above the sectoral chart.
 *
 * Its height is part of `SECTORAL_SECTION_HEIGHT`, not added on top of it: the strip
 * and the chart share one fixed box, so the chart gets whatever the strip leaves.
 */
export const SECTORAL_SUMMARY_HEIGHT = 'h-[44px]';

/**
 * Two rows of economy-wide panels, one row per cut of the data.
 *
 * Row one is agriculture beside non-agriculture, row two is industry beside
 * service, and the grid is what tells the reader which relationship they are
 * looking at. Each panel holds a single series, so it needs far less height than
 * a shared four-line chart did, but there are two rows of them.
 *
 * The height applies from `md` up, where the grid is the 2x2 it was sized for.
 * Below that the four panels stack, so the fixed height is dropped and each chart
 * takes its own — a 660px box split four ways would be 165px per panel.
 */
export const ECONOMY_WIDE_CHART_HEIGHT = 'md:h-[700px]';

/** The base the producer price index is measured against, named on the y-axis. */
export const APPI_BASE = 100;

/**
 * The aggregate the source reports beside the products. It is the whole index rather
 * than one product inside it, so the chart draws it first and heavier than the rest.
 */
export const APPI_OVERALL_LABEL = 'Overall Index';

/**
 * The products the source reports *inside* another product rather than beside it.
 * Wheat, Paddy and Maize are components of Cereals, and all sixteen products sum to
 * 134.09 rather than 100 — the thirteen that are not nested are the constituents.
 * Only Cereals nests here; the source carries no parent column, so this is written
 * out. Nested products are left out of the chart, but still exported in the CSV.
 */
export const APPI_NESTED_PRODUCTS = {
  Cereals: ['Wheat', 'Paddy', 'Maize'],
};

/** The same mapping flattened, for "is this product inside another one?". */
export const APPI_NESTED_PRODUCT_SET = new Set(Object.values(APPI_NESTED_PRODUCTS).flat());

/**
 * Lines on the producer price chart, the aggregate included. Weight picks them rather
 * than index level, because the heaviest products are what the index mostly moves with.
 */
export const APPI_SERIES_LINES = 5;

/**
 * Height reserved for a section before its chart mounts.
 *
 * A tab holds up to four sections and they are mounted as they scroll into view,
 * so the panel needs to know how much room each one will take before it is there —
 * otherwise the scrollbar jumps every time a section arrives. This is derived from
 * the same height constants the charts are drawn at, plus the card chrome around
 * them, so the two cannot drift apart.
 */
const CARD_CHROME_PX = 116;
const STANDARD_CHART_PX = 380;
const SECTORAL_SECTION_PX = 440;
const PROVINCE_CHART_PX = 640;
/**
 * Room for the producer price table with every group closed.
 *
 * `LazySection` applies this as a `minHeight`, not a height, so it only has to be
 * right for the state the table opens in. Fourteen rows is that state: the aggregate,
 * the thirteen top-level products, and no nested ones. Reserving the fully expanded
 * seventeen instead left roughly a hundred pixels of blank card under a collapsed
 * Cereals, which is the whole complaint.
 *
 * Because it is a minimum and not a cap, opening a group still grows the card to fit
 * its rows. That costs about a hundred pixels of scroll shift on a deliberate click,
 * which is a fair trade for not showing empty space the rest of the time.
 */
const APPI_TABLE_PX = 540;
const ECONOMY_WIDE_CHART_PX = 700;

/**
 * Which chart height each section is reserved at, keyed by section id.
 *
 * The pixel figures here and the Tailwind height classes the charts are drawn at
 * are two spellings of one number, and the class has to stay a literal for
 * Tailwind's scanner to find it — so nothing in the language keeps them equal, and
 * they did drift once already when the sectoral chart was resized and this table
 * was not.
 *
 * `appi` is absent on purpose: the producer price section is one ordinary-height
 * chart like the salary index beside it, so it takes the default.
 */
const RESERVED_CHART_PX = {
  appi_table: APPI_TABLE_PX,
  sectoral: SECTORAL_SECTION_PX,
  province: PROVINCE_CHART_PX,
  overall: ECONOMY_WIDE_CHART_PX,
};

/** The placeholder height, in pixels, for one section id. */
export const reservedSectionHeight = (sectionId) =>
  (RESERVED_CHART_PX[sectionId] ?? STANDARD_CHART_PX) + CARD_CHROME_PX;

/**
 * The series names printed on the generated PDF report. These are the formal
 * dataset titles rather than the tab labels, so the report reads as a document
 * listing what it covers.
 */
export const REPORT_INDICATORS = [
  'Sectoral Growth',
  'Economy-wide Growth',
  'World Output Growth',
  'Global Economies Growth',
  'Foreign Trade',
  'Trade by Partner',
  'Trade Balance',
  'Salary & Wage Rate Index',
  'Agriculture Producer Price Index',
  'Province-wise GDP Growth',
].join(', ');

/** A stable empty array, so `data.list || EMPTY_ARRAY` keeps referential equality. */
export const EMPTY_ARRAY = [];
