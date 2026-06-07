'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CarouselSlide {
  key: string;
  label: string;
  node: ReactNode;
}

/**
 * Lightweight swipe carousel for a holdings-board panel. Slide 0 is the live
 * chart; later slides are the setup / intelligence dossier for the same ticker.
 *
 * Navigation: tappable labelled pills + prev/next chevrons + horizontal touch
 * swipe. Note: the chart slide is a third-party iframe that captures its own
 * touch events, so swipes that *start on the chart* won't register - the pills
 * and chevrons are the reliable cross-slide control; swipe works on the
 * dossier slides and the surrounding chrome.
 */
export function PanelCarousel({ slides }: { slides: CarouselSlide[] }) {
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const deltaX = useRef(0);

  const last = slides.length - 1;
  const go = (i: number) => setIndex(Math.max(0, Math.min(last, i)));

  function onTouchStart(event: React.TouchEvent) {
    startX.current = event.touches[0]?.clientX ?? null;
    deltaX.current = 0;
  }
  function onTouchMove(event: React.TouchEvent) {
    if (startX.current === null) return;
    deltaX.current = (event.touches[0]?.clientX ?? startX.current) - startX.current;
  }
  function onTouchEnd() {
    if (Math.abs(deltaX.current) > 40) go(index + (deltaX.current < 0 ? 1 : -1));
    startX.current = null;
    deltaX.current = 0;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              onClick={() => go(i)}
              aria-pressed={i === index}
              className={[
                'rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] transition',
                i === index
                  ? 'border-[#f3a33a] bg-[#23180b] text-[#f3a33a]'
                  : 'border-[#263241] bg-[#0d141c] text-[#8190a0] hover:border-[#3a4754] hover:text-[#dbe5ee]',
              ].join(' ')}
            >
              {slide.label}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous panel"
            className="rounded border border-[#263241] bg-[#0d141c] p-1 text-[#a8b5c2] transition enabled:hover:text-[#eef3f8] disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === last}
            aria-label="Next panel"
            className="rounded border border-[#263241] bg-[#0d141c] p-1 text-[#a8b5c2] transition enabled:hover:text-[#eef3f8] disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div
          className="flex items-stretch transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide) => (
            <div key={slide.key} className="w-full shrink-0" aria-hidden={slide.key !== slides[index].key}>
              {slide.node}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
