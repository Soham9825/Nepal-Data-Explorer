/**
 * Lightweight province metadata for places that only need a name, capital, and
 * map id — search results, for example.
 *
 * Deliberately separate from `provincePaths.js`, which is ~90 KB of SVG path
 * data. Importing that into the top bar would pull the whole map geometry into
 * the main bundle for seven strings.
 *
 * The `id` values are the same shape ids used by `PROVINCE_PATHS` and by the
 * `/provinces/:id` route, so a search result can navigate straight to a province.
 * `provinces.test.js` asserts this list stays in step with `PROVINCE_PATHS`.
 */
export const PROVINCES = [
  { id: 1, name: 'Koshi', hq: 'Biratnagar' },
  { id: 2, name: 'Madhesh', hq: 'Janakpur' },
  { id: 3, name: 'Bagmati', hq: 'Hetauda' },
  { id: 4, name: 'Gandaki', hq: 'Pokhara' },
  { id: 5, name: 'Lumbini', hq: 'Deukhuri' },
  { id: 6, name: 'Karnali', hq: 'Birendranagar' },
  { id: 7, name: 'Sudurpashchim', hq: 'Godawari' },
];

export function findProvince(name) {
  return PROVINCES.find((province) => province.name === name) || null;
}
