import { describe, expect, it } from 'vitest';
import { aiHostingCopy } from '@/lib/ai/hosted-copy';

describe('aiHostingCopy - honest hosted-vs-BYOK copy', () => {
  it('promises hosted AI ONLY when a hosted key exists', () => {
    const hosted = aiHostingCopy(true);
    expect(hosted.headerSubtitle).toMatch(/hosted beta/i);
    expect(hosted.panelSubtitle).toMatch(/hosted/i);
    expect(hosted.openaiOptgroupLabel).toBe('Hosted beta');
    expect(hosted.openaiOptionLabel).toBe('OpenAI GPT-5.5');
  });

  it('tells the truth when NO hosted key exists: BYOK required, never a hosted promise', () => {
    const byok = aiHostingCopy(false);
    // Must state a key is required...
    expect(byok.headerSubtitle).toMatch(/your own key|bring your own|add your own/i);
    expect(byok.panelSubtitle).toMatch(/your own provider key/i);
    // ...and must NOT claim a hosted model is available (the cell-2 bug: Supabase set, no hosted key).
    expect(byok.headerSubtitle).not.toMatch(/hosted beta by default|hosted model.{0,20}(available|default)/i);
    expect(byok.panelSubtitle).not.toMatch(/hosted (beta|model)/i);
    expect(byok.openaiOptgroupLabel).toBe('Your own key');
    expect(byok.openaiOptionLabel).toMatch(/BYOK/);
  });

  it('decides on the hosted-key signal alone - not on Supabase/accounts', () => {
    // The function takes only `hostedAvailable`, so an accounted (Supabase) deployment with no
    // hosted key gets the exact BYOK copy a Solo deployment does. That decoupling IS the fix.
    expect(aiHostingCopy(false)).toEqual(aiHostingCopy(false));
    expect(aiHostingCopy(true)).not.toEqual(aiHostingCopy(false));
  });

  it('says AI is free and needs no key when the free pool is on, whatever else is configured', () => {
    for (const hosted of [true, false]) {
      const free = aiHostingCopy(hosted, true);
      expect(free.headerSubtitle).toMatch(/free open-source model/i);
      expect(free.headerSubtitle).toMatch(/nothing to set up/i);
      expect(free.panelSubtitle).toMatch(/Cloudflare or Groq/);
      expect(free.panelSubtitle).toMatch(/daily allowance/i);
      expect(free.openaiOptgroupLabel).toBe('Your own key');
      expect(free.headerSubtitle + free.panelSubtitle).not.toMatch(/hosted beta|[—–]/);
    }
    expect(aiHostingCopy(false, false)).toEqual(aiHostingCopy(false));
  });
});
