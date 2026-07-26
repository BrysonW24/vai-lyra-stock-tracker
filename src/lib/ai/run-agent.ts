/**
 * Agent orchestration - turns the declared agent registry into a real, invokable capability.
 *
 * Flow (deterministic-first): gather evidence through the FAIL-CLOSED tool runtime -> prompt the
 * model for structured JSON matching the agent's strict-Zod output schema -> validate the output
 * (validateAgentOutput, incl. citation enforcement) -> audit the run (recordAiRun). The model
 * phrases and cites; it never chooses to place an order, and its output is rejected if it does not
 * match the schema. This is the substrate the approval-gated paper-trading agent sits on.
 */
import { complete, type AiProvider } from '@/lib/ai/gateway';
import { getAgentDefinition } from '@/lib/ai/agents/registry';
import type { AiAgentName, AiToolName } from '@/lib/ai/policy';
import { validateAgentOutput, assertNoFabricatedNumbers } from '@/lib/ai/guardrails/schema';
import { evaluateGuardrails } from '@/lib/ai/guardrails/engine';
import { recordAiRun, hashInput } from '@/lib/ai/audit';
import { LYRA_IDENTITY, LYRA_GUARDRAILS, composeSystem } from '@/lib/ai/system-prompt';
import { executeTool } from './tools/runtime';
import type { EvidenceItem } from './tools';
// Shared with the free-text prose guard (chat/brief). Kept digit-only here on purpose:
// agent output is schema-validated JSON where prose.ts's spelled-figure stripping ("double",
// "percent") would mangle legitimate field text; the structured path relies on numerals.
import { numeralsIn, splitSentences } from '@/lib/ai/guardrails/prose';

/**
 * Strip every sentence that contains a fabricated numeral (one absent from the grounding the
 * agent was given). The free tier runs weak models that can invent a price/RSI/P&L - the
 * deterministic engine owns numbers, so a fabricated one is removed rather than surfaced.
 * Returns the cleaned text plus the numerals that were flagged.
 */
function stripFabricatedSentences(text: string, allowedNumbers: string[]): { text: string; fabricated: string[] } {
  const overall = assertNoFabricatedNumbers(text, allowedNumbers);
  if (overall.ok) return { text, fabricated: [] };
  const kept = splitSentences(text).filter((sentence) => assertNoFabricatedNumbers(sentence, allowedNumbers).ok);
  return { text: kept.join(' ').trim(), fabricated: overall.fabricated };
}

export interface AiCreds {
  provider: AiProvider;
  apiKey: string;
  model?: string;
}

export interface AgentRunResult {
  ok: boolean;
  agent: AiAgentName;
  result?: unknown;
  error?: string;
  evidenceIds: string[];
  toolsUsed: AiToolName[];
}

/** Pull the first JSON object out of a model reply (handles stray prose / code fences). */
function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Recursively rewrite every string in a parsed payload, leaving structure and non-string
 * values intact. Used to sanitise fabricated numerals out of the free-text fields the model
 * produced (summary, keyPoints, reasons, ...) without touching the schema shape.
 */
function mapStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = mapStrings(v, fn);
    return out;
  }
  return value;
}

/** True when any string field in the payload still carries a numeral absent from the grounding. */
function payloadHasFabricatedNumber(payload: unknown, allowedNumbers: string[]): boolean {
  let found = false;
  mapStrings(payload, (s) => {
    if (!assertNoFabricatedNumbers(s, allowedNumbers).ok) found = true;
    return s;
  });
  return found;
}

/** Every string field in a parsed payload, flattened - the model's actual free-text output. */
function collectStrings(payload: unknown): string[] {
  const out: string[] = [];
  mapStrings(payload, (s) => {
    out.push(s);
    return s;
  });
  return out;
}

