'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Mail, Send } from 'lucide-react';
import { MAX_HOLDINGS, SUBSCRIBE_TOPICS, normaliseHoldings, type SubscribeChannel, type SubscribeTopic } from '@/lib/subscribe';

interface SubscribeFormProps {
  telegram: boolean;
  email: boolean;
}

type Stage =
  | { kind: 'form' }
  | { kind: 'telegram'; token: string; url: string; status: 'pending' | 'active' | 'unsubscribed' }
  | { kind: 'email' };

interface SubscribeResponse {
  ok: boolean;
  error?: string;
  channel?: SubscribeChannel;
  status?: string;
  token?: string;
  telegramUrl?: string;
}

const POLL_MS = 3_000;
const POLL_LIMIT_MS = 15 * 60_000;

const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5A6B82]';
const inputClass =
  'w-full rounded-xl border border-[#0E1E3A]/15 bg-white/80 px-4 py-3 text-sm text-[#0E1E3A] placeholder:text-[#9AA6B6] outline-none transition focus:border-[#1E63FF] focus:ring-2 focus:ring-[#1E63FF]/20';
const chipBase = 'rounded-full border px-3 py-1.5 text-xs font-medium transition';
const chipOn = `${chipBase} border-[#1E63FF] bg-[#1E63FF] text-white shadow-[0_6px_16px_-8px_rgba(30,99,255,0.8)]`;
const chipOff = `${chipBase} border-[#0E1E3A]/15 bg-white/70 text-[#0E1E3A] hover:border-[#1E63FF]/50`;
const channelBase = 'flex flex-1 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition';
const channelOn = `${channelBase} border-[#1E63FF] bg-[#1E63FF]/8 text-[#0E1E3A]`;
const channelOff = `${channelBase} border-[#0E1E3A]/15 bg-white/70 text-[#5A6B82] hover:border-[#1E63FF]/40`;
const ctaClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#3b5bdb] via-[#43d18b] to-[#f3a33a] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#07090c] shadow-[0_12px_30px_-10px_rgba(67,209,139,0.6)] transition hover:brightness-110 disabled:opacity-50';

/**
 * Three questions, one button. No account, no password: the API answers with either a Telegram
 * deep link (the bot learns the chat itself when they tap Start) or "check your inbox".
 */
