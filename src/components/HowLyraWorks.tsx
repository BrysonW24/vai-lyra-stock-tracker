import { Cpu, Gauge, ListChecks, Radar, ShieldCheck, Sparkles, Target } from 'lucide-react';

/**
 * In-app "How Lyra Works" explainer - a readable, grounded walk through the decision process:
 * how signals are pulled and scored, how sends are ranked, why the ranking is auditable, and
 * exactly where AI is (and is not) in the loop. The numbers here mirror the code and the full
 * root doc HOW-LYRA-WORKS.md; when a weight changes, change both. No AI, no live data - static.
 */

const REPO_DOC = 'https://github.com/BrysonW24/vai-lyra-stock-tracker/blob/main/HOW-LYRA-WORKS.md';

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Cpu;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#1b2530] bg-[#0b1016] p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#eef3f8]">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#7fb0ff]">
          <Icon size={14} />
        </span>
        {title}
      </h2>
      <div className="mt-2.5 space-y-2.5 text-xs leading-relaxed text-[#a8b5c2]">{children}</div>
    </section>
  );
}

function Mono({ children }: { children: string }) {
  return (
    <div className="overflow-x-auto rounded-md border border-[#1b2530] bg-[#080c11] p-3">
      <pre className="font-mono text-[10.5px] leading-relaxed text-[#8fb0c8]">{children}</pre>
    </div>
  );
}

export function HowLyraWorks() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#9a6a1f]/40 bg-[#1a1305] p-4">
        <p className="text-sm font-semibold text-[#f3a33a]">The one law</p>
        <p className="mt-1 text-xs leading-relaxed text-[#d9c39a]">
          The deterministic engine decides, the AI only explains, and the AI never invents a
          number. Scoring, ranking, signal state, and every notification are computed by plain
          code you can audit. The model is a bounded narrator - it is structurally kept out of
          the decision path.
        </p>
      </div>

      <Section icon={Cpu} title="1. The pipeline, end to end">
        <p>
          Data is pulled by ordinary API calls, turned into a score by a fixed formula, ranked by
          a relevance number, routed to your channels by a pure function, then every published
          number is measured against reality so the ranking can be checked and corrected.
        </p>
        <Mono>{`DATA ─▶ indicators ─▶ SCORE 0-100 ─▶ status/action
       ─▶ your portfolio & watchlist overlays
       ─▶ RELEVANCE rank ─▶ notification ROUTER ─▶ you
                              │
                              ▼
          OUTCOME LOOP: measure forward returns,
          arm human retuning  (the audit trail)`}</Mono>
      </Section>

      <Section icon={Gauge} title="2. The score (how 'analysed' works)">
        <p>
          Each stock gets an additive <strong className="text-[#eef3f8]">0-100</strong> score from
          five hard-capped blocks. Every rule reads a raw indicator and contributes 0 when its
          input is missing - it is never guessed.
        </p>
        <ul className="space-y-1">
          <li>• RSI (cap 25) - rewards the 35-50 reset band and a rising RSI</li>
          <li>• MACD (cap 30) - rewards a still-negative histogram that is turning up</li>
          <li>• Price location (cap 15) - rewards sitting near the 60-period low</li>
          <li>• Trend (cap 15) - rewards price above / near the 200-day average</li>
          <li>• Volume (cap 15) - rewards participation rising into the move</li>
        </ul>
        <p>
          The score maps to a state:{' '}
          <strong className="text-[#eef3f8]">75+ = strong setup</strong>,{' '}
          <strong className="text-[#eef3f8]">60+ = watchlist</strong>, a drop of more than 8
          weakens it. It is a dip / early-turn read: a high score means &quot;beaten-down name
          turning up&quot;, not a breakout to new highs.
        </p>
      </Section>

      <Section icon={ListChecks} title="3. What gets sent (the ranking)">
        <p>
          Of everything that happens each scan, a relevance number decides what is worth your
          attention. The biggest lever is <strong className="text-[#eef3f8]">you</strong> - a move
          in something you hold or watch outranks a textbook setup in a name you have never looked
          at.
        </p>
        <p>
          A pure 10-rule router then decides deliver / hold / drop from your settings and clock:
          anything below your relevance floor (default 40) is dropped; you are capped at a default
          6 alerts an hour; and quiet-hours or capped alerts are{' '}
          <strong className="text-[#eef3f8]">held, never lost</strong> - late beats lost.
          Safety-critical alerts always get through.
        </p>
      </Section>

      <Section icon={ShieldCheck} title="4. Why you can trust the ranking">
        <p>
          A formula you cannot check is just a guess with better manners. So every published number
          is measured: each setup is labelled with its real forward return at 1, 5, 20 and 60 days
          - computed from the same candles that scored it, so it is reproducible.
        </p>
        <p>
          The track record shows the measured win rate or says &quot;not yet measured&quot; - it
          never shows a decorative number. A nightly ledger tracks which score components actually
          predicted good outcomes, and a human retunes the weights against that evidence. You are
          never asked to trust the weights - you are shown whether they predicted reality.
        </p>
      </Section>

      <Section icon={Radar} title="5. The scout (news, gov spending, partnerships)">
        <p>
          A nightly worker reads ~100 sources and attaches each item to a theme by plain keyword
          matching. Something is promoted to an idea only when it recurs in{' '}
          <strong className="text-[#eef3f8]">3+ items from 2+ independent sources</strong> inside a
          14-day window - one outlet repeating a story is marketing; several independently is
          signal. Confidence is pure breadth math, never a model&apos;s opinion. An optional AI
          &quot;read&quot; can rephrase the evidence headlines, but the card never depends on it.
        </p>
      </Section>

      <Section icon={Sparkles} title="6. Where AI is - and is not">
        <p>
          <strong className="text-[#eef3f8]">AI may:</strong> explain a signal in plain English,
          answer questions grounded in your dashboard, and write the optional scout read. Its
          answers are stripped of any number that is not in the underlying data.
        </p>
        <p>
          <strong className="text-[#eef3f8]">AI may not:</strong> compute a score, rank an alert,
          build an order, or touch the notification path. Those are plain code, and a test fails
          the build if any AI route slips past its guard. On this build, AI runs on your own key
          when you add one; it is never required for the signals or the alerts.
        </p>
      </Section>

      <Section icon={Target} title="7. Coming: your goal shapes what you see">
        <p className="text-[11px] uppercase tracking-wide text-[#6f7d8a]">Design / roadmap</p>
        <p>
          Tell Lyra your goal in plain words - &quot;grow steadily&quot; or &quot;max upside, high
          risk&quot; - and the AI translates that into a ranking policy: which setups to float to
          the top and how to frame them. The AI reasons about the policy once, when you say it; the
          engine then runs that policy for free on every hourly brief. It reshapes what you look at,
          never crossing into &quot;buy this / sell that&quot; - Lyra stays research, not advice.
        </p>
      </Section>

      <div className="rounded-lg border border-[#1b2530] bg-[#0b1016] p-3 text-center">
        <a
          href={REPO_DOC}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-[#7fb0ff] hover:underline"
        >
          Read the full, code-cited version →
        </a>
        <p className="mt-1 text-[10.5px] text-[#6f7d8a]">
          Every claim above is grounded in the source and traceable to a file and line.
        </p>
      </div>
    </div>
  );
}
