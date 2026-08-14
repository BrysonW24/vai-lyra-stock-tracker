'use client';

import { useEffect, useState } from 'react';
import { PieChart, BarChart2, TrendingUp, Globe } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';

const SECTOR_MAP: Record<string, string> = {
  AAPL:'Tech',MSFT:'Tech',NVDA:'Tech',AMD:'Tech',GOOGL:'Tech',GOOG:'Tech',
  META:'Tech',TSLA:'Tech',AMZN:'Tech',CRM:'Tech',ORCL:'Tech',INTC:'Tech',
  QCOM:'Tech',AVGO:'Tech',NOW:'Tech',ADBE:'Tech',SNOW:'Tech',PLTR:'Tech',
  NFLX:'Media',DIS:'Media',CMCSA:'Media',
  JPM:'Finance',GS:'Finance',BAC:'Finance',WFC:'Finance',V:'Finance',
  MA:'Finance',PYPL:'Finance',BLK:'Finance',AXP:'Finance',C:'Finance',
  JNJ:'Health',UNH:'Health',PFE:'Health',ABBV:'Health',MRK:'Health',
  LLY:'Health',TMO:'Health',ABT:'Health',ISRG:'Health',
  XOM:'Energy',CVX:'Energy',COP:'Energy',SLB:'Energy',
  BHP:'Materials',RIO:'Materials',FCX:'Materials',NEM:'Materials',
  CAT:'Industrial',DE:'Industrial',GE:'Industrial',HON:'Industrial',BA:'Industrial',RTX:'Industrial',
  WMT:'Consumer',COST:'Consumer',MCD:'Consumer',NKE:'Consumer',TGT:'Consumer',
  PG:'Consumer',KO:'Consumer',PEP:'Consumer',SBUX:'Consumer',
  NEE:'Utilities',DUK:'Utilities',SO:'Utilities',
  AMT:'Real Estate',SPG:'Real Estate',EQIX:'Real Estate',
  'CBA.AX':'Finance','ANZ.AX':'Finance','NAB.AX':'Finance','WBC.AX':'Finance',
  'BHP.AX':'Materials','RIO.AX':'Materials','FMG.AX':'Materials',
  'CSL.AX':'Health','WES.AX':'Consumer','WOW.AX':'Consumer','COL.AX':'Consumer',
  'MQG.AX':'Finance','ASX.AX':'Finance','QAN.AX':'Industrial','WDS.AX':'Energy',
};

/*
 * Chart category palettes stay LITERAL HEX on purpose (P2 chart-literal precedent): each value
 * feeds SVG fill=/stroke=/stopColor= presentation attributes, which cannot resolve var(), and
 * the same constant is shared with inline-style dots/bars, so one representation is kept.
 * Design-owner tension (same class as P0's LYRA_RAMP + P2's PanelCarousel flag): these are
 * categorical series palettes that include status-colour values - flagged in the P3 note, not
 * redesigned in a token-convergence pass.
 */
const SECTOR_COLORS: Record<string, string> = {
  Tech:'#8aa2ff', Finance:'#43d18b', Health:'#e879f9', Consumer:'#f3a33a',
  Energy:'#ff8a5c', Industrial:'#6fb1ff', Media:'#f472b6', Materials:'#a3e635',
  Utilities:'#67e8f9', 'Real Estate':'#fb923c', Other:'#4a5a6a',
};

const POSITION_COLORS = [
  '#8aa2ff','#43d18b','#f3a33a','#e879f9',
  '#ff8a5c','#6fb1ff','#f472b6','#a3e635',
];

const BENCHMARK_COLORS: Record<string, string> = {
  NASDAQ: '#8aa2ff',
  'ASX 200': '#43d18b',
  Portfolio: '#f3a33a',
};

interface Position {
  symbol: string; quantity: number; avgEntryPrice: number;
  currentPrice: number; marketValue: number;
  unrealisedPnl: number; unrealisedPnlPct: number;
}

interface Benchmark { label: string; symbol: string; points: number[]; }