/** Call the model for structured output, validate against the agent schema, and audit the run. */
async function runStructured(opts: {
  agent: AiAgentName;
  system: string;
  prompt: string;
  creds: AiCreds;
  toolsUsed: AiToolName[];
  evidenceIds: string[];
  inputForHash: unknown;
  /** The grounding/evidence text the agent was given - numerals outside this set are fabricated. */
  groundingText: string;
}): Promise<AgentRunResult> {
  const { agent, system, prompt, creds, toolsUsed, evidenceIds, inputForHash, groundingText } = opts;
  const inputHash = hashInput(inputForHash);
  const started = Date.now();
  let text = '';
  let model = creds.model ?? '';
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let costUsd: number | null = null;
  try {
    const r = await complete({ provider: creds.provider, apiKey: creds.apiKey, model: creds.model, system, prompt, maxTokens: 700, temperature: 0.3 });
    text = r.text;
    model = r.model;
    inputTokens = r.usage?.inputTokens ?? null;
    outputTokens = r.usage?.outputTokens ?? null;
    costUsd = r.costUsd;
  } catch (err) {
    await recordAiRun({ userId: 'local', agentName: agent, provider: creds.provider, model, inputHash, outputHash: null, toolsUsed, injectionFlags: [], validationErrors: [], citationCount: 0, status: 'error', refusalReason: null, latencyMs: Date.now() - started });
    return { ok: false, agent, error: err instanceof Error ? err.message : 'model_error', evidenceIds, toolsUsed };
  }
  const latencyMs = Date.now() - started;

  // Fabricated-number guard. The deterministic engine owns numbers; AI only explains. Numerals
  // allowed are exactly those present in the grounding the agent was given. On a violation we
  // strip the offending sentence(s) from the model's free-text fields. If that empties the
  // output (the whole answer hinged on an invented number), we refuse rather than ship it.
  const allowedNumbers = numeralsIn(groundingText);
  let parsed = extractJson(text);
  let refusalReason: string | null = null;
  if (parsed && typeof parsed === 'object') {
    const sanitised = mapStrings(parsed, (s) => stripFabricatedSentences(s, allowedNumbers).text);
    if (payloadHasFabricatedNumber(parsed, allowedNumbers)) {
      refusalReason = 'fabricated_number';
      // A required free-text field stripped to empty fails .strict() validation below and is
      // reported as a refusal - the safe outcome for an answer built on an invented number.
    }
    parsed = sanitised;
  }

  // Unified guardrails verdict over the model's final free-text (advice / injection echo / predictive
  // overclaim / any residual ungrounded numeral). A `block` is a HARD refusal regardless of schema
  // validity: research-only doctrine means directive advice or an injection echo never ships. A
  // `review` (predictive/insider overclaim) is recorded as a warning but allowed through.
  let guardrailBlock: string[] = [];
  let guardrailWarnings: string[] = [];
  if (parsed && typeof parsed === 'object') {
    const verdict = evaluateGuardrails({ text: collectStrings(parsed).join('\n'), allowedNumbers });
    guardrailWarnings = verdict.warnings;
    if (verdict.decision === 'block') {
      guardrailBlock = verdict.blockedReasons;
      refusalReason = refusalReason ?? `guardrail_block: ${verdict.blockedReasons.join('; ')}`;
    }
  }

  const validation = validateAgentOutput(agent, parsed);
  const citations = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).citations : undefined;
  const citationCount = Array.isArray(citations) ? citations.length : 0;
  const blocked = guardrailBlock.length > 0;
  const status = blocked || !validation.ok ? (refusalReason ? 'refused' : 'validation_failed') : 'ok';
  await recordAiRun({ userId: 'local', agentName: agent, provider: creds.provider, model, inputHash, outputHash: hashInput(text), toolsUsed, injectionFlags: [...guardrailBlock, ...guardrailWarnings], validationErrors: validation.errors, citationCount, status, refusalReason: blocked || !validation.ok ? refusalReason : null, latencyMs, inputTokens, outputTokens, costUsd });
  if (blocked) return { ok: false, agent, error: refusalReason ?? 'guardrail_block', evidenceIds, toolsUsed };
  if (!validation.ok) return { ok: false, agent, error: refusalReason ?? validation.errors.join('; '), evidenceIds, toolsUsed };
  return { ok: true, agent, result: parsed, evidenceIds, toolsUsed };
}

/**
 * research_analyst: retrieves evidence via the search_evidence tool, then returns a cited,
 * schema-valid summary ({ summary, keyPoints, citations, confidence }).
 */
