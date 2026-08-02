'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { bumpAiUsage } from '@/lib/usage-store';
import Link from 'next/link';
import { X, Send, Loader2, Sparkles, ShieldCheck, KeyRound, SquarePen, ArrowUpRight, Star, Plus, Check, Undo2, RotateCcw } from 'lucide-react';
import { loadAi, loadProfile, loadAgent, type AiSettings } from '@/lib/account';
import { addLocalWatchItem, loadLocalWatchlist, removeLocalWatchItem } from '@/lib/local-watchlist';
import { addLocalHolding, loadLocalHoldings, removeLocalHolding } from '@/lib/local-portfolio';
import { addLocalTradeLog, undoLocalTradeLog, LOCAL_TRADE_ID_PREFIX } from '@/lib/local-trades';
import { containFocus, registerDialog } from '@/lib/focus-trap';
import { loadOnboardingSummary } from '@/lib/onboarding-summary';
import { loadSavedPrompts, toggleSavedPrompt } from '@/lib/saved-prompts';
import type { ChatProfile } from '@/lib/ai/chat-context';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  aiFailureMessage,
  normaliseAiFailureReason,
  type AiFailureReason,
} from '@/lib/ai/failures';

interface ProposedAction {
  type: 'add_watchlist' | 'add_portfolio' | 'log_trade';
  symbol: string;
  side?: 'buy';
  notional?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: ProposedAction;
  actionStatus?: 'proposed' | 'running' | 'done' | 'undone' | 'failed' | 'demo';
  undoId?: string;
  qty?: number;
  price?: number;
}

interface AiRuntimeStatus {
  hostedOpenAi: boolean;
  hostedOpenAiModel: string;
  sharedGoogle: boolean;
  // Per-user entitlement from /api/ai/status (2026-07-27 audit V5 fix). hostedAvailable = the
  // deployment has a hosted key AND this user is entitled (inside trial or granted). Gating the chat
  // on this instead of the deployment-level hostedOpenAi stops a lapsed-trial user seeing a
  // working-looking chat that only errors on send. Optional: the anonymous status shape omits them.
  hostedAvailable?: boolean;
  hostedKeyOnDeployment?: boolean;
  aiIncluded?: boolean;
}

const ACTION_LABEL: Record<ProposedAction['type'], string> = {
  add_watchlist: 'Add to watchlist',
  add_portfolio: 'Add to portfolio',
  log_trade: 'Log trade',
};

interface ChatWidgetProps {
  open: boolean;
  onClose: () => void;
}

type Status = 'idle' | 'sending' | 'error';

/**
 * Strip any stray markdown a model might emit despite the plain-text instruction: bold/italic
 * asterisks, inline-code backticks, and leading heading hashes. Belt-and-suspenders so the
 * bubble never shows raw "**".
 */
function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^\s*#{1,6}\s*/, '')
    .trim();
}

/**
 * Render Lyra's reply cleanly: paragraphs split on blank lines, "-"/"*" lines become real
 * bullets, and any stray markdown is stripped. The canonical prompt asks for plain text, so
 * this is mostly a safety net. User messages render as plain text.
 */
