import { isValidElement, Suspense, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

/**
 * The Updates page with everything around it stubbed, and a world board that never answers - the
 * way a stalled Yahoo behaves. The market read must still be on the page.
 */
const fixtures = vi.hoisted(() => ({
  read: { kind: 'market_read', session: '2026-11-17', factsHash: 'abc', publishedAt: '2026-11-17T22:00:00.000Z', figures: [], prose: null, proseNote: null, writer: null },
}));

vi.mock('@/components/AppShell', () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/lib/data', () => ({ getDashboardData: async () => ({}) }));
vi.mock('@/lib/updates/store', () => ({ updatesAvailable: () => true, loadLatestRead: async () => fixtures.read }));
vi.mock('@/lib/world/fetch', () => ({ getWorldSnapshot: () => new Promise(() => undefined) }));

import UpdatesPage from '@/app/updates/page';
import { MarketReadView } from '@/components/updates/MarketReadView';
import { WorldBoardLoader } from '@/components/updates/WorldBoardView';

/** Every element in a rendered tree that `match` accepts. */
function findAll(node: ReactNode, match: (element: ReactElement) => boolean, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) findAll(child as ReactNode, match, out);
    return out;
  }
  if (!isValidElement(node)) return out;
  if (match(node)) out.push(node);
  findAll((node.props as { children?: ReactNode }).children, match, out);
  return out;
}

describe('the Updates page', () => {
  it('renders the market read without waiting for the world board', async () => {
    const outcome = await Promise.race([UpdatesPage(), new Promise<'waited'>((resolve) => setTimeout(() => resolve('waited'), 2_000))]);
    expect(outcome).not.toBe('waited');
    const page = outcome as ReactElement;
    const [readView] = findAll(page, (element) => element.type === MarketReadView);
    expect((readView!.props as { read: unknown }).read).toBe(fixtures.read);
    // The board is there, streamed behind its own boundary, to fill in when it is read.
    const [boundary] = findAll(page, (element) => element.type === Suspense);
    expect(boundary).toBeDefined();
    expect(findAll((boundary!.props as { children?: ReactNode }).children, (element) => element.type === WorldBoardLoader)).toHaveLength(1);
  });
});
