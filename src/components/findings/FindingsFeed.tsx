'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DEMO_FINDINGS } from '@/lib/findings/demo-findings';
import { FEED_SECTION_LABELS, type DrawerStackItem, type FeedSection, type Finding } from '@/lib/findings/types';
import { encodeStack, parseStack } from '@/lib/findings/stack';
import { FindingCard } from './FindingCard';
import { InvestigationDrawerStack } from './InvestigationDrawerStack';

/**
 * The /findings feed - Lyra's Opportunity Findings. Ranked findings grouped into sections, each a
 * tappable card that opens the nested investigation drawer (finding -> evidence -> source record ->
 * entity -> connected pattern). The whole drawer stack is persisted in the URL (?inv=) so an
 * investigation is shareable and survives reload. Phase 1 runs on demo findings to prove the model.
 * Distinct from /intelligence (the market-news feed) - this is the causal-chain investigation surface.
 */

const SECTION_ORDER: FeedSection[] = [
  'paper_bot_queue',
  'government_backed',
  'theme_acceleration',
  'accumulation',
  'supply_chain_bottleneck',
  'portfolio_impact',
  'watchlist_movement',
  'top_signal',
];

function sectionFor(f: Finding): FeedSection {
  if (f.state === 'Paper-bot research queue') return 'paper_bot_queue';
  if (f.type === 'government_contract' || f.evidence.some((e) => e.sourceType === 'government_contract')) return 'government_backed';
  if (f.type === 'theme_breakout') return 'theme_acceleration';
  if (f.type === 'investor_move') return 'accumulation';
  if (f.type === 'portfolio_risk') return 'portfolio_impact';
  return 'top_signal';
}

function deriveTitle(finding: Finding | null, item: DrawerStackItem): string {
  if (!finding) return item.id;
  if (item.type === 'genui') return 'Generated view';
  if (item.type === 'finding') return finding.symbol || finding.title;
  if (item.type === 'evidence' || item.type === 'source_record') {
    return finding.evidence.find((e) => e.id === item.id)?.sourceName ?? item.id;
  }
  const ent = finding.entities.find((e) => e.id === item.id);
  if (ent) return ent.name;
  return finding.risks.find((r) => r.id === item.id)?.label ?? item.id;
}

export function FindingsFeed({ findings }: { findings?: Finding[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Live findings projected from notification_events when present; demo fixtures otherwise.
  const isLive = Boolean(findings && findings.length);
  const all = useMemo(() => (isLive ? (findings as Finding[]) : DEMO_FINDINGS), [isLive, findings]);

  const stack = useMemo(() => parseStack(params.get('inv')), [params]);
  const activeFindingId = stack.find((s) => s.type === 'finding')?.id;
  const activeFinding = useMemo(
    () => (activeFindingId ? all.find((f) => f.id === activeFindingId) ?? null : null),
    [activeFindingId, all],
  );

  const setStack = useCallback(
    (next: DrawerStackItem[]) => {
      const qs = next.length ? `?inv=${encodeURIComponent(encodeStack(next))}` : '';
      router.push(`${pathname}${qs}`, { scroll: false });
    },
    [router, pathname],
  );

  const openFinding = useCallback((id: string) => setStack([{ type: 'finding', id }]), [setStack]);
  const push = useCallback((item: DrawerStackItem) => setStack([...stack, item]), [setStack, stack]);
  const back = useCallback(() => setStack(stack.slice(0, -1)), [setStack, stack]);
  const close = useCallback(() => setStack([]), [setStack]);

  const groups = useMemo(
    () =>
      SECTION_ORDER.map((sec) => ({ sec, findings: all.filter((f) => sectionFor(f) === sec) })).filter(
        (g) => g.findings.length > 0,
      ),
    [all],
  );

  const titledStack = useMemo(() => stack.map((item) => ({ ...item, title: deriveTitle(activeFinding, item) })), [stack, activeFinding]);

  return (
    <div className="space-y-4 pb-28 xl:pb-6">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">
        {isLive ? (
          <span className="text-[#43d18b]">Live findings - projected from your alerts</span>
        ) : (
          <span>Demo findings - live findings appear here as the scanner surfaces setups for you</span>
        )}
      </p>
      {groups.map(({ sec, findings }) => (
        <section key={sec}>
          <h2 className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">{FEED_SECTION_LABELS[sec]}</h2>
          <div className="grid gap-1.5 md:grid-cols-2">
            {findings.map((f) => (
              <FindingCard key={f.id} finding={f} onOpen={openFinding} />
            ))}
          </div>
        </section>
      ))}

      <InvestigationDrawerStack
        finding={activeFinding}
        stack={titledStack}
        onPush={push}
        onBack={back}
        onClose={close}
        enableLifecycle={isLive}
        onLifecycleChange={() => {
          close();
          router.refresh();
        }}
      />
    </div>
  );
}
