'use client';

import type { EWDomain } from '@/lib/emerging-winner/types';
import { shortDomain, scoreColor } from './scale';

/**
 * DomainRadar - the 10-domain spider chart for one company. One glance shows where a name is strong,
 * weak, or simply not yet measurable: covered domains plot their real 0-100 score; `unavailable`
 * domains plot at the centre with a hollow marker so a data gap never reads as a zero-score. Focus
 * domains (the ones the user chose to prioritise) get a highlighted axis label. Pure SVG.
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
    const [x, y] = point(angleFor(i), (score / 100) * R);
    return { d, i, covered, score, x, y };
  });

  const polygon = vertices.map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ');
  const meanCovered =
    vertices.filter((v) => v.covered).reduce((s, v) => s + v.score, 0) /
    Math.max(1, vertices.filter((v) => v.covered).length);
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

      {/* Spokes + labels */}
      {domains.map((d, i) => {
        const [ex, ey] = point(angleFor(i), R);
        const [lx, ly] = point(angleFor(i), R + 16);
        const isFocus = focus.includes(d.key);
        const anchor = Math.abs(lx - CENTER) < 8 ? 'middle' : lx < CENTER ? 'end' : 'start';
        return (
          <g key={d.key}>
            <line x1={CENTER} y1={CENTER} x2={ex} y2={ey} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <text
              x={lx}
              y={ly}
              textAnchor={anchor as 'start' | 'middle' | 'end'}
              dominantBaseline="middle"
              fontSize={9}
              className={isFocus ? 'fill-sky-300' : 'fill-white/45'}
              fontWeight={isFocus ? 700 : 400}
            >
              {shortDomain(d.key, d.label)}
            </text>
          </g>
        );
      })}

      {/* Score polygon */}
      <polygon points={polygon} fill={scoreColor(meanCovered || 0, 0.18)} stroke={stroke} strokeWidth={1.5} />

      {/* Vertices: covered = filled dot in its own score colour, unavailable = hollow ring at centre */}
      {vertices.map((v) =>
        v.covered ? (
          <circle key={v.d.key} cx={v.x} cy={v.y} r={3} fill={scoreColor(v.score)} stroke="#0b1220" strokeWidth={1} />
        ) : (
          <circle
            key={v.d.key}
            cx={CENTER}
            cy={CENTER}
            r={3}
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={1}
            strokeDasharray="1.5 1.5"
          />
        ),
      )}
    </svg>
  );
}
