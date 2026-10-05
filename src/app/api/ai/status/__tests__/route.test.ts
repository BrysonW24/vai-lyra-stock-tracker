import { afterEach, describe, expect, it, vi } from 'vitest';

interface MockUser {
  id: string;
  email?: string;
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
    vi.unstubAllEnvs();
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

  it('does NOT treat profiles.ai_included as a grant - a user can write their own profile row', async () => {
    // Until migration 058 any signed-in account could set this flag on itself and keep the hosted
    // key forever. The flag is no longer read: only the server's own allowlist grants.
    hoisted.client = signedInClient({ id: 'u-self', email: 'self@example.com' }, true);
    const body = (await (await GET()).json()) as { aiIncluded: boolean; granted: boolean; hostedAvailable: boolean };
    expect(body).toMatchObject({ aiIncluded: false, granted: false, hostedAvailable: false });
  });

  it('gives a GRANTED signed-in user the hosted mode (per-user)', async () => {
    vi.stubEnv('AI_INCLUDED_EMAILS', 'owner@example.com');
    hoisted.client = signedInClient({ id: 'u1', email: 'owner@example.com' }, null);
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
