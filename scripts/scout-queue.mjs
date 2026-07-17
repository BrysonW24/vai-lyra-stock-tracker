#!/usr/bin/env node
/**
 * scout-queue.mjs - list scout cards a human has ACCEPTED for drafting (v2 of the loop).
 *
 * The pragmatic draft-a-vertical shape: acceptance (a maintainer setting a scout card to
 * "planned") QUEUES the card; the next agent session drains the queue by running the
 * /draft-vertical chain, which drafts the vertical as a PR. This script is the seam
 * between the two: it reads the queue from the live board (the ideas API is public, so
 * no secrets are needed) and prints each card with its evidence, ready to seed the chain.
 *
 * Usage: npm run scout:queue          (reads APP_BASE_URL, else the production URL)
 */

const BASE = (process.env.APP_BASE_URL || 'https://vai-lyra-stock-tracker.vercel.app').replace(/\/$/, '');

const QUEUE_STATUSES = new Set(['planned', 'in_progress']);

async function main() {
  const res = await fetch(`${BASE}/api/community/ideas`, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    console.error(`scout-queue: ${BASE} answered ${res.status}`);
    process.exit(2);
  }
  const data = await res.json();
  const ideas = Array.isArray(data.ideas) ? data.ideas : [];
  const queue = ideas.filter(
    (i) => i.origin === 'scout' && i.kind === 'vertical' && QUEUE_STATUSES.has(i.status),
  );

  if (data.demo) console.log('(demo board - no Supabase configured on the target)');
  if (queue.length === 0) {
    console.log(`scout-queue: empty - no accepted scout verticals waiting (checked ${BASE}).`);
    console.log('A card enters the queue when a maintainer sets it to "planned" on /whats-new -> Ideas.');
    return;
  }

  console.log(`scout-queue: ${queue.length} card(s) waiting. Drain with the /draft-vertical chain.\n`);
  for (const card of queue) {
    console.log(`- [${card.status}] ${card.title}  (id: ${card.id}, confidence: ${card.confidence ?? 'n/a'})`);
    for (const ev of card.evidence ?? []) {
      const src = ev.sourceName || ev.sourceId || 'unknown source';
      console.log(`    · ${ev.title} - ${src}${ev.url ? ` - ${ev.url}` : ''}`);
    }
  }
}

main().catch((err) => {
  console.error(`scout-queue: ${err.message}`);
  process.exit(2);
});
