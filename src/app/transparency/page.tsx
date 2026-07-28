import type { Metadata } from 'next';
import { buildAiSystemCard, renderSystemCardMarkdown } from '@/lib/ai/system-card';

export const metadata: Metadata = {
  title: 'AI System Card - Transparency',
  description:
    "Lyra's AI System Card: what the AI may and may never do, its guardrails, agent tool grants, and live evaluation results - assembled from code so it cannot drift from reality.",
};

// Runs the live eval gates (deterministic, no network) so the card reflects the current state.
export const dynamic = 'force-dynamic';

/**
 * Public AI System Card / transparency readout (2026-07-27 audit V11 fix: the card was API-only -
 * served as JSON at /api/ai/system-card with no rendered surface and a dead markdown renderer). This
 * page renders the live card as structured HTML AND wires renderSystemCardMarkdown as the canonical
 * copy-pasteable text. Public by design (see middleware PUBLIC_PREFIXES).
 */
export default function TransparencyPage() {
  const card = buildAiSystemCard();
  const markdown = renderSystemCardMarkdown(card);
  const evals = card.evaluations;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 text-[#dbe5ee]">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8190a0]">Transparency</p>
        <h1 className="text-xl font-semibold text-[#eef3f8]">{card.name} - System Card</h1>
        <p className="text-xs leading-relaxed text-[#8190a0]">{card.generatedFrom}</p>
      </header>

      <Section title="Doctrine">
        <ul className="space-y-1.5">
          {card.doctrine.map((d) => (
            <li key={d} className="flex gap-2 text-sm leading-relaxed text-[#c8d3de]">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#43d18b]" />
              {d}
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="The AI may">
          <ul className="space-y-1 text-sm text-[#c8d3de]">
            {card.capabilities.may.map((c) => (
              <li key={c}>· {c}</li>
            ))}
          </ul>
        </Section>
        <Section title="The AI never">
          <ul className="space-y-1 text-sm text-[#c8d3de]">
            {card.capabilities.never.map((c) => (
              <li key={c}>· {c}</li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Live evaluations">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Safety gate" value={`${evals.safetyGate.passed}/${evals.safetyGate.total}`} ok={evals.safetyGate.ok} />
          <Stat label="Quality gate" value={evals.qualityGate.ok ? 'PASS' : 'FAIL'} ok={evals.qualityGate.ok} />
          <Stat label="Retrieval recall@3" value={String(evals.retrieval.recallAt3)} ok={evals.retrieval.recallAt3 >= 0.9} />
          <Stat label="Retrieval MRR" value={String(evals.retrieval.mrr)} ok={evals.retrieval.mrr >= 0.75} />
          <Stat label="Precision guard" value={String(evals.retrieval.precisionGuard)} ok={evals.retrieval.precisionGuard === 1} />
          <Stat label="Recovery OOS AUC" value={String(evals.recoveryModel.oosAuc)} />
        </div>
        <p className="mt-2 text-[10px] leading-snug text-[#6b7684]">
          These figures come from RUNNING the eval gates when this page loads - the card cannot report green while a gate is red.
        </p>
      </Section>

      <Section title="Agents (least-privilege tool grants)">
        <ul className="space-y-1.5 font-mono text-xs">
          {card.agents.map((a) => (
            <li key={a.name} className="border-t border-[#151d26] pt-1.5 first:border-t-0 first:pt-0">
              <span className="font-semibold text-[#eef3f8]">{a.name}</span>
              <span className="text-[#8190a0]"> - {a.allowedTools.length ? a.allowedTools.join(', ') : '(none)'}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-[#8190a0]">
          Structurally forbidden tools: <span className="font-mono text-[#f0758a]">{card.tools.forbidden.join(', ')}</span>
        </p>
      </Section>

      <Section title="Guardrails">
        <p className="text-sm text-[#c8d3de]">
          Guard set v{card.guardrails.version}: <span className="font-mono text-[#a8b5c2]">{card.guardrails.guards.join(', ')}</span>
        </p>
      </Section>

      <Section title="Limits">
        <ul className="space-y-1.5 text-sm leading-relaxed text-[#c8d3de]">
          {card.limits.map((l) => (
            <li key={l} className="flex gap-2">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#f3a33a]" />
              {l}
            </li>
          ))}
        </ul>
      </Section>

      <details className="rounded-md border border-[#1b2530] bg-[#0d1117] p-3">
        <summary className="cursor-pointer text-xs font-semibold text-[#8aa2ff]">Canonical text (Markdown)</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[#a8b5c2]">
          {markdown}
        </pre>
      </details>

      <p className="text-[10px] text-[#6b7684]">
        Machine-readable JSON is available at <code className="text-[#7fb0ff]">/api/ai/system-card</code>. Research tooling - not financial advice.
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-[#1b2530] bg-[#0d1117] p-3.5">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  const tone = ok === undefined ? 'text-[#eef3f8]' : ok ? 'text-[#43d18b]' : 'text-[#f0758a]';
  return (
    <div className="rounded-md border border-[#151d26] bg-[#0b1016] p-2">
      <p className="text-[9px] uppercase tracking-[0.1em] text-[#8190a0]">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
