'use client';

/**
 * Bot Readiness surface - renders the REAL output of the deterministic pre-trade
 * risk engine alongside the honest gate checklist that must pass before live
 * trading could ever exist. Display-only: nothing on this page can place,
 * approve, simulate, or toggle anything. Live broker execution is intentionally
 * not implemented in this codebase, and AI has no write path into any of it.
 *
 * Props are plain serialisable values computed server-side in app/trading/page.tsx.
 */

import { AlertTriangle, Check, X } from 'lucide-react';
import type { PreTradeCheck, PreTradeReport } from '@/lib/trading/types';

export interface KillSwitchInfo {
  id: string;
  label: string;
  description: string;
}

export interface DemoIntentSummary {
  symbol: string;
  side: string;
  orderType: string;
  quantity: number;
  notionalValue: number;
  strategyId: string;
  reasonCode: string;
}

export interface TradingReadinessProps {
  report: PreTradeReport;
  killSwitches: KillSwitchInfo[];
  demoIntent: DemoIntentSummary;
}

/** Every gate that must pass before live execution is even considered. All honestly unchecked. */
const REQUIRED_GATES: { label: string; requirement: string }[] = [
  {
    label: 'Backtests pass out-of-sample',
    requirement: 'Walk-forward backtests must hold up on data the strategy has never seen.',
  },
  {
    label: 'Paper trading proves the edge',
    requirement: 'At least 30 completed paper trades (n>=30) with positive expectancy after costs.',
  },
  {
    label: 'Risk controls configured',
    requirement: 'Daily loss limit and position limits set to reviewed, non-zero values.',
  },
  {
    label: 'Broker connected (sandbox first)',
    requirement: 'A sandbox/paper broker connection passing health checks before any live key exists.',
  },
  {
    label: 'Kill switches tested',
    requirement: 'Every kill switch tripped in a drill and verified to halt all activity.',
  },
  {
    label: 'Manual approval enabled',
    requirement: 'A human explicitly approves every intent - no unattended execution path.',
  },
  {
    label: 'Legal / compliance reviewed',
    requirement: 'Regulatory, licensing, and tax review of automated execution completed.',
  },
];

const AI_BOUNDARY_POINTS: string[] = [
  'AI never creates orders. Order intents only ever come from deterministic strategy code.',
  'AI may only explain intents. It gets read-only access to a finished pre-trade report, nothing more.',
  'Deterministic code + your approval decide. The risk engine and explicit human sign-off gate everything.',
];

