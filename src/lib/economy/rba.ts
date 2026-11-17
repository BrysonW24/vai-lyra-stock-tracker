/**
 * RBA statistical tables client - the cash rate, from the RBA's own published CSV.
 *
 * The RBA has no JSON API; its statistical tables are CSVs at
 * https://www.rba.gov.au/statistics/tables/csv/<table>-data.csv with a header block
 * (Title / Description / Frequency / Type / Units / Source / Publication date), then a
 * "Series ID" row naming each column, then one row per observation dated dd/mm/yyyy.
 *
 * We locate the column by its SERIES ID, never by position: the RBA adds and reorders
 * columns, and a positional read would quietly start returning a different rate.
 *
 * Same degrade contract as the ABS client: any failure returns [] and the indicator is
 * reported as unavailable. Never a stale constant in its place.
 */
import { withRetry } from '@/lib/ai/resilience';
import type { FetchImpl } from './abs';
import type { RbaSeriesSpec } from './series';
import type { EconomyObservation } from './types';

const RBA_TABLES = 'https://www.rba.gov.au/statistics/tables/csv';

export function rbaTableUrl(spec: RbaSeriesSpec): string {
  return `${RBA_TABLES}/${spec.table}-data.csv`;
}

/** Split one CSV line. RBA tables quote nothing in the data rows, but titles can - handle both. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const DATE_ROW = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Parse an RBA table CSV into observations for one series id, oldest first.
 * Monthly tables are dated on the last day of the month; the period becomes "yyyy-mm" so it
 * sorts and compares alongside the ABS's monthly labels.
 */
export function parseRbaSeries(csv: string, seriesId: string): EconomyObservation[] {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/);
  let column = -1;
  const out: EconomyObservation[] = [];

  for (const line of lines) {
    if (!line) continue;
    const cells = splitCsvLine(line);
    if (column < 0) {
      if (cells[0] === 'Series ID') column = cells.indexOf(seriesId);
      continue;
    }
    const match = DATE_ROW.exec(cells[0] ?? '');
    if (!match) continue;
    const raw = cells[column];
    if (raw === undefined || raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    out.push({ period: `${match[3]}-${match[2]}`, value });
  }

  // No "Series ID" row, or the id is not in it: report nothing rather than a wrong column.
  if (column < 0) return [];
  out.sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
  return out;
}

export interface RbaFetchOptions {
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Fetch one RBA series. [] on any failure. */
export async function fetchRbaSeries(spec: RbaSeriesSpec, options: RbaFetchOptions = {}): Promise<EconomyObservation[]> {
  const doFetch: FetchImpl =
    options.fetchImpl ?? ((url, init) => fetch(url, init) as unknown as ReturnType<FetchImpl>);
  const timeoutMs = options.timeoutMs ?? 8000;

  try {
    const observations = await withRetry(
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await doFetch(rbaTableUrl(spec), { signal: controller.signal });
          if (!res.ok) {
            if (res.status === 404) return [];
            throw new Error(`RBA ${spec.table} HTTP ${res.status}`);
          }
          return parseRbaSeries(await res.text(), spec.seriesId);
        } catch (err) {
          if (controller.signal.aborted) throw new Error(`RBA ${spec.table} timeout`);
          throw err;
        } finally {
          clearTimeout(timer);
        }
      },
      { policy: { maxAttempts: options.maxAttempts ?? 2 }, sleep: options.sleep },
    );
    // The full table runs back to 1969; the read needs the recent run only.
    return observations.slice(-24);
  } catch {
    return [];
  }
}
