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

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-[#1b2530] bg-[#0d1117] p-2.5">
      <div className="text-[9px] uppercase tracking-wide text-[#8190a0]">{label}</div>
      <div className={`mt-0.5 font-mono text-lg font-semibold ${tone ?? 'text-[#eef3f8]'}`}>{value}</div>
    </div>
  );
}

export default async function AiOpsPage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-[#eef3f8]">AI Ops</h1>
        <p className="mt-2 text-sm text-[#8190a0]">Sign in to view AI operational metrics.</p>
      </main>
    );
  }

  const report = aggregateAiRuns(inMemoryAiRunStore.list());
  const breakers = providerBreakerStatus();
  const breakerEntries = Object.entries(breakers);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-[#eef3f8]">AI Ops</h1>
        <span className="font-mono text-[10px] text-[#8190a0]">
          {report.runs} runs this process{report.since ? ` · since ${report.since.slice(0, 16).replace('T', ' ')}` : ''}
        </span>
      </header>

      {report.runs === 0 ? (
        <p className="rounded-md border border-[#1b2530] bg-[#0d1117] p-4 text-sm text-[#8190a0]">
          No AI runs recorded in this process yet. Run a brief, chat, or agent and refresh. Cross-instance history lives in the
          <code className="mx-1 text-[#7fb0ff]">ai_runs</code> table.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="OK rate" value={pct(report.rates.okRate)} tone="text-[#43d18b]" />
            <Tile label="Refusal rate" value={pct(report.rates.refusalRate)} tone="text-[#f3a33a]" />
            <Tile label="Guard-block rate" value={pct(report.rates.guardBlockRate)} tone="text-[#b79cff]" />
            <Tile label="Error rate" value={pct(report.rates.errorRate)} tone={report.rates.errorRate > 0.1 ? 'text-[#f0758a]' : 'text-[#eef3f8]'} />
          </section>

          {report.latency && (
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="Latency p50" value={`${report.latency.p50}ms`} />
              <Tile label="Latency p95" value={`${report.latency.p95}ms`} tone="text-[#7fb0ff]" />
              <Tile label="Latency max" value={`${report.latency.max}ms`} />
              <Tile label="Guard blocks" value={String(report.guardBlocks)} tone="text-[#b79cff]" />
            </section>
          )}

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-[#1b2530] bg-[#0d1117] p-3">
              <h2 className="mb-2 text-xs font-semibold text-[#eef3f8]">By agent</h2>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-[#8190a0]">
                    <th className="text-left font-medium">agent</th>
                    <th className="text-right font-medium">runs</th>
                    <th className="text-right font-medium">ok</th>
                    <th className="text-right font-medium">refuse</th>
                    <th className="text-right font-medium">p95</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[#dbe5ee]">
                  {report.byAgent.map((a) => (
                    <tr key={a.agent} className="border-t border-[#151d26]">
                      <td className="py-0.5 text-left">{a.agent}</td>
                      <td className="text-right">{a.runs}</td>
                      <td className="text-right text-[#43d18b]">{pct(a.okRate)}</td>
                      <td className="text-right text-[#f3a33a]">{pct(a.refusalRate)}</td>
                      <td className="text-right">{a.p95 !== null ? `${a.p95}ms` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-md border border-[#1b2530] bg-[#0d1117] p-3">
              <h2 className="mb-2 text-xs font-semibold text-[#eef3f8]">Top refusal reasons</h2>
              {report.topRefusalReasons.length === 0 ? (
                <p className="text-[10px] text-[#8190a0]">None recorded.</p>
              ) : (
                <ul className="space-y-1 font-mono text-[10px]">
                  {report.topRefusalReasons.map((r) => (
                    <li key={r.reason} className="flex justify-between border-t border-[#151d26] py-0.5">
                      <span className="text-[#dbe5ee]">{r.reason}</span>
                      <span className="text-[#f3a33a]">{r.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-[#1b2530] bg-[#0d1117] p-3">
          <h2 className="mb-2 text-xs font-semibold text-[#eef3f8]">Circuit breakers</h2>
          {breakerEntries.length === 0 ? (
            <p className="text-[10px] text-[#8190a0]">No provider calls yet - all closed.</p>
          ) : (
            <ul className="space-y-1 font-mono text-[10px]">
              {breakerEntries.map(([provider, s]) => (
                <li key={provider} className="flex justify-between border-t border-[#151d26] py-0.5">
                  <span className="text-[#dbe5ee]">{provider}</span>
                  <span className={s.open ? 'text-[#f0758a]' : 'text-[#43d18b]'}>
                    {s.open ? 'OPEN' : 'closed'} · {s.consecutiveFailures} fails
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-md border border-[#1b2530] bg-[#0d1117] p-3">
          <h2 className="mb-2 text-xs font-semibold text-[#eef3f8]">Recovery model card</h2>
          <ul className="space-y-1 font-mono text-[10px] text-[#dbe5ee]">
            <li className="flex justify-between"><span className="text-[#8190a0]">algorithm</span><span>{RECOVERY_MODEL_META.algorithm}</span></li>
            <li className="flex justify-between"><span className="text-[#8190a0]">OOS AUC</span><span className="text-[#43d18b]">{RECOVERY_MODEL_META.oosAuc}</span></li>
            <li className="flex justify-between"><span className="text-[#8190a0]">OOS Brier</span><span>{RECOVERY_MODEL_META.oosBrier} vs {RECOVERY_MODEL_META.baselineBrier}</span></li>
            <li className="flex justify-between"><span className="text-[#8190a0]">trained</span><span>{RECOVERY_MODEL_META.trainedAt}</span></li>
          </ul>
          <p className="mt-2 text-[9px] leading-snug text-[#6b7684]">{RECOVERY_MODEL_META.provenance}</p>
        </div>
      </section>

      <p className="text-[9px] text-[#6b7684]">
        Research tooling telemetry. No secrets or prompts are stored - the audit trail holds hashes only. Metrics reflect this
        server process; durable cross-instance history is in the ai_runs table.
      </p>
    </main>
  );
}
