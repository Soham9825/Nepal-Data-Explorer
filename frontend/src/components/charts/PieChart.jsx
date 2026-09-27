/**
 * A donut chart, with an optional ranked legend and centre figure.
 *
 * The slices encode share of a whole, so this suits part-to-whole data — what a
 * category contributes to a total — and suits nothing else. A ranking or a series
 * over time wants a bar or a line, where length along a shared axis can be compared
 * directly; a slice's angle cannot be compared as accurately, and the difference
 * between a 12% and a 14% slice is a judgement call where two bars are not.
 *
 * The legend and the centre figure are opt-in. With thirteen slices the colours
 * alone say nothing about which slice is which, so anything past a few slices needs
 * the legend beside it; the hole in the middle is otherwise dead space, and the total
 * is the one figure a part-to-whole chart should put in front of the reader.
 *
 * A single slice taking the whole circle is drawn as a near-complete arc: an SVG arc
 * whose endpoints coincide is dropped as degenerate, which would render a 100% slice
 * as a broken sliver instead of a full ring.
 */
export default function PieChart({
  data,
  legend = false,
  legendTitle = null,
  centerValue = null,
  centerLabel = null,
  size = 'w-48 h-48',
  // 'below' or 'right'. Chosen by the caller rather than by a viewport breakpoint,
  // because a chart in a narrow column of a wide page still gets the wide-page
  // breakpoint, and a legend laid out beside the donut there has nowhere to go.
  legendSide = 'below',
  ariaLabel = 'Composition chart',
  valueFormatter = (value) => value.toFixed(1),
}) {
  const slices = data.filter((item) => Number(item.value) > 0);
  const total = slices.reduce((sum, item) => sum + Number(item.value), 0);

  if (!slices.length || total <= 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-onSurface-variant">
        No data available
      </div>
    );
  }

  // Each slice starts where the last one ended, so the angles are laid out in the
  // order given rather than sorted here: a caller that has already ranked its data
  // has more context for the order than this chart does.
  let currentAngle = 0;
  const wedges = slices.map((item) => {
    const angle = Math.min((item.value / total) * 360, 359.999);
    const startAngle = currentAngle;
    currentAngle += angle;
    return { ...item, startAngle, angle, share: (item.value / total) * 100 };
  });

  // Without a legend the chart is the fixed square it has always been, because a
  // caller may overlay its own centre figure on top and positions it against this
  // box. The row layout exists only to make room for the legend.
  const rootClass = legend
    ? `flex h-full min-h-0 w-full gap-4 ${
        legendSide === 'right' ? 'flex-col sm:flex-row sm:items-center' : 'flex-col'
      }`
    : 'relative';
  const donutClass = legend ? `relative shrink-0 ${size}` : `relative ${size}`;

  return (
    <div className={rootClass}>
      <div className={donutClass}>
        <svg className="h-full w-full" viewBox="0 0 100 100" role="img" aria-label={ariaLabel}>
          {wedges.map((item) => {
            const x1 = 50 + 40 * Math.cos(((item.startAngle - 90) * Math.PI) / 180);
            const y1 = 50 + 40 * Math.sin(((item.startAngle - 90) * Math.PI) / 180);
            const x2 = 50 + 40 * Math.cos(((item.startAngle + item.angle - 90) * Math.PI) / 180);
            const y2 = 50 + 40 * Math.sin(((item.startAngle + item.angle - 90) * Math.PI) / 180);
            const largeArc = item.angle > 180 ? 1 : 0;

            return (
              <path
                key={item.label}
                d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                fill={item.color}
                stroke="#fff"
                strokeWidth="1"
                className="transition-opacity duration-200 hover:opacity-80"
              />
            );
          })}
          <circle cx="50" cy="50" r="26" fill="white" />
        </svg>

        {centerValue !== null ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold leading-none text-onSurface tabular-nums">
              {centerValue}
            </span>
            {centerLabel ? (
              <span className="mt-1 max-w-[70%] text-center text-[10px] leading-3 text-onSurface-variant">
                {centerLabel}
              </span>
            ) : null}
          </div>
        ) : (
          <circle cx="50" cy="50" r="20" fill="white" />
        )}
      </div>

      {legend ? (
        <ul className="min-h-0 min-w-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {legendTitle ? (
            <li className="text-xs font-semibold text-onSurface-variant">{legendTitle}</li>
          ) : null}
          {wedges.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-onSurface">{item.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-onSurface">
                {valueFormatter(item.share)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
