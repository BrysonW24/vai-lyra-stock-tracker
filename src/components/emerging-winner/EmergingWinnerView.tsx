import type {
  EmergingWinnerQueue,
  EmergingWinnerResult,
} from '@/lib/emerging-winner/types';

/**
 * Emerging Winner Engine research surface (shadow-live). Renders the ranked, risk-gated research queue.
 * Purely presentational - every number is engine-computed and read from the ledger; nothing here
 * recalculates. Research framing only: actions are research/watch/paper-bot, never "buy", never a price
 * target. The risk half (what's missing / what could go wrong) is always shown, never hidden.
 */

const STAGE_STYLE: Record<number, string> = {
  0: 'bg-white/10 text-white/60',
  1: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30',
  2: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30',
  3: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/40',
};

const RISK_STYLE: Record<string, string> = {
  pass: 'bg-emerald-500/15 text-emerald-300',
  review: 'bg-amber-400/15 text-amber-300',
  block: 'bg-rose-500/15 text-rose-300',
};

const ACTION_LABEL: Record<string, string> = {
  deep_research: 'Deep research',
  paper_bot_candidate: 'Paper-bot candidate',
  watchlist_candidate: 'Watchlist',
  needs_review: 'Needs review',
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function Card({ result, rank }: { result: EmergingWinnerResult; rank: number }) {
  const d = result;
  const dist = d.outcome_distribution;
  const topDrivers = d.contributions.slice(0, 4);
  const winners = d.analogues.nearest_winners.slice(0, 2);
  return (
    <article
      className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur ${
        d.surfaced ? '' : 'opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-white/40">#{rank}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-white">{d.symbol}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_STYLE[d.ordinal_stage] ?? ''}`}>
                {d.stage_label}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-white/50">
              {d.archetype} · confidence {d.confidence}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-white">{Math.round(d.winner_similarity)}</div>
          <div className="text-[10px] uppercase tracking-wide text-white/40">winner similarity</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`rounded-full px-2 py-0.5 font-medium ${RISK_STYLE[d.risk.verdict] ?? ''}`}>
          risk {d.risk.verdict}
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-white/60">
          {ACTION_LABEL[d.action] ?? d.action}
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-white/60">priority {Math.round(d.priority_score)}</span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-white/60">
          {Math.round(d.completeness * 100)}% domains
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-white/50">{d.timing_state}</span>
        {d.timing && d.timing.network_score !== null && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-white/50">
            network {Math.round(d.timing.network_score)} · {d.timing.network_state.split(' (')[0]}
          </span>
        )}
      </div>

      <div className="mt-3">
        <Bar value={d.completeness * 100} />
      </div>

      {topDrivers.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-wide text-white/40">top drivers</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {topDrivers.map((c) => (
              <span
                key={c.domain}
                className={`rounded px-1.5 py-0.5 text-[11px] ${
                  c.contribution >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
                }`}
              >
                {c.label} {c.contribution >= 0 ? '+' : ''}
                {Math.round(c.contribution)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="P(2x·24m)" value={pct(dist.p_2x_24m)} />
        <Stat label="P(5x·36m)" value={pct(dist.p_5x_36m)} />
        <Stat label="P(10x·60m)" value={pct(dist.p_10x_60m)} />
        <Stat label="P(-80%)" value={pct(dist.p_ruin)} danger />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/50">
        <span>survivability {dist.survivability}</span>
        {winners.length > 0 && (
          <span>
            resembles {winners.map((w) => `${w.name} (${Math.round(w.similarity)})`).join(', ')}
          </span>
        )}
        <span>winner/failure {d.analogues.winner_failure_ratio.toFixed(2)}</span>
      </div>

      {(d.missing_domains.length > 0 || d.risks.length > 0) && (
        <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-2.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-amber-300/80">
            Risks / what&apos;s missing
          </div>
          <ul className="mt-1 space-y-0.5 text-[11px] text-white/60">
            {d.risks.slice(0, 3).map((r, i) => (
              <li key={i}>· {r}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.03] p-2 text-center">
      <div className={`text-sm font-semibold ${danger ? 'text-rose-300' : 'text-white'}`}>{value}</div>
      <div className="text-[10px] text-white/40">{label}</div>
    </div>
  );
}

export function EmergingWinnerView({ queue }: { queue: EmergingWinnerQueue }) {
  const surfaced = queue.queue.filter((r) => r.surfaced);
  const blocked = queue.queue.filter((r) => !r.surfaced);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-white">Emerging Winners</h1>
          {queue.demo && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/60">demo data</span>
          )}
        </div>
        <p className="mt-1 text-sm text-white/50">
          Small caps that structurally resemble the companies that became outsized winners - a 10-domain
          scorecard, a winner classifier, historical analogues and a risk-gate stack, ranked for research.
        </p>
      </header>

      <div className="mb-5 rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-3 text-[12px] text-amber-100/80">
        <strong className="font-semibold text-amber-200">Shadow-live, reference-v1.</strong> {queue.note}{' '}
        The engine informs a resemblance score; it never decides an action, never says buy or sell, and
        never gives a price target. It is not yet trained on a real point-in-time winner dataset.
      </div>

      {surfaced.length === 0 && blocked.length === 0 && (
        <p className="text-sm text-white/50">No candidates in the current run.</p>
      )}

      <div className="space-y-3">
        {surfaced.map((r, i) => (
          <Card key={r.symbol} result={r} rank={i + 1} />
        ))}
      </div>

      {blocked.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-medium text-white/60">
            Filtered out by the risk gates ({blocked.length})
          </h2>
          <div className="space-y-3">
            {blocked.map((r, i) => (
              <Card key={r.symbol} result={r} rank={surfaced.length + i + 1} />
            ))}
          </div>
        </>
      )}

      {queue.engine_version && (
        <p className="mt-6 text-center text-[10px] text-white/30">
          {queue.engine_version}
          {queue.generated_at ? ` · ${new Date(queue.generated_at).toLocaleString()}` : ''}
        </p>
      )}
    </div>
  );
}
