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
import { validateAgentOutput } from '@/lib/ai/guardrails/schema';
import { recordAiRun, hashInput } from '@/lib/ai/audit';
import { LYRA_IDENTITY, LYRA_GUARDRAILS, composeSystem } from '@/lib/ai/system-prompt';
import { executeTool } from './tools/runtime';
import type { EvidenceItem } from './tools';

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

/** Call the model for structured output, validate against the agent schema, and audit the run. */
async function runStructured(opts: {
  agent: AiAgentName;
  system: string;
  prompt: string;
  creds: AiCreds;
  toolsUsed: AiToolName[];
  evidenceIds: string[];
  inputForHash: unknown;
}): Promise<AgentRunResult> {
  const { agent, system, prompt, creds, toolsUsed, evidenceIds, inputForHash } = opts;
  const inputHash = hashInput(inputForHash);
  const started = Date.now();
  let text = '';
  let model = creds.model ?? '';
  try {
    const r = await complete({ provider: creds.provider, apiKey: creds.apiKey, model: creds.model, system, prompt, maxTokens: 700, temperature: 0.3 });
    text = r.text;
    model = r.model;
  } catch {
    void recordAiRun({ userId: 'local', agentName: agent, provider: creds.provider, model, inputHash, outputHash: null, toolsUsed, injectionFlags: [], validationErrors: [], citationCount: 0, status: 'error', refusalReason: null, latencyMs: Date.now() - started }).catch(() => {});
    return { ok: false, agent, error: 'model_error', evidenceIds, toolsUsed };
  }
  const latencyMs = Date.now() - started;
  const parsed = extractJson(text);
  const validation = validateAgentOutput(agent, parsed);
  const citations = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).citations : undefined;
  const citationCount = Array.isArray(citations) ? citations.length : 0;
  void recordAiRun({ userId: 'local', agentName: agent, provider: creds.provider, model, inputHash, outputHash: hashInput(text), toolsUsed, injectionFlags: [], validationErrors: validation.errors, citationCount, status: validation.ok ? 'ok' : 'validation_failed', refusalReason: null, latencyMs }).catch(() => {});
  if (!validation.ok) return { ok: false, agent, error: validation.errors.join('; '), evidenceIds, toolsUsed };
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
  });
}
