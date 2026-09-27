import BarChart from '../../../components/charts/BarChart';
import { toSeries } from '../../../theme/chartPalette';
import { ECONOMY_WIDE_CHART_HEIGHT, ECONOMY_WIDE_PANELS } from '../constants';

/**
 * One component, one panel.
 *
 * The series is passed as a single-colour `color` rather than through `series`,
 * because `series` with one entry would widen every bar to fill its whole slot.
 * There is no legend either: the panel is titled with the component it shows, so a
 * legend would repeat the title and, with no multi-series colour to read, its swatch
 * would have nothing to show.
 */
/**
 * Where a panel's rule goes, by its position in the 2x2.
 *
 * The grid carries no gap; each panel pads its own side instead, so a rule is
 * equidistant from the two charts it divides. A rule drawn inside a gap sits off to
 * one side of the space and reads as a stray line rather than as a division.
 *
 * Half the padding is on the chart's side and half on the rule's, and the outermost
 * edges take none — a rule at the outside edge of the grid would box the section in.
 */
const PANEL_RULES = [
  'py-2 md:pr-3', // top left
  'border-t py-2 md:border-t-0 md:border-l md:pl-3', // top right
  'border-t py-2 md:pr-3', // bottom left
  'border-t py-2 md:border-l md:pl-3', // bottom right
];

function Panel({ panel, rows, position }) {
  const color = toSeries([{ key: panel.key, label: panel.label }])[0].color;
  return (
    <div
      className={`flex min-h-0 flex-col border-nepal-crimson/45 ${PANEL_RULES[position] ?? PANEL_RULES[0]}`}
    >
      <div className="mb-1 shrink-0">
        <h3 className="text-sm font-bold text-onSurface">{panel.label}</h3>
        <p className="text-xs text-onSurface-variant">{panel.note}</p>
      </div>
      {/* A definite height below md, where the panels stack and the grid has no
          fixed box to divide up; the chart draws against the grid's own row height
          from md up. `height="100%"` needs one or the other, never neither. */}
      <div className="h-[260px] md:h-auto md:min-h-0 md:flex-1">
        <BarChart
          data={rows}
          xKey="fiscal_year"
          labelKey="fiscal_year"
          valueKey={panel.key}
          color={color}
          height="100%"
          showValueLabels
          showLegend={false}
          bordered={false}
          labelFormatter={(value) => value}
        />
      </div>
    </div>
  );
}

/**
 * Economy-wide growth: the four component series, per fiscal year.
 *
 * They are drawn one per panel rather than as four lines on one axis because they
 * are not four peers. The source's "Overall" rows report two overlapping cuts:
 * agriculture and non-agriculture partition the economy, while industry and
 * service sit inside non-agriculture. A shared axis served all four badly —
 * agriculture only ever moves between 2.35% and 5.16% while the other three reach
 * 10.7% and fall to -4.53%, so agriculture was drawn across 15-34% of the plot
 * height and the steadiest series on the page read as the one doing nothing.
 * On its own axis it spans 46-100%, and the layout stops implying a set of four
 * parts that does not exist.
 *
 * A crimson rule runs between the four panels, so the 2x2 reads as four charts
 * rather than as one field with gaps in it. That matters more here than it would
 * elsewhere: a shared-looking field invites the reading the source does not support,
 * that these are four things measured against each other.
 *
 * The rule is the brand crimson rather than a hairline grey, which is a departure
 * worth naming. Grey would have been the quieter choice, and the crimson is held at
 * partial opacity so it still reads as structure, but it does share a hue with the
 * deficit series. Keep it a thin rule and leave the value labels to carry the data.
 *
 * The 2x2 grid carries the structure: row one is the partition, row two is the
 * composition inside non-agriculture. Bars carry their value so a short bar is
 * never a less readable one, and the zero line matters throughout because 2019/20
 * put all three non-agricultural components into contraction.
 */
function EconomyWideSection({ view }) {
  const rows = view.economy.economyWideRows;
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 ${ECONOMY_WIDE_CHART_HEIGHT}`}>
      {ECONOMY_WIDE_PANELS.map((panel, position) => (
        <Panel key={panel.id} panel={panel} rows={rows} position={position} />
      ))}
    </div>
  );
}

export const ECONOMY_WIDE_SECTION = {
  id: 'overall',
  subtitle: () => 'Real growth by component, one panel per component, by fiscal year',
  action: () => null,
  content: EconomyWideSection,
};
