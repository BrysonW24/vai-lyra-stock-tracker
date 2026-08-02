'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, MessageSquarePlus, ChevronRight } from 'lucide-react';
import { ChatWidget } from './chat/ChatWidget';
import { FeedbackWidget } from './FeedbackWidget';

type Slot = 'chat' | 'feedback';

const SLOTS: { id: Slot; label: string; icon: typeof Sparkles; accent: string; ring: string; bg: string }[] = [
  { id: 'chat', label: 'Ask Lyra', icon: Sparkles, accent: 'text-pending', ring: 'hover:border-pending/45', bg: 'bg-blue-tint' },
  { id: 'feedback', label: 'Feedback', icon: MessageSquarePlus, accent: 'text-accent', ring: 'hover:border-accent/45', bg: 'bg-accent-tint' },
];

/**
 * Dual launcher - one floating control carrying two actions (Ask Lyra + Feedback) on a
 * little carousel. Swipe the pill (or tap the dots / the swap chevron) to bring the other
 * action forward; tap the pill to open it. Owns the open state for both sheets so only one
 * floating control sits in the corner. Replaces the standalone feedback button.
 */
export function DualLauncher() {
  const [active, setActive] = useState<Slot>('chat');
  const [chatOpen, setChatOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const touchX = useRef<number | null>(null);

  const flip = () => setActive((a) => (a === 'chat' ? 'feedback' : 'chat'));
  const open = () => (active === 'chat' ? setChatOpen(true) : setFeedbackOpen(true));

  // Gentle periodic nudge: every 30s bring Feedback forward for 2s, then slide back to Ask Lyra -
  // a quiet reminder that this control also takes feedback. Never hijacks an open sheet, and stays
  // still for anyone who prefers reduced motion.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const CYCLE_MS = 30_000;
    const DWELL_MS = 2_000;
    let dwell: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      if (chatOpen || feedbackOpen) return;
      setActive('feedback');
      dwell = setTimeout(() => setActive((a) => (a === 'feedback' ? 'chat' : a)), DWELL_MS);
    }, CYCLE_MS);
    return () => {
      clearInterval(id);
      if (dwell) clearTimeout(dwell);
    };
  }, [chatOpen, feedbackOpen]);

  const slot = SLOTS.find((s) => s.id === active)!;
  const Icon = slot.icon;

  return (
    <>
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-40 flex flex-col items-center gap-1.5 xl:bottom-4">
        {/* position dots */}
        <div className="flex items-center gap-1.5">
          {SLOTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              aria-label={`Show ${s.label}`}
              className={`h-1.5 rounded-full transition-all ${active === s.id ? `w-4 ${s.id === 'chat' ? 'bg-pending' : 'bg-accent'}` : 'w-1.5 bg-line-hair'}`}
            />
          ))}
        </div>

        {/* the carousel pill */}
        <div
          className="overflow-hidden rounded-full"
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 28) flip();
            touchX.current = null;
          }}
        >
          <div
            key={active}
            className="flex items-center gap-0.5 rounded-full border border-line bg-chrome/80 pl-0.5 pr-1 shadow-[0_12px_34px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl"
            style={{ animation: 'tableRowSlide 220ms ease-out' }}
          >
            <button
              type="button"
              onClick={open}
              aria-label={`Open ${slot.label}`}
              className={`inline-flex items-center gap-1.5 rounded-full ${slot.bg} px-3 py-2 text-xs font-semibold text-ink-title transition border border-transparent ${slot.ring}`}
            >
              <Icon size={15} className={slot.accent} /> {slot.label}
            </button>
            <button
              type="button"
              onClick={flip}
              aria-label="Switch action"
              className="grid h-7 w-6 place-items-center rounded-full text-ink-dim transition hover:text-ink-title"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <ChatWidget open={chatOpen} onClose={() => setChatOpen(false)} />
      <FeedbackWidget open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
