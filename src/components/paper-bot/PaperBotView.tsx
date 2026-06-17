'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, ShieldCheck, Loader2, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Activity, Sparkles, Calculator, Wallet, TrendingUp, Terminal, Bell, CornerDownLeft, BellRing, BellOff, BadgePercent } from 'lucide-react';
import { loadAi } from '@/lib/account';
import { MiniSparkline } from '@/components/ChartPrimitives';
import { SaaSTooltip } from './SaaSTooltip';
import { PaperTickerInput } from './PaperTickerInput';
import { PaperBotQuotes } from './PaperBotQuotes';
import { Insight } from '@/components/Insight';
import { PaperAccountCharts } from './PaperAccountCharts';

interface MarketQuote {
  valid: boolean;
  symbol: string;
  name: string | null;
  price: number | null;
  currency: string | null;
  exchange: string | null;
  changePercent: number | null;
  error?: string;
}

type Action = 'propose' | 'approve' | 'execute';

interface Verdict {
  readiness?: string;
  reasons?: string[];
  missingEvidence?: string[];
  citations?: string[];
  confidence?: number;
}
interface Intent {
  symbol: string;
  side: string;
  quantity: number;
  notionalValue: number;
  status: string;
  aiExplanation?: string;
  reasonCode?: string;
}
interface Check {
  id: string;
  label: string;
  severity: string;
  passed: boolean;
}
interface Report {
  passed: boolean;
  requiresApproval: boolean;
  blocking?: Check[];
  warnings?: Check[];
}
interface Fill {
  symbol: string;
  side: string;
  quantity: number;
  fillPrice: number;
  notional: number;
  simulatedFee: number;
  simulatedSlippage: number;
}
interface BotRun {
  ok?: boolean;
  reason?: string;
  status?: string;
  verdict?: Verdict;
  intent?: Intent;
  report?: Report;
  fill?: Fill;
  requiresApproval?: boolean;
}
interface AccountPosition {
  symbol: string;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
}
interface Account {
  positions: AccountPosition[];
  totalInvested: number;
  marketValue: number;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
  openPositions: number;
  fillCount: number;
  startingEquity: number;
  equity: number;
  equityCurve: number[];
  realisedPnl: number;
  closedTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  dataSource: 'persisted' | 'demo';
}
interface Flag {
  id: string;
  kind: string;
  severity: 'action' | 'good' | 'warn' | 'info';
  message: string;
  symbol?: string;
  createdAt: string;
  read: boolean;
}
interface CliEntry {
  cmd: string;
  ok: boolean;
  lines: string[];
}

const FLAG_DOT: Record<string, string> = {
  action: 'bg-[#f3a33a]',
  good: 'bg-[#43d18b]',
  warn: 'bg-[#ff8a5c]',
  info: 'bg-[#8190a0]',
};

const QUICK_CMDS = ['status', 'positions', 'pnl', 'propose NVDA 10', 'approve', 'execute', 'flags'];

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  research_only: { label: 'Research only', tone: 'text-[#a8b5c2] border-[#263241] bg-[#0d141c]' },
  blocked_missing_evidence: { label: 'Blocked - missing evidence', tone: 'text-[#f3a33a] border-[#5a4a1a] bg-[#231a08]' },
  blocked_by_risk: { label: 'Blocked by risk', tone: 'text-[#ff6b6b] border-[#7f1d1d] bg-[#2b1214]' },
  proposed: { label: 'Paper candidate - needs approval', tone: 'text-[#8aa2ff] border-[#8aa2ff]/40 bg-[#101a2e]' },
  paper_executed: { label: 'Paper filled', tone: 'text-[#43d18b] border-[#1d7f55] bg-[#0d251b]' },
  error: { label: 'Error', tone: 'text-[#ff6b6b] border-[#7f1d1d] bg-[#2b1214]' },
};

/** The lifecycle, made legible. Each step names its OWNER so the AI/code/you split is obvious. */
const HOW_IT_WORKS: Array<{ icon: typeof Bot; title: string; detail: string; owner: 'DATA' | 'AI' | 'CODE' | 'YOU' }> = [
  { icon: Activity, title: 'Signal', detail: 'A stock shows a momentum setup in the scanner.', owner: 'DATA' },
  { icon: Sparkles, title: 'AI explains', detail: 'Lyra gives a readiness verdict + reasons + citations. Never a buy/sell instruction.', owner: 'AI' },
  { icon: Calculator, title: 'Order built', detail: 'Deterministic code sets side, quantity and price. The AI is not in this path.', owner: 'CODE' },
  { icon: ShieldCheck, title: 'Risk gate', detail: '23 pre-trade checks. Live execution is hard-blocked, always.', owner: 'CODE' },
  { icon: CheckCircle2, title: 'You approve', detail: 'Nothing fills without your tap. You are the gate.', owner: 'YOU' },
  { icon: Bot, title: 'Paper fill', detail: 'Simulated at the real price + fee + slippage. No broker. No real money.', owner: 'CODE' },
  { icon: TrendingUp, title: 'Tracked + analysed', detail: 'The fill becomes a position with live P/L you can review below.', owner: 'CODE' },
];

