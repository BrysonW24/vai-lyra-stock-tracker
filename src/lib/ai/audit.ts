/**
 * AI run audit trail. [AI-SEC-05]
 *
 * Every model invocation produces one AiRunRecord mirroring the ai_runs table:
 * who ran which agent, on which provider/model, with which tools, what the
 * guardrails flagged, and how validation ended. Records carry HASHES of inputs
 * and outputs, never raw prompts and never API keys - the audit trail must be
 * safe to read without becoming a secret store (BYOK keys are never persisted,
 * see src/lib/ai/gateway.ts).
 *
 * Server-side only (uses node:crypto). Storage is pluggable: the default writer
 * is an in-memory store; a Supabase-backed writer can be plugged in via
 * setAiRunWriter without touching any call site.
 */
import { createHash, randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { AiProvider } from './gateway';
import type { AiAgentName, AiToolName } from './policy';

export type AiRunStatus = 'ok' | 'refused' | 'validation_failed' | 'error';

/** One audited model invocation - mirrors the ai_runs table row shape. */
export interface AiRunRecord {
  id: string;
  userId: string;
  agentName: AiAgentName;
  provider: AiProvider;
  model: string;
  /** sha256 of the canonicalised input payload - never the raw prompt. */
  inputHash: string;
  /** sha256 of the output payload, or null when the run never produced one. */
  outputHash: string | null;
  /** Read-only tools the agent actually invoked during the run. */
  toolsUsed: AiToolName[];
  /** Injection pattern ids flagged on the run's external content. */
  injectionFlags: string[];
  /** Errors from validateAgentOutput - empty when validation passed. */
  validationErrors: string[];
  citationCount: number;
  status: AiRunStatus;
  /** Populated when status is 'refused' - which refusal rule fired. */
  refusalReason: string | null;
  latencyMs: number | null;
  /**
   * Token usage the provider reported (AI-11). Absent/null when no successful completion happened
   * (error/refused-before-model) or the provider omitted usage - never estimated. costUsd is the
   * list-price estimate (real tokens x declared rate), null when tokens or the model price is unknown.
   */
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd?: number | null;
  createdAt: string;
}

/** Input shape for recordAiRun - id and createdAt are filled when omitted. */
export type AiRunInput = Omit<AiRunRecord, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: string;
};

/** Pluggable persistence seam - implement this to write runs to the ai_runs table. */
export interface AiRunWriter {
  write(record: AiRunRecord): void | Promise<void>;
}

class InMemoryAiRunStore implements AiRunWriter {
  private records: AiRunRecord[] = [];

  write(record: AiRunRecord): void {
    this.records.push(record);
  }

  list(): readonly AiRunRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.records = [];
  }
}

/** Default writer - inspectable in tests and dev via list()/clear(). */
export const inMemoryAiRunStore = new InMemoryAiRunStore();

/**
 * Supabase-backed writer for the already-migrated public.ai_runs table (migration 019).
 * Server-side only - uses the service-role client (RLS-bypassing) so system + user runs
 * both persist. Fails soft: if Supabase env is unset the admin client is null and we keep
 * runs in memory; a transient write error is swallowed so auditing never breaks a request.
 *
 * Column mapping notes (camelCase record -> snake_case table):
 * - user_id is a uuid FK to profiles(id). Non-uuid sentinels (e.g. 'local' for local/dev
 *   runs) are stored as null - the table treats a null user_id as a system run.
 * - Fields without a dedicated column (toolsUsed, injectionFlags, validationErrors,
 *   citationCount, outputHash, refusalReason, latencyMs) are folded into output_payload so
 *   nothing in the audit record is lost.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class SupabaseAiRunWriter implements AiRunWriter {
  async write(record: AiRunRecord): Promise<void> {
    const client = createSupabaseAdminClient();
    if (!client) return; // no Supabase env - nothing to persist to
    const userId = UUID_RE.test(record.userId) ? record.userId : null;
    const { error } = await client.from('ai_runs').insert({
      id: record.id,
      user_id: userId,
      agent_name: record.agentName,
      model_provider: record.provider,
      model_name: record.model,
      input_hash: record.inputHash,
      output_payload: {
        outputHash: record.outputHash,
        toolsUsed: record.toolsUsed,
        injectionFlags: record.injectionFlags,
        validationErrors: record.validationErrors,
        citationCount: record.citationCount,
        refusalReason: record.refusalReason,
        latencyMs: record.latencyMs,
        inputTokens: record.inputTokens ?? null,
        outputTokens: record.outputTokens ?? null,
        costUsd: record.costUsd ?? null,
      },
      status: record.status,
      error_message: record.refusalReason,
      created_at: record.createdAt,
    });
    if (error) {
      // Audit must never break the caller - log and move on.
      console.error('ai_runs insert failed', error.message);
    }
  }
}

/** Reusable Supabase writer instance. */
export const supabaseAiRunStore = new SupabaseAiRunWriter();

