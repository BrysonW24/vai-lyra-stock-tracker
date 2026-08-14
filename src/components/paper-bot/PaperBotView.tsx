'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, ShieldCheck, Loader2, CheckCircle2, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { loadAi } from '@/lib/account';
import { DEFAULT_PAPER_STARTING_CASH } from '@/lib/edge/costs';
import { SaaSTooltip } from './SaaSTooltip';
import { PaperTickerInput } from './PaperTickerInput';
import { PaperBotQuotes } from './PaperBotQuotes';
import { Insight } from '@/components/Insight';
import { pageTitleClass } from '@/lib/ui';
import { HowItWorksPanel } from './HowItWorksPanel';
import { PaperAccountPanel } from './PaperAccountPanel';
import { FlagsPanel } from './FlagsPanel';
import { CliPanel } from './CliPanel';
import type { Account, Action, BotRun, CliEntry, Flag, Intent, MarketQuote } from './paper-bot-types';

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  research_only: { label: 'Research only', tone: 'text-ink-2 border-line-strong bg-panel' },
  blocked_missing_evidence: { label: 'Blocked - missing evidence', tone: 'text-accent border-accent-border/60 bg-accent-tint/80' },
  blocked_by_risk: { label: 'Blocked by risk', tone: 'text-negative border-negative/50 bg-negative/10' },
  proposed: { label: 'Paper candidate - needs approval', tone: 'text-pending border-pending/40 bg-blue-tint' },
  paper_executed: { label: 'Paper filled', tone: 'text-positive border-positive/50 bg-positive-tint' },
  error: { label: 'Error', tone: 'text-negative border-negative/50 bg-negative/10' },
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
  const [tourStep, setTourStep] = useState<number>(() => {
    if (typeof window === 'undefined') return -1;
    return localStorage.getItem('lyra.paperTourDismissed') === 'true' ? -1 : (isTour ? 0 : -1);
  });
  const [run, setRun] = useState<BotRun | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  // Server-signed capability from propose/approve; sent back so the server can verify the gate.
  const [token, setToken] = useState<string | null>(null);
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
    setToken(r.token ?? null);
  }
  async function approve() {
    if (tourStep === 2) setTourStep(3);
    if (!intent) return;
    const r = await call('approve', { intent, token });
    if (r.ok && r.intent) {
      setIntent(r.intent);
      setToken(r.token ?? null);
      setRun((prev) => (prev ? { ...prev, intent: r.intent, status: 'proposed' } : prev));
    }
  }
  async function execute() {
    if (!intent) return;
    const r = await call('execute', { intent, token });
    setRun(r);
    if (r.intent) setIntent(r.intent);
    if (r.status === 'paper_executed') {
      if ((isTour || intent.reasonCode === 'tour_mode') && r.fill) {
        // Force the UI to immediately show the "track it live" layout by mocking the account.
        // Equity is the real small-account default (DEFAULT_PAPER_STARTING_CASH), not the old
        // $100k fantasy balance that contradicted the app's $5k default (2026-07-27 audit V13 fix).
        setAccount({
          positions: [{ symbol: r.fill.symbol, quantity: r.fill.quantity, avgEntryPrice: r.fill.fillPrice, currentPrice: r.fill.fillPrice, marketValue: r.fill.notional, unrealisedPnl: 0, unrealisedPnlPct: 0 }],
          totalInvested: r.fill.notional, marketValue: r.fill.notional, unrealisedPnl: 0, unrealisedPnlPct: 0, openPositions: 1, fillCount: 1, startingEquity: DEFAULT_PAPER_STARTING_CASH, equity: DEFAULT_PAPER_STARTING_CASH, equityCurve: [DEFAULT_PAPER_STARTING_CASH, DEFAULT_PAPER_STARTING_CASH], realisedPnl: 0, closedTrades: 0, winRate: 0, avgWin: 0, avgLoss: 0, expectancy: 0, dataSource: 'demo'
        });
      } else {
        await loadAccount();
      }
      if (tourStep === 3) setTourStep(4);
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

  return (
    <div className="space-y-3 pb-28 xl:pb-6">
      {/* Header */}
      <div className="terminal-panel rounded-panel px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-cell border border-pending/30 bg-blue-tint text-pending">
            <Bot size={15} />
          </span>
          <div className="min-w-0">
            <h1 className={pageTitleClass}>Paper Bot</h1>
            <p className="text-[10px] text-ink-3">Practise the pipeline with fake money + real prices. AI explains; you approve; code fills on paper.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('lyra.paperTourDismissed', 'false');
                setTourStep(0);
              }}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line-strong bg-panel font-mono text-[11px] font-bold text-ink-3 transition hover:border-pending/40 hover:bg-blue-tint hover:text-pending"
              title="Restart Tour"
            >
              ?
            </button>
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-positive/50 bg-positive-tint px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-positive">
              <ShieldCheck size={10} className="shrink-0" /> Live trading disabled
            </span>
          </div>
        </div>
      </div>

      {/* What is this + why (visual lifecycle) */}
      <HowItWorksPanel open={showHow} onToggle={() => setShowHow((s) => !s)} />

      {/* Paper account analytics */}
      <PaperAccountPanel
        account={account}
        tourStep={tourStep}
        closing={closing}
        onClosePosition={closePosition}
        onTourDismiss={() => {
          localStorage.setItem('lyra.paperTourDismissed', 'true');
          setTourStep(-1);
        }}
        onTourReplay={() => setTourStep(0)}
      />

      {/* Notifications / flags feed */}
      <FlagsPanel flags={flags} channels={channels} alertsOn={alertsOn} onToggleAlerts={() => setAlertsOn((a) => !a)} />

      {/* Command line (CLI) - same paper-only engine as the buttons */}
      <CliPanel
        open={showCli}
        onToggle={() => setShowCli((s) => !s)}
        log={cliLog}
        input={cliInput}
        onInputChange={setCliInput}
        busy={cliBusy}
        onRun={runCli}
        endRef={cliEndRef}
      />

      {/* Propose form */}
      <div className={`terminal-panel rounded-panel p-4 relative ${tourStep === 0 ? 'z-50' : ''}`}>
        {/* Section header */}
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-cell border border-pending/30 bg-blue-tint text-pending">
            <Bot size={13} />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-title">Propose a Paper Trade</span>
        </div>

        {/* Buying power banner */}
        {account && (
          <div className="mb-3 rounded-cell border border-blue-focus/40 bg-blue-tint/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-dim">Buying Power</span>
              <span className="text-[9px] text-ink-dim">{account.openPositions} position{account.openPositions !== 1 ? 's' : ''} open</span>
            </div>
            <div className="mt-1 flex items-end justify-between">
              <span className="font-mono text-[20px] font-bold tabular-nums text-ink-title">
                ${(account.equity - account.totalInvested).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-ink-3">of ${account.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })} equity</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-panel">
              {/* Progress fill, not a CTA - gradient allowed per the P1 GoalCockpit ruling */}
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-deep to-pending transition-all duration-500"
                style={{ width: `${Math.min(100, (account.totalInvested / account.equity) * 100)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-[8px] text-ink-dim">Invested ${account.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span className="text-[8px] text-ink-dim">{Math.round((account.totalInvested / account.equity) * 100)}% deployed</span>
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
          <div className="mt-3 flex items-center justify-between rounded-cell border border-blue-focus/40 bg-well px-3 py-2">
            <div>
              <p className="text-[9px] uppercase tracking-[0.1em] text-ink-dim">Cash remaining after order</p>
              <p className={`font-mono text-[15px] font-bold tabular-nums ${
                (account.equity - account.totalInvested - liveQuote.price * quantity) < 0 ? 'text-negative' : 'text-positive'
              }`}>
                ${Math.max(0, account.equity - account.totalInvested - liveQuote.price * quantity).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-[0.1em] text-ink-dim">% cash used</p>
              <p className="font-mono text-[13px] font-semibold tabular-nums text-pending">
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
            className="w-full inline-flex min-h-[44px] items-center justify-center gap-2 rounded-cell border border-pending/40 bg-blue-tint px-4 py-2.5 text-[13px] font-semibold text-pending transition hover:border-pending/70 hover:bg-blue-deep/30 disabled:opacity-50 sm:min-h-0"
          >
            {busy === 'propose' ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
            Propose Paper Trade
          </button>
        </div>
        <p className="mt-2 text-[9px] leading-snug text-ink-dim">
          AI assesses readiness · deterministic code builds the order · risk engine gates it · you approve before any fill. Research, not advice.
        </p>
      </div>

      {/* Result */}
      {run && (
        <div className={`terminal-panel space-y-3 rounded-panel p-3 relative ${tourStep >= 1 && tourStep <= 3 ? 'z-50' : ''}`}>
          {run.ok === false ? (
            <p className="text-[12px] text-negative">Could not run: {run.reason}</p>
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
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">Trade-readiness verdict (AI)</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-title">{run.verdict.readiness} · confidence {Math.round((run.verdict.confidence ?? 0) * 100)}%</p>
                  {run.verdict.reasons?.length ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-ink-2 marker:text-ink-dim">
                      {run.verdict.reasons.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  ) : null}
                  {run.verdict.citations?.length ? (
                    <p className="mt-1 font-mono text-[9.5px] text-ink-dim">cited: {run.verdict.citations.join(', ')}</p>
                  ) : null}
                </div>
              )}

              {/* Intent */}
              {intent && (
                <div className="rounded-cell border border-line bg-chrome p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">Order intent (deterministic - not AI)</p>
                  <p className="mt-0.5 font-mono text-[12px] tabular-nums text-ink">
                    {intent.side.toUpperCase()} {intent.quantity} {intent.symbol} · ${intent.notionalValue.toLocaleString()} · <span className="text-pending">{intent.status}</span>
                  </p>
                </div>
              )}

              {/* Risk report */}
              {run.report && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">Pre-trade risk gate</p>
                  <p className={`mt-0.5 font-mono text-[11px] ${run.report.passed ? 'text-positive' : 'text-negative'}`}>
                    {run.report.passed ? 'PASSED' : 'BLOCKED'}{run.report.requiresApproval ? ' · requires approval' : ''}
                  </p>
                  {run.report.blocking?.length ? (
                    <ul className="mt-1 space-y-0.5 text-[11px] text-negative">
                      {run.report.blocking.map((c) => <li key={c.id}>✗ {c.label}</li>)}
                    </ul>
                  ) : null}
                </div>
              )}

              {/* Fill */}
              {run.fill && (
                <div className="rounded-cell border border-positive/50 bg-positive-tint p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-positive">Simulated paper fill</p>
                  <p className="mt-0.5 font-mono text-[12px] tabular-nums text-ink">
                    {run.fill.side.toUpperCase()} {run.fill.quantity} {run.fill.symbol} @ ${run.fill.fillPrice} · notional ${run.fill.notional.toLocaleString()}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-ink-3">fee ${run.fill.simulatedFee} · slippage ${run.fill.simulatedSlippage} · added to your paper account above</p>
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
                      <button type="button" onClick={approve} disabled={busy !== null} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-cell border border-accent-border bg-accent-tint px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-50">
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
                      <button type="button" onClick={execute} disabled={busy !== null} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-cell border border-positive/50 bg-positive-tint px-3 py-1.5 text-xs font-semibold text-positive transition hover:bg-positive/20 disabled:opacity-50">
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

      {/* Insight panel - same as command centre */}
      <Insight />

      {/* Rotating quotes from investing greats */}
      <PaperBotQuotes />
    </div>
  );
}
