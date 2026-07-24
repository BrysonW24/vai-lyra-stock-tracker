import { afterEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  client: null as null | {
    auth: {
      getUser: () => Promise<{ data: { user: { id: string } | null } }>;
    };
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

describe('GET /api/ai/status', () => {
  afterEach(() => {
    hoisted.client = null;
  });

  it('treats a Solo runtime with no auth stack as anonymous and hides runtime detail', async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ hostedAvailable: true, authenticated: false });
  });

  it('treats a signed-out Community caller as anonymous and hides runtime detail', async () => {
    hoisted.client = {
      auth: { getUser: async () => ({ data: { user: null } }) },
    };
    const response = await GET();
    expect(await response.json()).toEqual({ hostedAvailable: true, authenticated: false });
  });

  it('returns the detailed runtime only to a signed-in Community caller', async () => {
    hoisted.client = {
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    };
    const response = await GET();
    expect(await response.json()).toEqual({
      hostedOpenAi: true,
      hostedOpenAiModel: 'server-model',
      sharedGoogle: false,
      hostedAvailable: true,
      authenticated: true,
      breakers: { openai: { open: false, consecutiveFailures: 0 } },
    });
  });
});
