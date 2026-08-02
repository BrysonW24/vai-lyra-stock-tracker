'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { containFocus, registerDialog } from '@/lib/focus-trap';

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
}

/**
 * Reusable right-slide explainer drawer. Right-anchored on desktop, full-screen sheet on
 * mobile; scrollable body, sticky header, slides in, closes on backdrop click or Esc. The
 * shared shell behind the calendar / signal / smart-money explainers (mirrors IpoDrawer).
 */
export function DetailDrawer({ open, onClose, title, subtitle, badge, children }: DetailDrawerProps) {
  const [shown, setShown] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  // Portal to <body> so the fixed overlay escapes any ancestor with a
  // backdrop-filter / transform (e.g. .terminal-panel), which would otherwise
  // become the containing block for `position: fixed` and trap the drawer
  // inside the panel - mislaying it and making the close button unclickable.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const id = requestAnimationFrame(() => setShown(true));
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      containFocus(asideRef.current, e);
    }
    document.addEventListener('keydown', onKey);
    // Lock the page behind the drawer: without this, reaching the end of the drawer's
    // scroll chains into scrolling the page underneath (worst on mobile touch).
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus in so Esc/tab act on the dialog, and return it on close.
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const unregister = asideRef.current ? registerDialog(asideRef.current) : undefined;
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      unregister?.();
      previousFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col overflow-y-auto border-l border-line bg-chrome shadow-2xl transition-transform duration-300 ${
          shown ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ paddingRight: 'env(safe-area-inset-right)' }}
      >
        <div
          className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-line bg-chrome/95 px-4 py-3 backdrop-blur"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <div className="min-w-0">
            {badge}
            <p className="truncate text-sm font-semibold text-ink">{title}</p>
            {subtitle && <p className="mt-0.5 truncate font-mono text-[11px] text-ink-3">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            type="button"
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded border border-line-strong text-ink-3 transition hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>
        {/* Bottom padding clears the iOS home indicator (same pattern as AppShell). */}
        <div className="space-y-4 px-4 py-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {children}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
