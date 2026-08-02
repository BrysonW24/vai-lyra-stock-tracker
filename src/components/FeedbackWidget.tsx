'use client';

import { useEffect, useRef, useState } from 'react';
import { containFocus, registerDialog } from '@/lib/focus-trap';
import { MessageSquarePlus, X, Loader2, Check, Lightbulb, ArrowRight } from 'lucide-react';

type Status = 'idle' | 'sending' | 'sent' | 'error';
type FeedbackType = 'idea' | 'bug' | 'other';

interface FeedbackWidgetProps {
  /**
   * Controlled open state. When provided, the widget renders NO launcher of its own -
   * the parent (e.g. the dual launcher) owns opening it. Omit for the standalone
   * floating-button behaviour.
   */
  open?: boolean;
  onClose?: () => void;
}

/**
 * In-app feedback - a quick sheet. One box, one tap, send. Posts to /api/feedback
 * (which files a GitHub issue when configured) so users who have never touched GitHub
 * can still get their ideas onto the board. Renders its own floating launcher when
 * uncontrolled; when the parent passes `open`, it's a pure sheet with no launcher.
 */
export function FeedbackWidget({ open: controlledOpen, onClose }: FeedbackWidgetProps = {}) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const [type, setType] = useState<FeedbackType>('idea');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [botInterest, setBotInterest] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<() => void>(() => {});

  const close = () => {
    if (isControlled) onClose?.();
    else setInternalOpen(false);
    setStatus('idle');
  };
  closeRef.current = close;

  // Same dialog contract as every drawer: focus in + restore, dialog-stack
  // registration, page scroll lock, Esc to close, Tab contained in the sheet.
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    const unregister = sheetRef.current ? registerDialog(sheetRef.current) : undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      containFocus(sheetRef.current, e);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      unregister?.();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [open]);

  const submit = async () => {
    if (!message.trim() || status === 'sending') return;
    setStatus('sending');
    const fullMessage = botInterest ? `${message}\n\n[Also interested in: Trading bot (paper trading)]` : message;
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message: fullMessage, email }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (data.ok) {
        setStatus('sent');
        setMessage('');
        setEmail('');
        setBotInterest(false);
        window.setTimeout(close, 1900);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <>
      {!isControlled && (
        <button
          type="button"
          onClick={() => setInternalOpen(true)}
          aria-label="Send feedback"
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-40 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-ink-title shadow-[0_12px_34px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-accent-border xl:bottom-4"
        >
          <MessageSquarePlus size={15} className="text-accent" /> Feedback
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ground/70 p-3 backdrop-blur-sm sm:items-center"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          onClick={close}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Send feedback"
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-panel-deep shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-semibold text-ink">Suggest a feature or report a bug</p>
              <button ref={closeBtnRef} type="button" onClick={close} aria-label="Close" className="text-ink-3 transition hover:text-ink">
                <X size={16} />
              </button>
            </div>

            {status === 'sent' ? (
              <div className="flex flex-col items-center gap-2 px-4 py-9 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-positive-tint text-positive">
                  <Check size={22} />
                </span>
                <p className="text-sm font-semibold text-ink">Thanks - we got it.</p>
                <p className="text-[11px] text-ink-3">It goes straight onto our board.</p>
              </div>
            ) : (
              <div className="space-y-3 p-4">
                <div className="flex gap-1.5">
                  {(
                    [
                      ['idea', 'Idea'],
                      ['bug', 'Bug'],
                      ['other', 'Other'],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setType(v)}
                      className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition ${
                        type === v
                          ? 'border-[#f3a33a] bg-accent-tint text-accent'
                          : 'border-line-strong bg-panel text-ink-2 hover:border-line-hair'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {type === 'idea' && (
                  <a
                    href="/whats-new?tab=ideas"
                    onClick={close}
                    className="flex items-center justify-between gap-2 rounded-md border border-positive/40 bg-positive-tint px-3 py-2 text-[12px] font-medium text-positive transition hover:bg-positive/15"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Lightbulb size={13} /> Post it on the Ideas board so others can vote
                    </span>
                    <ArrowRight size={13} className="shrink-0" />
                  </a>
                )}

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="What would make this more useful for you?"
                  className="w-full resize-none rounded-md border border-line-strong bg-panel px-3 py-2 text-[13px] leading-snug text-ink-title placeholder:text-ink-dim outline-none focus:border-blue-focus/60"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional - if you'd like a reply)"
                  className="h-9 w-full rounded-md border border-line-strong bg-panel px-3 text-[13px] text-ink-title placeholder:text-ink-dim outline-none focus:border-blue-focus/60"
                />

                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-panel px-3 py-2">
                  <input
                    type="checkbox"
                    checked={botInterest}
                    onChange={(e) => setBotInterest(e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-blue-focus"
                  />
                  <span className="text-[12px] text-ink-title">I&apos;d be interested in a trading bot (paper trading)</span>
                </label>

                {status === 'error' && <p className="text-[11px] text-negative">Something went wrong - please try again.</p>}

                <button
                  type="button"
                  onClick={submit}
                  disabled={!message.trim() || status === 'sending'}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[#f3a33a] bg-accent-tint px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-accent transition hover:bg-accent-tint disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {status === 'sending' ? <Loader2 size={14} className="animate-spin" /> : 'Send feedback'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