function CheckRow({ check }: { check: PreTradeCheck }) {
  const failedBlocking = !check.passed && check.severity === 'blocking';
  const failedWarning = !check.passed && check.severity === 'warning';

  return (
    <li className="flex items-start gap-2 py-1.5">
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {check.passed ? (
          <Check className="h-3 w-3 text-positive" />
        ) : failedBlocking ? (
          <X className="h-3 w-3 text-negative-soft" />
        ) : (
          <AlertTriangle className="h-3 w-3 text-accent" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-[11px] font-medium leading-snug ${
            failedBlocking ? 'text-negative-soft' : failedWarning ? 'text-accent' : 'text-ink'
          }`}
        >
          {check.label}
        </p>
        <p
          className={`text-[10px] leading-relaxed ${
            failedBlocking ? 'text-negative-soft/75' : failedWarning ? 'text-accent/75' : 'text-ink-3'
          }`}
        >
          {check.detail}
        </p>
      </div>
      <span
        className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] ${
          check.passed
            ? 'border-positive/30 bg-positive/10 text-positive'
            : failedBlocking
              ? 'border-negative-soft/40 bg-negative-soft/10 text-negative-soft'
              : 'border-accent/40 bg-accent/10 text-accent'
        }`}
      >
        {check.passed ? 'PASS' : failedBlocking ? 'BLOCKED' : 'WARN'}
      </span>
    </li>
  );
}

export function TradingReadiness({ report, killSwitches, demoIntent }: TradingReadinessProps) {
  const blockedCount = report.blocking.length;
  const warningCount = report.warnings.length;
  const passedCount = report.checks.filter((c) => c.passed).length;

  return (
    <div className="space-y-3">
      {/* (a) Status header */}
      <section className="terminal-panel glass-hero rounded-panel p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-sm font-semibold text-ink">Live Bot</h1>
          <span className="rounded border border-negative-soft/50 bg-negative-soft/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-negative-soft">
            LIVE TRADING: DISABLED
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-ink-2">
          Live broker execution is intentionally not implemented in this build. Lyra is a research console
          first: every future order would have to come from deterministic strategy code, pass the pre-trade
          risk engine below, and receive explicit human approval. That gate is permanent - it does not get
          optimised away when execution eventually ships.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <div className="rounded-cell border border-line-strong bg-panel p-2">
            <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">Gates met</p>
            <p className="numeric mt-0.5 truncate font-mono text-sm font-semibold text-accent md:text-base">
              0 / {REQUIRED_GATES.length}
            </p>
          </div>
          <div className="rounded-cell border border-line-strong bg-panel p-2">
            <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">Kill switches</p>
            <p className="numeric mt-0.5 truncate font-mono text-sm font-semibold text-blue-info md:text-base">
              {killSwitches.length} ready
            </p>
          </div>
          <div className="rounded-cell border border-line-strong bg-panel p-2">
            <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">Demo intent</p>
            <p className="numeric mt-0.5 truncate font-mono text-sm font-semibold text-negative-soft md:text-base">
              BLOCKED
            </p>
          </div>
        </div>
      </section>

      {/* (b) Required gates checklist */}
      <section className="terminal-panel rounded-panel p-3">
        <p className="text-[9px] uppercase tracking-[0.12em] text-ink-3">
          Required gates before live trading
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-2">
          Every gate below must pass before execution is even considered. None has - this checklist is
          rendered honestly, nothing is pre-ticked.
        </p>
        <ul className="mt-2 divide-y divide-line/70">
          {REQUIRED_GATES.map((gate) => (
            <li key={gate.label} className="flex items-start gap-2 py-1.5">
              <span
                className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full border border-line-hair"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium leading-snug text-ink">{gate.label}</p>
                <p className="text-[10px] leading-relaxed text-ink-3">{gate.requirement}</p>
              </div>
              <span className="mt-0.5 shrink-0 rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] text-ink-3">
                NOT MET
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* (c) Kill-switch panel */}
      <section className="terminal-panel rounded-panel p-3">
        <p className="text-[9px] uppercase tracking-[0.12em] text-ink-3">Kill switches - display only</p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-2">
          Independent halt layers that stop activity the moment anything looks wrong. All are inactive
          because there is nothing to halt - and none can be toggled from this page.
        </p>
        <ul className="mt-2 divide-y divide-line/70">
          {killSwitches.map((sw) => (
            <li key={sw.id} className="flex items-start gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium leading-snug text-ink">{sw.label}</p>
                <p className="text-[10px] leading-relaxed text-ink-3">{sw.description}</p>
              </div>
              <span className="mt-0.5 shrink-0 rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] text-ink-3">
                INACTIVE
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* (d) Pre-trade engine, live demo */}
      <section className="terminal-panel rounded-panel p-3">
        <p className="text-[9px] uppercase tracking-[0.12em] text-ink-3">Pre-trade engine - live demo</p>
        <h2 className="mt-1 text-[13px] font-semibold text-negative-soft">
          This demo intent was BLOCKED by {blockedCount} checks
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-2">
          A sample {demoIntent.symbol} paper intent was run through the real deterministic engine with the
          default settings (trading disabled, no limits configured). The engine refused it - exactly as
          designed. {passedCount} checks passed, {blockedCount} blocked, {warningCount}{' '}
          {warningCount === 1 ? 'warning' : 'warnings'}. The engine logic is real; the context readings in
          the check details (quote age, drawdown, liquidity, spread) are illustrative inputs for this demo,
          not live measurements.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] text-ink-2">
            {demoIntent.symbol}
          </span>
          <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] uppercase text-ink-2">
            {demoIntent.side} {demoIntent.quantity} @ {demoIntent.orderType}
          </span>
          <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] text-ink-2">
            ${demoIntent.notionalValue.toLocaleString()}
          </span>
          <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] text-ink-2">
            {demoIntent.strategyId}
          </span>
          <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] text-ink-2">
            {demoIntent.reasonCode}
          </span>
        </div>
        <ul className="mt-2 divide-y divide-line/70">
          {report.checks.map((check) => (
            <CheckRow check={check} key={check.id} />
          ))}
        </ul>
        <p className="mt-2 border-t border-line pt-2 font-mono text-[9px] text-ink-3">
          Evaluated {report.evaluatedAt} · intent {report.intentId} · requires approval:{' '}
          {report.requiresApproval ? 'yes' : 'no'}
        </p>
      </section>

      {/* (e) AI boundary */}
      <section className="terminal-panel rounded-panel border-pending/30 bg-pending/5 p-3">
        <p className="text-[9px] uppercase tracking-[0.12em] text-pending">AI boundary</p>
        <ul className="mt-2 space-y-1.5">
          {AI_BOUNDARY_POINTS.map((point) => (
            <li className="flex items-start gap-2" key={point}>
              <span
                className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-pending"
                aria-hidden="true"
              />
              <p className="text-[11px] leading-relaxed text-ink-2">{point}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
