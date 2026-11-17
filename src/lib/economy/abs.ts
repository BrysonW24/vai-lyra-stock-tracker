/**
 * ABS Data API client - keyless SDMX-JSON over https://data.api.abs.gov.au.
 *
 * Same resilience contract as the USAspending ingestion (`src/lib/ingestion/usaspending.ts`):
 * time-bounded per attempt, retried on transient failure, and DEGRADES to an empty series on
 * any error. It never throws into a page render, and it never invents an observation.
 *
 * SDMX-JSON shape we consume, with `dimensionAtObservation=AllDimensions`:
 *
 *   data.structures[0].dimensions.observation : [{ id, values: [{ id }] }, ...]
 *   data.dataSets[0].observations             : { "0:1:0:0:0:3": [value], ... }
 *
 * The observation KEY is a colon-joined list of indexes into each dimension's `values`, in
 * the order the `observation` array lists them. So reading a series means finding the index
 * of TIME_PERIOD and mapping each key back through those value lists - there is no shortcut,
 * and assuming a fixed position is how this silently reads the wrong series.
 */
import { withRetry } from '@/lib/ai/resilience';
import type { AbsSeriesSpec } from './series';
import type { EconomyObservation } from './types';

const ABS_BASE = 'https://data.api.abs.gov.au/rest/data';

/** SDMX-JSON asks for its own media type; the generic one returns XML. */
const SDMX_JSON = 'application/vnd.sdmx.data+json';

export type FetchImpl = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

interface SdmxDimension {
  id?: unknown;
  values?: unknown;
}

/** Narrow the part of the SDMX payload we read, without trusting any of it. */
function readDimensions(payload: unknown): { ids: string[]; values: string[][] } | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const data = (payload as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return null;
  const structures = (data as { structures?: unknown }).structures;
  const structure = Array.isArray(structures)
    ? structures[0]
    : (data as { structure?: unknown }).structure;
  if (typeof structure !== 'object' || structure === null) return null;
  const dims = (structure as { dimensions?: { observation?: unknown } }).dimensions?.observation;
  if (!Array.isArray(dims)) return null;

  const ids: string[] = [];
  const values: string[][] = [];
  for (const dim of dims as SdmxDimension[]) {
    if (typeof dim?.id !== 'string' || !Array.isArray(dim.values)) return null;
    ids.push(dim.id);
    values.push(
      (dim.values as { id?: unknown }[]).map((v) => (typeof v?.id === 'string' ? v.id : '')),
    );
  }
  return { ids, values };
}

/** The raw observation map, or null when the payload is not a data message. */
function readObservations(payload: unknown): Record<string, unknown> | null {
  const data = (payload as { data?: { dataSets?: unknown } } | null)?.data;
  const dataSets = data?.dataSets;
  if (!Array.isArray(dataSets) || dataSets.length === 0) return null;
  const obs = (dataSets[0] as { observations?: unknown }).observations;
  if (typeof obs !== 'object' || obs === null) return null;
  return obs as Record<string, unknown>;
}

/**
 * Parse one SDMX-JSON data message into observations, oldest period first.
 *
 * A request whose key fully specifies every dimension still comes back as a cube, so we only
 * require that TIME_PERIOD exists; anything else in the key is already pinned by the request.
 * Returns [] for a payload that is not a data message (the ABS answers "NoRecordsFound" as a
 * 404 body, which must never become an observation).
 */
export function parseAbsSeries(payload: unknown): EconomyObservation[] {
  const dims = readDimensions(payload);
  const obs = readObservations(payload);
  if (!dims || !obs) return [];

  const timeIndex = dims.ids.indexOf('TIME_PERIOD');
  if (timeIndex < 0) return [];

  const out: EconomyObservation[] = [];
  for (const [key, raw] of Object.entries(obs)) {
    const parts = key.split(':');
    if (parts.length !== dims.ids.length) continue;
    const periodIdx = Number(parts[timeIndex]);
    const period = dims.values[timeIndex]?.[periodIdx];
    if (!period) continue;

    // An observation is an array whose first element is the value; null means "not published".
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    out.push({ period, value });
  }

  // Period labels sort correctly as strings for both "2026-Q2" and "2026-09".
  out.sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
  return out;
}

export interface AbsFetchOptions {
  fetchImpl?: FetchImpl;
  /** Per-attempt timeout in ms (default 8000). */
  timeoutMs?: number;
  /** Max attempts including the first (default 2 - a slow ABS answer should not hold a page). */
  maxAttempts?: number;
  /** Injectable backoff sleep, so tests never wait on the clock. */
  sleep?: (ms: number) => Promise<void>;
}

/** Build the request URL for a spec. Exported so a test can assert the key order. */
export function absSeriesUrl(spec: AbsSeriesSpec): string {
  const path = `ABS,${spec.dataflow},${spec.version}/${spec.key}`;
  return `${ABS_BASE}/${path}?startPeriod=${encodeURIComponent(spec.startPeriod)}&dimensionAtObservation=AllDimensions`;
}

/**
 * Fetch one ABS series. Returns [] on ANY failure - a 404 (the ABS "NoRecordsFound"), a
 * timeout, a network error, or a payload we cannot read. The caller turns [] into an
 * 'unavailable' indicator and names it; nothing downstream guesses a value.
 */
export async function fetchAbsSeries(
  spec: AbsSeriesSpec,
  options: AbsFetchOptions = {},
): Promise<EconomyObservation[]> {
  const doFetch: FetchImpl =
    options.fetchImpl ?? ((url, init) => fetch(url, init) as unknown as ReturnType<FetchImpl>);
  const timeoutMs = options.timeoutMs ?? 8000;
  const url = absSeriesUrl(spec);

  try {
    return await withRetry(
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await doFetch(url, {
            signal: controller.signal,
            headers: { Accept: SDMX_JSON },
          });
          if (!res.ok) {
            // 404 is the ABS's "no records" answer as well as a genuinely bad key. Neither is
            // retryable into existence, but both are safe to report as absent.
            if (res.status === 404) return [];
            throw new Error(`ABS ${spec.dataflow} HTTP ${res.status}`);
          }
          return parseAbsSeries(await res.json());
        } catch (err) {
          // An abort reads "This operation was aborted", which the default classifier would
          // treat as permanent. A slow statistics API is the textbook transient failure.
          if (controller.signal.aborted) throw new Error(`ABS ${spec.dataflow} timeout`);
          throw err;
        } finally {
          clearTimeout(timer);
        }
      },
      { policy: { maxAttempts: options.maxAttempts ?? 2 }, sleep: options.sleep },
    );
  } catch {
    return [];
  }
}
