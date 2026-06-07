'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search, X } from 'lucide-react';
import type { SignalRow } from '@/types/scanner';
import { EDUCATION_MODULES, getCategories, getModule, getModulesByCategory } from '@/lib/education';

interface EducationHubProps {
  signals: SignalRow[];
}

export function EducationHub({ signals }: EducationHubProps) {
  const [selectedModuleId, setSelectedModuleId] = useState<string>(EDUCATION_MODULES[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

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
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setCategoryFilter(null)}
              className={`rounded px-2 py-1 text-left font-mono text-xs transition ${
                categoryFilter === null
                  ? 'border border-[#f3a33a] bg-[#2a1f0f] text-[#f3a33a]'
                  : 'border border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:text-[#dbe5ee]'
              }`}
            >
              All Topics
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`rounded px-2 py-1 text-left font-mono text-xs transition ${
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
          <div className="border-b border-[#1b2530] px-4 py-4 md:px-5 md:py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">
              {selectedModule.category}
            </p>
            <h2 className="mt-2 font-mono text-lg font-semibold text-[#eef3f8] md:text-xl">
              {selectedModule.title}
            </h2>
          </div>

          <div className="space-y-4 overflow-y-auto px-4 py-4 md:px-5 md:py-5" style={{ maxHeight: 'calc(100vh - 200px)' }}>
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
