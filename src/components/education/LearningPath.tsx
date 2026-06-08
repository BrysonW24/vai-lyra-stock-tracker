'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, GraduationCap } from 'lucide-react';
import { loadOnboardingSummary } from '@/lib/onboarding-summary';
import { EducationCarousel } from '@/components/education/EducationCarousel';

type Level = 'beginner' | 'intermediate' | 'advanced';

interface Topic {
  t: string;
  summary: string;
  def: string;
  why: string;
  console: string;
  example: string;
}

const PATH: Record<Level, { blurb: string; topics: Topic[] }> = {
  beginner: {
    blurb: 'The few ideas that make everything else click. No jargon.',
    topics: [
      {
        t: 'What a share actually is',
        summary: 'Owning a tiny slice of a real business.',
        def: 'A share is a unit of ownership in a company - own one and you own a fraction of its assets and future profits.',
        why: 'Over time a share tends to follow how the business does, so you are backing a real company, not just a number on a screen.',
        console: 'Lyra tracks momentum on real listed companies; every ticker is a business you can read up on before you act.',
        example: 'Buying NVDA means owning a sliver of Nvidia - your slice rises and falls with the business and its momentum.',
      },
      {
        t: 'Price vs momentum',
        summary: 'Price is now; momentum is the change.',
        def: 'Price is what a share costs right now. Momentum is the rate and direction of change - speeding up or slowing down.',
        why: 'A cheap-looking price can keep falling and a high one can keep rising. Momentum tells you which way the energy is flowing.',
        console: 'Lyra is a momentum engine - it scores the change, not just the level, so you catch turns early instead of guessing tops and bottoms.',
        example: 'A stock down 20% but turning up is very different from one still falling - the score captures that difference.',
      },
      {
        t: 'RSI in plain words',
        summary: 'A 0-100 gauge of buying vs selling pressure.',
        def: 'Relative Strength Index compares recent gains to recent losses over 14 periods, scaled 0-100.',
        why: 'It shows whether a stock has been bought hard (high, can run hot) or sold hard (low, can be due a bounce) - and which way it is turning.',
        console: 'Lyra reads RSI low-and-rising as part of a recovery setup; the value and an up/down arrow show on every signal row and in the drawer.',
        example: 'RSI 43 with an up arrow = sold off but recovering. RSI 78 = run hot, risky to chase.',
      },
      {
        t: 'MACD in plain words',
        summary: 'Is selling pressure starting to ease?',
        def: 'MACD compares a faster and a slower average of price; the histogram shows the gap between them.',
        why: 'When the histogram shrinks toward zero and turns up, downward pressure is fading - often an early sign of a turn.',
        console: 'Lyra treats a recovering MACD histogram as confirmation that a setup is real, not just a one-bar blip.',
        example: 'A histogram at -1.9 but rising is improving; flat or falling is not yet confirming.',
      },
      {
        t: 'Risk comes first',
        summary: 'Decide your exit before you ever enter.',
        def: 'Risk management means sizing positions and setting an exit so a single trade can never hurt you badly.',
        why: 'You will be wrong often; survival comes from small planned losses and letting winners run - not from being right every time.',
        console: 'Lyra never tells you to buy or sell - it surfaces setups and risks so you make a planned decision. Research, not advice.',
        example: 'Risking a fixed small amount per trade means ten wrong calls in a row still leaves you in the game.',
      },
      {
        t: 'How Lyra helps',
        summary: 'It flags names to review - it never tells you to buy or sell.',
        def: 'Lyra scans the market for momentum patterns (RSI recovering, MACD easing, volume confirming) and scores each setup, surfacing the names worth a closer look.',
        why: 'It does the watching so you do not have to stare at charts all day - but the decision, and the risk, always stay yours.',
        console: 'Every signal row, score and explainer is research, not advice. Lyra never places trades or tells you to buy or sell.',
        example: 'A name appears with a rising score and RSI turning up = "worth reviewing", not "buy now". You decide.',
      },
    ],
  },
  intermediate: {
    blurb: 'Read a chart yourself - structure, levels and confirmation.',
    topics: [
      {
        t: 'Candlesticks',
        summary: 'What each bar says about the buyer/seller fight.',
        def: 'A candle shows the open, high, low and close for a period; the body is open-to-close, the wicks are the extremes.',
        why: 'The shape (long wicks, small body) reveals who won the period - useful for spotting reversals and continuation.',
        console: "Lyra's live charts are candles; reading them adds nuance on top of the deterministic score.",
        example: 'A long lower wick after a sell-off shows buyers stepped in - a potential bottoming tail.',
      },
      {
        t: 'Support & resistance',
        summary: 'The levels where price tends to react.',
        def: 'Support is a price area where buyers have repeatedly stepped in; resistance is where sellers have.',
        why: 'These levels frame risk - they tell you where a move is likely to pause, bounce, or break.',
        console: 'Use them to judge how far a Lyra setup has to run before it hits a wall, and where a sensible exit sits.',
        example: 'A setup approaching prior resistance with strong momentum may break out - or stall. The level tells you which to watch.',
      },
      {
        t: 'Moving averages',
        summary: 'Trend context from the 20 / 50 / 200.',
        def: 'A moving average is the average price over N periods, smoothing noise into a trend line.',
        why: 'Price above a rising 200-day is a long-term uptrend; below a falling one is a downtrend. The 20/50 show shorter swings.',
        console: "Lyra's price-location score factors where price sits vs these averages - a recovery above the 200 beats one below it.",
        example: 'A momentum setup reclaiming the 50-day average is higher quality than one still beneath it.',
      },
      {
        t: 'Volume confirmation',
        summary: 'Does participation actually back the move?',
        def: 'Volume is how many shares traded; the volume ratio compares it to its own average.',
        why: 'A move on heavy volume has conviction; the same move on light volume can be noise that fades.',
        console: "Lyra's volume score rewards above-average participation - one of the five components of the setup score.",
        example: 'A breakout on 1.8x average volume is far more trustworthy than one on 0.6x.',
      },
      {
        t: 'Trend vs range',
        summary: 'Trade the regime you are actually in.',
        def: 'A trend is a sustained directional move; a range is sideways chop between support and resistance.',
        why: 'Momentum setups work best in trends; in a range the same signals whipsaw. Knowing the regime sets expectations.',
        console: "Lyra's trend score and the market-regime strip help you tell which regime you are in before acting.",
        example: 'A strong setup inside a tight range may just bounce to the top of the range, not break out.',
      },
    ],
  },
  advanced: {
    blurb: 'Edge + discipline - the gap between being right and being profitable.',
    topics: [
      {
        t: 'Divergences',
        summary: 'When price and RSI / MACD disagree.',
        def: 'A divergence is when price makes a new high/low but the indicator does not - a sign momentum is fading.',
        why: 'Divergences often precede reversals; they are an early warning the current move is running out of fuel.',
        console: "Lyra's score delta and the RSI/MACD deltas in the drawer help you spot when momentum is no longer confirming price.",
        example: 'Price makes a higher high but RSI a lower high = bearish divergence; the setup may be weakening despite the price.',
      },
      {
        t: 'Multi-timeframe',
        summary: 'Align the daily trend with the hourly entry.',
        def: 'Multi-timeframe analysis checks the same stock across timeframes so your entry agrees with the bigger trend.',
        why: 'A great hourly setup against a daily downtrend is a trap; alignment massively improves the odds.',
        console: 'Switch the Lyra chart between 1H / 1D / 1W to confirm the higher timeframe agrees before acting.',
        example: 'Hourly recovery + daily uptrend = high conviction. Hourly recovery + daily downtrend = caution.',
      },
      {
        t: 'Position sizing & R',
        summary: 'Risk a fixed unit; think in R-multiples.',
        def: '"R" is the amount you risk per trade (entry to stop). Outcomes are measured in multiples of R, not dollars.',
        why: 'Fixed-R sizing makes results consistent and removes emotion - a +3R winner and a -1R loser are comparable.',
        console: 'Lyra surfaces setups and risk states; you set the size and exit so each trade risks the same planned R.',
        example: 'Risk 1R per trade; a string of -1R losses is survivable, and one +4R winner pays for four of them.',
      },
      {
        t: 'Market regimes',
        summary: 'Risk-on vs risk-off changes everything.',
        def: 'A market regime is the broad backdrop - trending risk-on, choppy, or risk-off / defensive.',
        why: 'The same setup behaves differently by regime; in risk-off even strong setups fail more often.',
        console: "Lyra's market + macro regime strips give the backdrop so you scale conviction to the environment.",
        example: 'A strong setup in a risk-on tape is worth more than the identical setup with the VIX spiking.',
      },
      {
        t: 'Backtest a rule',
        summary: 'Prove an edge before you trust real money to it.',
        def: 'Backtesting runs a rule over historical data to estimate its win rate, average return and drawdown.',
        why: 'It separates a real edge from a story - and shows the drawdowns you would have had to sit through.',
        console: "Lyra's Strategy Lab backtests momentum rules and shows win rate, returns, drawdown and sample size (research only).",
        example: 'A 60% win rate with a small average loss can be very profitable - but only if you survive the drawdown.',
      },
    ],
  },
};

