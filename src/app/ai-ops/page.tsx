import { getSessionUser } from '@/lib/supabase/server';
import { inMemoryAiRunStore } from '@/lib/ai/audit';
import { aggregateAiRuns } from '@/lib/ai/metrics';
import { providerBreakerStatus } from '@/lib/ai/gateway';
import { RECOVERY_MODEL_META } from '@/lib/ml/recovery-probability';

export const dynamic = 'force-dynamic';

/**
 * AI Ops - the operator dashboard over the AI layer. Server-rendered from this process's audit trail,
 * so it needs no client fetch. It surfaces the health the resilience + guardrails layers produce:
 * throughput, latency percentiles, refusal / guardrail-block / error rates, the circuit-breaker state,
 * and the ML model card. No secrets and no prompts (the audit stores hashes only). Auth-gated.
 */
function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

// StatCell (PATTERNS.md): label over tabular value on a dark well. Tones are status
// colours only - positive=healthy, accent=caution/refusal, pending=guard-blocked,
// negative-soft=error, blue-info=informational.
function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-cell border border-line bg-well p-2.5">
      <div className="text-[9px] uppercase tracking-wide text-ink-3">{label}</div>
      <div className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${tone ?? 'text-ink'}`}>{value}</div>
    </div>
  );
}

// PanelCard (PATTERNS.md): soft glass panel for the grouped tables/lists.
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="terminal-panel-soft rounded-panel p-3">
      <h2 className="mb-2 text-xs font-semibold text-ink-title">{title}</h2>
      {children}
    </div>
  );
}

export default async function AiOpsPage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-ink">AI Ops</h1>
        <p className="mt-2 text-sm text-ink-3">Sign in to view AI operational metrics.</p>
      </main>
    );
  }

  const report = aggregateAiRuns(inMemoryAiRunStore.list());
  const breakers = providerBreakerStatus();
  const breakerEntries = Object.entries(breakers);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-ink">AI Ops</h1>
        <span className="font-mono text-[10px] text-ink-3">
          {report.runs} runs this process{report.since ? ` · since ${report.since.slice(0, 16).replace('T', ' ')}` : ''}
        </span>
      </header>

      {report.runs === 0 ? (
        <p className="terminal-panel-soft rounded-panel p-4 text-sm text-ink-3">
          No AI runs recorded in this process yet. Run a brief, chat, or agent and refresh. Cross-instance history lives in the
          <code className="mx-1 text-blue-info">ai_runs</code> table.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="OK rate" value={pct(report.rates.okRate)} tone="text-positive" />
            <Tile label="Refusal rate" value={pct(report.rates.refusalRate)} tone="text-accent" />
            <Tile label="Guard-block rate" value={pct(report.rates.guardBlockRate)} tone="text-pending" />
            <Tile label="Error rate" value={pct(report.rates.errorRate)} tone={report.rates.errorRate > 0.1 ? 'text-negative-soft' : 'text-ink'} />
          </section>

          {report.latency && (
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="Latency p50" value={`${report.latency.p50}ms`} />
              <Tile label="Latency p95" value={`${report.latency.p95}ms`} tone="text-blue-info" />
              <Tile label="Latency max" value={`${report.latency.max}ms`} />
              <Tile label="Guard blocks" value={String(report.guardBlocks)} tone="text-pending" />
            </section>
          )}

          <section className="space-y-1">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile
                label="Est. cost"
                value={report.cost.totalUsd !== null ? `$${report.cost.totalUsd.toFixed(report.cost.totalUsd < 1 ? 4 : 2)}` : 'n/a'}
                tone="text-positive"
              />
              <Tile
                label="Avg $/run"
                value={report.cost.avgUsdPerRun !== null ? `$${report.cost.avgUsdPerRun.toFixed(5)}` : 'n/a'}
              />
              <Tile label="Tokens in" value={report.cost.inputTokens.toLocaleString()} />
              <Tile label="Tokens out" value={report.cost.outputTokens.toLocaleString()} tone="text-blue-info" />
            </div>
            <p className="text-[9px] leading-snug text-ink-dim">
              Tokens are provider-reported (real). USD is estimated at {report.cost.asOf} list prices.
              {report.cost.pricedRuns} priced
              {report.cost.unpricedRuns > 0 ? ` · ${report.cost.unpricedRuns} unpriced (provider omitted usage or model not in the price table - excluded from the total, never guessed)` : ''}.
            </p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <Panel title="By agent">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-ink-3">
                    <th className="text-left font-medium">agent</th>
                    <th className="text-right font-medium">runs</th>
                    <th className="text-right font-medium">ok</th>
                    <th className="text-right font-medium">refuse</th>
                    <th className="text-right font-medium">p95</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums text-ink-title">
                  {report.byAgent.map((a) => (
                    <tr key={a.agent} className="border-t border-line">
                      <td className="py-0.5 text-left">{a.agent}</td>
                      <td className="text-right">{a.runs}</td>
                      <td className="text-right text-positive">{pct(a.okRate)}</td>
                      <td className="text-right text-accent">{pct(a.refusalRate)}</td>
                      <td className="text-right">{a.p95 !== null ? `${a.p95}ms` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>

            <Panel title="Top refusal reasons">
              {report.topRefusalReasons.length === 0 ? (
                <p className="text-[10px] text-ink-3">None recorded.</p>
              ) : (
                <ul className="space-y-1 font-mono text-[10px]">
                  {report.topRefusalReasons.map((r) => (
                    <li key={r.reason} className="flex justify-between border-t border-line py-0.5">
                      <span className="text-ink-title">{r.reason}</span>
                      <span className="tabular-nums text-accent">{r.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>
        </>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <Panel title="Circuit breakers">
          {breakerEntries.length === 0 ? (
            <p className="text-[10px] text-ink-3">No provider calls yet - all closed.</p>
          ) : (
            <ul className="space-y-1 font-mono text-[10px]">
              {breakerEntries.map(([provider, s]) => (
                <li key={provider} className="flex justify-between border-t border-line py-0.5">
                  <span className="text-ink-title">{provider}</span>
                  <span className={s.open ? 'text-negative-soft' : 'text-positive'}>
                    {s.open ? 'OPEN' : 'closed'} · {s.consecutiveFailures} fails
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recovery model card">
          <ul className="space-y-1 font-mono text-[10px] text-ink-title">
            <li className="flex justify-between"><span className="text-ink-3">algorithm</span><span>{RECOVERY_MODEL_META.algorithm}</span></li>
            <li className="flex justify-between"><span className="text-ink-3">OOS AUC</span><span className="text-positive">{RECOVERY_MODEL_META.oosAuc}</span></li>
            <li className="flex justify-between"><span className="text-ink-3">OOS Brier</span><span>{RECOVERY_MODEL_META.oosBrier} vs {RECOVERY_MODEL_META.baselineBrier}</span></li>
            <li className="flex justify-between"><span className="text-ink-3">trained</span><span>{RECOVERY_MODEL_META.trainedAt}</span></li>
          </ul>
          <p className="mt-2 text-[9px] leading-snug text-ink-dim">{RECOVERY_MODEL_META.provenance}</p>
        </Panel>
      </section>

      <p className="text-[9px] text-ink-dim">
        Research tooling telemetry. No secrets or prompts are stored - the audit trail holds hashes only. Metrics reflect this
        server process; durable cross-instance history is in the ai_runs table.{' '}
        <a href="/transparency" className="text-blue-info underline underline-offset-2 hover:text-blue-focus">
          Public AI System Card
        </a>
        .
      </p>
    </main>
  );
}
