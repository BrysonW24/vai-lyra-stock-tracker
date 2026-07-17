/**
 * Contract of /api/scout/feed - the "what the scout saw" surface. In tests there is no
 * Supabase env, so the route must serve the DEMO feed: the panel always has shape, and
 * its shape here is pinned so the frontend can rely on it.
 */
import { describe, expect, it } from 'vitest';
import { GET } from '../route';

describe('GET /api/scout/feed', () => {
  it('serves a complete demo feed with no Supabase configured', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      ok: boolean;
      demo?: boolean;
      run?: { itemsFetched: number; themeCounts: Record<string, number>; drumbeats: unknown[] } | null;
      items?: { title: string; sourceName: string }[];
    };
    expect(data.ok).toBe(true);
    expect(data.demo).toBe(true);
    expect(data.run).toBeTruthy();
    expect(data.run!.itemsFetched).toBeGreaterThan(0);
    expect(Object.keys(data.run!.themeCounts).length).toBeGreaterThan(0);
    expect(data.run!.drumbeats.length).toBeGreaterThan(0);
    expect(data.items!.length).toBeGreaterThan(0);
    // Every demo item must carry a human source name - the self-verifying contract.
    for (const item of data.items!) expect(item.sourceName.length).toBeGreaterThan(0);
  });

  it('demo drumbeats state exactly what promotion still needs', async () => {
    const response = await GET();
    const data = (await response.json()) as {
      run: { drumbeats: { items: number; sources: number; needItems: number; needSources: number }[] };
    };
    for (const d of data.run.drumbeats) {
      expect(d.needItems).toBe(Math.max(0, 3 - d.items));
      expect(d.needSources).toBe(Math.max(0, 2 - d.sources));
    }
  });
});