const LEVELS: { key: Level; label: string }[] = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced', label: 'Advanced' },
];

function normalise(level?: string): Level {
  if (level === 'advanced' || level === 'professional') return 'advanced';
  if (level === 'intermediate') return 'intermediate';
  return 'beginner';
}

/**
 * Learning path - a beginner / intermediate / advanced split of what to actually master.
 * The level tabs drive everything (topics + the beginner walkthrough); each topic is an
 * accordion that rolls its detail out underneath on tap. Defaults to the level the user
 * picked in onboarding.
 */
export function LearningPath() {
  const [yourLevel, setYourLevel] = useState<Level | null>(null);
  const [active, setActive] = useState<Level>('beginner');
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  useEffect(() => {
    const summary = loadOnboardingSummary();
    const lvl = normalise(summary?.experienceLevel);
    setYourLevel(lvl);
    let activeLevel = lvl;
    let walkthrough = false;
    try {
      if (new URLSearchParams(window.location.search).get('track') === 'beginner') {
        activeLevel = 'beginner';
        walkthrough = true;
      }
    } catch {
      /* ignore */
    }
    setActive(activeLevel);
    setShowWalkthrough(walkthrough);
  }, []);

  function selectLevel(l: Level) {
    setActive(l);
    setOpenTopic(null);
    setShowWalkthrough(false);
  }

  const path = PATH[active];

  return (
    <section className="terminal-panel rounded-md p-3">
      <div className="flex items-center gap-2">
        <GraduationCap size={16} className="text-[#8aa2ff]" />
        <h2 className="text-sm font-semibold text-[#eef3f8]">Your learning path</h2>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {LEVELS.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => selectLevel(l.key)}
            className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] transition ${
              active === l.key
                ? 'border-[#3b5bdb] bg-[#0d1530] text-[#8aa2ff]'
                : 'border-[#1b2530] bg-[#0d141c] text-[#8190a0] hover:text-[#dbe5ee]'
            }`}
          >
            {l.label}
            {yourLevel === l.key ? ' · you' : ''}
          </button>
        ))}
      </div>

      <p className="mt-2 text-[11px] leading-snug text-[#a8b5c2]">{path.blurb}</p>

      <div className="mt-2 space-y-1.5">
        {path.topics.map((topic, i) => {
          const open = openTopic === topic.t;
          return (
            <div key={topic.t} className="overflow-hidden rounded-md border border-[#1b2530] bg-[#0d1117]">
              <button
                type="button"
                onClick={() => setOpenTopic(open ? null : topic.t)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left transition hover:bg-[#101720]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#3b5bdb] bg-[#0d1530] font-mono text-[10px] font-semibold text-[#8aa2ff]">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#eef3f8]">{topic.t}</p>
                    {!open && <p className="truncate text-[10px] text-[#8190a0]">{topic.summary}</p>}
                  </div>
                </div>
                <ChevronDown size={14} className={`shrink-0 text-[#8190a0] transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <div className="space-y-2 border-t border-[#1b2530] px-2.5 py-2 text-[11px] leading-snug">
                  {([
                    ['What it is', topic.def, 'text-[#8190a0]'],
                    ['Why it matters', topic.why, 'text-[#8190a0]'],
                    ['How Lyra uses it', topic.console, 'text-[#8aa2ff]'],
                    ['Live example', topic.example, 'text-[#43d18b]'],
                  ] as const).map(([label, body, tone]) => (
                    <div key={label}>
                      <p className={`text-[9px] font-semibold uppercase tracking-[0.12em] ${tone}`}>{label}</p>
                      <p className="mt-0.5 text-[#c8d3de]">{body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {active === 'beginner' && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowWalkthrough((v) => !v)}
            aria-expanded={showWalkthrough}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#3b5bdb] bg-[#0d1530] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8aa2ff] transition hover:bg-[#11193a]"
          >
            <GraduationCap size={13} /> {showWalkthrough ? 'Hide walkthrough' : 'Start the beginner walkthrough'}
          </button>
          {showWalkthrough && (
            <div className="mt-2">
              <EducationCarousel />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
