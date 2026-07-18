'use client';

import { useEffect, useRef, useState } from 'react';
import { containFocus, registerDialog } from '@/lib/focus-trap';
import type { DrawerStackItem, Finding, FindingState } from '@/lib/findings/types';
import { loadAi } from '@/lib/account';
import { buildAllowedMetrics, buildDefaultGenUIView, type GenUIView } from '@/lib/findings/genui';

/**
 * The nested investigation drawer. Renders the TOP item of the stack as a right-side panel
 * (desktop) / full-screen sheet (mobile), with a breadcrumb of the whole stack and back/close.
 * Every evidence item, entity and source record is clickable and pushes the next layer:
 *   finding -> evidence -> source record -> entity -> (connected pattern)
 * Deterministic data only; the "what it does not prove" line is always shown - this is trusted
 * investigation, not hype.
 */

interface Props {
  finding: Finding | null;
  stack: DrawerStackItem[];
  onPush: (item: DrawerStackItem) => void;
  onBack: () => void;
  onClose: () => void;
  /** Live findings only: show the promote/dismiss lifecycle controls (writes to /api/findings/lifecycle). */
  enableLifecycle?: boolean;
  /** Called after a successful lifecycle write so the caller can refresh + close. */
  onLifecycleChange?: () => void;
}

const confidenceTone: Record<string, string> = { high: 'text-[#43d18b]', medium: 'text-[#f3a33a]', low: 'text-[#8190a0]' };

export function InvestigationDrawerStack({ finding, stack, onPush, onBack, onClose, enableLifecycle, onLifecycleChange }: Props) {
  const isOpen = stack.length > 0 && Boolean(finding);
  const asideRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const depthRef = useRef(stack.length);
  depthRef.current = stack.length;

  // Dialog lifecycle: focus in on open + restore on close (aria-modal demands it),
  // register in the dialog stack, lock the page scroll behind. Keyed on [isOpen] only
  // so pushing deeper into the stack cannot re-capture the restore target.
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    const unregister = asideRef.current ? registerDialog(asideRef.current) : undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      unregister?.();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [isOpen]);

  // Esc mirrors the on-screen Back affordance: pop one level while deep in an
  // investigation, close only from the top level. Tab stays contained.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (depthRef.current > 1) onBack();
        else onClose();
      }
      containFocus(asideRef.current, e);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onBack, onClose]);

  if (stack.length === 0 || !finding) return null;
  const top = stack[stack.length - 1];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label="Investigation detail"
        className="flex h-full w-full max-w-xl flex-col border-l border-[#1b2530] bg-[#070b10] shadow-2xl md:w-[34rem]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingRight: 'env(safe-area-inset-right)' }}
      >
        {/* breadcrumb + controls */}
        <div
          className="flex items-center gap-2 border-b border-[#1b2530] px-3 py-2"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          {stack.length > 1 && (
            <button type="button" onClick={onBack} className="rounded border border-[#1b2530] px-2 py-0.5 text-[10px] text-[#a8b5c2] hover:border-[#2b3a4a]">
              &lt;- Back
            </button>
          )}
          <nav className="min-w-0 flex-1 truncate text-[10px] text-[#8190a0]">
            {stack.map((item, i) => (
              <span key={`${item.type}:${item.id}:${i}`}>
                {i > 0 && <span className="px-1 text-[#3a4654]">/</span>}
                <span className={i === stack.length - 1 ? 'text-[#a8b5c2]' : ''}>{item.title || item.id}</span>
              </span>
            ))}
          </nav>
          <button ref={closeBtnRef} type="button" onClick={onClose} className="rounded border border-[#1b2530] px-2 py-0.5 text-[10px] text-[#a8b5c2] hover:border-[#2b3a4a]">
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {top.type === 'finding' && (
            <FindingBody finding={finding} onPush={onPush} enableLifecycle={enableLifecycle} onLifecycleChange={onLifecycleChange} />
          )}
          {top.type === 'evidence' && <EvidenceBody finding={finding} evidenceId={top.id} onPush={onPush} />}
          {top.type === 'source_record' && <SourceRecordBody finding={finding} evidenceId={top.id} />}
          {(top.type === 'company' || top.type === 'theme' || top.type === 'supply_chain_node' || top.type === 'investor') && (
            <EntityBody finding={finding} entityId={top.id} onPush={onPush} />
          )}
          {top.type === 'risk' && <RiskBody finding={finding} riskId={top.id} />}
          {top.type === 'genui' && <GenUIBody finding={finding} onPush={onPush} />}
        </div>
      </aside>
    </div>
  );
}

