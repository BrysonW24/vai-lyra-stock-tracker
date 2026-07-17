/**
 * AI operational metrics - the observability surface over the audit trail. Every model run already
 * writes an AiRunRecord (audit.ts); this aggregates those records into the health picture an operator
 * needs: throughput, latency percentiles, and the rates that actually matter for a research tool -
 * how often the AI refused, how often the guardrails BLOCKED an answer, and how often a provider
 * errored. Pure and deterministic (no I/O); the route feeds it records and the dashboard renders it.
 *
 * This closes the "resilience is solid but not surfaced" gap: retry, backpressure, the circuit
 * breaker, and the guardrails now have a single legible readout instead of living only in code.
 */
import type { AiRunRecord, AiRunStatus } from './audit';
import { PRICING_AS_OF } from './cost';

export interface RateBlock {
  okRate: number;
  refusalRate: number;
  guardBlockRate: number;
  errorRate: number;
}

export interface LatencyBlock {
  p50: number;
  p95: number;
  max: number;
  mean: number;
}

export interface AgentBreakdown {
  agent: string;
  runs: number;
  okRate: number;
  refusalRate: number;
  p95: number | null;
}

export interface ProviderBreakdown {
  provider: string;
  runs: number;
  errorRate: number;
  inputTokens: number;
  outputTokens: number;
  /** Estimated USD across this provider's PRICED runs; null when none were priced. */
  costUsd: number | null;
}

/**
 * Cost roll-up over the audit trail (AI-11). Tokens are real (provider-reported); USD is estimated at
 * list price. pricedRuns/unpricedRuns keep the denominator honest - a run is "unpriced" when the
 * provider omitted usage or the model has no price rule, and its $ is NOT invented into the total.
 */
export interface CostBlock {
  totalUsd: number | null;
  avgUsdPerRun: number | null;
  inputTokens: number;
  outputTokens: number;
  pricedRuns: number;
  unpricedRuns: number;
  asOf: string;
}

export interface AiOpsReport {
  runs: number;
  since: string | null;
  status: Record<AiRunStatus, number>;
  rates: RateBlock;
  latency: LatencyBlock | null;
  byAgent: AgentBreakdown[];
  byProvider: ProviderBreakdown[];
  topRefusalReasons: Array<{ reason: string; count: number }>;
  /** Runs the unified guardrails engine hard-blocked (advice / injection / ungrounded). */
  guardBlocks: number;
  /** Token + estimated-USD roll-up (AI-11). */
  cost: CostBlock;
}

/** A run counts as a guardrail block when its refusal names the guardrail verdict or an injection flag fired. */
function isGuardBlock(r: AiRunRecord): boolean {
  return (r.refusalReason?.startsWith('guardrail_block') ?? false) || r.injectionFlags.length > 0;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function rate(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 1000) / 1000;
}

const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round6 = (v: number): number => Math.round(v * 1_000_000) / 1_000_000;

/** Sum tokens + estimated USD over a record set. A record is "priced" only when costUsd is a number. */
function costOf(records: AiRunRecord[]): { inputTokens: number; outputTokens: number; totalUsd: number | null; pricedRuns: number; unpricedRuns: number } {
  let inputTokens = 0;
  let outputTokens = 0;
  let usd = 0;
  let pricedRuns = 0;
  let unpricedRuns = 0;
  for (const r of records) {
    inputTokens += num(r.inputTokens);
    outputTokens += num(r.outputTokens);
    if (typeof r.costUsd === 'number' && Number.isFinite(r.costUsd)) {
      usd += r.costUsd;
      pricedRuns += 1;
    } else {
      unpricedRuns += 1;
    }
  }
  return { inputTokens, outputTokens, totalUsd: pricedRuns > 0 ? round6(usd) : null, pricedRuns, unpricedRuns };
}

function latencyOf(records: AiRunRecord[]): LatencyBlock | null {
  const ls = records.map((r) => r.latencyMs).filter((l): l is number => typeof l === 'number').sort((a, b) => a - b);
  if (ls.length === 0) return null;
  return {
    p50: percentile(ls, 50),
    p95: percentile(ls, 95),
    max: ls[ls.length - 1],
    mean: Math.round(ls.reduce((s, l) => s + l, 0) / ls.length),
  };
}

/** Aggregate a set of audit records into the operational report. Deterministic. */
export function aggregateAiRuns(records: readonly AiRunRecord[]): AiOpsReport {
  const runs = records.length;
  const status: Record<AiRunStatus, number> = { ok: 0, refused: 0, validation_failed: 0, error: 0 };
  for (const r of records) status[r.status] += 1;

  const guardBlocks = records.filter(isGuardBlock).length;
  const refusals = status.refused;
  const errors = status.error;

  // by-agent
  const agents = new Map<string, AiRunRecord[]>();
  for (const r of records) {
    const arr = agents.get(r.agentName) ?? [];
    arr.push(r);
    agents.set(r.agentName, arr);
  }
  const byAgent: AgentBreakdown[] = [...agents.entries()]
    .map(([agent, rs]) => {
      const lat = latencyOf(rs);
      return {
        agent,
        runs: rs.length,
        okRate: rate(rs.filter((r) => r.status === 'ok').length, rs.length),
        refusalRate: rate(rs.filter((r) => r.status === 'refused').length, rs.length),
        p95: lat ? lat.p95 : null,
      };
    })
    .sort((a, b) => b.runs - a.runs || a.agent.localeCompare(b.agent));

  // by-provider
  const providers = new Map<string, AiRunRecord[]>();
  for (const r of records) {
    const arr = providers.get(r.provider) ?? [];
    arr.push(r);
    providers.set(r.provider, arr);
  }
  const byProvider: ProviderBreakdown[] = [...providers.entries()]
    .map(([provider, rs]) => {
      const c = costOf(rs);
      return { provider, runs: rs.length, errorRate: rate(rs.filter((r) => r.status === 'error').length, rs.length), inputTokens: c.inputTokens, outputTokens: c.outputTokens, costUsd: c.totalUsd };
    })
    .sort((a, b) => b.runs - a.runs || a.provider.localeCompare(b.provider));

  // top refusal reasons
  const reasonCounts = new Map<string, number>();
  for (const r of records) {
    if (r.refusalReason) {
      // Normalise "guardrail_block: <detail>" to its class so the histogram is legible.
      const key = r.refusalReason.split(':')[0].trim();
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }
  }
  const topRefusalReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
    .slice(0, 8);

  const since = records.reduce<string | null>((min, r) => (min === null || r.createdAt < min ? r.createdAt : min), null);

  const c = costOf([...records]);
  const cost: CostBlock = {
    totalUsd: c.totalUsd,
    avgUsdPerRun: c.pricedRuns > 0 && c.totalUsd !== null ? round6(c.totalUsd / c.pricedRuns) : null,
    inputTokens: c.inputTokens,
    outputTokens: c.outputTokens,
    pricedRuns: c.pricedRuns,
    unpricedRuns: c.unpricedRuns,
    asOf: PRICING_AS_OF,
  };

  return {
    runs,
    since,
    status,
    rates: {
      okRate: rate(status.ok, runs),
      refusalRate: rate(refusals, runs),
      guardBlockRate: rate(guardBlocks, runs),
      errorRate: rate(errors, runs),
    },
    latency: latencyOf([...records]),
    byAgent,
    byProvider,
    topRefusalReasons,
    guardBlocks,
    cost,
  };
}