export async function runResearchAnalyst(params: { symbol: string; question?: string; creds: AiCreds }): Promise<AgentRunResult> {
  const agent: AiAgentName = 'research_analyst';
  const def = getAgentDefinition(agent);
  const symbol = params.symbol.toUpperCase();
  const question = params.question?.trim() || `Summarise the momentum evidence for ${symbol}.`;

  const evidence = (await executeTool(agent, 'search_evidence', { query: `${symbol} ${question}`, limit: 6 })) as EvidenceItem[];
  if (evidence.length === 0) {
    return { ok: false, agent, error: 'no_evidence', evidenceIds: [], toolsUsed: ['search_evidence'] };
  }

  const system = composeSystem([
    LYRA_IDENTITY,
    def.purpose,
    LYRA_GUARDRAILS,
    `REFUSAL RULES:\n- ${def.refusalRules.join('\n- ')}`,
    'Use ONLY the EVIDENCE below. In "citations" list the exact evidence ids you actually used (e.g. "theme:agi-infrastructure", "company:NVDA") - at least one. Set "confidence" between 0 and 1.',
    'Respond with ONLY a JSON object - no prose, no markdown fences - matching exactly: {"summary": string, "keyPoints": string[], "citations": string[], "confidence": number}.',
    `EVIDENCE:\n${evidence.map((e) => `[${e.id}] ${e.text}`).join('\n')}`,
  ]);
  const prompt = `Symbol: ${symbol}\nQuestion: ${question}\n\nJSON:`;

  return runStructured({
    agent,
    system,
    prompt,
    creds: params.creds,
    toolsUsed: ['search_evidence'],
    evidenceIds: evidence.map((e) => e.id),
    inputForHash: { symbol, question, evidence },
    // Allowed numerals: everything in the evidence the agent was given.
    groundingText: evidence.map((e) => e.text).join(' '),
  });
}

/**
 * trade_readiness: the paper-bot's verdict agent. It gathers evidence and emits ONE of three
 * verdicts ({ readiness, reasons, missingEvidence, citations, confidence }) - NEVER an order, a
 * quantity, or a price. Deterministic code downstream builds the OrderIntent; the agent's only job
 * is to say whether there is enough cited evidence to be a paper-trade candidate.
 */
export async function runTradeReadiness(params: {
  symbol: string;
  signalSnapshot: Record<string, unknown>;
  creds: AiCreds;
}): Promise<AgentRunResult> {
  const agent: AiAgentName = 'trade_readiness';
  const def = getAgentDefinition(agent);
  const symbol = params.symbol.toUpperCase();

  const evidence = (await executeTool(agent, 'search_evidence', { query: `${symbol} momentum thesis risk bottleneck`, limit: 6 })) as EvidenceItem[];
  const evidenceIds = evidence.map((e) => e.id);

  const system = composeSystem([
    LYRA_IDENTITY,
    def.purpose,
    LYRA_GUARDRAILS,
    `REFUSAL RULES:\n- ${def.refusalRules.join('\n- ')}`,
    'Decide ONE readiness verdict, exactly one of: "research_only", "paper_trade_eligible", "blocked_missing_evidence". You output a VERDICT ONLY - never an order, side, quantity, or price. Cite the evidence ids supporting the verdict; list any missing evidence that would strengthen it. Only mark "paper_trade_eligible" when the cited evidence genuinely supports it.',
    'Respond with ONLY a JSON object - no prose, no markdown - matching exactly: {"readiness": string, "reasons": string[], "missingEvidence": string[], "citations": string[], "confidence": number}.',
    `SIGNAL SNAPSHOT: ${JSON.stringify(params.signalSnapshot)}`,
    `EVIDENCE:\n${evidence.map((e) => `[${e.id}] ${e.text}`).join('\n')}`,
  ]);
  const prompt = `Symbol: ${symbol}\nIs there enough cited evidence for this to be a PAPER-trade candidate?\n\nJSON:`;

  return runStructured({
    agent,
    system,
    prompt,
    creds: params.creds,
    toolsUsed: ['search_evidence'],
    evidenceIds,
    inputForHash: { symbol, signalSnapshot: params.signalSnapshot, evidenceRefs: evidenceIds },
    // Allowed numerals: the deterministic signal snapshot (score/RSI/volume/etc.) plus the
    // evidence the agent was given. Anything else the model writes is invented.
    groundingText: `${JSON.stringify(params.signalSnapshot)} ${evidence.map((e) => e.text).join(' ')}`,
  });
}
