'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { X, Send, Loader2, Sparkles, ShieldCheck, KeyRound, SquarePen, ArrowUpRight, Star } from 'lucide-react';
import { loadAi, loadProfile, type AiSettings } from '@/lib/account';
import { loadOnboardingSummary } from '@/lib/onboarding-summary';
import { loadSavedPrompts, toggleSavedPrompt } from '@/lib/saved-prompts';
import type { ChatProfile } from '@/lib/ai/chat-context';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
      <ul key={`u${blocks.length}`} className="list-disc space-y-1 pl-4 marker:text-[#5e6b78]">
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
  const [profile, setProfile] = useState<ChatProfile>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [category, setCategory] = useState<string>(CATEGORIES[0].label);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const scrollRef = useRef<HTMLDivElement>(null);

  const newChat = () => {
    setMessages([]);
    setSuggestions([]);
    setInput('');
    setStatus('idle');
  };

  const toggleSave = (q: string) => setSaved(toggleSavedPrompt(q));

  useEffect(() => {
    if (!open) return;
    setAi(loadAi());
    setSaved(loadSavedPrompts());
    const acct = loadProfile();
    const summary = loadOnboardingSummary();
    setProfile({
      displayName: acct.displayName || undefined,
      experienceLevel: summary?.experienceLevel,
      tradedBefore: summary?.tradedBefore,
      riskComfort: summary?.riskComfort,
    });
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  // Connected when the user has a key, or the free open model is backed by a shared server-side
  // Google key (NEXT_PUBLIC_LYRA_FREE_AI === '1' tells the client that env is configured).
  const connected =
    ai != null &&
    (!!ai.apiKey?.trim() || (ai.provider === 'google' && process.env.NEXT_PUBLIC_LYRA_FREE_AI === '1'));

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || status === 'sending' || !ai || !connected) return;
    const next = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(next);
    setInput('');
    setSuggestions([]);
    setStatus('sending');
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, ai, profile }),
      });
      const data = (await res.json()) as { ok?: boolean; text?: string; reason?: string; suggestions?: string[] };
      if (data.ok && data.text) {
        setMessages((m) => [...m, { role: 'assistant', content: data.text as string }]);
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : []);
        setStatus('idle');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex h-[78vh] max-h-[680px] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl sm:h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#8aa2ff]/30 bg-[#101a2e] text-[#8aa2ff]">
              <Sparkles size={14} />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-[#eef3f8]">Ask Lyra</p>
              <p className="text-[10px] text-[#7f8b98]">Grounded in your dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={newChat}
                aria-label="New chat"
                className="inline-flex items-center gap-1 rounded-md border border-[#1d2733] px-2 py-1 text-[10px] font-semibold text-[#8aa2ff] transition hover:border-[#8aa2ff]/40 hover:bg-[#101a2e]"
              >
                <SquarePen size={11} /> New
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close" className="ml-1 text-[#8190a0] transition hover:text-[#eef3f8]">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        {!connected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-[#8aa2ff]/25 bg-[#101a2e] text-[#8aa2ff]">
              <KeyRound size={22} />
            </span>
            <p className="text-sm font-semibold text-[#eef3f8]">Connect a model to chat</p>
            <p className="max-w-xs text-[12px] leading-relaxed text-[#a8b5c2]">
              Lyra runs on a model you choose. Add a free key (Google AI Studio, ~10s, no card needed) - or your own key for a more powerful model. It stays in this browser.
            </p>
            <Link
              href="/account#ai-settings"
              onClick={onClose}
              className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-[#8aa2ff]/40 bg-[#101a2e] px-4 py-2 text-xs font-semibold text-[#8aa2ff] transition hover:bg-[#13203a]"
            >
              <KeyRound size={13} /> Connect a model
            </Link>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-[12px] leading-relaxed text-[#a8b5c2]">
                    I can read your holdings, watchlist, live signals, prime setups and catalysts. Pick a topic below or ask your own - I&apos;ll only answer from what&apos;s on your dashboard.
                  </p>

                  {saved.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5e6b78]">Saved</p>
                      {saved.map((q) => (
                        <div key={q} className="flex items-stretch gap-1.5">
                          <button
                            type="button"
                            onClick={() => send(q)}
                            className="flex-1 rounded-lg border border-[#3a2a10] bg-[#140f06] px-3 py-2 text-left text-[12px] text-[#cdd8e3] transition hover:border-[#f3a33a]/50"
                          >
                            {q}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSave(q)}
                            aria-label="Unsave prompt"
                            className="grid w-9 shrink-0 place-items-center rounded-lg border border-[#3a2a10] bg-[#140f06]"
                          >
                            <Star size={13} className="fill-[#f3a33a] text-[#f3a33a]" />
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
                              ? 'border-[#8aa2ff] bg-[#101a2e] text-[#8aa2ff]'
                              : 'border-[#1d2733] bg-[#0d141c] text-[#a8b5c2] hover:border-[#3a4754]'
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
                              className="flex-1 rounded-lg border border-[#1d2733] bg-[#0d141c] px-3 py-2 text-left text-[12px] text-[#cdd8e3] transition hover:border-[#8aa2ff]/40 hover:bg-[#101a2e]"
                            >
                              {q}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSave(q)}
                              aria-label={isSaved ? 'Unsave prompt' : 'Save prompt'}
                              className="grid w-9 shrink-0 place-items-center rounded-lg border border-[#1d2733] bg-[#0d141c] transition hover:border-[#8aa2ff]/40"
                            >
                              <Star size={13} className={isSaved ? 'fill-[#f3a33a] text-[#f3a33a]' : 'text-[#5e6b78]'} />
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
                        ? 'max-w-[82%] rounded-2xl rounded-br-sm border border-[#8aa2ff]/25 bg-[#101a2e] px-3 py-2 text-[12.5px] leading-relaxed text-[#eef3f8]'
                        : 'max-w-[88%] rounded-2xl rounded-bl-sm border border-[#1d2733] bg-[#0d141c] px-3 py-2 text-[12.5px] leading-relaxed text-[#dbe5ee]'
                    }
                  >
                    {m.role === 'user' ? m.content : <RichText text={m.content} />}
                  </div>
                </div>
              ))}

              {status === 'sending' && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm border border-[#1d2733] bg-[#0d141c] px-3 py-2 text-[12px] text-[#7f8b98]">
                    <Loader2 size={13} className="animate-spin" /> Lyra is reading your dashboard…
                  </div>
                </div>
              )}
              {status === 'error' && (
                <p className="text-center text-[11px] text-[#ff8a8a]">That didn&apos;t go through - check your key in settings and try again.</p>
              )}

              {status === 'idle' && messages.length > 0 && suggestions.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5e6b78]">Ask next</p>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#1d2733] bg-[#0d141c] px-3 py-2 text-left text-[12px] text-[#cdd8e3] transition hover:border-[#8aa2ff]/40 hover:bg-[#101a2e]"
                    >
                      <span>{s}</span>
                      <ArrowUpRight size={13} className="shrink-0 text-[#5e6b78]" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-white/10 px-3 py-2.5">
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
                  className="max-h-28 min-h-[38px] flex-1 resize-none rounded-xl border border-[#263241] bg-[#0d141c] px-3 py-2 text-[13px] leading-snug text-[#dbe5ee] placeholder:text-[#5d6b79] outline-none focus:border-[#8aa2ff]/50"
                />
                <button
                  type="button"
                  onClick={() => send(input)}
                  disabled={!input.trim() || status === 'sending'}
                  aria-label="Send"
                  className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl border border-[#8aa2ff]/40 bg-[#101a2e] text-[#8aa2ff] transition hover:bg-[#13203a] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {status === 'sending' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
              <p className="mt-1.5 flex items-center justify-center gap-1 text-[9.5px] text-[#5e6b78]">
                <ShieldCheck size={10} /> Research, not financial advice. Lyra answers only from your data.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
