'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { FundamentalsReport } from '@/lib/fundamentals';
import { TickerLogo } from '@/components/TickerLogo';
import {
  formatNumber,
  formatPercent,
  formatSignedPercent,
  toneClass,
} from '@/lib/format';
import { pageTitleClass } from '@/lib/ui';

interface FundamentalsViewProps {
  reports: FundamentalsReport[];
}

type SortField = keyof FundamentalsReport;
type SortDirection = 'asc' | 'desc';

export function FundamentalsView({ reports }: FundamentalsViewProps) {
  const [sortField, setSortField] = useState<SortField>('qualityScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const sortedReports = useMemo(() => {
    const sorted = [...reports].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1;

      // Number comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // String comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return 0;
    });

    return sorted;
  }, [reports, sortField, sortDirection]);

  const selectedReport = selectedTicker
    ? sortedReports.find((r) => r.symbol === selectedTicker)
    : null;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const valuationClass = (read: 'rich' | 'fair' | 'cheap'): string => {
    switch (read) {
      case 'rich':
        return 'text-[#ff6b6b] font-semibold';
      case 'cheap':
        return 'text-[#43d18b] font-semibold';
      case 'fair':
        return 'text-[#f3a33a] font-semibold';
    }
  };

  const qualityGrade = (score: number): string => {
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  return (
    <div className="space-y-3 pb-20 md:pb-0">
      <section className="grid gap-3 xl:grid-cols-[1fr_360px]">
        {/* Main table */}
        <div className="terminal-panel overflow-hidden rounded-md">
          <div className="border-b border-[#1b2530] px-3 py-3">
            <h1 className={pageTitleClass}>
              Fundamentals
            </h1>
            <p className="mt-1 font-mono text-xs text-[#8190a0]">
              Business quality metrics. Tap a ticker for detail.
            </p>
            <p className="mt-1.5 text-[10px] leading-relaxed text-[#8190a0]">
              <span className="text-[#a8b5c2]">Gross margin</span> = profit kept after direct costs ·{' '}
              <span className="text-[#a8b5c2]">Op margin</span> = profit after running the business ·{' '}
              <span className="text-[#a8b5c2]">FCF</span> = cash left after spending to run + grow ·{' '}
              <span className="text-[#a8b5c2]">P/E</span> = price vs earnings ·{' '}
              <span className="text-[#a8b5c2]">Quality</span> = our 0-100 blend of margins, growth + cash strength.
            </p>
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[1400px] text-left text-xs">
              <thead className="bg-[#0b1016] font-mono uppercase text-[#8190a0]">
                <tr>
                  <th
                    onClick={() => handleSort('symbol')}
                    className="cursor-pointer px-3 py-2 hover:text-[#dbe5ee]"
                  >
                    <div className="flex items-center gap-1">
                      Ticker
                      {sortField === 'symbol' && (
                        <>
                          {sortDirection === 'desc' ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronUp size={12} />
                          )}
                        </>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('marketCap')}
                    className="cursor-pointer px-3 py-2 text-right hover:text-[#dbe5ee]"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Mkt Cap
                      {sortField === 'marketCap' && (
                        <>
                          {sortDirection === 'desc' ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronUp size={12} />
                          )}
                        </>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('revenueGrowthYoY')}
                    className="cursor-pointer px-3 py-2 text-right hover:text-[#dbe5ee]"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Rev Growth
                      {sortField === 'revenueGrowthYoY' && (
                        <>
                          {sortDirection === 'desc' ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronUp size={12} />
                          )}
                        </>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('grossMargin')}
                    className="cursor-pointer px-3 py-2 text-right hover:text-[#dbe5ee]"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Gross Margin
                      {sortField === 'grossMargin' && (
                        <>
                          {sortDirection === 'desc' ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronUp size={12} />
                          )}
                        </>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('operatingMargin')}
                    className="cursor-pointer px-3 py-2 text-right hover:text-[#dbe5ee]"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Op Margin
                      {sortField === 'operatingMargin' && (
                        <>
                          {sortDirection === 'desc' ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronUp size={12} />
                          )}
                        </>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('freeCashFlow')}
                    className="cursor-pointer px-3 py-2 text-right hover:text-[#dbe5ee]"
                  >
                    <div className="flex items-center justify-end gap-1">
                      FCF
                      {sortField === 'freeCashFlow' && (
                        <>
                          {sortDirection === 'desc' ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronUp size={12} />
                          )}
                        </>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('pe')}
                    className="cursor-pointer px-3 py-2 text-right hover:text-[#dbe5ee]"
                  >
                    <div className="flex items-center justify-end gap-1">
                      P/E
                      {sortField === 'pe' && (
                        <>
                          {sortDirection === 'desc' ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronUp size={12} />
                          )}
                        </>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('priceToSales')}
                    className="cursor-pointer px-3 py-2 text-right hover:text-[#dbe5ee]"
                  >
                    <div className="flex items-center justify-end gap-1">
                      P/S
                      {sortField === 'priceToSales' && (
                        <>
                          {sortDirection === 'desc' ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronUp size={12} />
                          )}
                        </>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('evToEbitda')}
                    className="cursor-pointer px-3 py-2 text-right hover:text-[#dbe5ee]"
                  >
                    <div className="flex items-center justify-end gap-1">
                      EV/EBITDA
                      {sortField === 'evToEbitda' && (
                        <>
                          {sortDirection === 'desc' ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronUp size={12} />
                          )}
                        </>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('qualityScore')}
                    className="cursor-pointer px-3 py-2 text-right hover:text-[#dbe5ee]"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Quality
                      {sortField === 'qualityScore' && (
                        <>
                          {sortDirection === 'desc' ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronUp size={12} />
                          )}
                        </>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('valuationRead')}
                    className="cursor-pointer px-3 py-2 text-right hover:text-[#dbe5ee]"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Valuation
                      {sortField === 'valuationRead' && (
                        <>
                          {sortDirection === 'desc' ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronUp size={12} />
                          )}
                        </>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b2530]">
                {sortedReports.map((report) => (
                  <tr
                    key={report.symbol}
                    onClick={() => setSelectedTicker(report.symbol)}
                    className={`cursor-pointer font-mono text-[#dbe5ee] transition ${
                      selectedTicker === report.symbol
                        ? 'bg-[#151c25]'
                        : 'hover:bg-[#101720]'
                    }`}
                  >
                    <td className="px-3 py-2 font-semibold text-[#eef3f8]">
                      <span className="inline-flex items-center gap-1.5">
                        <TickerLogo symbol={report.symbol} companyName={report.companyName} size={16} />
                        {report.symbol}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      ${formatNumber(report.marketCap, 0)}B
                    </td>
                    <td
                      className={`px-3 py-2 text-right ${toneClass(
                        report.revenueGrowthYoY
                      )}`}
                    >
                      {formatSignedPercent(report.revenueGrowthYoY, 1)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatPercent(report.grossMargin, 1)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatPercent(report.operatingMargin, 1)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      ${formatNumber(report.freeCashFlow, 0)}M
                    </td>
                    <td className="px-3 py-2 text-right">
                      {report.pe > 0 && report.pe < 500
                        ? formatNumber(report.pe, 1)
                        : '-'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {report.priceToSales > 0 && report.priceToSales < 200
                        ? formatNumber(report.priceToSales, 1)
                        : '-'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {report.evToEbitda > 0 && report.evToEbitda < 300
                        ? formatNumber(report.evToEbitda, 1)
                        : '-'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-block min-w-12 font-semibold">
                        {qualityGrade(report.qualityScore)}{' '}
                        {formatNumber(report.qualityScore, 0)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={valuationClass(report.valuationRead)}>
                        {report.valuationRead}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="divide-y divide-[#1b2530] md:hidden">
            {sortedReports.map((report) => (
              <div
                key={report.symbol}
                onClick={() =>
                  setSelectedTicker(
                    selectedTicker === report.symbol ? null : report.symbol
                  )
                }
                className={`cursor-pointer px-3 py-3 transition ${
                  selectedTicker === report.symbol ? 'bg-[#151c25]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <TickerLogo symbol={report.symbol} companyName={report.companyName} size={20} />
                    <div className="min-w-0">
                      <p className="font-mono text-base font-semibold">{report.symbol}</p>
                      <p className="truncate font-mono text-[11px] text-[#8190a0]">{report.companyName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold">
                      {qualityGrade(report.qualityScore)}{' '}
                      {formatNumber(report.qualityScore, 0)}
                    </p>
                    <p className={`font-mono text-xs ${valuationClass(report.valuationRead)}`}>
                      {report.valuationRead}
                    </p>
                  </div>
                </div>
                <div className="mt-2 font-mono text-xs text-[#a8b5c2]">
                  <p>
                    ${formatNumber(report.marketCap, 0)}B mkt cap | Rev{' '}
                    {formatSignedPercent(report.revenueGrowthYoY, 0)} YoY
                  </p>
                  <p>
                    GM {formatPercent(report.grossMargin, 0)} | OM{' '}
                    {formatPercent(report.operatingMargin, 0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {selectedReport && (
          <aside className="space-y-3">
            <section className="terminal-panel overflow-hidden rounded-md p-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-[#eef3f8]">
                  {selectedReport.symbol}
                </h2>
                <button
                  onClick={() => setSelectedTicker(null)}
                  className="text-[#8190a0] transition hover:text-[#dbe5ee]"
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 font-mono text-xs text-[#8190a0]">
                {selectedReport.companyName}
              </p>

              {/* Growth summary */}
              <div className="mt-4 space-y-2 border-t border-[#1b2530] pt-3">
                <p className="text-xs uppercase tracking-[0.15em] text-[#8190a0]">
                  Growth
                </p>
                <p className="font-mono text-sm leading-relaxed text-[#dbe5ee]">
                  Revenue growing{' '}
                  <span className={toneClass(selectedReport.revenueGrowthYoY)}>
                    {formatSignedPercent(selectedReport.revenueGrowthYoY, 0)}
                  </span>{' '}
                  YoY; earnings{' '}
                  <span className={toneClass(selectedReport.epsGrowth)}>
                    {formatSignedPercent(selectedReport.epsGrowth, 0)}
                  </span>{' '}
                  YoY.
                </p>
              </div>

              {/* Profitability summary */}
              <div className="mt-3 space-y-2 border-t border-[#1b2530] pt-3">
                <p className="text-xs uppercase tracking-[0.15em] text-[#8190a0]">
                  Profitability
                </p>
                <p className="font-mono text-sm leading-relaxed text-[#dbe5ee]">
                  Gross margin {formatPercent(selectedReport.grossMargin, 1)};
                  operating margin{' '}
                  <span
                    className={
                      selectedReport.operatingMargin > 20
                        ? 'text-[#43d18b]'
                        : selectedReport.operatingMargin < 0
                          ? 'text-[#ff6b6b]'
                          : ''
                    }
                  >
                    {formatPercent(selectedReport.operatingMargin, 1)}
                  </span>
                  .
                </p>
                <p className="font-mono text-sm leading-relaxed text-[#dbe5ee]">
                  Free cash flow{' '}
                  <span
                    className={toneClass(selectedReport.freeCashFlow)}
                  >
                    ${formatNumber(selectedReport.freeCashFlow, 0)}M
                  </span>{' '}
                  annually.
                </p>
              </div>

              {/* Balance sheet */}
              <div className="mt-3 space-y-2 border-t border-[#1b2530] pt-3">
                <p className="text-xs uppercase tracking-[0.15em] text-[#8190a0]">
                  Balance Sheet
                </p>
                <p className="font-mono text-xs leading-relaxed text-[#a8b5c2]">
                  Cash ${formatNumber(selectedReport.cash, 0)}M | Debt{' '}
                  {selectedReport.debt > 0
                    ? `$${formatNumber(selectedReport.debt, 0)}M`
                    : 'minimal'}
                  | EV ${formatNumber(selectedReport.enterpriseValue, 0)}B
                </p>
              </div>

              {/* Valuation summary */}
              <div className="mt-3 space-y-2 border-t border-[#1b2530] pt-3">
                <p className="text-xs uppercase tracking-[0.15em] text-[#8190a0]">
                  Valuation
                </p>
                <p className="font-mono text-sm leading-relaxed text-[#dbe5ee]">
                  Forward P/E{' '}
                  <span className={`font-semibold ${valuationClass(selectedReport.valuationRead)}`}>
                    {selectedReport.forwardPe > 0 && selectedReport.forwardPe < 500
                      ? formatNumber(selectedReport.forwardPe, 1)
                      : '-'}
                  </span>{' '}
                  ({selectedReport.valuationRead}); P/S{' '}
                  {selectedReport.priceToSales > 0 && selectedReport.priceToSales < 200
                    ? formatNumber(selectedReport.priceToSales, 1)
                    : '-'}
                  ; EV/EBITDA{' '}
                  {selectedReport.evToEbitda > 0 && selectedReport.evToEbitda < 300
                    ? formatNumber(selectedReport.evToEbitda, 1)
                    : '-'}
                  .
                </p>
              </div>

              {/* Quality score */}
              <div className="mt-3 space-y-2 border-t border-[#1b2530] pt-3">
                <p className="text-xs uppercase tracking-[0.15em] text-[#8190a0]">
                  Quality Score
                </p>
                <div className="flex items-baseline gap-3">
                  <p className="font-mono text-2xl font-semibold">
                    {qualityGrade(selectedReport.qualityScore)}
                  </p>
                  <p className="font-mono text-sm text-[#dbe5ee]">
                    {formatNumber(selectedReport.qualityScore, 0)} / 100
                  </p>
                </div>
                <p className="font-mono text-xs leading-relaxed text-[#a8b5c2]">
                  Composite: growth 40%, margin 30%, FCF 30%.
                </p>
              </div>
            </section>
          </aside>
        )}
      </section>
    </div>
  );
}