function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`u${blocks.length}`} className="list-disc space-y-1 pl-4 marker:text-ink-dim">
        {items.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>,
    );
  };
  for (const line of text.split('\n')) {
    const t = line.trim();
    const bullet = t.match(/^[*-]\s+(.*)$/);
    if (bullet) {
      bullets.push(stripMarkdown(bullet[1]));
    } else {
      flush();
      const cleaned = stripMarkdown(t);
      if (cleaned) blocks.push(<p key={`p${blocks.length}`}>{cleaned}</p>);
    }
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

/** Browse-and-tap question categories - every prompt is answerable from the user's dashboard. */
const CATEGORIES: { label: string; questions: string[] }[] = [
  {
    label: 'Watchlist',
    questions: [
      "What's strongest in my watchlist right now?",
      'Which watchlist names are closest to their target?',
      'Are any of my watchlist setups confirming today?',
    ],
  },
  {
    label: 'Portfolio',
    questions: [
      'Summarise the risk in my book.',
      'Which of my holdings has the weakest signal?',
      'How is my book performing overall?',
      'Where am I most concentrated?',
    ],
  },
  {
    label: 'Signals',
    questions: [
      'What are the top signals right now?',
      'Which signals improved the most this scan?',
      'Are any prime setups forming?',
    ],
  },
  {
    label: 'Catalysts',
    questions: [
      'Any catalysts I should watch this week?',
      "What's the next big event on my radar?",
      'Which of my names has a catalyst coming up?',
    ],
  },
  {
    label: 'Risk',
    questions: [
      "What's my biggest risk right now?",
      'Are any of my holdings looking overextended?',
      'How exposed am I to one theme?',
    ],
  },
  {
    label: 'Macro',
    questions: ["What's the market regime right now?", 'How does the macro backdrop affect my book?'],
  },
];

/**
 * Ask Lyra - a grounded research copilot. Reads the local AI settings (BYOK) and the
 * onboarding profile, posts the conversation to /api/ai/chat where it's joined to the
 * deterministic dashboard, and renders the reply. When no model is connected it shows a
 * calm "connect a model" state rather than a dead box. Lyra phrases; it never invents a
 * number and never gives advice - that guardrail lives server-side.
 */
export function ChatWidget({ open, onClose }: ChatWidgetProps) {
  const [ai, setAi] = useState<AiSettings | null>(null);
  const [runtime, setRuntime] = useState<AiRuntimeStatus | null>(null);
  const [profile, setProfile] = useState<ChatProfile>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [category, setCategory] = useState<string>(CATEGORIES[0].label);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorReason, setErrorReason] = useState<AiFailureReason | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const newChat = () => {
    setMessages([]);
    setSuggestions([]);
    setInput('');
    setStatus('idle');
    setErrorReason(null);
  };

  const toggleSave = (q: string) => setSaved(toggleSavedPrompt(q));

  useEffect(() => {
    if (!open) return;
    setAi(loadAi());
    setRuntime(null);
    setSaved(loadSavedPrompts());
    const acct = loadProfile();
    const summary = loadOnboardingSummary();
    setProfile({
      displayName: acct.displayName || undefined,
      experienceLevel: summary?.experienceLevel,
      tradedBefore: summary?.tradedBefore,
      riskComfort: summary?.riskComfort,
    });

    let cancelled = false;
    fetch('/api/ai/status')
      .then((res) => res.json())
      .then((data: AiRuntimeStatus) => {
        if (!cancelled) setRuntime(data);
      })
      .catch(() => {
        if (!cancelled) setRuntime({ hostedOpenAi: false, hostedOpenAiModel: '', sharedGoogle: false });
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  // Dialog lifecycle: move focus IN on open and return it on close (aria-modal without
  // this strands screen readers on the inert launcher behind the backdrop), register in
  // the dialog stack, and stop the page behind from scrolling. Keyed on [open] only so a
  // re-render cannot re-capture in-dialog focus as the restore target.
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    const unregister = sheetRef.current ? registerDialog(sheetRef.current) : undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      unregister?.();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [open]);

  // Esc closes (parity with every other drawer); Tab is contained inside the sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      containFocus(sheetRef.current, e);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Still waiting for the /api/ai/status response (fetch in-flight).
  const soloMode = !isSupabaseConfigured();
  const checkingRuntime =
    !soloMode &&
    ai != null &&
    !ai.apiKey?.trim() &&
    runtime == null &&
    (ai.provider === 'openai' || ai.provider === 'google');

  // Connected when the user has a browser key, or the selected provider is backed by a server key
  // AND this user is entitled to it. We gate on the PER-USER hostedAvailable (deployment key +
  // trial/grant), not the deployment-level hostedOpenAi/sharedGoogle: a lapsed-trial user on a paid
  // deployment must fall to the "connect a model" state, not a working-looking chat that errors on
  // send (2026-07-27 audit V5 fix). While still checking (runtime === null) treat openai/google as
  // optimistically connected so the UI renders immediately - the spinner handles the loading UX.
  const connected =
    ai != null &&
    (!!ai.apiKey?.trim() ||
      (!soloMode &&
        ai.provider === 'openai' &&
        (runtime?.hostedAvailable || runtime === null)) ||
      (!soloMode &&
        ai.provider === 'google' &&
        (runtime?.hostedAvailable ||
          runtime === null ||
          process.env.NEXT_PUBLIC_LYRA_FREE_AI === '1')));

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || status === 'sending' || !ai || !connected) return;
    const next = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(next);
    setInput('');
    setSuggestions([]);
    setStatus('sending');
    setErrorReason(null);
    try {
      const agentActions = loadAgent().actionsEnabled;
      // Solo's own book/watchlist live in localStorage, while the server dataset is an
      // illustrative scan. Forward a minimal transient snapshot so BYOK answers ground on what
      // this user actually entered. The route validates it and audit logs only its hash.
      const summary = loadOnboardingSummary();
      const soloContext = !isSupabaseConfigured()
        ? {
            holdings: loadLocalHoldings().map(({ symbol, quantity, averageBuyPrice }) => ({
              symbol,
              quantity,
              averageBuyPrice,
            })),
            watchlist: loadLocalWatchlist().map(({ symbol, targetBuyPrice }) => ({
              symbol,
              targetBuyPrice,
            })),
            capital: summary?.capital,
          }
        : undefined;
      bumpAiUsage();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, ai, profile, agentActions, soloContext }),
      });
      const data = (await res.json()) as { ok?: boolean; text?: string; reason?: string; suggestions?: string[]; action?: ProposedAction | null };
      if (data.ok && data.text) {
        const action =
          data.action && (data.action.type === 'add_watchlist' || data.action.type === 'add_portfolio' || data.action.type === 'log_trade')
            ? data.action
            : undefined;
        setMessages((m) => [...m, { role: 'assistant', content: data.text as string, action, actionStatus: action ? 'proposed' : undefined }]);
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : []);
        setStatus('idle');
      } else {
        setErrorReason(normaliseAiFailureReason(data.reason));
        setStatus('error');
      }
    } catch {
      setErrorReason('provider_unavailable');
      setStatus('error');
    }
  };

  /** Confirm-to-act: the user explicitly approved, so deterministic code performs the reversible action. */
  const runAction = async (i: number) => {
    const msg = messages[i];
    if (!msg.action || msg.actionStatus === 'running' || msg.actionStatus === 'done') return;
    const { type, symbol } = msg.action;
    setMessages((m) => m.map((x, j) => (j === i ? { ...x, actionStatus: 'running' } : x)));
    try {
      const endpoint = type === 'add_watchlist' ? '/api/watchlist' : type === 'add_portfolio' ? '/api/portfolio' : '/api/trades';
      const payload =
        type === 'add_watchlist'
          ? { symbol }
          : type === 'add_portfolio'
            ? { symbol, quantity: msg.qty ?? 10, averageBuyPrice: msg.price ?? 0 }
            : { side: msg.action.side ?? 'buy', symbol, notional: msg.action.notional ?? 0, source: 'chat' };
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = (await res.json()) as { ok?: boolean; demo?: boolean; data?: { id?: string }; error?: string };
      let outcome: Pick<ChatMessage, 'actionStatus' | 'undoId'>;
      if (data.ok) {
        outcome = { actionStatus: 'done', undoId: data.data?.id };
      } else if (data.demo) {
        // Solo/demo deployment - there is no server store AT ALL, so "sign in to save" would
        // point at accounts that do not exist. Save to the browser-local twins instead; the
        // local- undo ids route undoAction to the same stores.
        if (type === 'add_watchlist') {
          outcome = addLocalWatchItem({ symbol })
            ? { actionStatus: 'done', undoId: `${LOCAL_TRADE_ID_PREFIX}${symbol}` }
            : { actionStatus: 'failed' };
        } else if (type === 'add_portfolio') {
          outcome = addLocalHolding({ symbol, quantity: msg.qty ?? 10, averageBuyPrice: msg.price ?? 0 })
            ? { actionStatus: 'done', undoId: `${LOCAL_TRADE_ID_PREFIX}${symbol}` }
            : { actionStatus: 'failed' };
        } else {
          const log = await addLocalTradeLog({ side: msg.action.side ?? 'buy', symbol, notional: msg.action.notional ?? 0, source: 'chat' });
          // null = no notional or no live quote - refusing beats logging a made-up fill.
          outcome = log ? { actionStatus: 'done', undoId: log.id } : { actionStatus: 'failed' };
        }
      } else if (res.status === 401) {
        // Configured deploy, signed out: accounts DO exist here, so "sign in to save" is right.
        outcome = { actionStatus: 'demo' };
      } else {
        outcome = { actionStatus: 'failed' };
      }
      setMessages((m) => m.map((x, j) => (j === i ? { ...x, ...outcome } : x)));
    } catch {
      setMessages((m) => m.map((x, j) => (j === i ? { ...x, actionStatus: 'failed' } : x)));
    }
  };

  /** Reversibility: undo the action via the matching soft-delete endpoint (or local store). */
  const undoAction = async (i: number) => {
    const msg = messages[i];
    if (!msg.action || !msg.undoId) return;
    // Local- ids came from the browser-local twins (Solo/demo mode) - undo there directly.
    if (msg.undoId.startsWith(LOCAL_TRADE_ID_PREFIX)) {
      if (msg.action.type === 'add_watchlist') removeLocalWatchItem(msg.action.symbol);
      else if (msg.action.type === 'add_portfolio') removeLocalHolding(msg.action.symbol);
      else undoLocalTradeLog(msg.undoId);
      setMessages((m) => m.map((x, j) => (j === i ? { ...x, actionStatus: 'undone' } : x)));
      return;
    }
    const endpoint = msg.action.type === 'add_watchlist' ? '/api/watchlist' : msg.action.type === 'add_portfolio' ? '/api/portfolio' : '/api/trades';
    setMessages((m) => m.map((x, j) => (j === i ? { ...x, actionStatus: 'running' } : x)));
    try {
      await fetch(endpoint, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: msg.undoId }) });
      setMessages((m) => m.map((x, j) => (j === i ? { ...x, actionStatus: 'undone' } : x)));
    } catch {
      setMessages((m) => m.map((x, j) => (j === i ? { ...x, actionStatus: 'done' } : x)));
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ground/70 p-3 backdrop-blur-sm sm:items-center"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Lyra copilot chat"
        className="flex h-[78vh] max-h-[680px] w-full max-w-md flex-col overflow-hidden rounded-panel border border-line-strong bg-panel-deep shadow-2xl sm:h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-cell border border-pending/30 bg-blue-tint text-pending">
              <Sparkles size={14} />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink">Ask Lyra</p>
              <p className="text-[10px] text-ink-3">AI copilot · grounded in your dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={newChat}
                aria-label="New chat"
                className="inline-flex items-center gap-1 rounded-cell border border-line px-2 py-1 text-[10px] font-semibold text-pending transition hover:border-pending/40 hover:bg-blue-tint"
              >
                <SquarePen size={11} /> New
              </button>
            )}
            <button ref={closeBtnRef} type="button" onClick={onClose} aria-label="Close" className="ml-1 text-ink-3 transition hover:text-ink">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        {!connected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-pending/25 bg-blue-tint text-pending">
              {checkingRuntime ? <Loader2 size={22} className="animate-spin" /> : <KeyRound size={22} />}
            </span>
            <p className="text-sm font-semibold text-ink">{checkingRuntime ? 'Checking hosted model' : 'Connect a model to chat'}</p>
            <p className="max-w-xs text-[12px] leading-relaxed text-ink-2">
              {checkingRuntime
                ? 'Lyra is checking whether the hosted beta key is available for this deployment.'
                : soloMode
                  ? 'Solo has no hosted model. Add your own provider key in Settings; it stays in this browser and is sent only with your requests.'
                  : ai?.provider === 'openai'
                    ? 'Hosted OpenAI is not configured for this deployment yet. Add your own OpenAI key, or set OPENAI_API_KEY server-side and redeploy.'
                  : 'Lyra runs on a model you choose. Add a free key or your own provider key in Settings. Browser keys stay on this device.'}
            </p>
            <Link
              href="/account/ai"
              onClick={onClose}
              className="mt-1 inline-flex items-center gap-1.5 rounded-cell border border-pending/40 bg-blue-tint px-4 py-2 text-xs font-semibold text-pending transition hover:bg-blue-deep/25"
            >
              <KeyRound size={13} /> Open AI settings
            </Link>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-[12px] leading-relaxed text-ink-2">
                    I can read your holdings, watchlist, live signals, prime setups and catalysts. Pick a topic below or ask your own - I&apos;ll only answer from what&apos;s on your dashboard.
                  </p>

                  {saved.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">Saved</p>
                      {saved.map((q) => (
                        <div key={q} className="flex items-stretch gap-1.5">
                          <button
                            type="button"
                            onClick={() => send(q)}
                            className="flex-1 rounded-cell border border-accent-border/50 bg-accent-tint/60 px-3 py-2 text-left text-[12px] text-ink-title transition hover:border-accent/50"
                          >
                            {q}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSave(q)}
                            aria-label="Unsave prompt"
                            className="grid w-9 shrink-0 place-items-center rounded-cell border border-accent-border/50 bg-accent-tint/60"
                          >
                            <Star size={13} className="fill-accent text-accent" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex flex-nowrap gap-1 overflow-x-auto no-scrollbar">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c.label}
                          type="button"
                          onClick={() => setCategory(c.label)}
                          className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-semibold transition ${
                            category === c.label
                              ? 'border-pending bg-blue-tint text-pending'
                              : 'border-line bg-panel text-ink-2 hover:border-line-hair'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {(CATEGORIES.find((c) => c.label === category) ?? CATEGORIES[0]).questions.map((q) => {
                        const isSaved = saved.includes(q);
                        return (
                          <div key={q} className="flex items-stretch gap-1.5">
                            <button
                              type="button"
                              onClick={() => send(q)}
                              className="flex-1 rounded-cell border border-line bg-panel px-3 py-2 text-left text-[12px] text-ink-title transition hover:border-pending/40 hover:bg-blue-tint"
                            >
                              {q}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSave(q)}
                              aria-label={isSaved ? 'Unsave prompt' : 'Save prompt'}
                              className="grid w-9 shrink-0 place-items-center rounded-cell border border-line bg-panel transition hover:border-pending/40"
                            >
                              <Star size={13} className={isSaved ? 'fill-accent text-accent' : 'text-ink-dim'} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[82%] rounded-panel rounded-br-sm border border-pending/25 bg-blue-tint px-3 py-2 text-[12.5px] leading-relaxed text-ink'
                        : 'max-w-[88%] rounded-panel rounded-bl-sm border border-line bg-panel px-3 py-2 text-[12.5px] leading-relaxed text-ink-title'
                    }
                  >
                    {m.role === 'user' ? m.content : <RichText text={m.content} />}
                    {m.role === 'assistant' && m.action && (
                      <div className="mt-2 rounded-cell border border-pending/30 bg-blue-tint/60 p-2.5">
                        {(m.actionStatus === 'proposed' || m.actionStatus === 'running' || m.actionStatus === 'failed') && (
                          <>
                            <div className="flex items-center gap-1.5">
                              <Plus size={12} className="text-pending" />
                              <span className="text-[11.5px] font-semibold text-ink-title">
                                {ACTION_LABEL[m.action.type]}: {m.action.symbol}
                                {m.action.type === 'log_trade' && m.action.notional ? ` - $${m.action.notional.toLocaleString()}` : ''}
                              </span>
                            </div>
                            {m.action.type === 'add_portfolio' && (
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <label className="text-[9px] uppercase tracking-wide text-ink-dim">Qty</label>
                                <input type="number" min={1} defaultValue={m.qty ?? 10} onChange={(e) => { const v = Math.max(1, Number(e.target.value) || 1); setMessages((mm) => mm.map((x, j) => (j === i ? { ...x, qty: v } : x))); }} className="min-h-[44px] w-16 rounded-cell border border-line-strong bg-panel px-1.5 py-2 font-mono text-[11px] text-ink-title outline-none" />
                                <label className="text-[9px] uppercase tracking-wide text-ink-dim">Buy $</label>
                                <input type="number" min={0} step="0.01" placeholder="price" onChange={(e) => { const v = Number(e.target.value) || 0; setMessages((mm) => mm.map((x, j) => (j === i ? { ...x, price: v } : x))); }} className="min-h-[44px] w-20 rounded-cell border border-line-strong bg-panel px-1.5 py-2 font-mono text-[11px] text-ink-title outline-none" />
                              </div>
                            )}
                            <p className="mt-1 text-[9px] leading-snug text-ink-dim">You confirm; Lyra never acts on its own. Reversible - you can undo it.</p>
                            <button type="button" onClick={() => runAction(i)} disabled={m.actionStatus === 'running'} className="mt-1.5 inline-flex items-center gap-1.5 rounded-cell border border-pending/40 bg-blue-tint px-2.5 py-1 text-[11px] font-semibold text-pending transition hover:bg-blue-deep/25 disabled:opacity-50">
                              {m.actionStatus === 'running' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Confirm
                            </button>
                            {m.actionStatus === 'failed' && <span className="ml-2 text-[10px] text-negative-soft">Didn&apos;t go through - try again.</span>}
                          </>
                        )}
                        {m.actionStatus === 'done' && (
                          <div className="flex items-center gap-1.5">
                            <Check size={12} className="text-positive" />
                            <span className="text-[11.5px] text-positive">
                              {m.action.type === 'log_trade'
                                ? m.undoId?.startsWith(LOCAL_TRADE_ID_PREFIX)
                                  ? // Local rows track holdings but not a cash balance - do not claim cash moved.
                                    `${m.action.symbol} trade logged on this device. Holdings updated.`
                                  : `${m.action.symbol} trade logged. Cash and holdings updated.`
                                : `${m.action.symbol} added to your ${m.action.type === 'add_watchlist' ? 'watchlist' : 'portfolio'}.`}
                            </span>
                            {m.undoId && (
                              <button type="button" onClick={() => undoAction(i)} className="ml-auto inline-flex items-center gap-1 rounded border border-negative/25 bg-negative/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-negative-soft transition hover:bg-negative/15">
                                <Undo2 size={9} /> Undo
                              </button>
                            )}
                          </div>
                        )}
                        {m.actionStatus === 'undone' && (
                          <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
                            <RotateCcw size={11} /> Undone - {m.action.type === 'log_trade' ? `${m.action.symbol} trade reversed.` : `${m.action.symbol} removed.`}
                          </div>
                        )}
                        {m.actionStatus === 'demo' && (
                          <div className="text-[10.5px] leading-snug text-accent">
                            You&apos;re in demo mode - <Link href="/auth/login" className="underline">sign in</Link> to save {m.action.symbol} to your real {m.action.type === 'add_watchlist' ? 'watchlist' : m.action.type === 'add_portfolio' ? 'portfolio' : 'trade log'}.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {status === 'sending' && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-panel rounded-bl-sm border border-line bg-panel px-3 py-2 text-[12px] text-ink-3">
                    <Loader2 size={13} className="animate-spin" /> Lyra is reading your dashboard…
                  </div>
                </div>
              )}
              {status === 'error' && (
                <p className="text-center text-[11px] text-negative-soft">
                  {aiFailureMessage(errorReason ?? 'error')}
                </p>
              )}

              {status === 'idle' && messages.length > 0 && suggestions.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">Ask next</p>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="flex w-full items-center justify-between gap-2 rounded-cell border border-line bg-panel px-3 py-2 text-left text-[12px] text-ink-title transition hover:border-pending/40 hover:bg-blue-tint"
                    >
                      <span>{s}</span>
                      <ArrowUpRight size={13} className="shrink-0 text-ink-dim" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-line px-3 py-2.5">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={1}
                  placeholder="Ask about your book, signals, catalysts…"
                  className="max-h-28 min-h-[44px] flex-1 resize-none rounded-cell border border-line-strong bg-panel px-3 py-2 text-[13px] leading-snug text-ink-title placeholder:text-ink-dim outline-none focus:border-blue-focus/60"
                />
                <button
                  type="button"
                  onClick={() => send(input)}
                  disabled={!input.trim() || status === 'sending'}
                  aria-label="Send"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-cell border border-pending/40 bg-blue-tint text-pending transition hover:bg-blue-deep/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {status === 'sending' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
              <p className="mt-1.5 flex items-center justify-center gap-1 text-[9.5px] text-ink-dim">
                <ShieldCheck size={10} /> AI-generated answers - research, not financial advice. Lyra answers only from your data.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
