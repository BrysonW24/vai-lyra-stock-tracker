import { describe, it, expect } from 'vitest';
import { buildConstraintsBlock, type UserConstraints } from '../user-context';
import { deriveTone } from '../chat-context';

/**
 * These guard the "captured values actually reach the AI, individualised per user" contract at the
 * pure-function layer. The deterministic pipeline gate (scripts/check-onboarding-contract.mjs) proves
 * the wiring exists; these prove it produces the right prompt text for real answers.
 */

const brandNewBeginner: UserConstraints = {
  experienceLevel: 'intermediate', // form default - must be overridden to beginner
  riskComfort: 'balanced', // form default - must be overridden to conservative
  tradedBefore: 'no',
  primaryGoal: 'grow_portfolio',
  cashAvailable: 10_000,
  goalTargetAmount: 50_000,
  beginnerMotivation: 'extra_income',
  beginnerKnowledge: 'scratch',
  beginnerInvolvement: 'guide_me',
  beginnerLearningStyle: 'step_by_step',
  beginnerHorizon: 'few_months',
};

describe('buildConstraintsBlock - beginner individualisation reaches the prompt', () => {
  it('emits every beginner-branch answer, not just the binary tradedBefore', () => {
    const block = buildConstraintsBlock(brandNewBeginner);
    expect(block).toContain('Here to: earn extra income');
    expect(block).toContain('Starting point: starting from scratch');
    expect(block).toContain('Involvement: wants to be guided step by step');
    expect(block).toContain('Time horizon: a few months');
    expect(block).toContain('How they learn best: step-by-step walkthroughs');
    // the learning-style instruction is what actually changes the model's output shape
    expect(block).toContain('Break guidance into short numbered steps');
  });

  it('forces beginner experience + conservative risk regardless of the form defaults', () => {
    const block = buildConstraintsBlock(brandNewBeginner);
    expect(block).toContain('Experience: beginner');
    expect(block).toContain('Risk comfort: conservative');
    expect(block).toContain('Brand-new investor');
  });

  it('anchors ideas to the user\'s own money goal', () => {
    const block = buildConstraintsBlock(brandNewBeginner);
    expect(block).toContain('Money goal:');
    expect(block).toContain('to go from cash on hand');
    expect(block).toContain('relate progress to this target');
  });

  it('does NOT leak beginner lines for an experienced user', () => {
    const block = buildConstraintsBlock({
      experienceLevel: 'advanced',
      riskComfort: 'aggressive',
      tradedBefore: 'yes',
      investingStyle: 'swing_trader',
      // stale beginner answers that must be ignored when not brand-new
      beginnerLearningStyle: 'step_by_step',
      beginnerHorizon: 'many_years',
    });
    expect(block).toContain('Experience: advanced');
    expect(block).toContain('Risk comfort: aggressive');
    expect(block).not.toContain('How they learn best');
    expect(block).not.toContain('Time horizon');
    expect(block).not.toContain('Brand-new investor');
  });

  it('returns empty string when there is nothing to say', () => {
    expect(buildConstraintsBlock({})).toBe('');
  });

  // The constraints header once instructed the model to "size every idea against these" and
  // "say roughly how many shares or what dollar amount fits" - directly contradicting the
  // NOT ADVICE guardrail in the same composed prompt ("never tell the user to ... size a
  // position"). Research-only is the AFSL bright line and wins: the header must frame the
  // constraints as a CHECK, never a prescription. If this test fails, the contradiction is back.
  it('frames constraints as a check, never a trade prescription (NOT ADVICE wins)', () => {
    const block = buildConstraintsBlock(brandNewBeginner);
    expect(block).toMatch(/CHECK ideas against these/i);
    expect(block).toMatch(/never prescribe a share count or dollar amount/i);
    expect(block).not.toMatch(/size every idea/i);
    expect(block).not.toMatch(/how many shares/i);
  });
});

describe('deriveTone - the voice individualises per user', () => {
  it('honours a beginner who asked for "just the signal" with brevity, not the warm explainer', () => {
    const tone = deriveTone({ tradedBefore: 'no', beginnerLearningStyle: 'just_signal' });
    expect(tone).toContain('brief and plain');
    expect(tone).not.toContain('warm');
  });

  it('lays out numbered steps for a step-by-step beginner', () => {
    const tone = deriveTone({ tradedBefore: 'no', beginnerLearningStyle: 'step_by_step' });
    expect(tone).toContain('warm and plain-English');
    expect(tone).toContain('numbered steps');
  });

  it('leads with risk for a conservative user', () => {
    expect(deriveTone({ riskComfort: 'conservative' })).toContain('cautious and protective');
  });

  it('is direct for an aggressive user', () => {
    expect(deriveTone({ riskComfort: 'aggressive' })).toContain('direct and decisive');
  });

  it('is technical for an advanced user', () => {
    expect(deriveTone({ experienceLevel: 'advanced' })).toContain('concise and technical');
  });

  it('falls back to a calm balanced default', () => {
    expect(deriveTone({})).toContain('clear, calm and balanced');
  });
});
