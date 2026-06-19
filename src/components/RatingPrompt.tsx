'use client';

import { useEffect, useState } from 'react';

/**
 * Two-week rating prompt - "Has Lyra helped you trade?" -> 5 stars + an optional line.
 *
 * Shows once a user has had the app for ~2 weeks (the window where there is enough lived experience
 * to answer honestly), never on day one. State lives in localStorage so it is per-device and needs no
 * table: first_seen is stamped on first mount, "Maybe later" snoozes a week, a submitted rating (or
 * dismiss) retires it for good. The rating is sent through the existing /api/feedback intake (lands as
 * a GitHub issue), so there is no new backend. Preview any time with ?rate=now in the URL.
 */

const KEY_FIRST_SEEN = 'lyra_first_seen';
const KEY_STATE = 'lyra_rating_state'; // 'done' once rated/dismissed
const KEY_SNOOZE = 'lyra_rating_snooze'; // ISO date to wait until
const RATING_AFTER_DAYS = 14;
const SNOOZE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function shouldShow(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.search.includes('rate=now')) return true; // preview hook
  try {
    if (localStorage.getItem(KEY_STATE) === 'done') return false;
    const snooze = localStorage.getItem(KEY_SNOOZE);
    if (snooze && Date.now() < new Date(snooze).getTime()) return false;
    let firstSeen = localStorage.getItem(KEY_FIRST_SEEN);
    if (!firstSeen) {
      firstSeen = new Date().toISOString();
      localStorage.setItem(KEY_FIRST_SEEN, firstSeen);
    }
    return Date.now() - new Date(firstSeen).getTime() >= RATING_AFTER_DAYS * DAY_MS;
  } catch {
    return false;
  }
}

export function RatingPrompt() {
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setOpen(shouldShow());
  }, []);

  if (!open) return null;

  const retire = () => {
    try {
      localStorage.setItem(KEY_STATE, 'done');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const snooze = () => {
    try {
      localStorage.setItem(KEY_SNOOZE, new Date(Date.now() + SNOOZE_DAYS * DAY_MS).toISOString());
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const submit = async () => {
    if (stars === 0) return;
    setSent(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'other',
          message: `2-week rating: ${stars}/5 stars.${comment.trim() ? ` ${comment.trim()}` : ''}`,
        }),
      });
    } catch {
      /* best-effort - retire either way so we never nag a user who tried to rate */
    }
    setTimeout(retire, 1100);
  };

  const active = hover || stars;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-sm rounded-xl border border-[#263241] bg-[#0b1118] p-3 shadow-2xl xl:left-auto xl:right-4 xl:mx-0">
      {sent ? (
        <p className="py-2 text-center text-[12px] text-[#43d18b]">Thank you - that helps shape what we build next.</p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[#eef3f8]">Has Lyra helped you trade?</p>
              <p className="mt-0.5 text-[11px] leading-snug text-[#8190a0]">You have used it for a couple of weeks - how is it going?</p>
            </div>
            <button type="button" onClick={snooze} aria-label="Dismiss" className="shrink-0 rounded px-1.5 text-[14px] leading-none text-[#5d6b79] hover:text-[#a8b5c2]">
              x
            </button>
          </div>

          <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStars(n)}
                onMouseEnter={() => setHover(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                className={`text-[22px] leading-none transition ${n <= active ? 'text-[#f3a33a]' : 'text-[#39424d] hover:text-[#5d6b79]'}`}
              >
                {n <= active ? '★' : '☆'}
              </button>
            ))}
          </div>

          {stars > 0 && (
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={200}
              placeholder={stars >= 4 ? 'What is working? (optional)' : 'What would make it better? (optional)'}
              className="mt-2 h-8 w-full rounded-md border border-[#263241] bg-[#0d141c] px-2.5 text-[12px] text-[#dbe5ee] placeholder:text-[#5d6b79] outline-none focus:border-[#f3a33a]/50"
            />
          )}

          <div className="mt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={snooze} className="rounded-md px-2.5 py-1 text-[11px] text-[#8190a0] hover:text-[#a8b5c2]">
              Maybe later
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={stars === 0}
              className="rounded-md bg-gradient-to-r from-[#3b5bdb] to-[#43d18b] px-3 py-1 text-[11px] font-semibold text-[#07090c] disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}