export function SubscribeForm({ telegram, email }: SubscribeFormProps) {
  const [channel, setChannel] = useState<SubscribeChannel>(telegram ? 'telegram' : 'email');
  const [holdingsText, setHoldingsText] = useState('');
  const [topics, setTopics] = useState<SubscribeTopic[]>([]);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'form' });
  const pollStartedAt = useRef<number>(0);

  const holdings = normaliseHoldings(holdingsText);
  const available = telegram || email;

  function toggleTopic(id: SubscribeTopic) {
    setTopics((current) => {
      if (current.includes(id)) return current.filter((topic) => topic !== id);
      // "Just my holdings" is a mode of its own: it stands alone, and picking a topic leaves it.
      if (id === 'holdings') return ['holdings'];
      return [...current.filter((topic) => topic !== 'holdings'), id];
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (topics.includes('holdings') && holdings.length === 0) {
      setError('"Just my holdings" needs at least one holding - add a ticker or pick a topic.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel, email: address.trim(), topics, holdings, source: 'subscribe-page' }),
      });
      const data = (await response.json()) as SubscribeResponse;
      if (!response.ok || !data.ok) {
        setError(data.error || 'Could not subscribe just now - try again shortly.');
        return;
      }
      if (data.channel === 'telegram' && data.token && data.telegramUrl) {
        pollStartedAt.current = Date.now();
        setStage({ kind: 'telegram', token: data.token, url: data.telegramUrl, status: 'pending' });
      } else {
        setStage({ kind: 'email' });
      }
    } catch {
      setError('Could not reach Lyra - check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  // After the Telegram button: ask every few seconds whether the bot has heard /start from them.
  useEffect(() => {
    if (stage.kind !== 'telegram' || stage.status !== 'pending') return;
    const token = stage.token;
    const timer = setInterval(async () => {
      if (Date.now() - pollStartedAt.current > POLL_LIMIT_MS) {
        clearInterval(timer);
        return;
      }
      try {
        const response = await fetch(`/api/subscribe?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const data = (await response.json()) as { ok: boolean; status?: Stage extends { status: infer S } ? S : never };
        if (data.ok && data.status === 'active') {
          setStage((current) => (current.kind === 'telegram' ? { ...current, status: 'active' } : current));
        }
      } catch {
        // A missed poll is not an error - the next one asks again.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [stage]);

  if (stage.kind === 'telegram' && stage.status === 'active') {
    return (
      <div className="rounded-2xl border border-[#43d18b]/40 bg-[#43d18b]/10 p-5">
        <p className="flex items-center gap-2 text-base font-semibold text-[#0E1E3A]">
          <Check size={18} className="text-[#1a9b62]" /> You&apos;re in.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[#5A6B82]">
          The first briefing arrives in Telegram around 8pm Sydney on the next weekday evening. Reply STOP to the bot any time to end it.
        </p>
      </div>
    );
  }

  if (stage.kind === 'telegram') {
    return (
      <div className="space-y-4 rounded-2xl border border-[#1E63FF]/25 bg-white/70 p-5">
        <p className="text-base font-semibold text-[#0E1E3A]">One tap left: open Telegram and press Start.</p>
        <p className="text-sm leading-relaxed text-[#5A6B82]">
          The button opens Lyra&apos;s bot. Pressing Start tells it which chat is yours - you never have to find or type a chat ID.
        </p>
        <a href={stage.url} target="_blank" rel="noopener noreferrer" className={ctaClass}>
          <Send size={16} /> Open Telegram
        </a>
        <p className="flex items-center gap-2 text-xs text-[#5A6B82]" aria-live="polite">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#1E63FF]" /> Waiting for Start... this page updates by itself.
        </p>
      </div>
    );
  }

  if (stage.kind === 'email') {
    return (
      <div className="rounded-2xl border border-[#1E63FF]/25 bg-white/70 p-5">
        <p className="flex items-center gap-2 text-base font-semibold text-[#0E1E3A]">
          <Mail size={18} className="text-[#1E63FF]" /> Check your inbox.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[#5A6B82]">
          We sent a confirmation link to {address.trim()}. Nothing is sent until you open it; every briefing after that carries an unsubscribe link.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6" aria-describedby="subscribe-note">
      <div className="space-y-2">
        <label htmlFor="holdings" className={labelClass}>
          1 · What do you hold? <span className="font-normal normal-case tracking-normal text-[#9AA6B6]">(optional)</span>
        </label>
        <input
          id="holdings"
          className={inputClass}
          value={holdingsText}
          onChange={(event) => setHoldingsText(event.target.value)}
          placeholder="NVDA, QQQ, CRWD"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <p className="text-xs text-[#5A6B82]">
          {holdings.length ? `Flagged first: ${holdings.join(', ')}` : `Tickers, separated by commas - up to ${MAX_HOLDINGS}. Items that touch them come first.`}
        </p>
      </div>

      <div className="space-y-2">
        <p className={labelClass}>2 · What do you want to hear about?</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Topics">
          {SUBSCRIBE_TOPICS.map((topic) => {
            const on = topics.includes(topic.id);
            return (
              <button key={topic.id} type="button" aria-pressed={on} onClick={() => toggleTopic(topic.id)} className={on ? chipOn : chipOff} title={topic.blurb}>
                {topic.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[#5A6B82]">
          {topics.length === 0
            ? 'Nothing picked = everything, in the order it happened.'
            : SUBSCRIBE_TOPICS.filter((topic) => topics.includes(topic.id))
                .map((topic) => topic.blurb)
                .join(' · ')}
        </p>
      </div>

      <div className="space-y-2">
        <p className={labelClass}>3 · Where should it go?</p>
        <div className="flex gap-2" role="radiogroup" aria-label="Channel">
          {telegram && (
            <button type="button" role="radio" aria-checked={channel === 'telegram'} onClick={() => setChannel('telegram')} className={channel === 'telegram' ? channelOn : channelOff}>
              <Send size={15} /> Telegram
            </button>
          )}
          {email && (
            <button type="button" role="radio" aria-checked={channel === 'email'} onClick={() => setChannel('email')} className={channel === 'email' ? channelOn : channelOff}>
              <Mail size={15} /> Email
            </button>
          )}
        </div>
        {channel === 'email' && email && (
          <input
            id="email"
            type="email"
            className={inputClass}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            aria-label="Email address"
          />
        )}
        {channel === 'telegram' && telegram && <p className="text-xs text-[#5A6B82]">Next you&apos;ll tap one button to open Lyra&apos;s bot - no chat ID, no code.</p>}
      </div>

      {error && (
        <p className="rounded-xl border border-[#f3a33a]/50 bg-[#f3a33a]/10 px-4 py-3 text-sm text-[#8a5a10]" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className={ctaClass} disabled={busy || !available}>
        {busy ? 'One moment...' : channel === 'telegram' ? 'Continue to Telegram' : 'Send me the briefing'} <ArrowRight size={16} />
      </button>
      {!available && <p className="text-xs text-[#8a5a10]">Subscriptions are not switched on in this environment yet.</p>}
      <p id="subscribe-note" className="text-xs leading-relaxed text-[#9AA6B6]">
        Around 8pm Sydney, Tuesday to Saturday. Every item is checked against the source it links to. Research, not advice - Lyra never recommends. Stop any time: reply STOP in Telegram or use the link in any email.
      </p>
    </form>
  );
}
