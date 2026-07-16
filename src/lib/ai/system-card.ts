/**
 * AI System Card - the machine-readable governance summary of Lyra's AI layer, ASSEMBLED FROM CODE so
 * it can never drift from reality. It reads the policy (what the AI may/never do, its agents + tool
 * grants), the guardrails (the active guard set + version), the LIVE eval results (safety gate,
 * quality gate, retrieval quality), and the ML model card, and folds them into one object. The route
 * (/api/ai/system-card) serves it; the test asserts it stays consistent with the policy/registry.
 *
 * Because it RUNS the eval gates, the card can never claim "green" while the gates are red - the
 * governance summary is falsifiable, not aspirational.
 */
import {
  AI_MAY,
  AI_NEVER,
  ALL_AI_TOOLS,
  FORBIDDEN_TOOLS,
  AI_AGENT_NAMES,
  AGENT_TOOL_MATRIX,
} from './policy';
import { STOCK_OPS_GUARDS, GUARDRAILS_VERSION } from './guardrails/engine';
import { runEvalGate } from './eval/gate';
import { runQualityGate } from './eval/quality-gate';
import { compareRetrievers } from '@/lib/knowledge/eval/retrieval-eval';
import { RECOVERY_MODEL_META } from '@/lib/ml/recovery-probability';

export interface AiSystemCard {
  name: string;
  generatedFrom: string;
  doctrine: string[];
  capabilities: { may: readonly string[]; never: readonly string[] };
  agents: Array<{ name: string; allowedTools: readonly string[] }>;
  tools: { readOnly: readonly string[]; forbidden: readonly string[] };
  guardrails: { version: number; guards: readonly string[] };
  evaluations: {
    safetyGate: { total: number; passed: number; ok: boolean };
    qualityGate: { total: number; ok: boolean; meanGoodComposite: number };
    retrieval: { recallAt3: number; mrr: number; precisionGuard: number };
    recoveryModel: typeof RECOVERY_MODEL_META;
  };
  limits: string[];
}

const DOCTRINE = [
  'The deterministic engine decides; the AI only explains. LLMs never generate orders or numbers.',
  'Research context, never advice. Action language is Buy Review / Watch / Do Not Add - never "buy now".',
  'External content (news, filings, retrieved docs) is DATA, never instructions.',
  'Every AI answer passes one unified guardrails verdict before it can reach a user.',
  'Every model run is audited (hashes only - never raw prompts or keys).',
];

const LIMITS = [
  'The recovery-probability model ships fit on a reproducible reference dataset; refit on real history before production reliance.',
  'Retrieval is deterministic hybrid (lexical + char-trigram cosine) over Lyra\'s own docs - not a general web search.',
  'AI ops metrics reflect the serving process; durable cross-instance history lives in the ai_runs table.',
  'Per-run token/cost capture is not yet wired; latency and outcome rates are the current cost proxies.',
];

/** Build the live system card. Runs the eval gates, so it reflects the real, current state. */
export function buildAiSystemCard(): AiSystemCard {
  const safety = runEvalGate();
  const quality = runQualityGate();
  const { hybrid } = compareRetrievers();

  return {
    name: 'Lyra AI',
    generatedFrom: 'policy + agent registry + guardrails engine + live eval gates (single source of truth)',
    doctrine: DOCTRINE,
    capabilities: { may: AI_MAY, never: AI_NEVER },
    agents: AI_AGENT_NAMES.map((name) => ({ name, allowedTools: AGENT_TOOL_MATRIX[name] })),
    tools: { readOnly: ALL_AI_TOOLS, forbidden: FORBIDDEN_TOOLS },
    guardrails: { version: GUARDRAILS_VERSION, guards: STOCK_OPS_GUARDS },
    evaluations: {
      safetyGate: { total: safety.total, passed: safety.passed, ok: safety.ok },
      qualityGate: { total: quality.total, ok: quality.ok, meanGoodComposite: quality.meanGoodComposite },
      retrieval: { recallAt3: hybrid.recallAt3, mrr: hybrid.mrr, precisionGuard: hybrid.precisionGuard },
      recoveryModel: RECOVERY_MODEL_META,
    },
    limits: LIMITS,
  };
}

/** Human-readable rendering of the card for docs / the whats-new surface. */
export function renderSystemCardMarkdown(card: AiSystemCard): string {
  const lines: string[] = [];
  lines.push(`# ${card.name} - System Card`, '', `_${card.generatedFrom}_`, '');
  lines.push('## Doctrine', ...card.doctrine.map((d) => `- ${d}`), '');
  lines.push('## Guardrails', `- Guard set v${card.guardrails.version}: ${card.guardrails.guards.join(', ')}`, '');
  lines.push('## Agents (least-privilege tool grants)');
  for (const a of card.agents) lines.push(`- **${a.name}**: ${a.allowedTools.join(', ') || '(none)'}`);
  lines.push('', '## Forbidden tools (structurally unrunnable)', `- ${card.tools.forbidden.join(', ')}`, '');
  lines.push('## Evaluations (live)');
  lines.push(`- Safety gate: ${card.evaluations.safetyGate.passed}/${card.evaluations.safetyGate.total} ${card.evaluations.safetyGate.ok ? 'PASS' : 'FAIL'}`);
  lines.push(`- Quality gate: ${card.evaluations.qualityGate.ok ? 'PASS' : 'FAIL'} (mean good composite ${card.evaluations.qualityGate.meanGoodComposite})`);
  lines.push(`- Retrieval: recall@3 ${card.evaluations.retrieval.recallAt3}, MRR ${card.evaluations.retrieval.mrr}, precision-guard ${card.evaluations.retrieval.precisionGuard}`);
  lines.push(`- Recovery model: OOS AUC ${card.evaluations.recoveryModel.oosAuc}, Brier ${card.evaluations.recoveryModel.oosBrier} vs baseline ${card.evaluations.recoveryModel.baselineBrier}`);
  lines.push('', '## Limits', ...card.limits.map((l) => `- ${l}`), '');
  return lines.join('\n');
}
