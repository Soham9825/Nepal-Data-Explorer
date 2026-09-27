/**
 * Static configuration for the Tourism dashboard.
 *
 * Nothing here depends on data or React state, so it is kept in one place and
 * imported by whichever module needs it. See `format.js` for the pure formatting
 * helpers and `hooks/` for the state and derivations.
 */

/** The four tabs of the dashboard, in the order they appear in the tab bar. */
export const TABS = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Headline tourism performance',
    icon: 'space_dashboard',
  },
  {
    id: 'markets',
    label: 'Source markets',
    description: 'Where visitors come from',
    icon: 'public',
  },
  {
    id: 'profile',
    label: 'Visitor profile',
    description: 'Activities and visitor characteristics',
    icon: 'groups',
  },
  {
    id: 'destinations',
    label: 'Destinations',
    description: 'Province-level destination records',
    icon: 'location_on',
  },
];

/** The tab opened on arrival and the one a `?section=` deep link falls back to. */
export const DEFAULT_TAB = 'overview';

export const RANGE_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: '10', label: '10Y' },
  { id: '5', label: '5Y' },
];

/**
 * Ranked lists cap the visible rows and scroll the remainder. Each RankedBars row
 * is 36px (20px label line + 6px row gap + 10px bar) with 12px between rows, so
 * five rows need 5 * 36 + 4 * 12 = 228px and six rows need 6 * 36 + 5 * 12 = 276px.
 * The class strings stay literal so Tailwind can generate them.
 */
export const RANKED_BAR_MAX_H = {
  5: 'max-h-[14.25rem]',
  6: 'max-h-[17.25rem]',
};

export const PURPOSE_VISIBLE_ROWS = 6;
export const AGE_VISIBLE_ROWS = 6;
export const TREKKING_VISIBLE_ROWS = 6;
export const TREKKING_LEADERS = 3;

/**
 * Every chart colour on this page comes from the shared semantic palette, so a
 * meaning keeps the same colour here and on any other page. See
 * `src/theme/colors.js` before adding a new hue. The only exception is the
 * destination trend, which plots one line per destination and therefore needs
 * the shared categorical ramp.
 */

/** Spellings the source uses for a market, mapped to the one we display. */
export const MARKET_NAME_ALIASES = {
  'U.S.A.': 'United States',
  USA: 'United States',
  US: 'United States',
  'U.K.': 'United Kingdom',
  UK: 'United Kingdom',
  'South Korea': 'South Korea',
  'Republic of Korea': 'South Korea',
};

/** Source order for the age bands; anything unlisted sorts last. */
export const AGE_ORDER = ['0-15', '16-30', '31-45', '46-60', '60+', 'Not_Specified'];

/** Anchors every tourism line chart at zero with an open top end. */
export const ZERO_DOMAIN = [0, null];

/** A stable empty array, so `data.list || EMPTY_ARRAY` keeps referential equality. */
export const EMPTY_ARRAY = [];
