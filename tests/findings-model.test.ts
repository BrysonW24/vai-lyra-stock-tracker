import { describe, expect, it } from 'vitest';
import { DEMO_FINDINGS, getDemoFinding } from '@/lib/findings/demo-findings';

/**
 * Integrity guards for the Investigation System demo data. The drawer stack drills
 * finding -> evidence -> source record -> entity -> connected pattern, so every linked id MUST
 * resolve or a drawer renders a dead end. These tests also enforce the trust rule: every evidence
 * item carries a non-empty "what it does not prove".
 */
describe('findings demo data integrity', () => {
  it('lookup works for known and unknown ids', () => {
    expect(getDemoFinding('BKSY-20260617')?.symbol).toBe('BKSY');
    expect(getDemoFinding('does-not-exist')).toBeUndefined();
  });

  it('every finding is well-formed', () => {
    for (const f of DEMO_FINDINGS) {
      expect(f.id).toBeTruthy();
      expect(f.scores.total).toBeGreaterThanOrEqual(0);
      expect(f.scores.total).toBeLessThanOrEqual(100);
      expect(f.whySurfaced.length).toBeGreaterThan(0);
      expect(f.evidence.length).toBeGreaterThan(0);
      expect(f.actions.length).toBeGreaterThan(0);
      expect(f.timeline.length).toBeGreaterThan(0);
      // Lyra never says Buy - every action must be in the research-only vocabulary.
      const allowed = new Set(['research', 'watch', 'monitor', 'compare', 'ask_lyra', 'set_alert', 'paper_bot', 'review_risk', 'dismiss_noise']);
      for (const a of f.actions) expect(allowed.has(a.kind)).toBe(true);
    }
  });

  it('every evidence item carries the honesty line and resolvable entity links', () => {
    for (const f of DEMO_FINDINGS) {
      const entityIds = new Set(f.entities.map((e) => e.id));
      for (const ev of f.evidence) {
        expect(ev.whyItMatters.trim().length).toBeGreaterThan(0);
        expect(ev.whatItDoesNotProve.trim().length).toBeGreaterThan(0);
        for (const id of ev.linkedEntityIds) {
          expect(entityIds.has(id)).toBe(true);
        }
      }
    }
  });

  it('every relationship resolves both endpoints with a valid confidence', () => {
    for (const f of DEMO_FINDINGS) {
      const entityIds = new Set(f.entities.map((e) => e.id));
      for (const r of f.relationships) {
        expect(entityIds.has(r.fromEntityId)).toBe(true);
        expect(entityIds.has(r.toEntityId)).toBe(true);
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the connected-pattern works: a shared node links more than one company', () => {
    const bksy = getDemoFinding('BKSY-20260617');
    expect(bksy).toBeDefined();
    const node = bksy?.entities.find((e) => e.id === 'node:earth-observation');
    expect(node?.type).toBe('supply_chain_node');
    // Both BKSY and the peer PL relate to the shared earth-observation node (the "other companies
    // exposed to this same bottleneck" pattern the investigation UI reveals).
    const companiesOnNode = new Set(
      (bksy?.relationships ?? [])
        .filter((r) => r.toEntityId === 'node:earth-observation' || r.fromEntityId === 'node:earth-observation')
        .flatMap((r) => [r.fromEntityId, r.toEntityId])
        .filter((id) => bksy?.entities.find((e) => e.id === id)?.type === 'company'),
    );
    expect(companiesOnNode.size).toBeGreaterThanOrEqual(2);
  });
});
