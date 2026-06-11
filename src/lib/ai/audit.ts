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

let activeWriter: AiRunWriter = inMemoryAiRunStore;

/** Swap the persistence backend. Passing null restores the in-memory store. */
export function setAiRunWriter(writer: AiRunWriter | null): void {
  activeWriter = writer ?? inMemoryAiRunStore;
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
  await activeWriter.write(record);
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
