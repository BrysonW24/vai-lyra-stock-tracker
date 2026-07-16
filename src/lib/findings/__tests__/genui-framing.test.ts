import { describe, it, expect } from 'vitest';
import { buildGenUIPrompt } from '@/lib/findings/genui';
import { DEMO_FINDINGS } from '@/lib/findings/demo-findings';

const finding = DEMO_FINDINGS[0];

describe('GenUI · per-user framing', () => {
  it('adds no personalisation section without framing', () => {
    const prompt = buildGenUIPrompt(finding);
    expect(prompt).not.toMatch(/PERSONALISATION/);
    // The number-free prose rule is always present.
    expect(prompt).toMatch(/NO numbers anywhere in prose/);
  });

  it('threads qualitative framing and always keeps the anti-bias duty', () => {
    const prompt = buildGenUIPrompt(finding, {
      riskPosture: 'cautious',
      preferredSignalKinds: ['Government award', 'Supply-chain bottleneck'],
    });
    expect(prompt).toMatch(/PERSONALISATION/);
    expect(prompt).toMatch(/cautious/);
    expect(prompt).toMatch(/Government award/);
    expect(prompt).toMatch(/ANTI-BIAS DUTY/);
    // No raw figures cross into the prompt from framing.
    expect(prompt).not.toMatch(/\d+%/);
  });
});