const OWNER_TONE: Record<string, string> = {
  DATA: 'text-[#a8b5c2] bg-[#0d141c] border-[#263241]',
  AI: 'text-[#8aa2ff] bg-[#101a2e] border-[#8aa2ff]/30',
  CODE: 'text-[#6fb1ff] bg-[#0b1626] border-[#1d3a5a]',
  YOU: 'text-[#f3a33a] bg-[#231a08] border-[#5a4a1a]',
};

/**
 * Paper Bot - the human-in-the-loop surface for the deterministic, paper-only spine.
 * propose (AI verdict -> deterministic intent -> risk gate) -> approve -> execute (simulated fill).
 * No live trading buttons exist. AI explains; the user approves; deterministic code fills on paper.
 * A "how it works" explainer makes the pipeline legible; a paper-account panel makes it analysable.
 */
export function PaperBotView({ isTour }: { isTour?: boolean }) {
  const [symbol, setSymbol] = useState('NVDA');
  const [quantity, setQuantity] = useState(10);
  const [liveQuote, setLiveQuote] = useState<MarketQuote | null>(null);
  const [alertsOn, setAlertsOn] = useState(true);
  const [tourStep, setTourStep] = useState<number>(isTour ? 0 : -1);
  const [run, setRun] = useState<BotRun | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [showHow, setShowHow] = useState(true);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [showCli, setShowCli] = useState(false);
  const [cliLog, setCliLog] = useState<CliEntry[]>([]);
  const [cliInput, setCliInput] = useState('');
  const [cliBusy, setCliBusy] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const cliEndRef = useRef<HTMLDivElement>(null);

  const loadAccount = useCallback(async () => {
    try {
      const res = await fetch('/api/trading/paper-account');
      if (res.ok) setAccount((await res.json()) as Account);
    } catch {
      /* analytics are best-effort */
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/trading/notifications');
      if (res.ok) {
        const d = (await res.json()) as { flags: Flag[]; channels: string[] };
        setFlags(d.flags ?? []);
        setChannels(d.channels ?? []);
      }
    } catch {
      /* best-effort */
    }
  }, []);

  // Poll account + flags so the equity curve grows and new flags surface while the page is open.
  useEffect(() => {
    loadAccount();
    loadNotifications();
    const id = setInterval(() => {
      loadAccount();
      loadNotifications();
    }, 15000);
    return () => clearInterval(id);
  }, [loadAccount, loadNotifications]);

  useEffect(() => {
    cliEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [cliLog]);

  useEffect(() => {
    if (tourStep === 0) {
      setSymbol('AAPL');
      setQuantity(10);
    }
  }, [tourStep]);

  async function closePosition(symbol: string) {
    if (closing) return;
    setClosing(symbol);
    try {
      const ai = loadAi();
      await fetch('/api/trading/paper-bot/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ line: `close ${symbol}`, ai: { provider: ai.provider, apiKey: ai.apiKey, model: ai.model } }),
      });
    } catch {
      /* best-effort */
    } finally {
      setClosing(null);
      loadAccount();
      loadNotifications();
    }
  }

  async function runCli(line: string) {
    const cmd = line.trim();
    if (!cmd || cliBusy) return;
    setCliBusy(true);
    setCliInput('');
    try {
      const ai = loadAi();
      const res = await fetch('/api/trading/paper-bot/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ line: cmd, ai: { provider: ai.provider, apiKey: ai.apiKey, model: ai.model } }),
      });
      const data = (await res.json()) as { ok: boolean; lines: string[] };
      setCliLog((prev) => [...prev.slice(-30), { cmd, ok: data.ok, lines: data.lines ?? [] }]);
    } catch {
      setCliLog((prev) => [...prev.slice(-30), { cmd, ok: false, lines: ['network error'] }]);
    } finally {
      setCliBusy(false);
      loadAccount();
      loadNotifications();
    }
  }

  async function call(action: Action, body: Record<string, unknown>) {
    setBusy(action);
    try {
      const res = await fetch('/api/trading/paper-bot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, tour: isTour && tourStep > -1, ...body }),
      });
      return (await res.json()) as BotRun;
    } catch {
      return { ok: false, reason: 'network' } as BotRun;
    } finally {
      setBusy(null);
    }
  }

  async function propose() {
    if (tourStep === 0) setTourStep(1);
    const ai = loadAi();
    const r = await call('propose', { symbol: symbol.trim().toUpperCase(), quantity, ai: { provider: ai.provider, apiKey: ai.apiKey, model: ai.model } });
    setRun(r);
    setIntent(r.intent ?? null);
  }
  async function approve() {
    if (tourStep === 2) setTourStep(3);
    if (!intent) return;
    const r = await call('approve', { intent });
    if (r.ok && r.intent) {
      setIntent(r.intent);
      setRun((prev) => (prev ? { ...prev, intent: r.intent, status: 'proposed' } : prev));
    }
  }
  async function execute() {
    if (tourStep === 3) setTourStep(4);
    if (!intent) return;
    const r = await call('execute', { intent });
    setRun(r);
    if (r.intent) setIntent(r.intent);
    if (r.status === 'paper_executed') {
      if ((isTour || intent.reasonCode === 'tour_mode') && r.fill) {
        // Force the UI to immediately show the "track it live" layout by mocking the account
        setAccount({
          positions: [{ symbol: r.fill.symbol, quantity: r.fill.quantity, avgEntryPrice: r.fill.fillPrice, currentPrice: r.fill.fillPrice, marketValue: r.fill.notional, unrealisedPnl: 0, unrealisedPnlPct: 0 }],
          totalInvested: r.fill.notional, marketValue: r.fill.notional, unrealisedPnl: 0, unrealisedPnlPct: 0, openPositions: 1, fillCount: 1, startingEquity: 100000, equity: 100000, equityCurve: [100000, 100000], realisedPnl: 0, closedTrades: 0, winRate: 0, avgWin: 0, avgLoss: 0, expectancy: 0, dataSource: 'demo'
        });
      } else {
        loadAccount();
      }
    }
  }

  // Advance tour when the AI completes its verdict
  useEffect(() => {
    if (tourStep === 1 && run?.status === 'proposed' && intent?.status === 'pending_approval') {
      setTourStep(2);
    }
  }, [tourStep, run?.status, intent?.status]);

  const status = run?.status ?? '';
  const statusCopy = STATUS_COPY[status];
  const canApprove = run?.status === 'proposed' && intent?.status === 'pending_approval';
  const canExecute = intent?.status === 'approved';
  const pnlUp = (account?.unrealisedPnl ?? 0) >= 0;

  return (
    <div className="space-y-3 pb-28 xl:pb-6">
      {/* Header */}
      <div className="terminal-panel rounded-md px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-[#8aa2ff]/30 bg-[#101a2e] text-[#8aa2ff]">
            <Bot size={15} />
          </span>
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#c8d3de]">Paper Bot</h1>
            <p className="text-[10px] text-[#8190a0]">Practise the pipeline with fake money + real prices. AI explains; you approve; code fills on paper.</p>
          </div>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#1d7f55] bg-[#0d251b] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#43d18b]">
            <ShieldCheck size={10} className="shrink-0" /> Live trading disabled
          </span>
        </div>
      </div>

      {/* What is this + why (visual lifecycle) */}
      <div className="terminal-panel rounded-md p-3">
        <button type="button" onClick={() => setShowHow((s) => !s)} className="flex w-full items-center gap-2 text-left">
          <Sparkles size={13} className="text-[#8aa2ff]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c8d3de]">What is this, and why?</span>
          <span className="ml-auto text-[10px] text-[#6f7d8a]">{showHow ? 'hide' : 'show'}</span>
        </button>
        {showHow && (
          <>
            <p className="mt-2 text-[11px] leading-relaxed text-[#a8b5c2]">
              Paper trading runs the <span className="text-[#dbe5ee]">exact AI-explained, risk-gated pipeline</span> a real bot would - but fills are <span className="text-[#43d18b]">simulated</span>, with fake money and real prices. The point: build an honest track record and trust the system <span className="text-[#dbe5ee]">before any real money is ever involved</span>. Below, propose a trade and watch each step; filled trades become positions with live P/L in your paper account.
            </p>
            <ol className="mt-3 space-y-1.5">
              {HOW_IT_WORKS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <li key={step.title} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#1d2733] bg-[#0b1016] text-[#8aa2ff]">
                      <Icon size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-[#dbe5ee]">{i + 1}. {step.title}</span>
                        <span className={`rounded-sm border px-1 py-px text-[8px] font-semibold uppercase tracking-[0.08em] ${OWNER_TONE[step.owner]}`}>{step.owner}</span>
                      </div>
                      <p className="text-[10px] leading-snug text-[#8190a0]">{step.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>

      {/* Paper account analytics */}
      <div className={`terminal-panel rounded-md p-4 relative ${tourStep === 4 ? 'z-50' : ''}`}>
        {tourStep === 4 && (
          <SaaSTooltip
            title="Track it live"
            body="Your simulated trade is now an open position! It tracks live P/L based on real market prices. Tour complete! 🎉"
            position="bottom"
            onDismiss={() => setTourStep(-1)}
            onReplay={() => setTourStep(0)}
          />
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md border border-[#43d18b]/30 bg-[#0d251b] text-[#43d18b]">
              <Wallet size={13} />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c8d3de]">Paper Account</span>
            {account && (
              <span className={`rounded-full border px-2 py-px text-[8px] font-semibold uppercase tracking-[0.08em] ${
                account.dataSource === 'persisted' ? 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b]' : 'border-[#5a4a1a] bg-[#231a08] text-[#f3a33a]'
              }`}>
                {account.dataSource === 'persisted' ? 'Saved' : 'Session'}
              </span>
            )}
          </div>
          <span className="text-[9px] text-[#6f7d8a]">{account?.fillCount ?? 0} fills · {account?.openPositions ?? 0} open</span>
        </div>

        {!account || (account.openPositions === 0 && account.closedTrades === 0) ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#1d2733] py-8 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full border border-[#1d2733] bg-[#0b1016]">
              <TrendingUp size={20} className="text-[#3a4a5a]" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-[#4a5a6a]">No positions yet</p>
              <p className="mt-0.5 text-[10px] text-[#3a4a5a]">Approved fills appear here with live P/L tracking</p>
            </div>
          </div>
        ) : (
          <>
            {/* Hero equity stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-lg border border-[#1d2733] bg-[#080c11] p-2.5 text-center">
                <p className="text-[8px] uppercase tracking-[0.1em] text-[#6f7d8a] mb-0.5">Equity</p>
                <p className="font-mono text-[14px] font-bold text-[#eef3f8]">${account.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="rounded-lg border border-[#1d2733] bg-[#080c11] p-2.5 text-center">
                <p className="text-[8px] uppercase tracking-[0.1em] text-[#6f7d8a] mb-0.5">Unrealised P/L</p>
                <p className={`font-mono text-[14px] font-bold ${pnlUp ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
                  {pnlUp ? '+' : ''}${account.unrealisedPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="rounded-lg border border-[#1d3a5a] bg-[#0b1626] p-2.5 text-center">
                <p className="text-[8px] uppercase tracking-[0.1em] text-[#6f7d8a] mb-0.5">Cash Free</p>
                <p className="font-mono text-[14px] font-bold text-[#8aa2ff]">
                  ${(account.equity - account.totalInvested).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            {/* Equity curve chart */}
            {account.equityCurve && account.equityCurve.length >= 2 && (
              <div className="mb-3 rounded-lg border border-[#1d2733] bg-[#080c11] p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-[#6f7d8a]">Portfolio Value Over Time</span>
                  <span className={`text-[9px] font-semibold ${account.equity >= account.startingEquity ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
                    {account.equity >= account.startingEquity ? '▲' : '▼'} {Math.abs(((account.equity - account.startingEquity) / account.startingEquity) * 100).toFixed(2)}%
                  </span>
                </div>
                <MiniSparkline
                  values={account.equityCurve}
                  color={account.equity >= account.startingEquity ? '#43d18b' : '#ff6b6b'}
                  className="h-14 w-full"
                />
                <div className="mt-1 flex justify-between">
                  <span className="text-[8px] text-[#5e6b78]">Start ${account.startingEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  <span className="text-[8px] text-[#5e6b78]">Now ${account.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            )}

            {/* Cash remaining bar */}
            <div className="mb-3 rounded-lg border border-[#1d3a5a] bg-gradient-to-r from-[#0b1626] to-[#0d141c] px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] uppercase tracking-[0.1em] text-[#6f7d8a]">Capital Deployed</span>
                <span className="font-mono text-[10px] text-[#8aa2ff]">{Math.round((account.totalInvested / account.equity) * 100)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#0d141c]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#3b5bdb] to-[#8aa2ff] transition-all duration-700"
                  style={{ width: `${Math.min(100, (account.totalInvested / account.equity) * 100)}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-[8px] text-[#5e6b78]">Invested ${account.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="text-[8px] text-[#43d18b]">Free ${(account.equity - account.totalInvested).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            {/* Per-position cards */}
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-[0.1em] text-[#6f7d8a]">Open Positions</p>
              {account.positions.map((p) => {
                const up = p.unrealisedPnl >= 0;
                const mag = Math.min(100, Math.abs(p.unrealisedPnlPct) * 8);
                return (
                  <div key={p.symbol} className={`rounded-lg border p-3 transition ${
                    up ? 'border-[#1d4a35] bg-gradient-to-r from-[#0a1e14] to-[#0d251b]' : 'border-[#4a1d2a] bg-gradient-to-r from-[#1e0a10] to-[#2b1214]'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[15px] font-bold text-[#eef3f8]">{p.symbol}</span>
                          <span className="rounded-full border border-[#1d2733] bg-[#0b1016] px-2 py-px font-mono text-[9px] text-[#8190a0]">
                            {p.quantity} units
                          </span>
                        </div>
                        <p className="mt-0.5 font-mono text-[9px] text-[#6f7d8a]">
                          Avg ${p.avgEntryPrice} → ${p.currentPrice}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono text-[14px] font-bold ${up ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
                          {up ? '+' : ''}${p.unrealisedPnl.toFixed(2)}
                        </p>
                        <p className={`font-mono text-[10px] ${up ? 'text-[#43d18b]/70' : 'text-[#ff6b6b]/70'}`}>
                          {up ? '+' : ''}{p.unrealisedPnlPct}%
                        </p>
                      </div>
                    </div>
                    {/* P/L bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 overflow-hidden rounded-full bg-[#11181f]">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            up ? 'bg-gradient-to-r from-[#1d7f55] to-[#43d18b]' : 'bg-gradient-to-r from-[#7f1d1d] to-[#ff6b6b]'
                          }`}
                          style={{ width: `${Math.max(4, mag)}%` }}
                        />
                      </div>
                      <span className="font-mono text-[9px] text-[#5e6b78]">
                        Val ${p.marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                      <button
                        type="button"
                        onClick={() => closePosition(p.symbol)}
                        disabled={closing !== null}
                        className="inline-flex items-center rounded-md border border-[#3a2630] bg-[#1c1116] px-2 py-0.5 font-mono text-[8px] uppercase tracking-wide text-[#e08a9a] transition hover:bg-[#26161d] disabled:opacity-50"
                      >
                        {closing === p.symbol ? <Loader2 size={9} className="animate-spin" /> : 'Close'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Allocation, Sector, P&L, Benchmark Charts */}
            <div className="mt-3">
              <PaperAccountCharts
                positions={account.positions}
                totalMarketValue={account.marketValue}
                equityCurve={account.equityCurve}
                startingEquity={account.startingEquity}
              />
            </div>

            {/* Realised performance */}
            {account.closedTrades > 0 && (
              <div className="mt-3 rounded-lg border border-[#1d2733] bg-[#080c11] px-3 py-2.5">
                <p className="mb-2 text-[9px] uppercase tracking-[0.1em] text-[#6f7d8a]">Closed Trade Stats</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[8px] text-[#5e6b78]">Win Rate</p>
                    <p className={`font-mono text-[13px] font-bold ${account.winRate >= 50 ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>{account.winRate}%</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-[#5e6b78]">Realised</p>
                    <p className={`font-mono text-[13px] font-bold ${account.realisedPnl >= 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
                      {account.realisedPnl >= 0 ? '+' : ''}${account.realisedPnl}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] text-[#5e6b78]">Expectancy</p>
                    <p className={`font-mono text-[13px] font-bold ${account.expectancy >= 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
                      {account.expectancy >= 0 ? '+' : ''}${account.expectancy}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <p className="mt-2 text-[8px] leading-snug text-[#5e6b78]">
              {account.dataSource === 'persisted'
                ? 'Saved — positions, trades and equity curve survive app restarts.'
                : 'In-memory this session. Sign in for a persistent saved track record.'}
            </p>
          </>
        )}
      </div>

      {/* Notifications / flags feed */}
      <div className="terminal-panel rounded-md p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md border border-[#f3a33a]/30 bg-[#231a08] text-[#f3a33a]">
              <Bell size={13} />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c8d3de]">Portfolio Alerts</span>
            {flags.filter(f => !f.read).length > 0 && (
              <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#f3a33a] px-1 font-mono text-[9px] font-bold text-[#07090c]">
                {flags.filter(f => !f.read).length}
              </span>
            )}
          </div>
          {/* Alert toggle */}
          <button
            type="button"
            onClick={() => setAlertsOn(a => !a)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold transition ${
              alertsOn
                ? 'border-[#1d7f55] bg-[#0d251b] text-[#43d18b] hover:bg-[#103626]'
                : 'border-[#263241] bg-[#0d141c] text-[#6f7d8a] hover:border-[#3a4a5a]'
            }`}
          >
            {alertsOn ? <BellRing size={10} /> : <BellOff size={10} />}
            {alertsOn ? 'Alerts on' : 'Alerts off'}
          </button>
        </div>

        {/* Alert threshold info */}
        {alertsOn && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-[#2a1f08] bg-[#1a1206] px-2.5 py-1.5">
            <BadgePercent size={11} className="shrink-0 text-[#f3a33a]" />
            <p className="text-[10px] text-[#a8913a]">Notified when any position moves <span className="font-semibold">±5%</span> — fills, approvals and risk blocks also flagged</p>
          </div>
        )}

        {/* Channel status */}
        <div className="mb-2 flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${channels.length ? 'bg-[#43d18b]' : 'bg-[#3a4a5a]'}`} />
          <span className="text-[9px] text-[#6f7d8a]">{channels.length ? channels.join(' · ') : 'In-app only — configure Telegram in Settings for push delivery'}</span>
        </div>

        {/* Flags feed */}
        {flags.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#1d2733] py-5 text-center">
            <Bell size={16} className="text-[#3a4a5a]" />
            <p className="text-[10px] text-[#4a5a6a]">No alerts yet — they'll appear here as your portfolio moves</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {flags.slice(0, 8).map((f) => (
              <li key={f.id} className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 ${
                f.severity === 'action' ? 'border-[#5a4a1a] bg-[#1a1206]' :
                f.severity === 'good' ? 'border-[#1d4a35] bg-[#0a1e14]' :
                f.severity === 'warn' ? 'border-[#4a2a1d] bg-[#1a1006]' :
                'border-[#1d2733] bg-[#080c11]'
              }`}>
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${FLAG_DOT[f.severity] ?? FLAG_DOT.info}`} />
                <span className="flex-1 text-[10px] leading-snug text-[#a8b5c2]">{f.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Command line (CLI) - same paper-only engine as the buttons */}
      <div className="terminal-panel rounded-md px-2.5 py-2">
        <button type="button" onClick={() => setShowCli((s) => !s)} className="flex w-full items-center gap-1.5 text-left">
          <Terminal size={11} className="text-[#8aa2ff]" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c8d3de]">Command line</span>
          <span className="ml-auto text-[9px] text-[#6f7d8a]">{showCli ? 'hide' : 'show'}</span>
        </button>
        {showCli && (
          <>
            <div className="mt-1.5 max-h-44 overflow-y-auto rounded border border-[#161e28] bg-[#080c11] p-2 font-mono text-[10px] leading-relaxed">
              {cliLog.length === 0 ? (
                <p className="text-[#5e6b78]">Type <span className="text-[#8aa2ff]">help</span> to list commands. The CLI drives the same paper-only engine as the buttons - no live path.</p>
              ) : (
                cliLog.map((e, i) => (
                  <div key={i} className="mb-1">
                    <p className="text-[#8aa2ff]">&gt; {e.cmd}</p>
                    {e.lines.map((ln, j) => (
                      <p key={j} className={e.ok ? 'text-[#a8b5c2]' : 'text-[#ff8a8a]'} style={{ whiteSpace: 'pre-wrap' }}>{ln}</p>
                    ))}
                  </div>
                ))
              )}
              <div ref={cliEndRef} />
            </div>
            <form onSubmit={(ev) => { ev.preventDefault(); runCli(cliInput); }} className="mt-1.5 flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-[#8aa2ff]">&gt;</span>
              <input
                value={cliInput}
                onChange={(e) => setCliInput(e.target.value)}
                placeholder="help"
                disabled={cliBusy}
                spellCheck={false}
                autoCapitalize="none"
                className="flex-1 rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-[11px] text-[#dbe5ee] outline-none focus:border-[#8aa2ff]/50"
              />
              <button type="submit" disabled={cliBusy} className="inline-flex items-center gap-1 rounded border border-[#8aa2ff]/40 bg-[#101a2e] px-2 py-1 text-[10px] font-semibold text-[#8aa2ff] disabled:opacity-50">
                {cliBusy ? <Loader2 size={11} className="animate-spin" /> : <CornerDownLeft size={11} />}
              </button>
            </form>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {QUICK_CMDS.map((c) => (
                <button key={c} type="button" onClick={() => runCli(c)} disabled={cliBusy} className="rounded-full border border-[#1d2733] bg-[#0b1016] px-1.5 py-0.5 font-mono text-[9px] text-[#8190a0] transition hover:border-[#8aa2ff]/40 hover:text-[#8aa2ff] disabled:opacity-50">{c}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Propose form */}
      <div className={`terminal-panel rounded-md p-4 relative ${tourStep === 0 ? 'z-50' : ''}`}>
        {/* Section header */}
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md border border-[#8aa2ff]/30 bg-[#101a2e] text-[#8aa2ff]">
            <Bot size={13} />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c8d3de]">Propose a Paper Trade</span>
        </div>

        {/* Buying power banner */}
        {account && (
          <div className="mb-3 rounded-lg border border-[#1d3a5a] bg-gradient-to-r from-[#0b1626] to-[#101a2e] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6f7d8a]">Buying Power</span>
              <span className="text-[9px] text-[#6f7d8a]">{account.openPositions} position{account.openPositions !== 1 ? 's' : ''} open</span>
            </div>
            <div className="mt-1 flex items-end justify-between">
              <span className="font-mono text-[20px] font-bold text-[#dbe5ee]">
                ${(account.equity - account.totalInvested).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-[#8190a0]">of ${account.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })} equity</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#0d141c]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#3b5bdb] to-[#8aa2ff] transition-all duration-500"
                style={{ width: `${Math.min(100, (account.totalInvested / account.equity) * 100)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-[8px] text-[#5e6b78]">Invested ${account.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span className="text-[8px] text-[#5e6b78]">{Math.round((account.totalInvested / account.equity) * 100)}% deployed</span>
            </div>
          </div>
        )}

        {/* Rich ticker input with logo + search + live price */}
        <PaperTickerInput
          symbol={symbol}
          quantity={quantity}
          onSymbolChange={setSymbol}
          onQuantityChange={setQuantity}
          onQuoteResolved={setLiveQuote}
        />

        {/* Cash after estimate (uses live price × qty) */}
        {account && liveQuote?.price && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-[#1d3a5a] bg-[#080e16] px-3 py-2">
            <div>
              <p className="text-[9px] uppercase tracking-[0.1em] text-[#6f7d8a]">Cash remaining after order</p>
              <p className={`font-mono text-[15px] font-bold ${
                (account.equity - account.totalInvested - liveQuote.price * quantity) < 0 ? 'text-[#ff6b6b]' : 'text-[#43d18b]'
              }`}>
                ${Math.max(0, account.equity - account.totalInvested - liveQuote.price * quantity).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-[0.1em] text-[#6f7d8a]">% cash used</p>
              <p className="font-mono text-[13px] font-semibold text-[#8aa2ff]">
                {Math.min(100, Math.round(((liveQuote.price * quantity) / Math.max(1, account.equity - account.totalInvested)) * 100))}%
              </p>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="relative mt-3">
          {tourStep === 0 && (
            <SaaSTooltip
              title="Propose a trade"
              body="Click this to ask the AI to evaluate an AAPL trade. The AI explains, and the deterministic code builds the order."
              position="top"
              align="left"
            />
          )}
          <button
            type="button"
            onClick={propose}
            disabled={busy !== null}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-[#8aa2ff]/40 bg-gradient-to-r from-[#101a2e] to-[#13203a] px-4 py-2.5 text-[13px] font-semibold text-[#8aa2ff] transition hover:border-[#8aa2ff]/70 hover:from-[#13203a] hover:to-[#1a2d50] disabled:opacity-50"
          >
            {busy === 'propose' ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
            Propose Paper Trade
          </button>
        </div>
        <p className="mt-2 text-[9px] leading-snug text-[#5e6b78]">
          AI assesses readiness · deterministic code builds the order · risk engine gates it · you approve before any fill. Research, not advice.
        </p>
      </div>

      {/* Result */}
      {run && (
        <div className={`terminal-panel space-y-3 rounded-md p-3 relative ${tourStep >= 1 && tourStep <= 3 ? 'z-50' : ''}`}>
          {run.ok === false ? (
            <p className="text-[12px] text-[#ff6b6b]">Could not run: {run.reason}</p>
          ) : (
            <>
              {statusCopy && (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusCopy.tone}`}>
                  {status === 'paper_executed' ? <CheckCircle2 size={12} /> : status === 'blocked_by_risk' || status === 'blocked_missing_evidence' ? <XCircle size={12} /> : status === 'proposed' ? <AlertTriangle size={12} /> : null}
                  {statusCopy.label}
                </span>
              )}

              {/* Verdict */}
              {run.verdict?.readiness && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8190a0]">Trade-readiness verdict (AI)</p>
                  <p className="mt-0.5 font-mono text-[11px] text-[#dbe5ee]">{run.verdict.readiness} · confidence {Math.round((run.verdict.confidence ?? 0) * 100)}%</p>
                  {run.verdict.reasons?.length ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-[#a8b5c2] marker:text-[#5e6b78]">
                      {run.verdict.reasons.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  ) : null}
                  {run.verdict.citations?.length ? (
                    <p className="mt-1 font-mono text-[9.5px] text-[#5e6b78]">cited: {run.verdict.citations.join(', ')}</p>
                  ) : null}
                </div>
              )}

              {/* Intent */}
              {intent && (
                <div className="rounded border border-[#1d2733] bg-[#0b1016] p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8190a0]">Order intent (deterministic - not AI)</p>
                  <p className="mt-0.5 font-mono text-[12px] text-[#eef3f8]">
                    {intent.side.toUpperCase()} {intent.quantity} {intent.symbol} · ${intent.notionalValue.toLocaleString()} · <span className="text-[#8aa2ff]">{intent.status}</span>
                  </p>
                </div>
              )}

              {/* Risk report */}
              {run.report && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8190a0]">Pre-trade risk gate</p>
                  <p className={`mt-0.5 font-mono text-[11px] ${run.report.passed ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
                    {run.report.passed ? 'PASSED' : 'BLOCKED'}{run.report.requiresApproval ? ' · requires approval' : ''}
                  </p>
                  {run.report.blocking?.length ? (
                    <ul className="mt-1 space-y-0.5 text-[11px] text-[#ff8a8a]">
                      {run.report.blocking.map((c) => <li key={c.id}>✗ {c.label}</li>)}
                    </ul>
                  ) : null}
                </div>
              )}

              {/* Fill */}
              {run.fill && (
                <div className="rounded border border-[#1d7f55] bg-[#0d251b] p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#43d18b]">Simulated paper fill</p>
                  <p className="mt-0.5 font-mono text-[12px] text-[#eef3f8]">
                    {run.fill.side.toUpperCase()} {run.fill.quantity} {run.fill.symbol} @ ${run.fill.fillPrice} · notional ${run.fill.notional.toLocaleString()}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-[#8190a0]">fee ${run.fill.simulatedFee} · slippage ${run.fill.simulatedSlippage} · added to your paper account above</p>
                </div>
              )}

              {/* Actions */}
              {(canApprove || canExecute) && (
                <div className="flex items-center gap-2">
                  {canApprove && (
                    <div className="relative">
                      {tourStep === 2 && (
                        <SaaSTooltip
                          title="You are the gate"
                          body="The AI cannot trade. Deterministic code cannot trade. Only you can approve this intent."
                          position="top"
                          align="left"
                        />
                      )}
                      <button type="button" onClick={approve} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-md border border-[#9a6a1f] bg-[#2a1f0f] px-3 py-1.5 text-xs font-semibold text-[#f3a33a] transition hover:bg-[#332615] disabled:opacity-50">
                        {busy === 'approve' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Approve for paper
                      </button>
                    </div>
                  )}
                  {canExecute && (
                    <div className="relative">
                      {tourStep === 3 && (
                        <SaaSTooltip
                          title="Simulate Fill"
                          body="Push it through the risk engine one last time and simulate a fill at the real price."
                          position="top"
                          align="left"
                        />
                      )}
                      <button type="button" onClick={execute} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-md border border-[#1d7f55] bg-[#0d251b] px-3 py-1.5 text-xs font-semibold text-[#43d18b] transition hover:bg-[#103626] disabled:opacity-50">
                         {busy === 'execute' ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />} Submit to paper
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Insight panel — same as command centre */}
      <Insight />

      {/* Rotating quotes from investing greats */}
      <PaperBotQuotes />
    </div>
  );
}
