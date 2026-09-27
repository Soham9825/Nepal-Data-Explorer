/** D3 category10. Ordered most- to least-contrasty for 2px strokes on white. */
export const CATEGORICAL_PALETTE = [
  '#1F77B4', // blue
  '#B70011', // brand red
  '#2CA02C', // green
  '#FF7F0E', // orange
  '#9467BD', // purple
  '#17BECF', // cyan
  '#8C564B', // brown
  '#BCBD22', // olive
  '#E377C2', // pink
  '#7F7F7F', // grey
];

/** Colour used for every non-highlighted series while a chart/legend is hovered. */
export const MUTED_SERIES_COLOR = '#D0D5DD';

/** Semantic slots that should never be taken by a cycling categorical colour. */
export const SEMANTIC_SERIES = {
  exports: '#2CA02C',
  imports: '#B70011',
  deficit: '#B70011',
};

export const PROVINCE_COLORS = {
  Koshi: '#9a6800',
  Madhesh: '#dc2626',
  Bagmati: '#b70011',
  Gandaki: '#316bf3',
  Lumbini: '#0051d5',
  Karnali: '#5c403c',
  Sudurpashchim: '#7a5100',
};

/**
 * Fixed colours for entities that show up in more than one chart on a page.
 * Anything not listed here is coloured by `buildSeriesScale` instead.
 */
export const ENTITY_COLOR_HINTS = {
  // Global economies / trade partners
  'Advanced Economies': '#1F77B4',
  China: '#B70011',
  India: '#FF7F0E',
  Japan: '#9467BD',
  USA: '#2CA02C',
  'Euro Area': '#17BECF',
  'Emerging Asia': '#8C564B',
  'Developing Countries': '#BCBD22',
  'Other Countries': '#7F7F7F',
  'Other countries': '#7F7F7F',
  // Economy-wide growth components
  Agriculture: '#2CA02C',
  'Non-agriculture': '#1F77B4',
  Industry: '#B70011',
  Service: '#FF7F0E',
  // Provinces, so a province keeps the map's colour on every chart
  ...PROVINCE_COLORS,
};

/**
 * Deterministically map a list of series names to colours.
 *
 * Hinted names claim their fixed colour first so that colour pairing is stable
 * across charts. Remaining names walk the palette in order, skipping colours
 * already taken; only when the palette is exhausted do colours repeat.
 *
 * @param {string[]} names
 * @param {{ palette?: string[], hints?: Record<string, string> }} [options]
 * @returns {{ colorFor: (name: string) => string, colors: Record<string, string> }}
 */
export function buildSeriesScale(names, options = {}) {
  const { palette = CATEGORICAL_PALETTE, hints = ENTITY_COLOR_HINTS } = options;
  const unique = Array.from(new Set(names.filter((name) => name != null && name !== '')));
  const colors = {};
  const taken = new Set();

  unique.forEach((name) => {
    const hinted = hints[name];
    if (hinted) {
      colors[name] = hinted;
      taken.add(hinted);
    }
  });

  let cursor = 0;
  unique.forEach((name) => {
    if (colors[name]) return;
    let color = palette[cursor % palette.length];
    for (let step = 0; step < palette.length && taken.has(color); step += 1) {
      color = palette[(cursor + step + 1) % palette.length];
    }
    colors[name] = color;
    taken.add(color);
    cursor += 1;
  });

  return {
    colorFor: (name) => colors[name] || palette[0],
    colors,
  };
}

/** Build a LineChart/BarChart `series` array from shared key/label pairs. */
export function toSeries(entries, options = {}) {
  const scale = buildSeriesScale(
    entries.map((entry) => entry.label || entry.key),
    options
  );
  return entries.map((entry) => ({
    ...entry,
    key: entry.key ?? entry.label,
    label: entry.label ?? entry.key,
    color: entry.color || scale.colorFor(entry.label || entry.key),
  }));
}