// ─── SVG helpers ─────────────────────────────────────────────────────────────
function pathFor(values: number[], w: number, h: number, min: number, max: number, pad = 8) {
  const range = max - min || 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values.map((v, i) => {
    const x = pad + step * i;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function areaFor(values: number[], w: number, h: number, min: number, max: number, pad = 8) {
  const range = max - min || 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const line = values.map((v, i) => {
    const x = pad + step * i; const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  const lx = pad + step * (values.length - 1);
  return `${line} L ${lx.toFixed(1)} ${h - pad} L ${pad} ${h - pad} Z`;
}

// ─── Donut chart ─────────────────────────────────────────────────────────────
function DonutChart({ slices }: { slices: { label: string; pct: number; color: string }[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const R = 44; const r = 27; const cx = 52; const cy = 52;
  let angle = -90;

  const arcs = slices.map(s => {
    const sweep = (s.pct / 100) * 360;
    const startRad = (angle * Math.PI) / 180;
    const endRad = ((angle + sweep) * Math.PI) / 180;
    const x1 = cx + R * Math.cos(startRad); const y1 = cy + R * Math.sin(startRad);
    const x2 = cx + R * Math.cos(endRad);   const y2 = cy + R * Math.sin(endRad);
    const ix1 = cx + r * Math.cos(startRad); const iy1 = cy + r * Math.sin(startRad);
    const ix2 = cx + r * Math.cos(endRad);   const iy2 = cy + r * Math.sin(endRad);
    const large = sweep > 180 ? 1 : 0;
    const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${ix2.toFixed(1)} ${iy2.toFixed(1)} A ${r} ${r} 0 ${large} 0 ${ix1.toFixed(1)} ${iy1.toFixed(1)} Z`;
    angle += sweep;
    return { ...s, d };
  });

  const active = arcs.find(a => a.label === hovered);

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 104 104" className="h-[104px] w-[104px] shrink-0">
        {arcs.map(a => (
          <path key={a.label} d={a.d} fill={a.color}
            opacity={hovered && hovered !== a.label ? 0.25 : 1}
            className="cursor-pointer transition-opacity duration-150"
            onMouseEnter={() => setHovered(a.label)} onMouseLeave={() => setHovered(null)} />
        ))}
        {/* SVG fill= attrs cannot resolve var(): byte-copies of ink / ink-dim (P0/P2 precedent) */}
        <text x={cx} y={cy - 5} textAnchor="middle" fill="#eef3f8" fontSize={9} fontWeight={700}>
          {active ? active.label : `${slices.length}`}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="#5e6b78" fontSize={7.5}>
          {active ? `${active.pct.toFixed(1)}%` : 'positions'}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {arcs.map(a => (
          <li key={a.label} className="flex items-center gap-2 cursor-pointer"
            onMouseEnter={() => setHovered(a.label)} onMouseLeave={() => setHovered(null)}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
            <TickerLogo symbol={a.label} size={14} />
            <span className={`font-mono text-[11px] font-bold transition-colors ${hovered === a.label ? 'text-ink' : 'text-ink-3'}`}>{a.label}</span>
            <span className="ml-auto font-mono text-[10px] tabular-nums text-ink-dim">{a.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Sector horizontal bars ───────────────────────────────────────────────────
function HorizBars({ bars }: { bars: { label: string; pct: number; color: string; count: number }[] }) {
  return (
    <ul className="space-y-3">
      {bars.map(b => (
        <li key={b.label}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
              <span className="text-[11px] font-semibold text-ink-title">{b.label}</span>
            </div>
            <span className="font-mono text-[10px] tabular-nums text-ink-dim">{b.pct.toFixed(1)}% · {b.count} pos</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-panel">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.max(3, b.pct)}%`, backgroundColor: b.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── P&L per position ────────────────────────────────────────────────────────
function PnlBars({ positions, colors }: { positions: Position[]; colors: string[] }) {
  const max = Math.max(...positions.map(p => Math.abs(p.unrealisedPnlPct)), 0.1);
  return (
    <ul className="space-y-3">
      {positions.map((p, i) => {
        const up = p.unrealisedPnl >= 0;
        const barPct = Math.min(100, (Math.abs(p.unrealisedPnlPct) / max) * 100);
        return (
          <li key={p.symbol}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                <TickerLogo symbol={p.symbol} size={14} />
                <span className="font-mono text-[11px] font-bold text-ink-title">{p.symbol}</span>
              </div>
              <span className={`font-mono text-[11px] font-semibold tabular-nums ${up ? 'text-positive' : 'text-negative'}`}>
                {up ? '+' : ''}{p.unrealisedPnlPct.toFixed(2)}% · {up ? '+' : ''}${p.unrealisedPnl.toFixed(0)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-panel">
              <div className={`h-full rounded-full transition-all duration-700 ${up
                ? 'bg-gradient-to-r from-positive/50 to-positive'
                : 'bg-gradient-to-r from-negative/50 to-negative'}`}
                style={{ width: `${Math.max(4, barPct)}%` }} />
            </div>
            <div className="flex justify-between mt-0.5 tabular-nums">
              <span className="text-[9px] text-ink-dim/80">entry ${p.avgEntryPrice.toFixed(2)}</span>
              <span className="text-[9px] text-ink-dim/80">now ${p.currentPrice.toFixed(2)} · {p.quantity} shares</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Benchmark multi-line chart ───────────────────────────────────────────────
function BenchmarkChart({
  benchmarks, equityCurve, startingEquity,
}: {
  benchmarks: Benchmark[];
  equityCurve: number[];
  startingEquity: number;
}) {
  const W = 320; const H = 120; const pad = 12;
  const [hovered, setHovered] = useState<{ x: number; idx: number } | null>(null);

  // Index portfolio equity curve to 100
  const portfolioIndexed = equityCurve.length >= 2
    ? equityCurve.map(v => parseFloat(((v / startingEquity) * 100).toFixed(3)))
    : [];

  const allSeries = [
    ...(portfolioIndexed.length >= 2 ? [{ label: 'Session', points: portfolioIndexed, color: BENCHMARK_COLORS.Portfolio }] : []),
    ...benchmarks.map(b => ({ label: b.label, points: b.points, color: BENCHMARK_COLORS[b.label] ?? '#8190a0' })),
  ];

  if (allSeries.length === 0) {
    return <p className="text-[10px] text-ink-dim/80 py-4 text-center">No benchmark data yet - execute a paper trade to start tracking</p>;
  }

  const allValues = allSeries.flatMap(s => s.points);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);

  // Use the longest series for x-axis point count
  const days = Math.max(...allSeries.map(s => s.points.length));

  return (
    <div>
      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-3">
        {allSeries.map(s => {
          const last = s.points[s.points.length - 1] ?? 100;
          const pct = last - 100;
          return (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="font-mono text-[10px] font-bold text-ink-title">{s.label}</span>
              <span className={`font-mono text-[10px] tabular-nums ${pct >= 0 ? 'text-positive' : 'text-negative'}`}>
                {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* SVG chart */}
      <div className="relative overflow-hidden rounded-cell border border-line/70 bg-ground">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: '120px' }}
          preserveAspectRatio="none"
          onMouseLeave={() => setHovered(null)}
          onMouseMove={e => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const svgX = ((e.clientX - rect.left) / rect.width) * W;
            const idx = Math.round(((svgX - pad) / (W - pad * 2)) * (days - 1));
            setHovered({ x: svgX, idx: Math.max(0, Math.min(days - 1, idx)) });
          }}
        >
          <defs>
            {allSeries.map(s => (
              <linearGradient key={s.label} id={`bg-${s.label}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.10" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* 100 baseline. SVG stroke= attrs cannot resolve var(): byte-copy of line-strong (P0/P2 precedent) */}
          {(() => {
            const baseY = H - pad - ((100 - min) / (max - min || 1)) * (H - pad * 2);
            return <line x1={pad} x2={W - pad} y1={baseY} y2={baseY}
              stroke="#263241" strokeWidth="0.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />;
          })()}

          {/* Area fills */}
          {allSeries.map(s => (
            <path key={`area-${s.label}`} d={areaFor(s.points, W, H, min, max)}
              fill={`url(#bg-${s.label})`} />
          ))}

          {/* Lines */}
          {allSeries.map(s => (
            <path key={`line-${s.label}`} d={pathFor(s.points, W, H, min, max)}
              fill="none" stroke={s.color} strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))}

          {/* Hover crosshair. Literal SVG strokes: ink-dim byte-copy + the ground chart backdrop */}
          {hovered && (
            <>
              <line x1={hovered.x} x2={hovered.x} y1={pad} y2={H - pad}
                stroke="#5e6b78" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
              {allSeries.map(s => {
                if (hovered.idx >= s.points.length) return null;
                const step = s.points.length > 1 ? (W - pad * 2) / (s.points.length - 1) : 0;
                const cx = pad + step * hovered.idx;
                const range = max - min || 1;
                const cy = H - pad - ((s.points[hovered.idx] - min) / range) * (H - pad * 2);
                return <circle key={s.label} cx={cx} cy={cy} r="3"
                  fill={s.color} stroke="#07090c" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />;
              })}
            </>
          )}
        </svg>

        {/* Hover tooltip */}
        {hovered && (
          <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-10 rounded-cell border border-line-strong bg-panel-deep/95 px-3 py-2 shadow-xl backdrop-blur-sm">
            {allSeries.map(s => {
              if (hovered.idx >= s.points.length) return null;
              const val = s.points[hovered.idx];
              const pct = val - 100;
              return (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="font-mono text-[10px] text-ink-2">{s.label}</span>
                  <span className={`ml-auto font-mono text-[10px] font-bold tabular-nums ${pct >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                  </span>
                </div>
              );
            })}
            {/* No derived calendar date here: the Session series is not one-point-per-day, so an
                index-times-86400000 date was invented for it (2026-08-11 audit). The series share
                an index, not a calendar - the footer says so. */}
          </div>
        )}
      </div>

      {/* X-axis labels */}
      <div className="mt-1 flex justify-between px-1">
        {/* "30d ago" is true only for the daily benchmark series; the Session line spans its own
            shorter window - so the axis names the window class, not a hard calendar date. */}
        <span className="font-mono text-[8px] text-ink-dim/80">benchmarks: 30d ago · session: first snapshot</span>
        <span className="font-mono text-[8px] text-ink-dim/80">Today</span>
      </div>

      <p className="mt-2 text-[9px] text-ink-dim/80">
        All series indexed to 100 at start. NASDAQ + ASX 200 are the last 30 days of live Yahoo Finance
        data; Session is your live paper run, which spans a different (usually shorter) window - so the
        lines share an index, not a calendar. Compare the shapes, not a head-to-head % return.
      </p>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
type Tab = 'allocation' | 'sector' | 'pnl' | 'benchmark';

interface PaperAccountChartsProps {
  positions: Position[];
  totalMarketValue: number;
  equityCurve: number[];
  startingEquity: number;
}

export function PaperAccountCharts({ positions, totalMarketValue, equityCurve, startingEquity }: PaperAccountChartsProps) {
  const [tab, setTab] = useState<Tab>('allocation');
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'benchmark' || benchmarks.length > 0) return;
    setBenchmarkLoading(true);
    fetch('/api/trading/benchmarks')
      .then(r => r.json())
      .then((d: { benchmarks: Benchmark[] }) => setBenchmarks(d.benchmarks ?? []))
      .catch(() => {})
      .finally(() => setBenchmarkLoading(false));
  }, [tab, benchmarks.length]);

  if (positions.length === 0) return null;

  const allocationSlices = positions.map((p, i) => ({
    label: p.symbol,
    pct: totalMarketValue > 0 ? (p.marketValue / totalMarketValue) * 100 : 0,
    color: POSITION_COLORS[i % POSITION_COLORS.length],
  }));

  const sectorMap = new Map<string, { value: number; count: number }>();
  positions.forEach(p => {
    const sector = SECTOR_MAP[p.symbol] ?? 'Other';
    const ex = sectorMap.get(sector) ?? { value: 0, count: 0 };
    sectorMap.set(sector, { value: ex.value + p.marketValue, count: ex.count + 1 });
  });
  const sectorBars = [...sectorMap.entries()]
    .sort((a, b) => b[1].value - a[1].value)
    .map(([label, { value, count }]) => ({
      label, count,
      pct: totalMarketValue > 0 ? (value / totalMarketValue) * 100 : 0,
      color: SECTOR_COLORS[label] ?? SECTOR_COLORS.Other,
    }));

  const tabs: { id: Tab; label: string; icon: typeof PieChart }[] = [
    { id: 'allocation', label: 'Allocation', icon: PieChart },
    { id: 'sector',     label: 'Sector',     icon: BarChart2 },
    { id: 'pnl',        label: 'P&L',        icon: TrendingUp },
    { id: 'benchmark',  label: 'vs Market',  icon: Globe },
  ];

  return (
    <div className="rounded-cell border border-line bg-well overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-line/70">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`flex min-h-[44px] flex-1 items-center justify-center gap-1 py-2.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] transition-colors sm:min-h-0 ${
              tab === id ? 'border-b-2 border-pending text-pending bg-panel-deep' : 'text-ink-dim hover:text-ink-3'
            }`}>
            <Icon size={11} />{label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'allocation' && (
          <>
            <p className="mb-3 text-[9px] uppercase tracking-[0.1em] text-ink-dim/80">Portfolio by market value</p>
            <DonutChart slices={allocationSlices} />
          </>
        )}
        {tab === 'sector' && (
          <>
            <p className="mb-3 text-[9px] uppercase tracking-[0.1em] text-ink-dim/80">Capital by industry sector</p>
            {sectorBars.length === 1 && sectorBars[0].label === 'Other'
              ? <p className="text-[10px] text-ink-dim/80">Sector data unavailable - try AAPL, NVDA, JPM…</p>
              : <HorizBars bars={sectorBars} />}
          </>
        )}
        {tab === 'pnl' && (
          <>
            <p className="mb-3 text-[9px] uppercase tracking-[0.1em] text-ink-dim/80">Unrealised return per position</p>
            <PnlBars positions={positions} colors={POSITION_COLORS} />
          </>
        )}
        {tab === 'benchmark' && (
          <>
            <p className="mb-3 text-[9px] uppercase tracking-[0.1em] text-ink-dim/80">Your portfolio vs NASDAQ & ASX 200 - 30 days indexed</p>
            {benchmarkLoading
              ? <div className="flex items-center gap-2 py-6 justify-center text-ink-dim">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-pending border-t-transparent" />
                  <span className="text-[11px]">Fetching live market data…</span>
                </div>
              : <BenchmarkChart benchmarks={benchmarks} equityCurve={equityCurve} startingEquity={startingEquity} />
            }
          </>
        )}
      </div>
    </div>
  );
}
