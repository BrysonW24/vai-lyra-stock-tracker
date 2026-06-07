'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import { BeginnerWelcome } from './BeginnerWelcome';

interface Lesson {
  title: string;
  lead: string;
  points: string[];
  takeaway: string;
  tag?: string;
}

// Slide 1 is the BeginnerWelcome overview; these are slides 2-10.
const LESSONS: Lesson[] = [
  {
    title: 'What a company is - and why it sells shares',
    lead: 'A public company sells small ownership pieces (shares) to raise money to grow. When you buy a share, you become a part-owner.',
    points: [
      'Companies list on an exchange (like NASDAQ or NYSE) to access investors.',
      'There are a fixed number of shares; you can own as few as one.',
      'Owning shares can mean a claim on future profits and growth.',
    ],
    takeaway: 'Buying a share = owning a tiny slice of a real business.',
  },
  {
    title: 'How to actually buy a share',
    lead: 'You buy and sell through a brokerage account - an app or platform that connects you to the market.',
    points: [
      'Open and fund a brokerage account (this is the part Lyra does not do for you).',
      'Search the company ticker (e.g. NVDA), choose how many shares, place an order.',
      'A "market" order buys now; a "limit" order only buys at a price you set.',
    ],
    takeaway: 'Lyra helps you decide what to look at - your broker is where you act.',
  },
  {
    title: 'How you make (or lose) money',
    lead: 'Two ways: the share price moves, and some companies pay you a slice of profits (dividends).',
    points: [
      'If you sell higher than you bought, the difference is your gain (or loss if lower).',
      'Dividends are small regular payments some companies make to shareholders.',
      'Nothing is guaranteed - prices fall as well as rise.',
    ],
    takeaway: 'Profit comes from selling higher and/or dividends - never assume one direction.',
  },
  {
    title: 'What to look for - and be aware of',
    lead: 'Before anything technical, sanity-check the business and your own risk.',
    points: [
      'Is it a real, growing business? Revenue, profit and customers matter.',
      'Is it already expensive? A great company can still be a poor entry.',
      'Only ever risk money you can afford to leave invested.',
    ],
    takeaway: 'Good business + sensible price + money you can spare = a calmer start.',
  },
  {
    title: 'Reading the chart: technical analysis',
    lead: 'Price tells you what happened; momentum tools tell you how the move is behaving. This is where Lyra focuses.',
    points: [
      'RSI (0-100): low and turning up can mean recovery; very high can mean overheated.',
      'MACD: when its histogram shrinks toward zero, selling pressure is easing.',
      'Moving averages show the longer trend underneath the noise.',
    ],
    takeaway: 'Momentum often shifts before price fully reacts - that is the edge Lyra looks for.',
  },
  {
    title: 'Strategies: different setups for different goals',
    lead: 'A strategy is just a repeatable pattern you choose to watch for, so you act consistently instead of emotionally.',
    points: [
      'Momentum Recovery: beaten-down names starting to turn back up.',
      'Trend Continuation: names already climbing that may keep going.',
      'Pick one that suits you and stick with it - consistency beats chasing.',
    ],
    takeaway: 'A strategy turns "what should I do?" into "does this match my rules?"',
  },
  {
    title: 'Stop loss: decide your exit before you enter',
    lead: 'A stop loss is a pre-set price where you accept the trade did not work and step out - capping the damage.',
    points: [
      'Set it when you enter, not in the heat of the moment.',
      'A small planned loss keeps any single trade from hurting you badly.',
      'It removes the "maybe it will come back" trap.',
    ],
    takeaway: 'Knowing your exit in advance is how disciplined traders protect their capital.',
  },
  {
    title: 'Taking profit: have a plan for the upside too',
    lead: 'Just as important as cutting losses - decide in advance where you would take some gains.',
    points: [
      'Trimming into strength locks in real profit instead of hoping for more.',
      'You can sell part of a position and let the rest run.',
      'A plan beats reacting to every wiggle on the screen.',
    ],
    takeaway: 'Plan your take-profit before emotion (greed or fear) makes the call for you.',
  },
  {
    title: 'Advanced - handle with care',
    lead: 'These tools add leverage: bigger gains, but also bigger and faster losses. They are not for beginners.',
    points: [
      'Calls / puts (options): contracts to buy or sell later - powerful but can expire worthless.',
      'Margin loans: borrowing to invest more - amplifies losses as much as gains.',
      'Learn each thoroughly (and paper-trade) long before risking real money.',
    ],
    takeaway: 'Master the basics first. Leverage punishes mistakes - respect it.',
    tag: 'For later',
  },
];

const TOTAL = LESSONS.length + 1;

function LessonSlide({ lesson, index }: { lesson: Lesson; index: number }) {
  return (
    <div className="terminal-panel glass-hero rounded-lg p-5 md:p-6">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#3b5bdb] bg-[#0d1530] font-mono text-xs font-semibold text-[#8aa2ff]">
          {index + 1}
        </span>
        <h2 className="text-lg font-semibold text-[#eef3f8] md:text-xl">{lesson.title}</h2>
        {lesson.tag && (
          <span className="ml-auto rounded-full border border-[#7f1d1d] bg-[#2b1214] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#ff6b6b]">
            {lesson.tag}
          </span>
        )}
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a8b5c2]">{lesson.lead}</p>
      <ul className="mt-3 space-y-2">
        {lesson.points.map((p) => (
          <li key={p} className="flex gap-2 text-sm leading-6 text-[#dbe5ee]">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#60a5fa]" />
            {p}
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-md border border-[#1d4f3a] bg-[#0d251b] px-3 py-2 text-xs leading-5 text-[#43d18b]">
        Takeaway: {lesson.takeaway}
      </p>
    </div>
  );
}

export function EducationCarousel() {
  const [i, setI] = useState(0);
  const atStart = i === 0;
  const atEnd = i === TOTAL - 1;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="text-[#8aa2ff]" size={18} />
          <h1 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Learn the basics</h1>
        </div>
        <span className="font-mono text-xs text-[#8190a0]">{i + 1} / {TOTAL}</span>
      </div>

      {/* Viewport - one slide at a time with a soft entrance animation */}
      <div className="overflow-hidden">
        <div key={i} className="animate-[tableRowSlide_420ms_ease-out]">
          {i === 0 ? <BeginnerWelcome /> : <LessonSlide lesson={LESSONS[i - 1]} index={i} />}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setI((v) => Math.max(0, v - 1))}
          disabled={atStart}
          className={`inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
            atStart ? 'cursor-not-allowed border-[#1b2530] text-[#3a4754]' : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:text-[#eef3f8]'
          }`}
        >
          <ChevronLeft size={14} /> Back
        </button>

        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {Array.from({ length: TOTAL }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-6 bg-[#f3a33a]' : 'w-1.5 bg-[#263241] hover:bg-[#3a4754]'}`}
            />
          ))}
        </div>

        {atEnd ? (
          <span className="inline-flex items-center rounded-md border border-[#1d7f55] bg-[#0d251b] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#43d18b]">
            Glossary below ↓
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setI((v) => Math.min(TOTAL - 1, v + 1))}
            className="inline-flex items-center gap-1 rounded-md border border-[#f3a33a] bg-[#23180b] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#f3a33a] transition hover:bg-[#2a1f0f]"
          >
            Next <ChevronRight size={14} />
          </button>
        )}
      </div>
    </section>
  );
}
