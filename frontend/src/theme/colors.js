/**
 * Semantic chart palette.
 *
 * A colour encodes what a series *means*, never which panel it happens to sit
 * in, so the same meaning keeps the same colour on every page. New charts pick
 * a token from this map instead of inventing a hex value.
 *
 * A chart that breaks down one subject paints all of its bars with that
 * subject's token. A per-row colour ramp is decoration rather than information,
 * so there is deliberately no ramp here: rank is already carried by order, bar
 * length and the printed value.
 *
 * A few tokens intentionally share a hue because they fill the same role — the
 * male split and the arrivals count are both "the primary quantity", and
 * not-specified values and neutral chrome are both "not the subject".
 */
export const SEMANTIC_COLORS = {
  // Dimension — the subject a chart breaks down.
  female: '#C8102E', // crimson
  male: '#2563EB', // blue
  total: '#101828', // dark neutral; an aggregate never reads as a peer of its parts
  activity: '#0F766E', // teal; tourism activity such as purpose, trekking and visits
  notSpecified: '#667085', // gray; reported as unknown rather than measured

  // Measure — what a series counts.
  arrivals: '#2563EB', // blue
  revenue: '#0F766E', // teal
  stay: '#B7791F', // gold; a duration in days

  // Role — a colour's job inside a single chart.
  highlight: '#C8102E', // crimson; the ranking a reader should scan first
  secondary: '#667085', // gray; supporting context behind the main series
  neutral: '#667085', // gray; axis, icon and empty-state chrome
};

/**
 * Categorical ramp for the one case a semantic token cannot cover: a chart that
 * plots several *peer* series at once, where the reader has to tell the lines
 * apart and no single meaning owns the colour. The destination trend is the
 * current example — each line is a different destination, and "which line is
 * which" is the whole question the chart answers.
 *
 * This is the only sanctioned exception to the no-ramp rule above, so it stays
 * ordered for maximum adjacent separation and is reused verbatim across every
 * multi-series chart rather than redefined per page. Single-subject charts must
 * still use one semantic token, not a slice of this.
 *
 * Cap a multi-series chart at a readable number of lines; if a chart needs more
 * series than the ramp can separate, facet it or chart the top few instead of
 * adding colours.
 */
export const CATEGORICAL_SERIES = [
  '#2563EB', // blue
  '#0F766E', // teal
  '#B7791F', // gold
  '#C8102E', // crimson
  '#7A5100', // dark gold
  '#4B5563', // gray
];

export default SEMANTIC_COLORS;
