'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import type { IntelligenceItem, IntelligenceCategory, Sentiment, Relevance, TickerHype } from '@/lib/intelligence';
import { filterIntelligenceFeed, sortIntelligenceFeed } from '@/lib/intelligence';
import { SourceFavicon } from '@/components/SourceFavicon';
import { relativeTime, trendArrow } from '@/lib/format';

interface IntelligenceFeedProps {
  feed: IntelligenceItem[];
  hypeMap: Record<string, TickerHype>;
}

type FilterKey = 'ticker' | 'category' | 'sentiment' | 'relevance';

/**
 * IntelligenceFeed - dense client-side filterable market intelligence feed.
 */
export function IntelligenceFeed({ feed, hypeMap }: IntelligenceFeedProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    ticker?: string;
    category?: IntelligenceCategory;
    sentiment?: Sentiment;
    relevance?: Relevance;
  }>({});

  // Compute top hype tickers
  const topHypeTickers = useMemo(() => {
    return Object.values(hypeMap)
      .sort((a, b) => b.hypeScore - a.hypeScore)
      .slice(0, 5);
  }, [hypeMap]);

  // Filter and sort
  const filtered = useMemo(() => {
    const f = filterIntelligenceFeed(feed, filters);
    return sortIntelligenceFeed(f);
  }, [feed, filters]);

  // Unique categories for filter
  const categories = useMemo(
    () => Array.from(new Set(feed.map((item) => item.category))).sort(),
    [feed],
  );

  // Build unique tickers
  const allTickers = useMemo(
    () => Array.from(new Set(feed.flatMap((item) => item.tickers))).sort(),
    [feed],
  );

  const toggleFilter = (key: FilterKey, value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key as keyof typeof prev] === value ? undefined : (value as never),
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  // Sentiment and relevance badges
  const sentimentColour = {
    positive: 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b]',
    neutral: 'border-[#263241] bg-[#0d141c] text-[#a8b5c2]',
    negative: 'border-[#7f1d1d] bg-[#2b1214] text-[#ff6b6b]',
  };

  const relevanceColour = {
    high: 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b]',
    medium: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]',
    low: 'border-[#263241] bg-[#0d141c] text-[#8190a0]',
  };

  return (
    <div className="space-y-3 pb-20 md:pb-0">
      {/* Hype meter panel */}
      <section className="terminal-panel rounded-md p-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-[#f3a33a]" size={16} />
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Hype meter</h2>
        </div>
        <p className="mt-1 text-xs text-[#8190a0]">Hype sits beside technical score, never replaces it.</p>
        <div className="mt-3 space-y-2">
          {topHypeTickers.map((ticker) => (
            <div className="flex items-center justify-between gap-2 border-b border-[#1b2530] pb-2 last:border-b-0 last:pb-0" key={ticker.ticker}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-[#eef3f8]">{ticker.ticker}</span>
                <span className="text-xs text-[#8190a0]">{ticker.recentCount} recent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 rounded-full bg-[#1b2530]">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      ticker.trend === 'rising' ? 'bg-[#43d18b]' : ticker.trend === 'cooling' ? 'bg-[#ff6b6b]' : 'bg-[#f3a33a]'
                    }`}
                    style={{ width: `${ticker.hypeScore}%` }}
                  />
                </div>
                <span className="text-right font-mono text-xs font-semibold text-[#dbe5ee]">{ticker.hypeScore}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Filter bar */}
      <section className="terminal-panel rounded-md p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Filters</h2>
          {Object.values(filters).some((v) => v !== undefined) && (
            <button
              onClick={clearFilters}
              className="text-xs text-[#f3a33a] transition hover:text-[#eef3f8]"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="mt-3 space-y-3">
          {/* Ticker filter */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.1em] text-[#a8b5c2]">Ticker</p>
            <div className="flex flex-wrap gap-2">
              {allTickers.map((ticker) => (
                <button
                  key={ticker}
                  onClick={() => toggleFilter('ticker', ticker)}
                  className={`rounded border px-2 py-1 text-xs font-mono transition ${
                    filters.ticker === ticker
                      ? 'border-[#f3a33a] bg-[#2a1f0f] text-[#f3a33a]'
                      : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:border-[#f3a33a]'
                  }`}
                >
                  {ticker}
                </button>
              ))}
            </div>
          </div>

          {/* Category filter */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.1em] text-[#a8b5c2]">Category</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => toggleFilter('category', category)}
                  className={`rounded border px-2 py-1 text-xs transition ${
                    filters.category === category
                      ? 'border-[#60a5fa] bg-[#0f1e2e] text-[#60a5fa]'
                      : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:border-[#60a5fa]'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Sentiment filter */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.1em] text-[#a8b5c2]">Sentiment</p>
            <div className="flex flex-wrap gap-2">
              {(['positive', 'neutral', 'negative'] as const).map((sentiment) => (
                <button
                  key={sentiment}
                  onClick={() => toggleFilter('sentiment', sentiment)}
                  className={`rounded border px-2 py-1 text-xs capitalize transition ${
                    filters.sentiment === sentiment
                      ? `${sentimentColour[sentiment]} border-current`
                      : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:border-[#263241]'
                  }`}
                >
                  {sentiment}
                </button>
              ))}
            </div>
          </div>

          {/* Relevance filter */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.1em] text-[#a8b5c2]">Relevance</p>
            <div className="flex flex-wrap gap-2">
              {(['high', 'medium', 'low'] as const).map((relevance) => (
                <button
                  key={relevance}
                  onClick={() => toggleFilter('relevance', relevance)}
                  className={`rounded border px-2 py-1 text-xs capitalize transition ${
                    filters.relevance === relevance
                      ? `${relevanceColour[relevance]} border-current`
                      : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:border-[#263241]'
                  }`}
                >
                  {relevance}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Intelligence feed */}
      <section className="terminal-panel rounded-md">
        <div className="border-b border-[#1b2530] px-3 py-3">
          <h1 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">
            Intelligence ({filtered.length})
          </h1>
          <p className="mt-1 font-mono text-xs text-[#8190a0]">Dense ticker-tagged market and company news.</p>
        </div>

        <div className="divide-y divide-[#1b2530]">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-sm text-[#8190a0]">No items match your filters.</p>
            </div>
          ) : (
            filtered.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full text-left transition hover:bg-[#101720]"
                >
                  {/* Compact row */}
                  <div className="flex flex-col gap-2 px-3 py-3 md:flex-row md:items-center md:gap-3">
                    {/* Source + tickers */}
                    <div className="flex min-w-0 items-center gap-2">
                      <SourceFavicon domain={item.sourceDomain} sourceName={item.sourceName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1">
                          {item.tickers.map((ticker) => (
                            <span key={ticker} className="font-mono text-xs font-semibold text-[#f3a33a]">
                              {ticker}
                            </span>
                          ))}
                          <span className="text-xs text-[#8190a0]">•</span>
                          <span className="text-xs text-[#a8b5c2]">{item.sourceName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Category chip */}
                    <div className="hidden gap-2 lg:flex lg:items-center">
                      <span className="inline-block rounded border border-[#263241] bg-[#0d141c] px-2 py-1 text-xs text-[#a8b5c2]">
                        {item.category}
                      </span>
                    </div>

                    {/* Headline (full - wraps so it's readable) + when (mobile, where the
                        right-side timestamp is hidden) so it's never undated. */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug text-[#eef3f8]">{item.headline}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#8190a0] sm:hidden">{relativeTime(item.publishedAt)}</p>
                    </div>

                    {/* Sentiment dot */}
                    <div className="hidden gap-2 xs:flex xs:items-center">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          item.sentiment === 'positive'
                            ? 'bg-[#43d18b]'
                            : item.sentiment === 'negative'
                              ? 'bg-[#ff6b6b]'
                              : 'bg-[#a8b5c2]'
                        }`}
                        title={item.sentiment}
                      />
                    </div>

                    {/* Relevance badge */}
                    <div className="hidden gap-2 sm:flex sm:items-center">
                      <span className={`rounded border px-2 py-1 text-xs ${relevanceColour[item.relevance]}`}>
                        {item.relevance}
                      </span>
                    </div>

                    {/* Hype arrow */}
                    <div className="hidden gap-1 text-[#f3a33a] lg:flex lg:items-center">
                      <span className="text-xs">{trendArrow(item.hypeImpact === 'rising' ? 1 : item.hypeImpact === 'cooling' ? -1 : 0)}</span>
                    </div>

                    {/* Relative time */}
                    <div className="hidden gap-2 sm:flex sm:items-center">
                      <span className="text-xs text-[#8190a0]">{relativeTime(item.publishedAt)}</span>
                    </div>

                    {/* Expand toggle */}
                    <div className="flex items-center justify-end">
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-[#f3a33a]" />
                      ) : (
                        <ChevronDown size={16} className="text-[#8190a0]" />
                      )}
                    </div>
                  </div>

                  {/* Expanded row */}
                  {isExpanded && (
                    <div className="border-t border-[#1b2530] bg-[#0b1016] px-3 py-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        {/* Summary */}
                        <div>
                          <p className="text-xs uppercase tracking-[0.1em] text-[#a8b5c2]">Summary</p>
                          <p className="mt-2 text-sm leading-5 text-[#dbe5ee]">{item.summary}</p>
                        </div>

                        {/* Metadata */}
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs uppercase tracking-[0.1em] text-[#a8b5c2]">Source type</p>
                            <p className="mt-1 text-xs text-[#eef3f8]">{item.sourceType.replaceAll('_', ' ')}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.1em] text-[#a8b5c2]">Sentiment</p>
                            <p className={`mt-1 text-xs capitalize ${sentimentColour[item.sentiment]}`}>
                              {item.sentiment}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.1em] text-[#a8b5c2]">Confidence</p>
                            <p className="mt-1 text-xs text-[#eef3f8]">{item.confidence}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.1em] text-[#a8b5c2]">Hype impact</p>
                            <div className="mt-1 flex items-center gap-1">
                              <span className="text-xs text-[#f3a33a]">{trendArrow(item.hypeImpact === 'rising' ? 1 : item.hypeImpact === 'cooling' ? -1 : 0)}</span>
                              <span className="text-xs text-[#eef3f8]">{item.hypeImpact}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
