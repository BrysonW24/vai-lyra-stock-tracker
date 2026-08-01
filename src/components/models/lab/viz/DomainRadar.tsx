'use client';

import type { EWDomain } from '@/lib/emerging-winner/types';
import { shortDomain, scoreColor } from './scale';

/**
 * DomainRadar - the 10-domain spider chart for one company. One glance shows where a name is strong,
 * weak, or simply not yet measurable. Covered domains plot their real 0-100 score and are the only
 * vertices in the filled shape. `unavailable` domains are NEVER placed on the value axis (no radius-0
 * point), so a data gap can never become part of the area or read as a zero-score - a gap is shown as a
 * dashed spoke with a dimmed label instead. Focus domains get a highlighted axis label. Pure SVG.
 */

const R = 92; // outer radius
const CENTER = 118; // svg is 236x236 viewBox to leave room for labels

function point(angle: number, radius: number): [number, number] {
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
}

export function DomainRadar({
  domains,
  focus = [],
  size = 236,
}: {
  domains: EWDomain[];
  focus?: string[];
  size?: number;
}) {
  const n = domains.length || 1;
  // Start at top (-90deg) and go clockwise.
  const angleFor = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2;

  const rings = [25, 50, 75, 100];

  const vertices = domains.map((d, i) => {
    const covered = d.coverage !== 'unavailable' && d.score != null;
    const score = covered ? Math.max(0, Math.min(100, d.score ?? 0)) : 0;
    // Covered vertices sit at their score radius. Uncovered domains are NOT placed on the value axis at
    // all (no radius-0 point), so a data gap never becomes part of the filled shape and never reads as a
    // zero-score - the gap is shown instead as a dashed spoke + dimmed label below.
    const [x, y] = covered ? point(angleFor(i), (score / 100) * R) : [CENTER, CENTER];
    return { d, i, covered, score, x, y };
  });

  const coveredVerts = vertices.filter((v) => v.covered);
  // The fill spans covered domains only; with fewer than 3 covered a polygon is degenerate, so dots alone.
  const polygon = coveredVerts.length >= 3 ? coveredVerts.map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ') : '';
  const meanCovered = coveredVerts.length ? coveredVerts.reduce((s, v) => s + v.score, 0) / coveredVerts.length : 0;
  const stroke = scoreColor(meanCovered || 0);

  return (
    <svg viewBox="0 0 236 236" width={size} height={size} role="img" aria-label="10-domain radar" className="mx-auto block">
      {/* Grid rings */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={domains
            .map((_, i) => {
              const [x, y] = point(angleFor(i), (r / 100) * R);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}

      {/* Spokes + labels - uncovered domains get a dashed spoke + dimmed label so a gap reads as "not
          measured", never as a low score. */}
      {domains.map((d, i) => {
        const [ex, ey] = point(angleFor(i), R);
        const [lx, ly] = point(angleFor(i), R + 16);
        const isFocus = focus.includes(d.key);
        const covered = d.coverage !== 'unavailable' && d.score != null;
        const anchor = Math.abs(lx - CENTER) < 8 ? 'middle' : lx < CENTER ? 'end' : 'start';
        return (
          <g key={d.key}>
            <line
              x1={CENTER}
              y1={CENTER}
              x2={ex}
              y2={ey}
              stroke={covered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)'}
              strokeWidth={1}
              strokeDasharray={covered ? undefined : '2 3'}
            />
            <text
              x={lx}
              y={ly}
              textAnchor={anchor as 'start' | 'middle' | 'end'}
              dominantBaseline="middle"
              fontSize={9}
              className={isFocus ? 'fill-sky-300' : covered ? 'fill-white/45' : 'fill-white/20'}
              fontWeight={isFocus ? 700 : 400}
            >
              {shortDomain(d.key, d.label)}
            </text>
          </g>
        );
      })}

      {/* Score polygon - covered domains only (never dips to a gap) */}
      {polygon ? <polygon points={polygon} fill={scoreColor(meanCovered || 0, 0.18)} stroke={stroke} strokeWidth={1.5} /> : null}

      {/* Vertices: only covered domains get a dot at their real score. Gaps have no value-axis marker -
          the dashed spoke + dimmed label above is their explicit "not measured" signal. */}
      {coveredVerts.map((v) => (
        <circle key={v.d.key} cx={v.x} cy={v.y} r={3} fill={scoreColor(v.score)} stroke="#0b1220" strokeWidth={1} />
      ))}
    </svg>
  );
}
