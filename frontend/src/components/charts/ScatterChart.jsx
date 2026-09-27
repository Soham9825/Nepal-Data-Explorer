import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Module-level defaults so memoized values stay stable across renders.
const DEFAULT_DATA = [];
const DEFAULT_OPTIONS = { fit: true, guides: false, trail: false };

const TOOLTIP_MARGIN = 10;

// Pearson correlation coefficient for two series of equal length.
function pearsonCorrelation(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const denom = Math.sqrt(denX * denY);
  return denom === 0 ? null : num / denom;
}

function correlationLabel(r) {
  const abs = Math.abs(r);
  if (abs >= 0.7) return 'strong';
  if (abs >= 0.4) return 'moderate';
  if (abs >= 0.2) return 'weak';
  return 'negligible';
}

// Round a raw step up to a "nice" value (1/2/2.5/5 * power of ten) so tick
// labels read cleanly instead of showing long decimal fragments.
function niceStep(rawValue) {
  if (!(rawValue > 0) || !Number.isFinite(rawValue)) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawValue)));
  const normalized = rawValue / magnitude;
  const multiplier =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return multiplier * magnitude;
}

// Compact axis labels: 81234 -> "81.2K", 2400000 -> "2.4M", 0.25 -> "0.3".
function compactTick(value) {
  const trim = (text) => text.replace(/\.0+$/, '');
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${trim((value / 1e6).toFixed(2))}M`;
  if (abs >= 1e3) return `${trim((value / 1e3).toFixed(1))}K`;
  return Number(value.toFixed(1)).toLocaleString();
}

function fmt(n) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function deltaPct(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default function ScatterChart({
  data = DEFAULT_DATA,
  xKey = 'x',
  yKey = 'y',
  labelKey = xKey,
  xLabel = xKey,
  yLabel = yKey,
  color = '#0051d5',
  fitColor = '#b70011',
  height = 440,
  showControls = true,
  initialOptions = DEFAULT_OPTIONS,
}) {
  const W = 1000;
  const H = 470;
  const PAD_L = 74;
  const PAD_R = 28;
  const PAD_T = 26;
  const PAD_B = 58;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const [options, setOptions] = useState(initialOptions);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [pinnedIndex, setPinnedIndex] = useState(null);
  const [tip, setTip] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(null);
  const [playNonce, setPlayNonce] = useState(0);
  const progressRef = useRef(0);
  const playingRef = useRef(false);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

  const toggleOption = (key) => setOptions((prev) => ({ ...prev, [key]: !prev[key] }));

  // Points + least-squares fit + Pearson r, all computed from the raw rows.
  const model = useMemo(() => {
    const points = data
      .map((d) => ({ x: Number(d[xKey]), y: Number(d[yKey]), label: d[labelKey] }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (points.length < 2) return null;
    const n = points.length;
    const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
    const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
    let num = 0;
    let den = 0;
    for (const p of points) {
      num += (p.x - meanX) * (p.y - meanY);
      den += (p.x - meanX) * (p.x - meanX);
    }
    if (den === 0) return null;
    const slope = num / den;
    const intercept = meanY - slope * meanX;
    const rValue = pearsonCorrelation(
      points.map((p) => p.x),
      points.map((p) => p.y)
    );
    return {
      points,
      slope,
      intercept,
      r: Number.isFinite(Number(rValue)) ? Number(rValue) : null,
      minX: Math.min(...points.map((p) => p.x)),
      maxX: Math.max(...points.map((p) => p.x)),
      minY: Math.min(...points.map((p) => p.y)),
      maxY: Math.max(...points.map((p) => p.y)),
    };
  }, [data, xKey, yKey, labelKey]);

  // Derived analytics: means, per-point residuals, biggest outlier, and counts
  // per A/B mean quadrant.
  const analysis = useMemo(() => {
    if (!model) return null;
    const meanX = model.points.reduce((s, p) => s + p.x, 0) / model.points.length;
    const meanY = model.points.reduce((s, p) => s + p.y, 0) / model.points.length;
    const residuals = model.points.map((p) =>
      Math.abs(p.y - (model.slope * p.x + model.intercept))
    );
    const outlierIndex = residuals.length ? residuals.indexOf(Math.max(...residuals)) : null;
    const quadrants = { highHigh: 0, highLow: 0, lowHigh: 0, lowLow: 0 };
    model.points.forEach((p) => {
      const aboveX = p.x >= meanX;
      const aboveY = p.y >= meanY;
      if (aboveX && aboveY) quadrants.highHigh += 1;
      else if (!aboveX && aboveY) quadrants.lowHigh += 1;
      else if (!aboveX && !aboveY) quadrants.lowLow += 1;
      else quadrants.highLow += 1;
    });
    return { meanX, meanY, residuals, outlierIndex, quadrants };
  }, [model]);

  const xFor = useCallback(
    (x) => (model ? PAD_L + ((x - model.minX) / (model.maxX - model.minX || 1)) * innerW : 0),
    [model, innerW]
  );
  const yFor = useCallback(
    (y) =>
      model ? PAD_T + innerH - ((y - model.minY) / (model.maxY - model.minY || 1)) * innerH : 0,
    [model, innerH]
  );

  const xTicks = [];
  const yTicks = [];
  if (model) {
    const xStep = niceStep((model.maxX - model.minX) / 4 || 1);
    for (
      let v = Math.floor(model.minX / xStep) * xStep;
      v <= model.maxX + xStep * 1e-6;
      v += xStep
    ) {
      xTicks.push(v);
      if (xTicks.length > 9) break;
    }
    const yStep = niceStep((model.maxY - model.minY) / 4 || 1);
    for (
      let v = Math.floor(model.minY / yStep) * yStep;
      v <= model.maxY + yStep * 1e-6;
      v += yStep
    ) {
      yTicks.push(v);
      if (yTicks.length > 9) break;
    }
  }

  const positionTooltip = useCallback(() => {
    const point = model?.points[hoverIndex];
    if (hoverIndex == null || !point || !containerRef.current || !tooltipRef.current) {
      setTip((prev) => (prev === null ? prev : null));
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const box = tooltipRef.current.getBoundingClientRect();
    const px = (xFor(point.x) / W) * rect.width;
    const py = (yFor(point.y) / H) * rect.height;
    const half = box.width / 2;
    const left = Math.min(
      Math.max(px, half + TOOLTIP_MARGIN),
      Math.max(half + TOOLTIP_MARGIN, rect.width - half - TOOLTIP_MARGIN)
    );
    const flipBelow = py - box.height - 12 < TOOLTIP_MARGIN;
    const top = Math.min(
      Math.max(flipBelow ? py + 14 : py - box.height - 12, TOOLTIP_MARGIN),
      Math.max(TOOLTIP_MARGIN, rect.height - box.height - TOOLTIP_MARGIN)
    );
    setTip((prev) =>
      prev && prev.left === left && prev.top === top && prev.flipBelow === flipBelow
        ? prev
        : { left, top, flipBelow }
    );
  }, [hoverIndex, model, xFor, yFor]);

  useEffect(() => {
    positionTooltip();
  }, [positionTooltip, data]);

  useEffect(() => {
    if (hoverIndex == null) return undefined;
    const handle = () => positionTooltip();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [hoverIndex, positionTooltip]);

  // New data -> clear hover / pinned selections so indices never point at the wrong rows.
  useEffect(() => {
    setHoverIndex(null);
    setPinnedIndex(null);
  }, [data]);

  // Trail geometry: consecutive points as pixel segments + cumulative length so the
  // playhead can be parametrized by a single 0..1 progress value.
  const trailGeom = useMemo(() => {
    if (!model) return null;
    const pts = model.points.map((p) => ({ x: xFor(p.x), y: yFor(p.y), label: p.label }));
    const segLen = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      segLen.push(l);
      total += l;
    }
    return { pts, segLen, total: total || 1 };
  }, [model, xFor, yFor]);

  // Walk t (0..1) along the polyline and return the on-path position, the segment
  // being traversed, and the closest period label.
  const pointAt = useCallback(
    (t) => {
      const g = trailGeom;
      if (!g) return null;
      let dist = Math.max(0, Math.min(1, t)) * g.total;
      const last = g.segLen.length - 1;
      for (let i = 0; i <= last; i++) {
        const seg = g.segLen[i];
        if (dist <= seg || i === last) {
          const f = seg === 0 ? 0 : dist / seg;
          const a = g.pts[i];
          const b = g.pts[i + 1];
          return {
            x: a.x + (b.x - a.x) * f,
            y: a.y + (b.y - a.y) * f,
            index: i,
            label: f >= 0.5 ? b.label : a.label,
          };
        }
        dist -= seg;
      }
      return {
        x: g.pts[last + 1].x,
        y: g.pts[last + 1].y,
        index: last + 1,
        label: g.pts[last + 1].label,
      };
    },
    [trailGeom]
  );

  // Restart the trail playback whenever the geometry or the trail toggle changes.
  useEffect(() => {
    if (!trailGeom) return undefined;
    progressRef.current = 0;
    setPlayhead(pointAt(0));
    return undefined;
  }, [trailGeom, options.trail, pointAt]);

  // rAF playback loop: advances the playhead between periods and STOPS when it
  // reaches the destination. Toggling the trail (or pressing Play) restarts it.
  useEffect(() => {
    if (!options.trail || !trailGeom) return undefined;
    playingRef.current = true;
    setPlaying(true);
    const SPEED = 0.00015; // fraction of the trail per millisecond (~7s full run)
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = now - last;
      last = now;
      if (playingRef.current) {
        progressRef.current = Math.min(1, progressRef.current + dt * SPEED);
        setPlayhead(pointAt(progressRef.current));
        if (progressRef.current >= 1) {
          playingRef.current = false;
          setPlaying(false);
          return; // reached the destination -> stop, do not loop
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setPlaying(false);
    };
  }, [options.trail, trailGeom, pointAt, playNonce]);

  const pinnable = model && analysis && pinnedIndex != null ? model.points[pinnedIndex] : null;

  if (!model || !analysis) {
    return (
      <div
        className="flex items-center justify-center text-sm text-onSurface-variant"
        style={{
          height,
          width: '100%',
          border: '1px solid #e2e2e2',
          color: '#8a8a8a',
          fontFamily: "'Hanken Grotesk', sans-serif",
        }}
      >
        Not enough variation to plot {xLabel} vs {yLabel}
      </div>
    );
  }

  const hoveredPoint = model.points[hoverIndex];
  const rAbs = model.r != null ? Math.abs(model.r) : null;
  const rStrength = rAbs != null ? correlationLabel(model.r) : 'unavailable';
  const fitY1 = yFor(model.slope * model.minX + model.intercept);
  const fitY2 = yFor(model.slope * model.maxX + model.intercept);
  const trailSegments = model.points.slice(1).map((p, i) => {
    const prev = model.points[i];
    return { x1: xFor(prev.x), y1: yFor(prev.y), x2: xFor(p.x), y2: yFor(p.y) };
  });

  // Portion of the trail already "watched" by the playhead, drawn as an accent path.
  const coveredPath =
    options.trail && playhead && trailGeom
      ? (() => {
          let d = `M ${trailGeom.pts[0].x} ${trailGeom.pts[0].y}`;
          for (let i = 1; i <= playhead.index; i++)
            d += ` L ${trailGeom.pts[i].x} ${trailGeom.pts[i].y}`;
          d += ` L ${playhead.x} ${playhead.y}`;
          return d;
        })()
      : null;

  const quadrantChips = [
    { key: 'highHigh', label: `High ${xLabel} · High ${yLabel}`, bg: '#eef3ee', fg: '#1b7f3b' },
    { key: 'lowHigh', label: `Low ${xLabel} · High ${yLabel}`, bg: '#fdf3e7', fg: '#9a5b00' },
    { key: 'lowLow', label: `Low ${xLabel} · Low ${yLabel}`, bg: '#eef0f4', fg: '#5a6472' },
    { key: 'highLow', label: `High ${xLabel} · Low ${yLabel}`, bg: '#e9f1fb', fg: '#0051d5' },
  ];

  return (
    <div className="w-full" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
      {showControls && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => toggleOption('fit')}
            aria-pressed={options.fit}
            className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
              options.fit
                ? 'border-transparent text-white'
                : 'border-outline-variant bg-white text-onSurface-variant hover:bg-surface-highest'
            }`}
            style={options.fit ? { backgroundColor: fitColor } : undefined}
          >
            Fit line
          </button>
          <button
            type="button"
            onClick={() => toggleOption('guides')}
            aria-pressed={options.guides}
            className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
              options.guides
                ? 'border-transparent text-white'
                : 'border-outline-variant bg-white text-onSurface-variant hover:bg-surface-highest'
            }`}
            style={options.guides ? { backgroundColor: '#334155' } : undefined}
          >
            Avg guides
          </button>
          <button
            type="button"
            onClick={() => toggleOption('trail')}
            aria-pressed={options.trail}
            className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
              options.trail
                ? 'border-transparent text-white'
                : 'border-outline-variant bg-white text-onSurface-variant hover:bg-surface-highest'
            }`}
            style={options.trail ? { backgroundColor: '#64748b' } : undefined}
          >
            Time trail
          </button>
          {options.trail && trailGeom && (
            <button
              type="button"
              onClick={() => {
                if (playingRef.current) {
                  playingRef.current = false;
                  setPlaying(false);
                } else {
                  if (progressRef.current >= 1) {
                    progressRef.current = 0;
                    setPlayhead(pointAt(0));
                  }
                  playingRef.current = true;
                  setPlaying(true);
                  setPlayNonce((n) => n + 1);
                }
              }}
              className="flex items-center gap-1.5 rounded-sm border border-outline-variant bg-white px-3 py-1.5 text-xs font-semibold text-onSurface-variant transition-colors hover:bg-surface-highest"
            >
              {playing ? 'Pause' : '▶ Play'}
            </button>
          )}
          <span className="ml-auto text-xs font-semibold text-onSurface-variant">
            Hover a dot · click to pin
          </span>
        </div>
      )}

      <div ref={containerRef} className="relative w-full">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: 'block' }}>
          <defs>
            <marker
              id="scatter-trail-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
          </defs>

          {yTicks.map((t) => (
            <g key={`y-${t}`}>
              <line
                x1={PAD_L}
                y1={yFor(t)}
                x2={W - PAD_R}
                y2={yFor(t)}
                stroke="#EDEFF3"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD_L - 10}
                y={yFor(t) + 4}
                fontSize="11"
                fill="#5A6472"
                fontWeight="600"
                textAnchor="end"
              >
                {compactTick(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g key={`x-${t}`}>
              <line
                x1={xFor(t)}
                y1={PAD_T}
                x2={xFor(t)}
                y2={H - PAD_B}
                stroke="#EDEFF3"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={xFor(t)}
                y={H - PAD_B + 18}
                fontSize="11"
                fill="#5A6472"
                fontWeight="600"
                textAnchor="middle"
              >
                {compactTick(t)}
              </text>
            </g>
          ))}
          <line
            x1={PAD_L}
            y1={H - PAD_B}
            x2={W - PAD_R}
            y2={H - PAD_B}
            stroke="#CBD5E1"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={PAD_L}
            y1={PAD_T}
            x2={PAD_L}
            y2={H - PAD_B}
            stroke="#CBD5E1"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={PAD_L + innerW / 2}
            y={H - 8}
            fontSize="12"
            fill="#39424E"
            fontWeight="600"
            textAnchor="middle"
          >
            {xLabel}
          </text>
          <text
            x={14}
            y={PAD_T + innerH / 2}
            fontSize="12"
            fill="#39424E"
            fontWeight="600"
            textAnchor="middle"
            transform={`rotate(-90 14 ${PAD_T + innerH / 2})`}
          >
            {yLabel}
          </text>

          {/* Average guide lines split the plot into four mean quadrants */}
          {options.guides && (
            <g>
              <line
                x1={xFor(analysis.meanX)}
                y1={PAD_T}
                x2={xFor(analysis.meanX)}
                y2={H - PAD_B}
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="4 4"
                strokeOpacity="0.5"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={xFor(analysis.meanX) + 6}
                y={PAD_T + 14}
                fontSize="10"
                fontWeight="700"
                fill="#334155"
              >
                avg
              </text>
              <line
                x1={PAD_L}
                y1={yFor(analysis.meanY)}
                x2={W - PAD_R}
                y2={yFor(analysis.meanY)}
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="4 4"
                strokeOpacity="0.5"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={xFor(analysis.meanX) + 6}
                y={yFor(analysis.meanY) - 8}
                fontSize="10"
                fontWeight="700"
                fill="#334155"
              >
                avg
              </text>
            </g>
          )}

          {/* Hover guide line */}
          {hoverIndex != null && model.points[hoverIndex] && (
            <line
              x1={xFor(model.points[hoverIndex].x)}
              y1={PAD_T}
              x2={xFor(model.points[hoverIndex].x)}
              y2={H - PAD_B}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="3 4"
              strokeOpacity="0.45"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Time trail: consecutive periods linked with direction arrows */}
          {options.trail &&
            trailSegments.map((s, i) => (
              <line
                key={i}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke="#94a3b8"
                strokeWidth="1.4"
                strokeOpacity="0.55"
                markerEnd="url(#scatter-trail-arrow)"
                vectorEffect="non-scaling-stroke"
              />
            ))}

          {/* Trail already covered by the playhead, drawn in the accent color */}
          {coveredPath && (
            <path
              d={coveredPath}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Fit line */}
          {options.fit && (
            <line
              x1={xFor(model.minX)}
              y1={fitY1}
              x2={xFor(model.maxX)}
              y2={fitY2}
              stroke={fitColor}
              strokeWidth="2.5"
              strokeDasharray="7 5"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {model.points.map((p, i) => {
            const hovered = i === hoverIndex;
            const pinned = i === pinnedIndex;
            const outlier = analysis.outlierIndex === i;
            return (
              <g key={`${p.label}-${i}`}>
                {(hovered || pinned) && (
                  <circle
                    cx={xFor(p.x)}
                    cy={yFor(p.y)}
                    r={11}
                    fill={color}
                    fillOpacity={hovered ? 0.14 : 0.07}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {outlier && !hovered && !pinned && (
                  <circle
                    cx={xFor(p.x)}
                    cy={yFor(p.y)}
                    r={9}
                    fill="none"
                    stroke="#d97706"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <circle
                  cx={xFor(p.x)}
                  cy={yFor(p.y)}
                  r={hovered ? 7 : pinned ? 6.5 : 5.5}
                  fill={pinned ? '#d97706' : hovered ? color : color}
                  fillOpacity={hovered || pinned ? 0.95 : 0.55}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  style={{ transition: 'r 120ms ease, fill-opacity 120ms ease' }}
                />
                <circle
                  cx={xFor(p.x)}
                  cy={yFor(p.y)}
                  r={16}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                  onClick={() => setPinnedIndex((prev) => (prev === i ? null : i))}
                  style={{ cursor: 'pointer' }}
                />
              </g>
            );
          })}

          {/* Animated playhead: glides along the trail like a video cursor */}
          {options.trail && playhead && (
            <g pointerEvents="none">
              <circle cx={playhead.x} cy={playhead.y} r={10} fill={color} fillOpacity="0.18" />
              <circle
                cx={playhead.x}
                cy={playhead.y}
                r={5.5}
                fill="#ffffff"
                stroke={color}
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={playhead.x}
                y={playhead.y - 14}
                fontSize="11"
                fontWeight="700"
                fill="#334155"
                textAnchor="middle"
              >
                {String(playhead.label)}
              </text>
            </g>
          )}
        </svg>

        {hoveredPoint && tip && (
          <div
            ref={tooltipRef}
            className="pointer-events-none absolute z-10 bg-white px-4 py-3 text-sm"
            style={{
              left: tip.left,
              top: tip.top,
              transform: 'translate(-50%, 0)',
              whiteSpace: 'nowrap',
              borderRadius: 6,
              border: '1px solid #e6e8ec',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.14)',
              transition: 'opacity 120ms ease, left 120ms ease, top 120ms ease',
            }}
          >
            <p className="text-xs font-bold text-onSurface">{String(hoveredPoint.label)}</p>
            <p className="mt-1 text-xs text-onSurface-variant">
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                style={{ backgroundColor: color }}
              />
              {xLabel}: <strong className="text-onSurface">{fmt(hoveredPoint.x)}</strong>
              {hoverIndex > 0 &&
                model.points[hoverIndex - 1] &&
                (() => {
                  const d = deltaPct(hoveredPoint.x, model.points[hoverIndex - 1].x);
                  return d != null ? (
                    <span
                      className={`ml-1 text-[11px] ${d >= 0 ? 'text-onSurface-variant' : 'text-danger'}`}
                    >
                      ({d >= 0 ? '+' : ''}
                      {d.toFixed(1)}%)
                    </span>
                  ) : null;
                })()}
            </p>
            <p className="mt-1 text-xs text-onSurface-variant">
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                style={{ backgroundColor: fitColor }}
              />
              {yLabel}: <strong className="text-onSurface">{fmt(hoveredPoint.y)}</strong>
              {hoverIndex > 0 &&
                model.points[hoverIndex - 1] &&
                (() => {
                  const d = deltaPct(hoveredPoint.y, model.points[hoverIndex - 1].y);
                  return d != null ? (
                    <span
                      className={`ml-1 text-[11px] ${d >= 0 ? 'text-onSurface-variant' : 'text-danger'}`}
                    >
                      ({d >= 0 ? '+' : ''}
                      {d.toFixed(1)}%)
                    </span>
                  ) : null;
                })()}
            </p>
            {analysis.outlierIndex === hoverIndex && (
              <p className="mt-1.5 text-[11px] font-bold text-[#d97706]">
                Farthest from the fit line (outlier)
              </p>
            )}
          </div>
        )}
      </div>

      {pinnable && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm border border-outline-variant bg-surface-highest px-4 py-3 text-sm">
          <span className="text-xs font-bold uppercase text-onSurface-variant">Pinned</span>
          <span className="font-bold text-onSurface">{String(pinnable.label)}</span>
          <span className="text-onSurface-variant">
            <span
              className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
              style={{ backgroundColor: color }}
            />
            {xLabel}: <strong className="text-onSurface">{fmt(pinnable.x)}</strong>
          </span>
          <span className="text-onSurface-variant">
            <span
              className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
              style={{ backgroundColor: fitColor }}
            />
            {yLabel}: <strong className="text-onSurface">{fmt(pinnable.y)}</strong>
          </span>
          <span className="text-onSurface-variant">
            Residual: <strong className="text-onSurface">{fmt(analysis.residuals?.[pinnedIndex]?.toFixed(1) ?? '—')}</strong>
          </span>
          <button
            type="button"
            onClick={() => setPinnedIndex(null)}
            className="ml-auto flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-semibold text-onSurface-variant transition-colors hover:bg-surface-lowest"
          >
            ✕ Clear
          </button>
        </div>
      )}

      <div
        className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
        style={{ color: '#39424E' }}
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
          {xLabel} vs {yLabel} · {model.points.length} shared periods
        </span>
        {options.fit && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-6" style={{ backgroundColor: fitColor }} />
            Fit: y = {fmt(model.slope)}·x {model.intercept >= 0 ? '+' : '−'}{' '}
            {fmt(Math.abs(model.intercept))}
          </span>
        )}
        {model.r != null && (
          <span
            className="flex items-center gap-1.5 rounded-sm px-2 py-1 font-bold"
            style={{ backgroundColor: '#eef3ee', color: '#1b7f3b' }}
          >
            r = {model.r.toFixed(2)} · {rStrength} {model.r >= 0 ? 'positive' : 'inverse'}{' '}
            correlation
          </span>
        )}
        {options.trail && (
          <span className="flex items-center gap-1.5 text-onSurface-variant">
            <span className="inline-block h-0.5 w-6" style={{ backgroundColor: '#94a3b8' }} />
            Time trail (older → newer)
          </span>
        )}
      </div>

      {options.guides && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {quadrantChips.map((chip) => (
            <span
              key={chip.key}
              className="rounded-sm border border-outline-variant px-2 py-1 font-semibold"
              style={{ backgroundColor: chip.bg, color: chip.fg }}
            >
              {chip.label}: {analysis.quadrants[chip.key]}
            </span>
          ))}
          <span className="ml-auto self-center font-bold text-onSurface-variant">
            of {model.points.length} periods
          </span>
        </div>
      )}
    </div>
  );
}
