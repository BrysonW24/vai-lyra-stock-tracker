'use client';

import { useEffect, useState } from 'react';
import { BookOpen, HelpCircle, Lightbulb, Rocket, Sparkles, TrendingUp } from 'lucide-react';
import { TradingViewChart } from '@/components/TradingViewChart';
import { TickerLogo } from '@/components/TickerLogo';

/**
 * Auto-rotating feature showcase for the landing hero. Shows the REAL product -
 * live candles, the real setup-scoring card, the plain-English brief - not a faked
 * "AI mockup". Premium glassmorphism in Lyra's own dark + amber palette.
 */

const ROTATE_MS = 10000;

const BREAKDOWN = [
  { label: 'RSI', value: 25, max: 25 },
  { label: 'MACD', value: 30, max: 30 },
  { label: 'Price', value: 15, max: 15 },
  { label: 'Trend', value: 7, max: 15 },
  { label: 'Volume', value: 5, max: 15 },
];

// A rotating one-liner under the brief - a mix of fun facts, handy tips, and
// investing questions that make you think. Changes each day to keep it feeling alive.
type NuggetKind = 'fact' | 'tip' | 'think' | 'book' | 'market';

const NUGGET_META: Record<NuggetKind, { label: string; icon: typeof Lightbulb; color: string }> = {
  fact: { label: 'Fun fact', icon: Lightbulb, color: '#60a5fa' },
  tip: { label: 'Handy tip', icon: Sparkles, color: '#43d18b' },
  think: { label: 'Worth pondering', icon: HelpCircle, color: '#f3a33a' },
  book: { label: 'Worth a read', icon: BookOpen, color: '#a78bfa' },
  market: { label: 'The bigger picture', icon: TrendingUp, color: '#4fd1d9' },
};

const NUGGETS: { kind: NuggetKind; text: string }[] = [
  { kind: 'fact', text: 'Around 1 in 3 Australian adults own shares directly.' },
  { kind: 'book', text: "'The Psychology of Money' by Morgan Housel - how behaviour, not brains, builds wealth." },
  { kind: 'tip', text: "Rest a wooden spoon across a pot and it won't boil over." },
  { kind: 'think', text: 'If this position halved tomorrow, would you buy more or sell? Decide before it happens.' },
  { kind: 'book', text: "'The Intelligent Investor' by Benjamin Graham - the value-investing classic." },
  { kind: 'fact', text: "More than half of Australians hold investments - many just call it 'super'." },
  { kind: 'tip', text: 'Write your exit before your entry. A plan beats a feeling.' },
  { kind: 'book', text: "'Rich Dad Poor Dad' by Robert Kiyosaki - assets vs liabilities, made simple." },
  { kind: 'think', text: "What's your edge here - information, discipline, or just hope?" },
  { kind: 'fact', text: 'Australia is wider than the moon.' },
  { kind: 'book', text: "'Unshakeable' by Tony Robbins - staying calm and invested through any market." },
  { kind: 'tip', text: 'A pinch of salt in coffee cuts the bitterness.' },
  { kind: 'fact', text: 'Most of Australia’s newest investors are under 35.' },
  { kind: 'think', text: 'Would you still hold this if you were opening the position from scratch today?' },
  { kind: 'book', text: "'The Richest Man in Babylon' by George S. Clason - timeless rules for building wealth." },
  { kind: 'fact', text: 'Sharks are older than trees - by about 50 million years.' },
  { kind: 'tip', text: 'Size every position so a 50% drop never changes how you sleep.' },
  { kind: 'book', text: "'Think and Grow Rich' by Napoleon Hill - mindset as the foundation of wealth." },
  { kind: 'think', text: 'Are you trading the chart, or the company?' },
  { kind: 'fact', text: 'A day on Venus is longer than a year on Venus.' },
  { kind: 'book', text: "'The Cashflow Quadrant' by Robert Kiyosaki - employee, self-employed, business, investor." },
  { kind: 'tip', text: 'Freeze leftover herbs in olive oil for instant flavour cubes.' },
  { kind: 'fact', text: 'Honey never spoils - 3,000-year-old jars have been found edible.' },
  { kind: 'book', text: "'Money: Master the Game' by Tony Robbins - the long game, from those who play it well." },
  { kind: 'think', text: 'Is this a conviction buy, or FOMO with a chart attached?' },
  { kind: 'fact', text: 'Cleopatra lived closer to the Moon landing than to the building of the pyramids.' },
  { kind: 'market', text: "A 'correction' is a 10%+ drop; a 'bear market' is a 20%+ drop." },
  { kind: 'market', text: 'On average, the market has a correction about once a year - and has recovered from every one.' },
  { kind: 'market', text: 'Bear markets have historically arrived every few years; the bull runs that follow last far longer.' },
  { kind: 'market', text: 'A recession is two straight quarters of shrinking GDP; a bear market is just falling prices.' },
  { kind: 'market', text: 'Long term, the S&P 500 has returned roughly 10% a year - about 7% after inflation.' },
  { kind: 'market', text: 'The ASX 200 has averaged roughly 9% a year over the long run, dividends included.' },
  { kind: 'market', text: "Miss the market's 10 best days over decades and you can halve your return - time in beats timing it." },
  { kind: 'market', text: 'There are around 60 major stock exchanges around the world.' },
  { kind: 'market', text: 'Trillions of dollars change hands across global markets every single day.' },
  { kind: 'market', text: "A 'bull market' is a sustained rise; a sharp jump up is a 'spike' - the upside of a correction." },
  { kind: 'market', text: 'No one reliably times the top or bottom - the market spends most of its life rising.' },
];