let activeWriter: AiRunWriter | null = null;
let autoConfigured = false;

/** Swap the persistence backend. Passing null restores the in-memory store. */
export function setAiRunWriter(writer: AiRunWriter | null): void {
  activeWriter = writer ?? inMemoryAiRunStore;
  autoConfigured = true; // explicit configuration wins over auto-selection
}

/**
 * Resolve the writer to use. The first time a run is recorded without an explicit
 * setAiRunWriter call, auto-select: use the Supabase writer when service-role env is present,
 * otherwise the in-memory store. This persists the audit trail in production (where the in-
 * memory store was empty on every serverless cold start) without touching any call site.
 */
function resolveWriter(): AiRunWriter {
  if (activeWriter) return activeWriter;
  if (!autoConfigured) {
    autoConfigured = true;
    activeWriter = createSupabaseAdminClient() ? supabaseAiRunStore : inMemoryAiRunStore;
    return activeWriter;
  }
  return inMemoryAiRunStore;
}

/**
 * Reduce internal refusal detail to a bounded operations code. The raw reason remains in the
 * protected audit record, while console logs get enough signal for alerting without provider
 * response text, prompts, keys, or free-form validation content.
 */
function safeFailureCode(record: AiRunRecord): string | null {
  if (record.status === 'ok') return null;
  const providerReason = record.refusalReason?.match(
    /^provider:(invalid_key|invalid_model|provider_rate_limited|provider_unavailable|empty_response|error)$/,
  )?.[1];
  if (providerReason) return providerReason;
  if (
    record.refusalReason === 'empty_response' ||
    record.validationErrors.includes('empty_response')
  ) {
    return 'empty_response';
  }
  if (record.status === 'refused') return 'guardrail_block';
  if (record.status === 'validation_failed') return 'validation_failed';
  return 'error';
}

/**
 * Record one AI run through the active writer. Fills id and createdAt when the
 * caller does not supply them, and returns the complete record.
 */
export async function recordAiRun(input: AiRunInput): Promise<AiRunRecord> {
  const record: AiRunRecord = {
    ...input,
    id: input.id ?? randomUUID(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  const writer = resolveWriter();
  const safeModel = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,95}$/.test(record.model)
    ? record.model
    : '[invalid-model-id]';
  let writeOk = true;
  try {
    await writer.write(record);
  } catch {
    writeOk = false;
    // Deliberately omit the thrown message: a custom writer could accidentally include a
    // credential or provider payload in it. The run id joins this to the safe event below.
    console.error(
      JSON.stringify({
        event: 'lyra.ai_audit_write_failed',
        schemaVersion: 1,
        runId: record.id,
      }),
    );
  }

  // Serverless-safe operational telemetry. This is emitted synchronously after the durable write
  // is awaited, so Solo (which intentionally has no Supabase) still has a complete Vercel log
  // trail. No prompt, response, API key or raw identity is present.
  console.info(
    JSON.stringify({
      event: 'lyra.ai_run',
      schemaVersion: 1,
      runId: record.id,
      identityHash: createHash('sha256').update(record.userId, 'utf8').digest('hex').slice(0, 16),
      agent: record.agentName,
      provider: record.provider,
      model: safeModel,
      status: record.status,
      failureCode: safeFailureCode(record),
      inputHash: record.inputHash.slice(0, 16),
      outputHash: record.outputHash?.slice(0, 16) ?? null,
      toolCount: record.toolsUsed.length,
      injectionFlagCount: record.injectionFlags.length,
      validationErrorCount: record.validationErrors.length,
      citationCount: record.citationCount,
      latencyMs: record.latencyMs,
      inputTokens: record.inputTokens ?? null,
      outputTokens: record.outputTokens ?? null,
      costUsd: record.costUsd ?? null,
      storage: writer === supabaseAiRunStore ? 'supabase' : 'memory',
      writeOk,
      createdAt: record.createdAt,
    }),
  );
  return record;
}

/** Deterministic JSON canonicalisation - object keys sorted at every depth. */
function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(',')}}`;
}

/**
 * sha256 hex of a canonicalised payload. Key order never changes the hash, so
 * the same logical input always maps to the same audit fingerprint.
 */
export function hashInput(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload), 'utf8').digest('hex');
}
