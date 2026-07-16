'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  calculateCompoundInterest,
  calculateDividends,
  calculatePositionSizing,
  calculateCAGR,
  calculateRule72,
  calculateDCA,
  calculateProfitTarget,
  type CompoundInterestResult,
  type DividendResult,
  type PositionSizingResult,
  type CAGRResult,
  type Rule72Result,
  type DCAResult,
  type ProfitTargetResult,
} from '@/lib/calculators';
import { formatCurrency, formatNumber, formatPercent, formatSignedPercent } from '@/lib/format';

type Tab = 'compound' | 'dividends' | 'position' | 'cagr' | 'dca' | 'profit';

const tabLabels: Record<Tab, string> = {
  compound: 'Compound Interest',
  dividends: 'Dividends',
  position: 'Position Size',
  cagr: 'CAGR / Rule 72',
  dca: 'Dollar-Cost Avg',
  profit: 'Profit Target',
};

// SVG Line chart helper for light data visualization
function SimpleLineChart({
  data,
  width = 280,
  height = 120,
  label,
}: {
  data: Array<{ x: number; y: number }>;
  width?: number;
  height?: number;
  label: string;
}) {
  if (data.length < 2) return null;

  const minY = Math.min(...data.map((d) => d.y));
  const maxY = Math.max(...data.map((d) => d.y));
  const minX = Math.min(...data.map((d) => d.x));
  const maxX = Math.max(...data.map((d) => d.x));

  const padding = 20;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  const yRange = maxY - minY || 1;
  const xRange = maxX - minX || 1;

  const points = data.map((d) => {
    const x = padding + ((d.x - minX) / xRange) * chartWidth;
    const y = height - padding - ((d.y - minY) / yRange) * chartHeight;
    return `${x},${y}`;
  });

  const pathData = `M ${points.join(' L ')}`;

  return (
    <div className="mt-3 flex flex-col items-center">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full" xmlns="http://www.w3.org/2000/svg">
        {/* Grid lines */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#263241" strokeWidth="1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#263241" strokeWidth="1" />

        {/* Path */}
        <path d={pathData} stroke="#43d18b" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />

        {/* Gradient fill under path */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#43d18b', stopOpacity: 0.2 }} />
            <stop offset="100%" style={{ stopColor: '#43d18b', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path
          d={`${pathData} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`}
          fill="url(#gradient)"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="mt-1 text-xs text-[#8190a0]">{label}</p>
    </div>
  );
}

export function CalculatorsView() {
  const [activeTab, setActiveTab] = useState<Tab>('compound');

  // Compound Interest state
  const [ciPrincipal, setCiPrincipal] = useState(10000);
  const [ciMonthly, setCiMonthly] = useState(500);
  const [ciRate, setCiRate] = useState(7);
  const [ciYears, setCiYears] = useState(10);
  const [ciCompounding, setCiCompounding] = useState(12);
  const [ciResult, setCiResult] = useState<CompoundInterestResult | null>(null);

  // Dividend state
  const [divInvestment, setDivInvestment] = useState(10000);
  const [divPrice, setDivPrice] = useState(50);
  const [divYield, setDivYield] = useState(3.5);
  const [divYears, setDivYears] = useState(10);
  const [divDrip, setDivDrip] = useState(false);
  const [divGrowth, setDivGrowth] = useState(0);
  const [divResult, setDivResult] = useState<DividendResult | null>(null);

  // Position Sizing state
  const [posAccount, setPosAccount] = useState(50000);
  const [posRisk, setPosRisk] = useState(1);
  const [posEntry, setPosEntry] = useState(100);
  const [posStop, setPosStop] = useState(95);
  const [posResult, setPosResult] = useState<PositionSizingResult | null>(null);

  // CAGR state
  const [cagrStart, setCAGRStart] = useState(10000);
  const [cagrEnd, setCAGREnd] = useState(20000);
  const [cagrYears, setCAGRYears] = useState(5);
  const [cagrResult, setCAGRResult] = useState<CAGRResult | null>(null);

  // Rule of 72 state
  const [r72Result, setR72Result] = useState<Rule72Result | null>(null);

  // DCA state
  const [dcaAmount, setDcaAmount] = useState(1000);
  const [dcaPeriods, setDcaPeriods] = useState(12);
  const [dcaCurrentPrice, setDcaCurrentPrice] = useState(50);
  const [dcaAveragePrice, setDcaAveragePrice] = useState(48);
  const [dcaResult, setDcaResult] = useState<DCAResult | null>(null);

  // Profit Target state
  const [profitEntry, setProfitEntry] = useState(100);
  const [profitTarget, setProfitTarget] = useState(10);
  const [profitStop, setProfitStop] = useState(5);
  const [profitShares, setProfitShares] = useState(100);
  const [profitResult, setProfitResult] = useState<ProfitTargetResult | null>(null);

  // Handlers
  const handleCompoundInterest = () => {
    const result = calculateCompoundInterest(ciPrincipal, ciMonthly, ciRate, ciYears, ciCompounding);
    setCiResult(result);
  };

  const handleDividends = () => {
    const result = calculateDividends(divInvestment, divPrice, divYield, divYears, divDrip, divGrowth);
    setDivResult(result);
  };

  const handlePositionSizing = () => {
    const result = calculatePositionSizing(posAccount, posRisk, posEntry, posStop);
    setPosResult(result);
  };

  const handleCAGR = () => {
    const cagrRes = calculateCAGR(cagrStart, cagrEnd, cagrYears);
    setCAGRResult(cagrRes);
    const r72Res = calculateRule72(cagrRes.annualGrowthRate * 100);
    setR72Result(r72Res);
  };

  const handleDCA = () => {
    // Generate prices array for DCA
    const prices: number[] = [];
    for (let i = 0; i < dcaPeriods; i++) {
      // Interpolate between average price and current price
      const t = dcaPeriods > 1 ? i / (dcaPeriods - 1) : 0;
      prices.push(dcaAveragePrice + t * (dcaCurrentPrice - dcaAveragePrice) + (Math.random() - 0.5) * 2);
    }
    const result = calculateDCA(dcaAmount, dcaPeriods, prices, dcaCurrentPrice);
    setDcaResult(result);
  };

  const handleProfitTarget = () => {
    const result = calculateProfitTarget(profitEntry, profitTarget, profitStop, profitShares);
    setProfitResult(result);
  };

  // Recompute on input changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="space-y-3 pb-20 md:pb-0">
      {/* Tab Navigation */}
      <div className="terminal-panel overflow-hidden rounded-md">
        <div className="flex flex-wrap gap-1 border-b border-[#1b2530] px-3 py-3">
          {(Object.keys(tabLabels) as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`rounded px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                activeTab === tab
                  ? 'bg-[#1a3a2a] text-[#43d18b] border border-[#43d18b]'
                  : 'bg-[#0d141c] text-[#a8b5c2] border border-[#263241] hover:text-[#eef3f8]'
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Compound Interest Tab */}
      {activeTab === 'compound' && (
        <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="terminal-panel overflow-hidden rounded-md">
            <div className="border-b border-[#1b2530] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Compound Interest</p>
              <p className="mt-1 font-mono text-xs text-[#a8b5c2]">Project investment growth</p>
            </div>
            <div className="space-y-3 p-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Initial Principal ${ciPrincipal.toLocaleString()}</label>
                <input
                  type="range"
                  min="100"
                  max="100000"
                  step="500"
                  value={ciPrincipal}
                  onChange={(e) => {
                    setCiPrincipal(Number(e.target.value));
                    handleCompoundInterest();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Monthly Contribution ${ciMonthly.toLocaleString()}</label>
                <input
                  type="range"
                  min="0"
                  max="5000"
                  step="50"
                  value={ciMonthly}
                  onChange={(e) => {
                    setCiMonthly(Number(e.target.value));
                    handleCompoundInterest();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Annual Rate {ciRate.toFixed(2)}%</label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.1"
                  value={ciRate}
                  onChange={(e) => {
                    setCiRate(Number(e.target.value));
                    handleCompoundInterest();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Years {ciYears}</label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={ciYears}
                  onChange={(e) => {
                    setCiYears(Number(e.target.value));
                    handleCompoundInterest();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Compounding</label>
                <select
                  value={ciCompounding}
                  onChange={(e) => {
                    setCiCompounding(Number(e.target.value));
                    handleCompoundInterest();
                  }}
                  className="mt-1 w-full rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-xs text-[#eef3f8]"
                >
                  <option value={1}>Annual</option>
                  <option value={4}>Quarterly</option>
                  <option value={12}>Monthly</option>
                </select>
              </div>
              <p className="mt-4 border-t border-[#1b2530] pt-3 text-[11px] uppercase tracking-[0.14em] text-[#8190a0]">Estimates only - not financial advice</p>
            </div>
          </div>

          {ciResult && (
            <div className="terminal-panel overflow-hidden rounded-md">
              <div className="border-b border-[#1b2530] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#43d18b]">Projection</p>
              </div>
              <div className="space-y-3 p-3 font-mono text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-[#8190a0]">Final Balance</p>
                    <p className="mt-1 text-lg font-semibold text-[#eef3f8]">{formatCurrency(ciResult.finalBalance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8190a0]">Total Interest</p>
                    <p className="mt-1 text-lg font-semibold text-[#43d18b]">{formatCurrency(ciResult.totalInterest)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#8190a0]">Total Contributed</p>
                  <p className="mt-1 font-semibold text-[#dbe5ee]">{formatCurrency(ciResult.totalContributed)}</p>
                </div>
                {ciResult.periodBalances.length > 1 && (
                  <SimpleLineChart
                    data={ciResult.periodBalances.map((p) => ({ x: p.period, y: p.balance }))}
                    label="Balance over time"
                  />
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Dividends Tab */}
      {activeTab === 'dividends' && (
        <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="terminal-panel overflow-hidden rounded-md">
            <div className="border-b border-[#1b2530] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Dividend Income</p>
              <p className="mt-1 font-mono text-xs text-[#a8b5c2]">Model dividend growth + DRIP</p>
            </div>
            <div className="space-y-3 p-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Initial Investment ${divInvestment.toLocaleString()}</label>
                <input
                  type="range"
                  min="100"
                  max="100000"
                  step="500"
                  value={divInvestment}
                  onChange={(e) => {
                    setDivInvestment(Number(e.target.value));
                    handleDividends();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Share Price ${divPrice.toFixed(2)}</label>
                <input
                  type="range"
                  min="1"
                  max="500"
                  step="0.5"
                  value={divPrice}
                  onChange={(e) => {
                    setDivPrice(Number(e.target.value));
                    handleDividends();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Dividend Yield {divYield.toFixed(2)}%</label>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.1"
                  value={divYield}
                  onChange={(e) => {
                    setDivYield(Number(e.target.value));
                    handleDividends();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">
                  <input
                    type="checkbox"
                    checked={divDrip}
                    onChange={(e) => {
                      setDivDrip(e.target.checked);
                      handleDividends();
                    }}
                    className="rounded"
                  />
                  Enable DRIP Reinvestment
                </label>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Annual Dividend Growth {divGrowth.toFixed(2)}%</label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={divGrowth}
                  onChange={(e) => {
                    setDivGrowth(Number(e.target.value));
                    handleDividends();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Years {divYears}</label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={divYears}
                  onChange={(e) => {
                    setDivYears(Number(e.target.value));
                    handleDividends();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <p className="mt-4 border-t border-[#1b2530] pt-3 text-[11px] uppercase tracking-[0.14em] text-[#8190a0]">Estimates only - not financial advice</p>
            </div>
          </div>

          {divResult && (
            <div className="terminal-panel overflow-hidden rounded-md">
              <div className="border-b border-[#1b2530] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#43d18b]">Income Projection</p>
              </div>
              <div className="space-y-3 p-3 font-mono text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-[#8190a0]">Year 1 Income</p>
                    <p className="mt-1 text-lg font-semibold text-[#eef3f8]">{formatCurrency(divResult.year1Income)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8190a0]">Yield on Cost</p>
                    <p className="mt-1 text-lg font-semibold text-[#43d18b]">{formatPercent(divResult.yieldOnCost, 2)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#8190a0]">Total Projected Income</p>
                  <p className="mt-1 font-semibold text-[#dbe5ee]">{formatCurrency(divResult.totalProjectedIncome)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8190a0]">Final Portfolio Value</p>
                  <p className="mt-1 font-semibold text-[#dbe5ee]">{formatCurrency(divResult.finalPortfolioValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8190a0]">Final Share Count</p>
                  <p className="mt-1 font-semibold text-[#dbe5ee]">{formatNumber(divResult.finalShareCount, 4)}</p>
                </div>
                {divResult.projectedIncome.length > 1 && (
                  <SimpleLineChart
                    data={divResult.projectedIncome.map((p) => ({ x: p.year, y: p.income }))}
                    label="Annual income projection"
                  />
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Position Sizing Tab */}
      {activeTab === 'position' && (
        <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="terminal-panel overflow-hidden rounded-md">
            <div className="border-b border-[#1b2530] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Position Sizing</p>
              <p className="mt-1 font-mono text-xs text-[#a8b5c2]">Risk-based position calculator</p>
            </div>
            <div className="space-y-3 p-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Account Size ${posAccount.toLocaleString()}</label>
                <input
                  type="range"
                  min="1000"
                  max="1000000"
                  step="5000"
                  value={posAccount}
                  onChange={(e) => {
                    setPosAccount(Number(e.target.value));
                    handlePositionSizing();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Risk % per Trade {posRisk.toFixed(2)}%</label>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={posRisk}
                  onChange={(e) => {
                    setPosRisk(Number(e.target.value));
                    handlePositionSizing();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Entry Price ${posEntry.toFixed(2)}</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={posEntry}
                  onChange={(e) => {
                    setPosEntry(Number(e.target.value));
                    handlePositionSizing();
                  }}
                  className="mt-1 w-full rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-sm text-[#eef3f8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Stop Loss Price ${posStop.toFixed(2)}</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={posStop}
                  onChange={(e) => {
                    setPosStop(Number(e.target.value));
                    handlePositionSizing();
                  }}
                  className="mt-1 w-full rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-sm text-[#eef3f8]"
                />
              </div>
              <p className="mt-4 border-t border-[#1b2530] pt-3 text-[11px] uppercase tracking-[0.14em] text-[#8190a0]">Estimates only - not financial advice</p>
            </div>
          </div>

          {posResult && (
            <div className="terminal-panel overflow-hidden rounded-md">
              <div className="border-b border-[#1b2530] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#43d18b]">Position Details</p>
              </div>
              <div className="space-y-3 p-3 font-mono text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-[#8190a0]">Position Size</p>
                    <p className="mt-1 text-lg font-semibold text-[#eef3f8]">{formatCurrency(posResult.positionSizeDollars)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8190a0]">Shares</p>
                    <p className="mt-1 text-lg font-semibold text-[#eef3f8]">{formatNumber(posResult.positionSizeShares, 4)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#8190a0]">Risk $ per Trade</p>
                  <p className="mt-1 font-semibold text-[#ff6b6b]">{formatCurrency(posResult.riskDollars)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8190a0]">Risk:Reward Ratio</p>
                  <p className="mt-1 font-semibold text-[#dbe5ee]">1R per {posResult.rMultiple.toFixed(2)} shares</p>
                </div>
                <div>
                  <p className="text-xs text-[#8190a0]">Max Shares (100% account)</p>
                  <p className="mt-1 font-semibold text-[#dbe5ee]">{formatNumber(posResult.maxShares, 0)}</p>
                </div>
              </div>
              <div className="border-t border-[#1b2530] px-3 py-2.5">
                <Link
                  href="/plan"
                  className="flex items-center justify-between gap-2 rounded border border-[#27496b] bg-[#0d1b2b] px-2.5 py-2 text-[11px] text-[#7fb0ff] transition hover:bg-[#0f2236]"
                >
                  <span>
                    Take this to the <span className="font-semibold">Trade Plan</span> - sizes against a real name and your own
                    cash, then nets round-trip cost and expectancy against it.
                  </span>
                  <span className="shrink-0 font-mono">{'->'}</span>
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      {/* CAGR / Rule 72 Tab */}
      {activeTab === 'cagr' && (
        <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="terminal-panel overflow-hidden rounded-md">
            <div className="border-b border-[#1b2530] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">CAGR &amp; Rule of 72</p>
              <p className="mt-1 font-mono text-xs text-[#a8b5c2]">Growth rates and doubling times</p>
            </div>
            <div className="space-y-3 p-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Start Value ${cagrStart.toLocaleString()}</label>
                <input
                  type="range"
                  min="100"
                  max="100000"
                  step="500"
                  value={cagrStart}
                  onChange={(e) => {
                    setCAGRStart(Number(e.target.value));
                    handleCAGR();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">End Value ${cagrEnd.toLocaleString()}</label>
                <input
                  type="range"
                  min="100"
                  max="500000"
                  step="500"
                  value={cagrEnd}
                  onChange={(e) => {
                    setCAGREnd(Number(e.target.value));
                    handleCAGR();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Years {cagrYears}</label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={cagrYears}
                  onChange={(e) => {
                    setCAGRYears(Number(e.target.value));
                    handleCAGR();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <p className="mt-4 border-t border-[#1b2530] pt-3 text-[11px] uppercase tracking-[0.14em] text-[#8190a0]">Estimates only - not financial advice</p>
            </div>
          </div>

          {cagrResult && r72Result && (
            <div className="terminal-panel overflow-hidden rounded-md">
              <div className="border-b border-[#1b2530] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#43d18b]">Results</p>
              </div>
              <div className="space-y-3 p-3 font-mono text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-[#8190a0]">CAGR</p>
                    <p className="mt-1 text-lg font-semibold text-[#eef3f8]">{formatPercent(cagrResult.cagr, 2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8190a0]">Doubling Time</p>
                    <p className="mt-1 text-lg font-semibold text-[#43d18b]">{r72Result.doublingTimeYears.toFixed(1)} years</p>
                  </div>
                </div>
                <div className="border-t border-[#1b2530] pt-3">
                  <p className="text-xs text-[#8190a0]">Rule of 72 Explanation</p>
                  <p className="mt-2 text-xs leading-relaxed text-[#dbe5ee]">
                    Dividing 72 by the annual growth rate gives an estimate of how many years it takes for an investment to double. At {formatPercent(cagrResult.cagr, 2)},
                    money doubles roughly every {r72Result.doublingTimeYears.toFixed(1)} years.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* DCA Tab */}
      {activeTab === 'dca' && (
        <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="terminal-panel overflow-hidden rounded-md">
            <div className="border-b border-[#1b2530] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Dollar-Cost Averaging</p>
              <p className="mt-1 font-mono text-xs text-[#a8b5c2]">Simulate regular periodic investing</p>
            </div>
            <div className="space-y-3 p-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Periodic Amount ${dcaAmount.toLocaleString()}</label>
                <input
                  type="range"
                  min="100"
                  max="10000"
                  step="100"
                  value={dcaAmount}
                  onChange={(e) => {
                    setDcaAmount(Number(e.target.value));
                    handleDCA();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Periods (months) {dcaPeriods}</label>
                <input
                  type="range"
                  min="1"
                  max="120"
                  step="1"
                  value={dcaPeriods}
                  onChange={(e) => {
                    setDcaPeriods(Number(e.target.value));
                    handleDCA();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Current Price ${dcaCurrentPrice.toFixed(2)}</label>
                <input
                  type="range"
                  min="1"
                  max="500"
                  step="0.5"
                  value={dcaCurrentPrice}
                  onChange={(e) => {
                    setDcaCurrentPrice(Number(e.target.value));
                    handleDCA();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Average Price Paid ${dcaAveragePrice.toFixed(2)}</label>
                <input
                  type="range"
                  min="1"
                  max="500"
                  step="0.5"
                  value={dcaAveragePrice}
                  onChange={(e) => {
                    setDcaAveragePrice(Number(e.target.value));
                    handleDCA();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <p className="mt-4 border-t border-[#1b2530] pt-3 text-[11px] uppercase tracking-[0.14em] text-[#8190a0]">Estimates only - not financial advice</p>
            </div>
          </div>

          {dcaResult && (
            <div className="terminal-panel overflow-hidden rounded-md">
              <div className="border-b border-[#1b2530] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#43d18b]">DCA Summary</p>
              </div>
              <div className="space-y-3 p-3 font-mono text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-[#8190a0]">Total Units</p>
                    <p className="mt-1 text-lg font-semibold text-[#eef3f8]">{formatNumber(dcaResult.totalUnits, 4)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8190a0]">Avg Cost/Unit</p>
                    <p className="mt-1 text-lg font-semibold text-[#dbe5ee]">${dcaResult.averageCostPerUnit.toFixed(2)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-[#8190a0]">Total Invested</p>
                    <p className="mt-1 font-semibold text-[#dbe5ee]">{formatCurrency(dcaResult.totalInvested)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8190a0]">Current Value</p>
                    <p className="mt-1 font-semibold text-[#dbe5ee]">{formatCurrency(dcaResult.currentValue)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#8190a0]">Gain/Loss</p>
                  <p className={`mt-1 text-lg font-semibold ${dcaResult.gainLoss >= 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
                    {formatCurrency(dcaResult.gainLoss)} {formatSignedPercent(dcaResult.gainLossPercent, 2)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Profit Target Tab */}
      {activeTab === 'profit' && (
        <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="terminal-panel overflow-hidden rounded-md">
            <div className="border-b border-[#1b2530] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Profit Target</p>
              <p className="mt-1 font-mono text-xs text-[#a8b5c2]">Risk-reward analysis &amp; breakeven</p>
            </div>
            <div className="space-y-3 p-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Entry Price ${profitEntry.toFixed(2)}</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={profitEntry}
                  onChange={(e) => {
                    setProfitEntry(Number(e.target.value));
                    handleProfitTarget();
                  }}
                  className="mt-1 w-full rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-sm text-[#eef3f8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Profit Target {profitTarget.toFixed(2)}%</label>
                <input
                  type="range"
                  min="0.1"
                  max="50"
                  step="0.1"
                  value={profitTarget}
                  onChange={(e) => {
                    setProfitTarget(Number(e.target.value));
                    handleProfitTarget();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Stop Loss {profitStop.toFixed(2)}%</label>
                <input
                  type="range"
                  min="0.1"
                  max="20"
                  step="0.1"
                  value={profitStop}
                  onChange={(e) => {
                    setProfitStop(Number(e.target.value));
                    handleProfitTarget();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Position Size (shares) {profitShares.toLocaleString()}</label>
                <input
                  type="range"
                  min="1"
                  max="10000"
                  step="1"
                  value={profitShares}
                  onChange={(e) => {
                    setProfitShares(Number(e.target.value));
                    handleProfitTarget();
                  }}
                  className="mt-1 w-full"
                />
              </div>
              <p className="mt-4 border-t border-[#1b2530] pt-3 text-[11px] uppercase tracking-[0.14em] text-[#8190a0]">Estimates only - not financial advice</p>
            </div>
          </div>

          {profitResult && (
            <div className="terminal-panel overflow-hidden rounded-md">
              <div className="border-b border-[#1b2530] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#43d18b]">Trade Analysis</p>
              </div>
              <div className="space-y-3 p-3 font-mono text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-[#8190a0]">Target Price</p>
                    <p className="mt-1 text-lg font-semibold text-[#eef3f8]">${profitResult.targetPrice.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8190a0]">Risk:Reward</p>
                    <p className="mt-1 text-lg font-semibold text-[#43d18b]">1:{profitResult.riskRewardRatio.toFixed(2)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#8190a0]">Profit @ Target</p>
                  <p className="mt-1 font-semibold text-[#43d18b]">{formatCurrency(profitResult.profitAtTarget)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8190a0]">Win Rate Required (breakeven)</p>
                  <p className="mt-1 font-semibold text-[#dbe5ee]">{profitResult.winRateRequired.toFixed(1)}%</p>
                </div>
                <div className="border-t border-[#1b2530] pt-3">
                  <p className="text-xs text-[#8190a0]">Breakeven Analysis</p>
                  <p className="mt-2 text-xs leading-relaxed text-[#dbe5ee]">
                    If you win {profitResult.winRateRequired.toFixed(1)}% of trades at this risk-reward ratio, you will break even. The higher your win rate, the more profitable.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
