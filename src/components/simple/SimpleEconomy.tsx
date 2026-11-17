import Link from 'next/link';
import type { EconomyRead } from '@/lib/economy/types';
import { getEconomyRead } from '@/lib/economy/live';
import { SimpleSection, SimpleEmpty, SimpleChip } from '@/components/simple/SimpleSection';
import { VerdictChip } from '@/components/economy/VerdictChip';
import { QUESTION_SHORT } from '@/components/economy/economy-format';

const TITLE = "Australia's economy";
const HINT = 'What the latest national figures mean together - not just the numbers.';

/**
 * Simple view's economy block: the one-sentence read and four verdicts, then one link to the
 * evidence. No figures beyond the ones the sentence quotes - the detail lives on /economy.
 */
export function SimpleEconomy({ read }: { read: EconomyRead }) {
  if (read.empty) {
    return (
      <SimpleSection title={TITLE} hint={HINT} href="/economy" linkLabel="Open">
        <SimpleEmpty>
          Lyra could not reach the ABS or the RBA just now. It will not show old or made-up figures in their place.
        </SimpleEmpty>
      </SimpleSection>
    );
  }
  return (
    <SimpleSection
      title={TITLE}
      hint={HINT}
      href="/economy"
      linkLabel="See what is behind it"
      chip={<SimpleChip tone="live">Live</SimpleChip>}
    >
      <p className="text-[14px] leading-relaxed text-ink-title">{read.headline}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {read.questions.map((q) => (
          <Link key={q.id} href={`/economy#${q.id}`} className="rounded-full transition hover:opacity-80">
            <VerdictChip verdict={q.verdict} prefix={QUESTION_SHORT[q.id] ?? q.id} />
          </Link>
        ))}
      </div>
    </SimpleSection>
  );
}

/** Streams in behind Suspense, so a slow statistics API never holds up the rest of the home page. */
export async function SimpleEconomyLoader() {
  return <SimpleEconomy read={await getEconomyRead()} />;
}

/** The placeholder while the read loads - same frame, no spinner, no shimmer. */
export function SimpleEconomyPending() {
  return (
    <SimpleSection title={TITLE} hint={HINT}>
      <SimpleEmpty>Reading the latest ABS and RBA figures...</SimpleEmpty>
    </SimpleSection>
  );
}