// ---- Finding (tabs) -------------------------------------------------------------------------

type Tab = 'Summary' | 'Evidence' | 'Risk' | 'Timeline' | 'Actions';
const TABS: Tab[] = ['Summary', 'Evidence', 'Risk', 'Timeline', 'Actions'];

function FindingBody({
  finding,
  onPush,
  enableLifecycle,
  onLifecycleChange,
}: {
  finding: Finding;
  onPush: (i: DrawerStackItem) => void;
  enableLifecycle?: boolean;
  onLifecycleChange?: () => void;
}) {
  const [tab, setTab] = useState<Tab>('Summary');
  const s = finding.scores;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">
          {finding.symbol ? `${finding.symbol} - why Lyra surfaced this` : finding.title}
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[#a8b5c2]">{finding.summary}</p>
      </div>

      <button
        type="button"
        onClick={() => onPush({ type: 'genui', id: finding.id, title: 'Generated view' })}
        className="flex w-full items-center justify-between rounded-md border border-[#234] bg-gradient-to-r from-[#0b1016] to-[#0d1a26] px-3 py-2 text-left hover:border-[#2b4a63]"
      >
        <span className="text-[11px] text-[#8fd0ff]">Want to see what this looks like? Generate a view -&gt;</span>
        <span className="text-[10px] text-[#8190a0]">AI composes, Lyra owns the numbers</span>
      </button>

      <div className="flex gap-1 border-b border-[#1b2530]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-2 py-1 text-[10px] uppercase tracking-[0.1em] ${tab === t ? 'border-b border-[#60a5fa] text-[#eef3f8]' : 'text-[#8190a0]'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Summary' && (
        <div className="space-y-3">
          <Section title="Why surfaced">
            <ol className="space-y-1">
              {finding.whySurfaced.map((w, i) => (
                <li key={i} className="text-[11px] leading-relaxed text-[#a8b5c2]">
                  <span className="text-[#60a5fa]">{i + 1}.</span> {w}
                </li>
              ))}
            </ol>
          </Section>
          <Section title="Scores">
            <div className="grid grid-cols-3 gap-1.5">
              {([['Total', s.total], ['Government', s.government], ['Technical', s.technical], ['Volume', s.volume], ['Theme fit', s.themeFit], ['Risk penalty', s.riskPenalty]] as [string, number | undefined][])
                .filter(([, v]) => typeof v === 'number')
                .map(([label, v]) => (
                  <div key={label} className="rounded bg-[#0b1016] p-1.5">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-[#8190a0]">{label}</p>
                    <p className="numeric font-mono text-sm font-semibold text-[#eef3f8]">{v}</p>
                  </div>
                ))}
            </div>
          </Section>
        </div>
      )}

      {tab === 'Evidence' && (
        <div className="space-y-1.5">
          {finding.evidence.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => onPush({ type: 'evidence', id: ev.id, title: ev.sourceName })}
              className="block w-full rounded border border-[#1b2530] p-2 text-left hover:border-[#2b3a4a]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#dbe5ee]">{ev.sourceName}</span>
                <span className={`text-[9px] uppercase ${confidenceTone[ev.confidence]}`}>{ev.confidence}</span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[#a8b5c2]">{ev.summary}</p>
              <p className="mt-0.5 text-[10px] text-[#8190a0]">{ev.eventDate} - {ev.freshness} -&gt;</p>
            </button>
          ))}
        </div>
      )}

      {tab === 'Risk' && (
        <div className="space-y-1.5">
          {finding.risks.map((r) => (
            <div key={r.id} className="rounded border border-[#1b2530] p-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#dbe5ee]">{r.label}</span>
                <span className={`text-[9px] uppercase ${r.severity === 'high' ? 'text-[#f1646c]' : r.severity === 'medium' ? 'text-[#f3a33a]' : 'text-[#8190a0]'}`}>{r.severity}</span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[#a8b5c2]">{r.detail}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'Timeline' && (
        <ol className="space-y-2 border-l border-[#1b2530] pl-3">
          {finding.timeline.map((t, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[15px] top-1 h-1.5 w-1.5 rounded-full bg-[#60a5fa]" />
              <p className="text-[10px] text-[#8190a0]">{t.date}</p>
              <p className={`text-[11px] ${t.stateChange ? 'text-[#43d18b]' : 'text-[#a8b5c2]'}`}>{t.label}</p>
            </li>
          ))}
        </ol>
      )}

      {tab === 'Actions' && (
        <div className="space-y-3">
          {enableLifecycle && <LifecycleControls finding={finding} onChange={onLifecycleChange} />}
          <div>
            <p className="mb-1 text-[9px] uppercase tracking-[0.14em] text-[#8190a0]">Research shortcuts</p>
            <div className="flex flex-wrap gap-1.5">
              {finding.actions.map((a) =>
                a.href ? (
                  <a key={a.kind} href={a.href} className="rounded border border-[#1b2530] px-2.5 py-1 text-[11px] text-[#a8b5c2] hover:border-[#2b3a4a]">
                    {a.label}
                  </a>
                ) : (
                  <span key={a.kind} className="rounded border border-[#1b2530] px-2.5 py-1 text-[11px] text-[#a8b5c2]">
                    {a.label}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Evidence -------------------------------------------------------------------------------

function EvidenceBody({ finding, evidenceId, onPush }: { finding: Finding; evidenceId: string; onPush: (i: DrawerStackItem) => void }) {
  const ev = finding.evidence.find((e) => e.id === evidenceId);
  if (!ev) return <Missing />;
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">{ev.sourceName}</h2>
      <Meta rows={[['Source', ev.sourceName], ['Type', ev.sourceType.replace(/_/g, ' ')], ['Date', ev.eventDate], ['Freshness', ev.freshness], ['Confidence', ev.confidence]]} />
      <Section title="Why it matters">
        <p className="text-[11px] leading-relaxed text-[#a8b5c2]">{ev.whyItMatters}</p>
      </Section>
      <Section title="What it does not prove">
        <p className="text-[11px] leading-relaxed text-[#f3a33a]">{ev.whatItDoesNotProve}</p>
      </Section>
      {ev.linkedEntityIds.length > 0 && (
        <Section title="Linked">
          <div className="flex flex-wrap gap-1.5">
            {ev.linkedEntityIds
              .map((id) => finding.entities.find((e) => e.id === id))
              .filter((e): e is NonNullable<typeof e> => Boolean(e))
              .map((e) => (
                <button key={e.id} type="button" onClick={() => onPush({ type: drawerTypeForEntity(e.type), id: e.id, title: e.name })} className="rounded bg-[#0b1016] px-2 py-0.5 text-[10px] text-[#60a5fa] hover:underline">
                  {e.name}
                </button>
              ))}
          </div>
        </Section>
      )}
      {ev.rawPayload && (
        <button type="button" onClick={() => onPush({ type: 'source_record', id: ev.id, title: 'Source record' })} className="w-full rounded border border-[#1b2530] px-2.5 py-1.5 text-[11px] text-[#a8b5c2] hover:border-[#2b3a4a]">
          Open source record -&gt;
        </button>
      )}
    </div>
  );
}

function SourceRecordBody({ finding, evidenceId }: { finding: Finding; evidenceId: string }) {
  const ev = finding.evidence.find((e) => e.id === evidenceId);
  if (!ev) return <Missing />;
  const payload = ev.rawPayload ?? {};
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Source record</h2>
      <Meta rows={[['Source', ev.sourceName], ['Type', ev.sourceType.replace(/_/g, ' ')], ['Date', ev.eventDate]]} />
      <Section title="Raw record">
        <dl className="space-y-1">
          {Object.entries(payload).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-[#101820] py-0.5">
              <dt className="text-[10px] uppercase tracking-[0.08em] text-[#8190a0]">{k}</dt>
              <dd className="text-right font-mono text-[11px] text-[#a8b5c2]">{String(v)}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="Lyra interpretation">
        <p className="text-[11px] leading-relaxed text-[#a8b5c2]">{ev.whyItMatters}</p>
      </Section>
      <Section title="Limitations">
        <p className="text-[11px] leading-relaxed text-[#f3a33a]">{ev.whatItDoesNotProve}</p>
      </Section>
      {ev.sourceUrl && (
        <a href={ev.sourceUrl} target="_blank" rel="noreferrer" className="block w-full rounded border border-[#1b2530] px-2.5 py-1.5 text-center text-[11px] text-[#60a5fa] hover:border-[#2b3a4a]">
          View original source -&gt;
        </a>
      )}
    </div>
  );
}

// ---- Entity ---------------------------------------------------------------------------------

function EntityBody({ finding, entityId, onPush }: { finding: Finding; entityId: string; onPush: (i: DrawerStackItem) => void }) {
  const entity = finding.entities.find((e) => e.id === entityId);
  if (!entity) return <Missing />;
  // Connected entities via relationships (either direction).
  const connections = finding.relationships
    .filter((r) => r.fromEntityId === entityId || r.toEntityId === entityId)
    .map((r) => {
      const otherId = r.fromEntityId === entityId ? r.toEntityId : r.fromEntityId;
      const other = finding.entities.find((e) => e.id === otherId);
      return other ? { other, rel: r.relationshipType } : null;
    })
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  // Evidence that touches this entity - the proof attached to the node, walkable from the graph too.
  const linkedEvidence = finding.evidence.filter((e) => e.linkedEntityIds.includes(entityId));

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">{entity.name}</h2>
      <p className="text-[10px] uppercase tracking-[0.1em] text-[#8190a0]">{entity.type.replace(/_/g, ' ')}{entity.ref ? ` - ${entity.ref}` : ''}</p>
      {entity.summary && <p className="text-[11px] leading-relaxed text-[#a8b5c2]">{entity.summary}</p>}
      {entity.facts && entity.facts.length > 0 && (
        <Section title="Detail">
          <dl className="space-y-1">
            {entity.facts.map((f) => (
              <div key={f.label} className="flex justify-between gap-3 border-b border-[#101820] py-0.5">
                <dt className="text-[10px] uppercase tracking-[0.08em] text-[#8190a0]">{f.label}</dt>
                <dd className="text-right text-[11px] text-[#a8b5c2]">{f.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
      {linkedEvidence.length > 0 && (
        <Section title={`Evidence (${linkedEvidence.length})`}>
          <div className="space-y-1">
            {linkedEvidence.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => onPush({ type: 'evidence', id: ev.id, title: ev.sourceName })}
                className="flex w-full items-center justify-between rounded border border-[#1b2530] px-2 py-1 text-left hover:border-[#2b3a4a]"
              >
                <span className="min-w-0 truncate text-[11px] text-[#dbe5ee]">{ev.sourceName}</span>
                <span className={`shrink-0 text-[9px] uppercase ${confidenceTone[ev.confidence]}`}>{ev.confidence} -&gt;</span>
              </button>
            ))}
          </div>
        </Section>
      )}
      {connections.length > 0 && (
        <Section title="Connected">
          <div className="space-y-1">
            {connections.map((c, i) => (
              <button key={i} type="button" onClick={() => onPush({ type: drawerTypeForEntity(c.other.type), id: c.other.id, title: c.other.name })} className="flex w-full items-center justify-between rounded border border-[#1b2530] px-2 py-1 text-left hover:border-[#2b3a4a]">
                <span className="text-[11px] text-[#dbe5ee]">{c.other.name}</span>
                <span className="text-[9px] uppercase tracking-[0.08em] text-[#8190a0]">{c.rel.replace(/_/g, ' ')} -&gt;</span>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function RiskBody({ finding, riskId }: { finding: Finding; riskId: string }) {
  const r = finding.risks.find((x) => x.id === riskId);
  if (!r) return <Missing />;
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">{r.label}</h2>
      <p className="text-[10px] uppercase text-[#f3a33a]">{r.severity} risk</p>
      <p className="text-[11px] leading-relaxed text-[#a8b5c2]">{r.detail}</p>
    </div>
  );
}

// ---- Lifecycle (promote / dismiss live findings) --------------------------------------------

const LIFECYCLE_STATES: FindingState[] = ['Watchlist candidate', 'Deep research candidate', 'Paper-bot research queue', 'Review risk'];

function LifecycleControls({ finding, onChange }: { finding: Finding; onChange?: () => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const post = async (body: { state?: string; dismiss?: boolean }, key: string) => {
    setPending(key);
    setErr(null);
    try {
      const res = await fetch('/api/findings/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findingKey: finding.id,
          type: finding.type,
          symbol: finding.symbol,
          theme: finding.themeId,
          score: finding.scores.total,
          ...body,
        }),
      });
      const d = (await res.json()) as { ok: boolean; error?: string };
      if (!d.ok) {
        setErr(d.error || 'Could not save.');
        setPending(null);
        return;
      }
      onChange?.();
    } catch {
      setErr('Could not save.');
      setPending(null);
    }
  };

  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-[0.14em] text-[#8190a0]">Set status (research lifecycle)</p>
      <div className="flex flex-wrap gap-1.5">
        {LIFECYCLE_STATES.map((st) => (
          <button
            key={st}
            type="button"
            disabled={pending !== null}
            onClick={() => post({ state: st }, st)}
            className={`rounded border px-2 py-1 text-[10px] disabled:opacity-50 ${
              finding.state === st ? 'border-[#60a5fa] text-[#eef3f8]' : 'border-[#1b2530] text-[#a8b5c2] hover:border-[#2b3a4a]'
            }`}
          >
            {pending === st ? 'Saving...' : st}
          </button>
        ))}
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => post({ dismiss: true }, 'dismiss')}
          className="rounded border border-[#7f1d1d] px-2 py-1 text-[10px] text-[#ff6b6b] hover:border-[#a52a2a] disabled:opacity-50"
        >
          {pending === 'dismiss' ? 'Saving...' : 'Dismiss as noise'}
        </button>
      </div>
      {err && <p className="mt-1 text-[10px] text-[#ff6b6b]">{err}</p>}
    </div>
  );
}

// ---- GenUI (AI-composed view, deterministic numbers) ----------------------------------------

function GenUIBody({ finding, onPush }: { finding: Finding; onPush: (i: DrawerStackItem) => void }) {
  const [view, setView] = useState<GenUIView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    fetch('/api/findings/genui', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findingId: finding.id, ai: loadAi() }),
    })
      .then((r) => r.json())
      .then((d: { ok: boolean; view?: GenUIView }) => {
        if (cancelled) return;
        // The API always returns a view (deterministic fallback) when ok; degrade to the local
        // default if the request itself failed, so the view is never blank.
        setView(d.ok && d.view ? d.view : buildDefaultGenUIView(finding));
        setState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setView(buildDefaultGenUIView(finding));
        setState('ready');
      });
    return () => {
      cancelled = true;
    };
  }, [finding]);

  if (state === 'loading' || !view) {
    return <p className="text-[11px] text-[#8190a0]">Generating a view...</p>;
  }

  const metricMap = new Map(buildAllowedMetrics(finding).map((m) => [m.key, m]));

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">{view.title}</h2>
        {view.subtitle && <p className="mt-1 text-[11px] leading-relaxed text-[#a8b5c2]">{view.subtitle}</p>}
      </div>

      {view.blocks.map((b, i) => {
        if (b.kind === 'metric_grid') {
          const cells = b.metrics.map((m) => metricMap.get(m.key)).filter((m): m is NonNullable<typeof m> => Boolean(m));
          if (!cells.length) return null;
          return (
            <Section key={i} title={b.title || 'Metrics'}>
              <div className="grid grid-cols-3 gap-1.5">
                {cells.map((m) => (
                  <div key={m.key} className="rounded bg-[#0b1016] p-1.5">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-[#8190a0]">{m.label}</p>
                    <p className="numeric font-mono text-sm font-semibold text-[#eef3f8]">{m.value}</p>
                  </div>
                ))}
              </div>
            </Section>
          );
        }
        if (b.kind === 'bullets') {
          return (
            <Section key={i} title={b.title || 'Notes'}>
              <ul className="space-y-1">
                {b.items.map((it, j) => (
                  <li key={j} className="text-[11px] leading-relaxed text-[#a8b5c2]">- {it}</li>
                ))}
              </ul>
            </Section>
          );
        }
        if (b.kind === 'note') {
          return <p key={i} className="text-[11px] leading-relaxed text-[#a8b5c2]">{b.text}</p>;
        }
        if (b.kind === 'evidence_list') {
          return (
            <Section key={i} title={b.title || 'Evidence'}>
              <div className="space-y-1">
                {finding.evidence.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onPush({ type: 'evidence', id: ev.id, title: ev.sourceName })}
                    className="flex w-full items-center justify-between rounded border border-[#1b2530] px-2 py-1 text-left hover:border-[#2b3a4a]"
                  >
                    <span className="min-w-0 truncate text-[11px] text-[#dbe5ee]">{ev.sourceName}</span>
                    <span className="shrink-0 text-[9px] uppercase text-[#8190a0]">{ev.freshness} -&gt;</span>
                  </button>
                ))}
              </div>
            </Section>
          );
        }
        if (b.kind === 'risk_list') {
          return (
            <Section key={i} title={b.title || 'Risks'}>
              <div className="space-y-1">
                {finding.risks.map((r) => (
                  <div key={r.id} className="rounded border border-[#1b2530] p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#dbe5ee]">{r.label}</span>
                      <span className={`text-[9px] uppercase ${r.severity === 'high' ? 'text-[#f1646c]' : r.severity === 'medium' ? 'text-[#f3a33a]' : 'text-[#8190a0]'}`}>{r.severity}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[#a8b5c2]">{r.detail}</p>
                  </div>
                ))}
              </div>
            </Section>
          );
        }
        if (b.kind === 'timeline') {
          return (
            <Section key={i} title={b.title || 'Timeline'}>
              <ol className="space-y-2 border-l border-[#1b2530] pl-3">
                {finding.timeline.map((t, j) => (
                  <li key={j} className="relative">
                    <span className="absolute -left-[15px] top-1 h-1.5 w-1.5 rounded-full bg-[#60a5fa]" />
                    <p className="text-[10px] text-[#8190a0]">{t.date}</p>
                    <p className={`text-[11px] ${t.stateChange ? 'text-[#43d18b]' : 'text-[#a8b5c2]'}`}>{t.label}</p>
                  </li>
                ))}
              </ol>
            </Section>
          );
        }
        return null;
      })}

      <p className="text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">
        {view.source === 'ai' ? 'AI-composed layout - every number from Lyra\'s engine' : 'Deterministic view - connect a model for an AI-composed layout'}
      </p>
    </div>
  );
}

// ---- shared ---------------------------------------------------------------------------------

function drawerTypeForEntity(type: Finding['entities'][number]['type']): DrawerStackItem['type'] {
  if (type === 'company') return 'company';
  if (type === 'theme') return 'theme';
  if (type === 'supply_chain_node') return 'supply_chain_node';
  if (type === 'investor') return 'investor';
  // contract / patent / filing / commodity / government_agency render in the generic company-style entity body
  return 'company';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-[0.14em] text-[#8190a0]">{title}</p>
      {children}
    </div>
  );
}

function Meta({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-1.5">
      {rows.map(([k, v]) => (
        <div key={k} className="rounded bg-[#0b1016] p-1.5">
          <dt className="text-[9px] uppercase tracking-[0.1em] text-[#8190a0]">{k}</dt>
          <dd className="text-[11px] text-[#a8b5c2]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Missing() {
  return <p className="text-[11px] text-[#8190a0]">That detail is not in this finding.</p>;
}
