import { afterEach, describe, expect, it, vi } from 'vitest';

interface MockUser {
  id: string;
  created_at?: string;
}

const hoisted = vi.hoisted(() => ({
  client: null as null | {
    auth: { getUser: () => Promise<{ data: { user: MockUser | null } }> };
    from?: (table: string) => unknown;
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => hoisted.client,
}));

vi.mock('@/lib/ai/credentials', () => ({
  getAiRuntimeStatus: () => ({
    hostedOpenAi: true,
    hostedOpenAiModel: 'server-model',
    sharedGoogle: false,
  }),
}));

vi.mock('@/lib/ai/gateway', () => ({
  providerBreakerStatus: () => ({ openai: { open: false, consecutiveFailures: 0 } }),
}));

import { GET } from '../route';

/** Build a mock Supabase client for a signed-in user with a given profiles.ai_included grant. */
function signedInClient(user: MockUser, granted: boolean | null) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: granted == null ? null : { ai_included: granted } }),
        }),
      }),
    }),
  };
}

const RUNTIME = {
  hostedOpenAi: true,
  hostedOpenAiModel: 'server-model',
  sharedGoogle: false,
  breakers: { openai: { open: false, consecutiveFailures: 0 } },
};

describe('GET /api/ai/status', () => {
  afterEach(() => {
    hoisted.client = null;
  });

  it('treats a Solo runtime with no auth stack as anonymous, exposing only whether a hosted mode exists', async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ hostedAvailable: true, authenticated: false });
  });

  it('treats a signed-out Community caller as anonymous', async () => {
    hoisted.client = { auth: { getUser: async () => ({ data: { user: null } }) } };
    const response = await GET();
    expect(await response.json()).toEqual({ hostedAvailable: true, authenticated: false });
  });

  it('gives a GRANTED signed-in user the hosted mode (per-user)', async () => {
    hoisted.client = signedInClient({ id: 'u1' }, true);
    const response = await GET();
    expect(await response.json()).toEqual({
      ...RUNTIME,
      hostedAvailable: true,
      hostedKeyOnDeployment: true,
      aiIncluded: true,
      granted: true,
      trialDaysLeft: 0,
      authenticated: true,
    });
  });

  it('marks a signed-in user PAST their trial (not granted) as BYOK, even on a paid deployment', async () => {
    // No created_at + not granted => not in trial => not included => hostedAvailable false.
    hoisted.client = signedInClient({ id: 'u2' }, false);
    const response = await GET();
    expect(await response.json()).toEqual({
      ...RUNTIME,
      hostedAvailable: false,
      hostedKeyOnDeployment: true,
      aiIncluded: false,
      granted: false,
      trialDaysLeft: 0,
      authenticated: true,
    });
  });
});
