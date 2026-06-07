import Link from 'next/link';
import { GraduationCap, ArrowRight } from 'lucide-react';

/**
 * Beginner education track - a plain-English, jargon-free starting journey for
 * someone who has never traded. Separate from the setup onboarding: this teaches
 * the ideas first. General education, not financial advice.
 */

const LESSONS: { n: number; title: string; body: string }[] = [
  {
    n: 1,
    title: 'What a share actually is',
    body: 'Buying a share means owning a tiny slice of a real company. If the business does well over time, your slice can become worth more.',
  },
  {
    n: 2,
    title: 'Price vs momentum',
    body: 'Price is what a stock costs right now. Momentum is whether it is speeding up or slowing down. Lyra focuses on momentum - spotting changes early.',
  },
  {
    n: 3,
    title: 'RSI, in plain words',
    body: 'A 0-100 gauge of how hard a stock has been bought or sold lately. Low and turning up can mean it is recovering; very high can mean it has run hot.',
  },
  {
    n: 4,
    title: 'MACD, in plain words',
    body: 'It compares recent momentum to the slightly longer trend. When the gap shrinks toward zero, selling pressure is easing - an early sign of a turn.',
  },
  {
    n: 5,
    title: 'Risk comes first',
    body: 'Never risk money you cannot afford to lose. Decide your exit before you enter. Small, planned positions beat big, emotional ones.',
  },
  {
    n: 6,
    title: 'How Lyra helps',
    body: 'It scans the market for these patterns and flags names worth reviewing - it never tells you to buy or sell. The decision is always yours.',
  },
];

export function BeginnerWelcome() {
  return (
    <section className="terminal-panel glass-hero rounded-lg p-5 md:p-6">
      <div className="flex items-center gap-2">
        <GraduationCap className="text-[#8aa2ff]" size={20} />
        <h1 className="text-xl font-semibold text-[#eef3f8] md:text-2xl">Never traded before? Start here.</h1>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a8b5c2]">
        A short, plain-English walkthrough of the few ideas that make the rest of the app make sense. No jargon, no
        pressure - take your time and revisit anytime.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {LESSONS.map((lesson) => (
          <div key={lesson.n} className="rounded-md border border-[#1b2530] bg-[#0d1117] p-4">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#3b5bdb] bg-[#0d1530] font-mono text-[11px] font-semibold text-[#8aa2ff]">
                {lesson.n}
              </span>
              <p className="text-sm font-semibold text-[#eef3f8]">{lesson.title}</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#a8b5c2]">{lesson.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] leading-4 text-[#8190a0]">
          General education, not financial advice. When you feel ready, set up your console - or just keep exploring
          the full lesson library below.
        </p>
        <Link
          href="/onboarding"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-[#f3a33a] bg-[#23180b] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#f3a33a] transition hover:bg-[#2a1f0f]"
        >
          I&apos;m ready - set up my console <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
