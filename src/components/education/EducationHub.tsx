'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, Search, X } from 'lucide-react';
import type { SignalRow } from '@/types/scanner';
import { EDUCATION_MODULES, getCategories, getModule, getModulesByCategory } from '@/lib/education';

interface EducationHubProps {
  signals: SignalRow[];
}

export function EducationHub({ signals }: EducationHubProps) {
  const searchParams = useSearchParams();
  const moduleIdParam = searchParams.get('module');

  const [selectedModuleId, setSelectedModuleId] = useState<string>(
    moduleIdParam && EDUCATION_MODULES.some((m) => m.id === moduleIdParam)
      ? moduleIdParam
      : EDUCATION_MODULES[0].id
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    if (moduleIdParam && EDUCATION_MODULES.some((m) => m.id === moduleIdParam)) {
      setSelectedModuleId(moduleIdParam);
    }
  }, [moduleIdParam]);

  const selectedModule = getModule(selectedModuleId);
  const categories = getCategories();

  const filteredModules = useMemo(() => {
    let modules = [...EDUCATION_MODULES];

    if (categoryFilter) {
      modules = modules.filter((m) => m.category === categoryFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      modules = modules.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          m.definition.toLowerCase().includes(query) ||
          m.whyItMatters.toLowerCase().includes(query),
      );
    }

    return modules;
  }, [searchQuery, categoryFilter]);

  // Find a live example signal that matches the selected module
  const liveExampleSignal = useMemo(() => {
    if (!selectedModule) return null;

    const moduleId = selectedModule.id;

    // Map module IDs to signal properties
    if (moduleId === 'rsi') {
      return signals.find((s) => s.rsi < 35);
    }
    if (moduleId === 'macd' || moduleId === 'macd-histogram') {
      return signals.find((s) => s.macdHistogram > 0 && s.histDelta > 0);
    }
    if (moduleId === 'momentum-recovery') {
      return signals.find(
        (s) =>
          s.status === 'strong_setup' &&
          s.signalType === 'momentum_recovery',
      );
    }
    if (moduleId === 'overextension') {
      return signals.find((s) => s.status === 'overextended');
    }

    // For other modules, return the first strong setup as a generic example
    return signals.find((s) => s.status === 'strong_setup') || signals[0];
  }, [selectedModule, signals]);

  return (
    <div className="grid gap-3 pb-20 md:pb-0 lg:grid-cols-[320px_1fr]">
      {/* Left Panel: Module List */}
      <div className="terminal-panel overflow-hidden rounded-md">
        {/* Header */}
        <div className="border-b border-[#1b2530] px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">
            Learn the Console
          </p>
          <p className="mt-1 font-mono text-xs text-[#a8b5c2]">
            {filteredModules.length} {filteredModules.length === 1 ? 'topic' : 'topics'}
          </p>
        </div>

        {/* Search Box */}
        <div className="border-b border-[#1b2530] px-3 py-3">
          <div className="flex items-center gap-2 rounded border border-[#263241] bg-[#0d141c] px-2 py-2">
            <Search size={14} className="text-[#8190a0]" />
            <input
              type="text"
              placeholder="Search topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-mono text-xs text-[#dbe5ee] placeholder-[#8190a0] outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="rounded hover:bg-[#151c25]"
                title="Clear search"
              >
                <X size={14} className="text-[#8190a0]" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <div className="border-b border-[#1b2530] px-3 py-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">
            Filter by category
          </div>
          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={() => setCategoryFilter(null)}
              className={`rounded px-1.5 py-1 text-center font-mono text-[11px] leading-tight transition ${
                categoryFilter === null
                  ? 'border border-[#f3a33a] bg-[#2a1f0f] text-[#f3a33a]'
                  : 'border border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:text-[#dbe5ee]'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`rounded px-1.5 py-1 text-center font-mono text-[11px] leading-tight transition ${
                  categoryFilter === cat
                    ? 'border border-[#f3a33a] bg-[#2a1f0f] text-[#f3a33a]'
                    : 'border border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:text-[#dbe5ee]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Module List */}
        <div className="divide-y divide-[#1b2530] overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          {filteredModules.length === 0 ? (
            <div className="px-3 py-4 text-center font-mono text-xs text-[#8190a0]">
              No topics found matching "{searchQuery}"
            </div>
          ) : (
            filteredModules.map((module) => (
              <button
                key={module.id}
                onClick={() => setSelectedModuleId(module.id)}
                className={`w-full px-3 py-3 text-left transition ${
                  selectedModuleId === module.id
                    ? 'border-l-2 border-[#f3a33a] bg-[#151c25]'
                    : 'border-l-2 border-transparent hover:bg-[#0d141c]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-[#dbe5ee]">
                      {module.title}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8190a0]">
                      {module.category}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Module Detail */}
      {selectedModule && (
        <div className="terminal-panel overflow-hidden rounded-md">
          <div className="border-b border-[#1b2530] px-3 py-3 md:px-4 md:py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">
              {selectedModule.category}
            </p>
            <h2 className="mt-1.5 font-mono text-base font-semibold text-[#eef3f8] md:text-lg">
              {selectedModule.title}
            </h2>
          </div>

          <div className="space-y-3 overflow-y-auto px-3 py-3 md:px-4 md:py-3.5" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {/* Definition */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">
                Definition
              </p>
              <p className="mt-2 font-mono text-sm leading-relaxed text-[#dbe5ee]">
                {selectedModule.definition}
              </p>
            </div>

            {/* Why It Matters */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">
                Why it matters
              </p>
              <p className="mt-2 font-mono text-sm leading-relaxed text-[#dbe5ee]">
                {selectedModule.whyItMatters}
              </p>
            </div>

            {/* How Console Uses It */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">
                How this console uses it
              </p>
              <p className="mt-2 font-mono text-sm leading-relaxed text-[#dbe5ee]">
                {selectedModule.howConsoleUsesIt}
              </p>
            </div>

            {/* Live Example Hint */}
            {selectedModule.liveExampleHint && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">
                  Finding live examples
                </p>
                <p className="mt-2 font-mono text-sm leading-relaxed text-[#dbe5ee]">
                  {selectedModule.liveExampleHint}
                </p>
              </div>
            )}

            {/* Custom Interactive / SVG Visualizations */}
            {selectedModule.id === 'candle-closes' && (
              <div className="space-y-4 rounded-lg border border-[#263241] bg-[#070b10] p-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f3a33a]">
                    Visual Concept 1: Timeframe Stitching (5m vs 1m)
                  </p>
                  <p className="mt-1 text-xs text-[#a8b5c2]">
                    One 5-minute candle represents five consecutive 1-minute candles stitched together.
                  </p>
                  <div className="mt-3 flex flex-col items-center rounded bg-[#0b1016] p-3">
                    <svg viewBox="0 0 400 145" className="w-full max-w-[360px] overflow-visible">
                      <line x1="10" y1="110" x2="390" y2="110" stroke="#1b2530" strokeDasharray="3" />
                      <g transform="translate(10, 0)">
                        <line x1="30" y1="40" x2="30" y2="120" stroke="#43d18b" strokeWidth="1.5" />
                        <rect x="23" y="50" width="14" height="50" fill="#43d18b" rx="2" />
                        <text x="30" y="130" textAnchor="middle" className="font-mono text-[9px] fill-[#8190a0]">00:20</text>
                        <line x1="80" y1="60" x2="80" y2="110" stroke="#ff6b6b" strokeWidth="1.5" />
                        <rect x="73" y="70" width="14" height="30" fill="#ff6b6b" rx="2" />
                        <text x="80" y="130" textAnchor="middle" className="font-mono text-[9px] fill-[#8190a0]">00:21</text>
                        <line x1="130" y1="30" x2="130" y2="90" stroke="#43d18b" strokeWidth="1.5" />
                        <rect x="123" y="40" width="14" height="40" fill="#43d18b" rx="2" />
                        <text x="130" y="130" textAnchor="middle" className="font-mono text-[9px] fill-[#8190a0]">00:22</text>
                        <line x1="180" y1="20" x2="180" y2="70" stroke="#43d18b" strokeWidth="1.5" />
                        <rect x="173" y="25" width="14" height="35" fill="#43d18b" rx="2" />
                        <text x="180" y="130" textAnchor="middle" className="font-mono text-[9px] fill-[#8190a0]">00:23</text>
                        <line x1="230" y1="10" x2="230" y2="50" stroke="#ff6b6b" strokeWidth="1.5" />
                        <rect x="223" y="15" width="14" height="25" fill="#ff6b6b" rx="2" />
                        <text x="230" y="130" textAnchor="middle" className="font-mono text-[9px] fill-[#8190a0]">00:24</text>
                      </g>
                      <path d="M 35 15 L 10 15 L 10 5 L 260 5 L 260 15 L 235 15" fill="none" stroke="#263241" strokeWidth="1.5" transform="translate(10, 0)" />
                      <line x1="145" y1="5" x2="145" y2="0" stroke="#263241" strokeWidth="1.5" />
                      <path d="M 285 60 L 305 60" stroke="#f3a33a" strokeWidth="2" markerEnd="url(#arrow)" />
                      <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 0 L 10 5 L 0 10 z" fill="#f3a33a" />
                        </marker>
                      </defs>
                      <g transform="translate(320, 0)">
                        <line x1="30" y1="10" x2="30" y2="120" stroke="#43d18b" strokeWidth="2.5" />
                        <rect x="20" y="30" width="20" height="70" fill="#43d18b" rx="2" />
                        <text x="30" y="130" textAnchor="middle" className="font-mono text-[9px] font-bold fill-[#f3a33a]">5m Close</text>
                      </g>
                    </svg>
                  </div>
                </div>
                <div className="border-t border-[#1b2530] pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f3a33a]">
                    Visual Concept 2: Bullish Reclaim vs. Fakeout Wick
                  </p>
                  <p className="mt-1 text-xs text-[#a8b5c2]">
                    A candle tells the truth only when it closes. Compare these two scenarios:
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="flex flex-col items-center rounded bg-[#0b1016] p-2 text-center">
                      <p className="font-mono text-[10px] font-bold text-[#43d18b]">Scenario A: Bullish Close</p>
                      <p className="text-[9px] text-[#8190a0] mt-0.5">Buyers sustain control</p>
                      <svg viewBox="0 0 140 140" className="w-full max-w-[100px] mt-2 overflow-visible">
                        <line x1="10" y1="50" x2="130" y2="50" stroke="#f3a33a" strokeDasharray="2" />
                        <text x="135" y="53" className="font-mono text-[8px] fill-[#f3a33a]">Reclaim ($204)</text>
                        <line x1="70" y1="15" x2="70" y2="120" stroke="#43d18b" strokeWidth="2" />
                        <rect x="55" y="30" width="30" height="70" fill="#43d18b" rx="2" />
                        <circle cx="70" cy="30" r="3" fill="#43d18b" />
                        <text x="92" y="33" className="font-mono text-[9px] fill-[#eef3f8]">Close</text>
                        <text x="92" y="103" className="font-mono text-[9px] fill-[#a8b5c2]">Open</text>
                      </svg>
                      <p className="text-[9px] text-[#a8b5c2] mt-1.5 leading-tight">
                        Price closes near the high and holds above the reclaim zone.
                      </p>
                    </div>
                    <div className="flex flex-col items-center rounded bg-[#0b1016] p-2 text-center">
                      <p className="font-mono text-[10px] font-bold text-[#ff6b6b]">Scenario B: Fakeout Wick</p>
                      <p className="text-[9px] text-[#8190a0] mt-0.5">Sellers reject the spike</p>
                      <svg viewBox="0 0 140 140" className="w-full max-w-[100px] mt-2 overflow-visible">
                        <line x1="10" y1="50" x2="130" y2="50" stroke="#f3a33a" strokeDasharray="2" />
                        <text x="135" y="53" className="font-mono text-[8px] fill-[#f3a33a]">Reclaim ($204)</text>
                        <line x1="70" y1="15" x2="70" y2="120" stroke="#ff6b6b" strokeWidth="2" />
                        <rect x="55" y="70" width="30" height="30" fill="#ff6b6b" rx="2" />
                        <circle cx="70" cy="70" r="3" fill="#ff6b6b" />
                        <path d="M 70 15 L 85 15" stroke="#8190a0" strokeWidth="0.8" />
                        <text x="90" y="18" className="font-mono text-[8px] fill-[#8190a0]">Spike (High)</text>
                        <text x="92" y="73" className="font-mono text-[9px] fill-[#eef3f8]">Close</text>
                        <text x="92" y="103" className="font-mono text-[9px] fill-[#a8b5c2]">Open</text>
                      </svg>
                      <p className="text-[9px] text-[#a8b5c2] mt-1.5 leading-tight">
                        Price wicks up to test reclaim but closes back down near the lows.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-[#1b2530] pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">
                    Real Chart Examples & Strategy
                  </p>
                  <div className="mt-2 space-y-1.5 font-mono text-[11px] text-[#a8b5c2] leading-normal">
                    <p>
                      • <span className="text-[#eef3f8] font-bold">SPCX Reversal (17 Jun 2026):</span> Flush low at $195.13 was defended on a pullback at $200.50 (forming a higher low). Price bounced to $204.88, testing the middle Bollinger Band at $204.79.
                    </p>
                    <p>
                      • <span className="text-[#eef3f8] font-bold">The Confirmation:</span> Chasing the immediate 1m candle spike at 00:20:14 when it was only 14s old was risky. The mature play was waiting for the 5m candle to close above $204.80 to confirm the higher low was actually held.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Live Example Callout */}
            {liveExampleSignal && (
              <div className="rounded border border-[#1d7f55] bg-[#0d251b] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#43d18b]">
                  Live example on the radar
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-semibold text-[#eef3f8]">
                      {liveExampleSignal.symbol}
                    </p>
                    <p className="font-mono text-xs text-[#a8b5c2]">
                      {liveExampleSignal.signalType.replaceAll('_', ' ')} •{' '}
                      {liveExampleSignal.status.replaceAll('_', ' ')}
                    </p>
                  </div>
                  <Link
                    href={`/tickers/${liveExampleSignal.symbol}`}
                    className="inline-flex items-center gap-1 rounded border border-[#43d18b] bg-[#0d1117] px-2 py-1 font-mono text-xs text-[#43d18b] transition hover:bg-[#151c25]"
                  >
                    View <ArrowUpRight size={12} />
                  </Link>
                </div>
              </div>
            )}

            {/* Navigation Links */}
            <div className="border-t border-[#1b2530] pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">
                Explore more
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/radar"
                  className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-xs text-[#a8b5c2] transition hover:text-[#eef3f8]"
                >
                  Go to Radar <ArrowUpRight size={12} />
                </Link>
                <Link
                  href="/portfolio"
                  className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-xs text-[#a8b5c2] transition hover:text-[#eef3f8]"
                >
                  Portfolio <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
