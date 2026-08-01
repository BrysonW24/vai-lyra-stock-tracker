import Link from 'next/link';

/**
 * Landing section: the modelling stack. Light Vivacity brand surface (cream/navy/electric blue)
 * matching the welcome page. Honest framing baked in: the stack is shadow-live, research only,
 * and every claim here mirrors the in-app /models catalogue - never ahead of it.
 */

const MODELS = [
  {
    key: 'M1',
    name: 'Domain Score Engine',
    line: '10 interpretable company scores - technical, theme, capital, government, sponsorship and more.',
  },
  {
    key: 'M2',
    name: 'Emerging Winner Classifier',
    line: 'Winner similarity 0-100 with a conviction ladder - now trained on real historical outcomes (survivor-biased backtest, still beta).',
  },
  {
    key: 'M3',
    name: 'Historical Analogue Model',
    line: 'Which past winners and failures a name most resembles - and what it is still missing.',
  },
  {
    key: 'M4',
    name: 'Archetype & Queue Ranker',
    line: 'The opportunity type, and what deserves research attention first.',
  },
  {
    key: 'M5',
    name: 'Risk Gate Stack',
    line: 'Five gates - survivability, dilution, manipulation, liquidity, downside. A pump gets blocked.',
  },
  {
    key: 'M6',
    name: 'Timing & Network Intelligence',
    line: 'Is evidence accelerating or crowded; is the name inside the clusters winners sat inside.',
  },
];

export function ModelsShowcase() {
  return (
    <div>
      <div className="mb-7 min-w-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#1E63FF]">The modelling stack</p>
        <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#0E1E3A] md:text-3xl">
          Six models. One honest <span className="text-[#1E63FF]">research queue</span>.
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#5A6B82]">
          The Emerging Winner Engine scores small caps against the structural shape of history&apos;s
          winners - then risk-gates every finding before you see it. It runs in beta: every
          prediction lands in an immutable ledger and the models are promoted to live only after their
          track record earns it.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODELS.map((m) => (
          <div
            key={m.key}
            className="rounded-2xl border border-[#0E1E3A]/10 bg-white/60 p-4 shadow-sm backdrop-blur-sm"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-9 place-items-center rounded-md bg-[#1E63FF]/10 font-mono text-[11px] font-bold text-[#1E63FF]">
                {m.key}
              </span>
              <h3 className="text-[13px] font-semibold text-[#0E1E3A]">{m.name}</h3>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-[#5A6B82]">{m.line}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/models"
          className="inline-flex min-h-[44px] items-center rounded-full bg-[#0E1E3A] px-5 text-sm font-semibold text-white transition hover:bg-[#1E63FF]"
        >
          Explore the models
        </Link>
        <p className="text-[11px] text-[#5A6B82]">
          Research, not advice - the engine never says what to trade, and the risks are always on the card.
        </p>
      </div>
    </div>
  );
}
