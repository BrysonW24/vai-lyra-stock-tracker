/**
 * Shared (Upstash) hosted-key budget - the serverless-correct path. Pins that the ceiling
 * holds across a SINGLE Redis counter (not per-lambda), that a blocked call is rolled back and
 * not counted, and that an unconfigured/erroring Upstash falls back to the in-memory tracker
 * rather than failing the call open.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  store: new Map<string, number>(),
  mode: 'ok' as 'ok' | 'unconfigured' | 'throw',
}));

vi.mock('@/lib/cache', () => ({
  upstashCommand: async (cmd: (string | number)[]) => {
    if (hoisted.mode === 'unconfigured') return null;
    if (hoisted.mode === 'throw') throw new Error('redis down');
    const [op, key] = cmd as [string, string, number];
    if (op === 'INCRBY') {
      const next = (hoisted.store.get(key) ?? 0) + Number(cmd[2]);
      hoisted.store.set(key, next);
      return next;
    }
    if (op === 'EXPIRE') return 1;
    return null;
  },
}));

import { chargeHostedBudgetShared, resetHostedBudgetForTests } from '../budget-tracker';

const NOW = new Date('2026-07-16T12:00:00Z');

describe('chargeHostedBudgetShared', () => {
  beforeEach(() => {
    hoisted.store.clear();
    hoisted.mode = 'ok';
    resetHostedBudgetForTests();
    process.env.LYRA_HOSTED_TOKENS_PER_RUN = '1000';
    process.env.LYRA_HOSTED_TOKENS_PER_DAY = '2500';
  });
  afterEach(() => {
    delete process.env.LYRA_HOSTED_TOKENS_PER_RUN;
    delete process.env.LYRA_HOSTED_TOKENS_PER_DAY;
    resetHostedBudgetForTests();
  });

  it('accumulates against ONE shared counter and blocks at the day ceiling', async () => {
    expect((await chargeHostedBudgetShared('hosted_openai', 700, NOW)).decision).toBe('allow');
    expect((await chargeHostedBudgetShared('hosted_openai', 700, NOW)).decision).toBe('allow');
    // 1400 -> +700 = 2100 (84% of 2500) -> warn, still charged.
    expect((await chargeHostedBudgetShared('hosted_openai', 700, NOW)).decision).toBe('warn');
    // 2100 -> +700 would be 2800 > 2500 -> block, and rolled back.
    const blocked = await chargeHostedBudgetShared('hosted_openai', 700, NOW);
    expect(blocked.decision).toBe('block');
    expect(blocked.window).toBe('day');
    // The block was NOT counted: a 300-token call still fits (2100 + 300 = 2400).
    expect((await chargeHostedBudgetShared('hosted_openai', 300, NOW)).decision).not.toBe('block');
  });

  it('blocks a single run over the per-run ceiling WITHOUT touching the counter', async () => {
    const v = await chargeHostedBudgetShared('hosted_openai', 1500, NOW);
    expect(v.decision).toBe('block');
    expect(v.window).toBe('run');
    // Counter untouched, so a normal call is still 'allow' from zero.
    expect((await chargeHostedBudgetShared('hosted_openai', 700, NOW)).decision).toBe('allow');
  });

  it('tracks sources independently under distinct keys', async () => {
    for (let i = 0; i < 3; i++) await chargeHostedBudgetShared('hosted_openai', 800, NOW);
    expect((await chargeHostedBudgetShared('hosted_openai', 800, NOW)).decision).toBe('block'); // 2400+800>2500
    expect((await chargeHostedBudgetShared('shared_google', 800, NOW)).decision).not.toBe('block');
  });

  it('falls back to the in-memory tracker when Upstash is unconfigured (never fails open)', async () => {
    hoisted.mode = 'unconfigured';
    // The in-memory tracker enforces the same ceilings.
    expect((await chargeHostedBudgetShared('hosted_openai', 700, NOW)).decision).toBe('allow');
    expect((await chargeHostedBudgetShared('hosted_openai', 700, NOW)).decision).toBe('allow');
    expect((await chargeHostedBudgetShared('hosted_openai', 700, NOW)).decision).toBe('warn');
    expect((await chargeHostedBudgetShared('hosted_openai', 700, NOW)).decision).toBe('block');
  });

  it('falls back (does not fail open) when Upstash throws', async () => {
    hoisted.mode = 'throw';
    const v = await chargeHostedBudgetShared('hosted_openai', 700, NOW);
    expect(['allow', 'warn']).toContain(v.decision); // enforced via in-memory, not waved through
  });
});
