/**
 * contracts/notifications enforcement - these JSON files were referenced by NOTHING (no
 * codegen, no runtime validation, no test), so any drift was silent decoration. This suite
 * makes them a real gate: templates must be internally consistent, the golden test register
 * must exercise real templates, and every template key must be an alert type the Python
 * scanner can actually emit.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const templatesDoc = JSON.parse(readFileSync(join(root, 'contracts/notifications/message-templates.json'), 'utf8'));
const registerDoc = JSON.parse(readFileSync(join(root, 'contracts/notifications/test-register.json'), 'utf8'));

// The alert types the worker emits (alert_engine.py + main.py + outcome_job.py). A template
// for a type the scanner can never produce - or a scanner type with no template - is drift.
const WORKER_ALERT_TYPES = new Set([
  'strong_setup',
  'score_jump',
  'signal_invalidated',
  'watchlist_upgrade',
  'portfolio_risk',
  'watchlist_price_move',
  'portfolio_price_move',
  // Contract-level family name for the threshold price moves above (the worker emits
  // watchlist_price_move_10 / portfolio_price_move_-5 etc.; one template covers them).
  'price_alert',
  'signal_followup',
  'daily_digest',
  'weekly_report',
]);

const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const SLOT_RE = /\{([a-z0-9_]+)\}/g;

describe('message-templates.json', () => {
  const templates = templatesDoc.templates as Record<string, { severity: string; headline: string; detail: string }>;

  it('declares limits and at least the core signal templates', () => {
    expect(templatesDoc.limits.max_headline_chars).toBeGreaterThan(0);
    expect(templatesDoc.limits.max_detail_chars).toBeGreaterThan(0);
    expect(Object.keys(templates)).toEqual(expect.arrayContaining(['strong_setup', 'score_jump']));
  });

  it('every template maps to a real worker alert type with a valid severity', () => {
    for (const [key, template] of Object.entries(templates)) {
      expect(WORKER_ALERT_TYPES.has(key), `template "${key}" is not an alert type the worker emits`).toBe(true);
      expect(SEVERITIES.has(template.severity), `template "${key}" severity "${template.severity}"`).toBe(true);
    }
  });

  it('template literals respect their own char limits (slots collapse, never grow the floor)', () => {
    for (const [key, template] of Object.entries(templates)) {
      const headlineFloor = template.headline.replace(SLOT_RE, '').length;
      const detailFloor = template.detail.replace(SLOT_RE, '').length;
      expect(headlineFloor, `"${key}" headline literal exceeds max_headline_chars`).toBeLessThanOrEqual(
        templatesDoc.limits.max_headline_chars,
      );
      expect(detailFloor, `"${key}" detail literal exceeds max_detail_chars`).toBeLessThanOrEqual(
        templatesDoc.limits.max_detail_chars,
      );
    }
  });
});

describe('test-register.json', () => {
  interface RegisterCase {
    case_id: string;
    input: { type: string; ticker?: string; facts?: Record<string, unknown> };
    expect?: { must_include?: string[] };
  }
  const cases = registerDoc.cases as RegisterCase[];

  it('has cases and unique case ids', () => {
    expect(cases.length).toBeGreaterThan(0);
    const ids = cases.map((c) => c.case_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every alert case exercises a template that exists (digest cases use kind, not type)', () => {
    const templates = Object.keys(templatesDoc.templates as Record<string, unknown>);
    for (const testCase of cases.filter((c) => typeof c.input.type === 'string')) {
      expect(templates, `case "${testCase.case_id}" targets missing template "${testCase.input.type}"`).toContain(
        testCase.input.type,
      );
    }
  });

  it('must_include expectations only reference the case facts or ticker (no invented numbers)', () => {
    for (const testCase of cases) {
      const legal = new Set<string>(
        Object.values(testCase.input.facts ?? {}).map((value) => String(value)),
      );
      if (testCase.input.ticker) legal.add(testCase.input.ticker);
      for (const expected of testCase.expect?.must_include ?? []) {
        const isFactOrTicker = Array.from(legal).some((value) => expected.includes(value) || value.includes(expected));
        expect(isFactOrTicker, `case "${testCase.case_id}" expects "${expected}" which is not in facts/ticker`).toBe(true);
      }
    }
  });
});
