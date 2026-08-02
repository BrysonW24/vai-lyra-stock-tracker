import { Fingerprint, Sparkles, Scale } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { getDashboardData } from '@/lib/data';
import { loadTwinReflection } from '@/lib/twin/repo';
import { pageTitleClass } from '@/lib/ui';

export const metadata = { title: 'Your Twin' };
export const dynamic = 'force-dynamic';

/**
 * "Your trading twin" - the reflection surface. Shows the user THEMSELVES: interests, habits, and
 * revealed risk posture derived deterministically from their own behaviour. Research about you,
 * framed neutrally - never advice. The deterministic engine still owns every signal; this only
 * mirrors what Lyra has learned about how you pay attention and weigh risk. Degrades to a learning
 * state when there is not enough history (or the user is not signed in).
 */

const GAP_TONE: Record<string, string> = {
  aligned: 'text-positive',
  'bolder-than-stated': 'text-accent',
  'more-cautious-than-stated': 'text-blue-info',
  'insufficient-data': 'text-ink-3',
};

function RiskBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-cell border border-line-strong bg-panel px-3 py-2 text-center">
      <div className="text-[9px] uppercase tracking-[0.14em] text-ink-3">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold capitalize text-ink">{value}</div>
    </div>
  );
}

export default async function TwinPage() {
  const data = await getDashboardData();
  const twin = await loadTwinReflection();

  const learning = !twin || !twin.hasEnoughData;

  return (
    <AppShell data={data}>
      <div className="mx-auto max-w-3xl space-y-2.5 pb-28 xl:pb-6">
        <div className="terminal-panel rounded-panel px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-cell border border-line-strong bg-panel text-pending">
              <Fingerprint size={15} />
            </span>
            <div>
              <h1 className={pageTitleClass}>Your trading twin</h1>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-3">
                Research about you, learned from your own behaviour. A mirror, never advice - the deterministic engine still decides every signal.
              </p>
            </div>
          </div>
        </div>

        {learning ? (
          <section className="terminal-panel rounded-panel p-4">
            <div className="flex items-start gap-2.5">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <h2 className="text-sm font-semibold text-ink-title">Your twin is still learning</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
                  {twin?.observations[0] ??
                    'Sign in, then watch a few names, build your watchlist, and paper-trade some setups. Once there is enough history, Lyra reflects your interests, habits, and risk posture back to you here - as research about you, never as advice.'}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="terminal-panel rounded-panel p-3">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-title">
                {twin.headline}
              </h2>
              <ul className="space-y-2">
                {twin.observations.map((o, i) => (
                  <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-ink-title">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-pending" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="terminal-panel rounded-panel p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <Scale size={13} className="text-blue-info" />
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-title">Stated vs revealed</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <RiskBadge label="You said" value={twin.reconciliation.statedRisk} />
                <RiskBadge label="You trade" value={twin.reconciliation.revealedRisk} />
                <div className="col-span-2 rounded-cell border border-line-strong bg-panel px-3 py-2 text-center sm:col-span-1">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-ink-3">Gap</div>
                  <div className={`mt-0.5 font-mono text-[11px] font-semibold ${GAP_TONE[twin.reconciliation.gap] ?? 'text-ink'}`}>
                    {twin.reconciliation.gap.replace(/-/g, ' ')}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-2">{twin.reconciliation.summary}</p>
              {twin.reconciliation.factors.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {twin.reconciliation.factors.map((f, i) => (
                    <li key={i} className="font-mono text-[10.5px] text-ink-3">- {f}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid gap-2.5 sm:grid-cols-2">
              <div className="terminal-panel rounded-panel p-3">
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-title">Where your attention goes</h2>
                <div className="space-y-1.5">
                  {twin.topThemes.map((t) => (
                    <div key={t.key}>
                      <div className="flex justify-between text-[11px] text-ink-title">
                        <span>{t.key}</span>
                        <span className="font-mono text-ink-3">{t.sharePct}%</span>
                      </div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-panel">
                        <div className="h-full rounded-full bg-pending" style={{ width: `${Math.min(100, t.sharePct)}%` }} />
                      </div>
                    </div>
                  ))}
                  {twin.topThemes.length === 0 && <p className="text-[11px] text-ink-3">No theme concentration yet.</p>}
                </div>
              </div>

              <div className="terminal-panel rounded-panel p-3">
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-title">Signals you trust</h2>
                <div className="flex flex-wrap gap-1.5">
                  {twin.topSignalKinds.map((k) => (
                    <span key={k.key} className="rounded-full border border-line-strong bg-panel px-2 py-0.5 font-mono text-[10px] text-blue-info">
                      {k.label}
                    </span>
                  ))}
                  {twin.topSignalKinds.length === 0 && <p className="text-[11px] text-ink-3">Not enough signal history yet.</p>}
                </div>
                {twin.stageLean && (
                  <p className="mt-3 text-[11px] text-ink-2">
                    Stage lean: <span className="font-mono capitalize text-ink">{twin.stageLean}</span>
                    {twin.stageLean === 'late' && ' - you gravitate to scaling/crowded names.'}
                    {twin.stageLean === 'early' && ' - you gravitate to concept/funded names.'}
                  </p>
                )}
              </div>
            </section>
          </>
        )}

        <p className="px-1 text-[10px] leading-relaxed text-ink-dim">
          Your twin is private to you, computed deterministically from your own watchlist and paper trades - no other user can see it, and it never places a trade or gives advice. Manage or delete this data anytime in Account &amp; settings.
        </p>
      </div>
    </AppShell>
  );
}
