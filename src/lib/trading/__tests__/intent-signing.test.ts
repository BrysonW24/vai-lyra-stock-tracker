/**
 * The paper-bot approval gate is a signed capability, not trust-the-client state. These pin the
 * property the security audit demanded: a client cannot forge, tamper, replay, stage-swap, or
 * tour-flip a capability. Every one of these went RED against the old route (which flipped an intent
 * to approved / executed it purely because the body said so).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { signClaim, verifyClaim, type IntentClaim } from '../intent-signing';

beforeAll(() => {
  process.env.PAPER_BOT_INTENT_SECRET = 'unit-test-secret';
});

const base: IntentClaim = { id: 'intent-1', symbol: 'NVDA', side: 'buy', quantity: 10, owner: 'user-A', stage: 'approved', tour: false };

describe('paper-bot intent capability (signClaim / verifyClaim)', () => {
  it('verifies a token it just signed (happy path)', () => {
    expect(verifyClaim(base, signClaim(base))).toBe(true);
  });

  it('rejects a missing / empty / non-string / garbage token (forge-from-nothing)', () => {
    expect(verifyClaim(base, undefined)).toBe(false);
    expect(verifyClaim(base, '')).toBe(false);
    expect(verifyClaim(base, 123 as unknown)).toBe(false);
    expect(verifyClaim(base, 'not-a-real-token')).toBe(false);
  });

  it('rejects an owner mismatch - user B cannot replay user A capability', () => {
    const token = signClaim(base);
    expect(verifyClaim({ ...base, owner: 'user-B' }, token)).toBe(false);
  });

  it('rejects tampered economics - fabricated quantity / symbol / side', () => {
    const token = signClaim(base);
    expect(verifyClaim({ ...base, quantity: 100_000 }, token)).toBe(false);
    expect(verifyClaim({ ...base, symbol: 'AAPL' }, token)).toBe(false);
    expect(verifyClaim({ ...base, side: 'sell' }, token)).toBe(false);
  });

  it('rejects a stage swap - a proposed token cannot satisfy an approved check', () => {
    const proposedToken = signClaim({ ...base, stage: 'proposed' });
    expect(verifyClaim({ ...base, stage: 'approved' }, proposedToken)).toBe(false);
  });

  it('rejects a tour flip - a tour token cannot drive a real fill, or vice versa', () => {
    const tourToken = signClaim({ ...base, tour: true });
    expect(verifyClaim({ ...base, tour: false }, tourToken)).toBe(false);
    const realToken = signClaim({ ...base, tour: false });
    expect(verifyClaim({ ...base, tour: true }, realToken)).toBe(false);
  });
});
