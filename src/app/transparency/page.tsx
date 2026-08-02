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
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 text-ink-title">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">Transparency</p>
        <h1 className="text-xl font-semibold text-ink">{card.name} - System Card</h1>
        <p className="text-xs leading-relaxed text-ink-3">{card.generatedFrom}</p>
      </header>

      <Section title="Doctrine">
        <ul className="space-y-1.5">
          {card.doctrine.map((d) => (
            <li key={d} className="flex gap-2 text-sm leading-relaxed text-ink-title">
              {/* positive dot = affirmed doctrine (status colour, not decoration) */}
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-positive" />
              {d}
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="The AI may">
          <ul className="space-y-1 text-sm text-ink-title">
            {card.capabilities.may.map((c) => (
              <li key={c}>· {c}</li>
            ))}
          </ul>
        </Section>
        <Section title="The AI never">
          <ul className="space-y-1 text-sm text-ink-title">
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
        <p className="mt-2 text-[10px] leading-snug text-ink-dim">
          These figures come from RUNNING the eval gates when this page loads - the card cannot report green while a gate is red.
        </p>
      </Section>

      <Section title="Agents (least-privilege tool grants)">
        <ul className="space-y-1.5 font-mono text-xs">
          {card.agents.map((a) => (
            <li key={a.name} className="border-t border-line pt-1.5 first:border-t-0 first:pt-0">
              <span className="font-semibold text-ink">{a.name}</span>
              <span className="text-ink-3"> - {a.allowedTools.length ? a.allowedTools.join(', ') : '(none)'}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-ink-3">
          Structurally forbidden tools: <span className="font-mono text-negative-soft">{card.tools.forbidden.join(', ')}</span>
        </p>
      </Section>

      <Section title="Guardrails">
        <p className="text-sm text-ink-title">
          Guard set v{card.guardrails.version}: <span className="font-mono text-ink-2">{card.guardrails.guards.join(', ')}</span>
        </p>
      </Section>

      <Section title="Limits">
        <ul className="space-y-1.5 text-sm leading-relaxed text-ink-title">
          {card.limits.map((l) => (
            <li key={l} className="flex gap-2">
              {/* accent dot = caution / limitation (status colour, not decoration) */}
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent" />
              {l}
            </li>
          ))}
        </ul>
      </Section>

      <details className="terminal-panel-soft rounded-panel p-3">
        <summary className="cursor-pointer text-xs font-semibold text-blue-info">Canonical text (Markdown)</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-ink-2">
          {markdown}
        </pre>
      </details>

      <p className="text-[10px] text-ink-dim">
        Machine-readable JSON is available at <code className="text-blue-info">/api/ai/system-card</code>. Research tooling - not financial advice.
      </p>
    </main>
  );
}

// PanelCard (PATTERNS.md): soft glass panel with an uppercase ink-3 label heading.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="terminal-panel-soft rounded-panel p-3.5">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{title}</h2>
      {children}
    </section>
  );
}

// StatCell (PATTERNS.md): label over tabular value on a dark well; pass/fail carry status colour.
function Stat({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  const tone = ok === undefined ? 'text-ink' : ok ? 'text-positive' : 'text-negative-soft';
  return (
    <div className="rounded-cell border border-line bg-well p-2">
      <p className="text-[9px] uppercase tracking-[0.1em] text-ink-3">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
