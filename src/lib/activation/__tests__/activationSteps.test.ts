import { describe, it, expect } from 'vitest';
import { ACTIVATION_SCENES } from '../activationSteps';

/**
 * The activation primer is the product's first impression - so its scene data is pinned: step
 * numbers stay contiguous, every scene agrees on the total, and the models scene (added when the
 * Emerging Winner Engine shipped) cannot silently fall out of the sequence.
 */

const SCENES = Object.values(ACTIVATION_SCENES);

describe('activation scenes', () => {
  it('has contiguous step numbers agreeing with every totalSteps', () => {
    const steps = SCENES.map((s) => s.step).sort((a, b) => a - b);
    expect(steps).toEqual(Array.from({ length: SCENES.length }, (_, i) => i + 1));
    for (const s of SCENES) {
      expect(s.totalSteps).toBe(SCENES.length);
    }
  });

  it('has unique ids and non-empty copy on every scene', () => {
    const ids = SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SCENES) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });

  it('includes the models scene before the final ready beat', () => {
    expect(ACTIVATION_SCENES.models).toBeTruthy();
    expect(ACTIVATION_SCENES.models.id).toBe('models');
    expect(ACTIVATION_SCENES.models.step).toBeLessThan(ACTIVATION_SCENES.ready.step);
    expect(ACTIVATION_SCENES.models.description).toMatch(/research only/i);
  });
});