function dailyNugget(): { kind: NuggetKind; text: string } {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);
  return NUGGETS[dayOfYear % NUGGETS.length];
}

function SetupSlide() {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TickerLogo symbol="NVDA" companyName="Nvidia" size={28} />
          <div>
            <p className="font-mono text-sm font-semibold text-[#eef3f8]">NVDA</p>
            <p className="text-[10px] uppercase tracking-wide text-[#8190a0]">Technology · Semiconductors</p>
          </div>
        </div>
        <span className="rounded border border-[#1f5132] bg-[#0f2417] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#5fd08a]">Buy · review</span>
      </div>

      <div className="grid grid-cols-3 gap-2 font-mono">
        {[
          { v: '82', l: 'Setup', c: 'text-[#f3a33a]' },
          { v: '46', l: 'RSI', c: 'text-[#60a5fa]' },
          { v: '+9', l: 'Delta', c: 'text-[#43d18b]' },
        ].map((t) => (
          <div key={t.l} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-center backdrop-blur">
            <p className={`text-xl font-bold ${t.c}`}>{t.v}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[#8190a0]">{t.l}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {BREAKDOWN.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="w-12 shrink-0 font-mono text-[10px] text-[#8190a0]">{b.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#161e27]">
              <span className="block h-full rounded-full bg-[#f3a33a]" style={{ width: `${(b.value / b.max) * 100}%` }} />
            </span>
            <span className="w-9 shrink-0 text-right font-mono text-[10px] text-[#a8b5c2]">{b.value}/{b.max}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5fd08a]">Why this setup</p>
        <p className="flex gap-1.5 text-[11px] leading-snug text-[#cdd8e3]"><span className="text-[#5fd08a]">▸</span> RSI is below 50 and rising</p>
        <p className="flex gap-1.5 text-[11px] leading-snug text-[#cdd8e3]"><span className="text-[#5fd08a]">▸</span> MACD histogram is negative but improving</p>
      </div>
    </div>
  );
}

function BriefSlide() {
  const [nugget, setNugget] = useState(NUGGETS[0]);
  useEffect(() => setNugget(dailyNugget()), []);
  const meta = NUGGET_META[nugget.kind];
  const NuggetIcon = meta.icon;

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">Daily brief · plain English</p>
      <p className="text-[15px] leading-relaxed text-[#dbe5ee]">
        Morning. <span className="font-semibold text-[#eef3f8]">2 strong setups</span> on the radar - NVDA leads at
        <span className="font-semibold text-[#f3a33a]"> 82</span>. Your book is
        <span className="font-semibold text-[#43d18b]"> +6.5%</span>, with NVDA cooling since this morning. One watchlist
        name is <span className="text-[#f3a33a]">near a trigger</span>.
      </p>

      <div className="space-y-1">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#f3a33a]">
          <Rocket size={12} /> Looking ahead
        </p>
        <p className="text-[13px] leading-relaxed text-[#a8b5c2]">
          The SpaceX IPO goes ahead June 12. One to keep an eye on.
        </p>
      </div>

      <div className="mt-auto space-y-1">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: meta.color }}>
          <NuggetIcon size={12} /> {meta.label}
        </p>
        <p className="text-[13px] leading-relaxed text-[#a8b5c2]">{nugget.text}</p>
      </div>
    </div>
  );
}

const SLIDES = [
  { key: 'candles', label: 'Live candles · RSI · MACD', node: <TradingViewChart symbol="NVDA" exchange="NASDAQ" compact height={296} /> },
  { key: 'setup', label: 'Every setup, scored & explained', node: <SetupSlide /> },
  { key: 'brief', label: 'A plain-English daily brief', node: <BriefSlide /> },
];

export function LandingShowcase() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <div
      className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_28px_80px_-28px_rgba(0,0,0,0.8)] backdrop-blur-xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* premium glass highlights */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#f3a33a]/10 blur-3xl" />

      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#a8b5c2]">{SLIDES[index].label}</p>
        <div className="flex gap-1.5">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show ${slide.label}`}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-[#f3a33a]' : 'w-1.5 bg-white/20'}`}
            />
          ))}
        </div>
      </div>

      <div className="relative h-[332px] overflow-hidden">
        <div className="flex h-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
          {SLIDES.map((slide) => (
            <div key={slide.key} className="h-full w-full shrink-0">{slide.node}</div>
          ))}
        </div>
      </div>

      {/* Source attribution - builds credibility: real market data, named source */}
      <div className="border-t border-white/10 px-4 py-2">
        <p className="text-[10px] italic leading-snug text-[#6f7d8a]">
          Live market data from Yahoo Finance · chart by TradingView.
        </p>
      </div>
    </div>
  );
}
