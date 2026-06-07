'use client';

import { useState } from 'react';
import { MessageSquarePlus, X, Loader2, Check } from 'lucide-react';

type Status = 'idle' | 'sending' | 'sent' | 'error';
type FeedbackType = 'idea' | 'bug' | 'other';

/**
 * In-app feedback - a floating launcher + a quick sheet. One box, one tap, send.
 * Posts to /api/feedback (which files a GitHub issue when configured) so users who
 * have never touched GitHub can still get their ideas onto the board.
 */
export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('idea');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const close = () => {
    setOpen(false);
    setStatus('idle');
  };

  const submit = async () => {
    if (!message.trim() || status === 'sending') return;
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message, email }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (data.ok) {
        setStatus('sent');
        setMessage('');
        setEmail('');
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="fixed bottom-20 right-3 z-40 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-[#dbe5ee] shadow-[0_12px_34px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#f3a33a]/40 xl:bottom-4"
      >
        <MessageSquarePlus size={15} className="text-[#f3a33a]" /> Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center"
          onClick={close}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-semibold text-[#eef3f8]">Suggest a feature or report a bug</p>
              <button type="button" onClick={close} aria-label="Close" className="text-[#8190a0] transition hover:text-[#eef3f8]">
                <X size={16} />
              </button>
            </div>

            {status === 'sent' ? (
              <div className="flex flex-col items-center gap-2 px-4 py-9 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#0d251b] text-[#43d18b]">
                  <Check size={22} />
                </span>
                <p className="text-sm font-semibold text-[#eef3f8]">Thanks - we got it.</p>
                <p className="text-[11px] text-[#8190a0]">It goes straight onto our board.</p>
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
                          ? 'border-[#f3a33a] bg-[#23180b] text-[#f3a33a]'
                          : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:border-[#3a4754]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="What would make this more useful for you?"
                  className="w-full resize-none rounded-md border border-[#263241] bg-[#0d141c] px-3 py-2 text-[13px] leading-snug text-[#dbe5ee] placeholder:text-[#5d6b79] outline-none focus:border-[#f3a33a]/50"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional - if you'd like a reply)"
                  className="h-9 w-full rounded-md border border-[#263241] bg-[#0d141c] px-3 text-[13px] text-[#dbe5ee] placeholder:text-[#5d6b79] outline-none focus:border-[#f3a33a]/50"
                />

                {status === 'error' && <p className="text-[11px] text-[#ff6b6b]">Something went wrong - please try again.</p>}

                <button
                  type="button"
                  onClick={submit}
                  disabled={!message.trim() || status === 'sending'}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[#f3a33a] bg-[#23180b] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-[#f3a33a] transition hover:bg-[#2a1f0f] disabled:cursor-not-allowed disabled:opacity-50"
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
