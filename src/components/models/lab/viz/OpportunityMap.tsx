'use client';

import type { LabResult } from '@/lib/models/lab';
import { riskColor, capRadius, fmtCap } from './scale';

/**
 * OpportunityMap - a bubble scatter that turns a run into a shape you can read. X = winner resemblance
 * (how much the name looks like past winners), Y = risk headroom (100 - risk penalty, so higher = a
 * cleaner risk profile). Bubble size = market cap when sourced (log scale), else data completeness.
 * Colour = the risk-gate verdict. The top-right is the sweet spot: strong resemblance AND clean risk.
 * Everything plotted is a real field from the run - no synthetic axis. A name whose market cap is not
 * sourced is drawn HOLLOW at a neutral radius (never the smallest-real-cap size), so a data gap never
 * reads as "smallest company". Click a bubble to inspect.
 */

const W = 360;
const H = 260;
const padL = 30;
const padR = 12;
const padT = 14;
const padB = 26;
const plotW = W - padL - padR;
const plotH = H - padT - padB;

const xPix = (v: number) => padL + (Math.max(0, Math.min(100, v)) / 100) * plotW;
const yPix = (v: number) => padT + (1 - Math.max(0, Math.min(100, v)) / 100) * plotH;

interface Bubble {
  r: LabResult;
  x: number;
  y: number;
  radius: number;
  capKnown: boolean;
  color: string;
}

export function OpportunityMap({
  results,
  selectedSymbol,
  onSelect,
}: {
  results: LabResult[];
  selectedSymbol?: string;
  onSelect?: (r: LabResult) => void;
}) {
  const ew = results.filter((r) => r.ew);
  if (!ew.length) return null;
  const anyCap = ew.some((r) => r.marketCap != null);

  const bubbles: Bubble[] = ew.map((r) => {
    const w = r.ew!;
    const x = w.winner_similarity;
    const y = Math.max(0, 100 - w.risk.penalty);
    const capKnown = r.marketCap != null;
    // Size = market cap when known. In a run where cap IS sourced for some, a name whose cap is NOT
    // sourced is drawn hollow at a neutral radius (never the smallest-real-cap radius), so a data gap
    // never reads as "smallest company". With no caps sourced at all, size falls back to completeness.
    const radius = anyCap ? (capKnown ? capRadius(r.marketCap) : 8) : 5 + w.completeness * 9;
    return { r, x, y, radius, capKnown, color: riskColor(w.risk.verdict) };
  });

  // Label the strongest few by resemblance to avoid clutter.
  const labelled = new Set([...bubbles].sort((a, b) => b.x - a.x).slice(0, 5).map((b) => b.r.symbol));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Opportunity map" className="block">
        {/* Sweet-spot quadrant (top-right) */}
        <rect x={xPix(50)} y={yPix(100)} width={xPix(100) - xPix(50)} height={yPix(50) - yPix(100)} fill="hsl(152 62% 46% / 0.06)" />
        <text x={xPix(100) - 4} y={yPix(100) + 11} textAnchor="end" fontSize={8} className="fill-emerald-300/60">
          sweet spot
        </text>

        {/* Gridlines */}
        {[25, 50, 75].map((g) => (
          <g key={g}>
            <line x1={xPix(g)} y1={padT} x2={xPix(g)} y2={padT + plotH} stroke="rgba(255,255,255,0.05)" />
            <line x1={padL} y1={yPix(g)} x2={padL + plotW} y2={yPix(g)} stroke="rgba(255,255,255,0.05)" />
          </g>
        ))}

        {/* Axes */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="rgba(255,255,255,0.15)" />
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="rgba(255,255,255,0.15)" />
        <text x={padL + plotW / 2} y={H - 4} textAnchor="middle" fontSize={9} className="fill-white/45">
          Winner resemblance -&gt;
        </text>
        <text x={-(padT + plotH / 2)} y={9} transform="rotate(-90)" textAnchor="middle" fontSize={9} className="fill-white/45">
          Risk headroom -&gt;
        </text>

        {/* Bubbles */}
        {bubbles.map((b) => {
          const active = b.r.symbol === selectedSymbol;
          return (
            <g
              key={b.r.symbol}
              onClick={() => onSelect?.(b.r)}
              className="cursor-pointer"
              role="button"
              aria-label={`${b.r.symbol} - resemblance ${Math.round(b.x)}, risk headroom ${Math.round(b.y)}`}
            >
              <circle
                cx={xPix(b.x)}
                cy={yPix(b.y)}
                r={b.radius}
                fill={anyCap && !b.capKnown ? 'none' : b.color}
                fillOpacity={anyCap && !b.capKnown ? 1 : active ? 0.55 : 0.28}
                stroke={b.color}
                strokeWidth={active ? 2 : 1}
                strokeDasharray={anyCap && !b.capKnown ? '3 2' : undefined}
              />
              {labelled.has(b.r.symbol) || active ? (
                <text x={xPix(b.x)} y={yPix(b.y) - b.radius - 2} textAnchor="middle" fontSize={8} className="fill-white/80" fontWeight={600}>
                  {b.r.symbol}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/45">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: riskColor('pass') }} /> pass
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: riskColor('review') }} /> review
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: riskColor('block') }} /> block
        </span>
        <span className="text-white/35">
          · bubble = {anyCap ? 'market cap' : 'data completeness'}
          {anyCap ? ` (${fmtCap(Math.min(...ew.map((r) => r.marketCap ?? Infinity)))} - ${fmtCap(Math.max(...ew.map((r) => r.marketCap ?? 0)))})` : ''}
        </span>
        {anyCap && ew.some((r) => r.marketCap == null) ? <span className="text-white/35">· hollow = cap not sourced</span> : null}
      </div>
    </div>
  );
}
