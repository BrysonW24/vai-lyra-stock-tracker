'use client';

import { useEffect, useRef, useState } from 'react';
import { GripVertical, LayoutGrid, Plus, RotateCcw, X, type LucideIcon } from 'lucide-react';

/**
 * NavCustomizer - lets the user own their bottom bar. Drag to reorder, remove what they never touch,
 * and add any surface from the section map, placed wherever they want. Pointer-based so it works on
 * touch (the phone is the point) and keyboard-reorderable on the grip for accessibility. It is a
 * controlled editor: every change commits up via onChange; the parent owns persistence.
 */

export interface NavCustomizerItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  bucket: string;
}

export interface NavCustomizerBucket {
  id: string;
  label: string;
  color: string;
}

interface Props {
  items: NavCustomizerItem[];
  buckets: NavCustomizerBucket[];
  value: string[];
  min: number;
  max: number;
  onChange: (hrefs: string[]) => void;
  onReset: () => void;
  isDefault: boolean;
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, moved);
  return next;
}

export function NavCustomizer({ items, buckets, value, min, max, onChange, onReset, isDefault }: Props) {
  const byHref = new Map(items.map((i) => [i.href, i]));
  const colorOf = (href: string) => buckets.find((b) => b.id === byHref.get(href)?.bucket)?.color ?? 'var(--lyra-ink-3)';

  // Local working order for a smooth drag; commits up on drop / add / remove. Resyncs when the parent's
  // committed value changes (e.g. Reset), keyed on the joined string so array-identity churn is ignored.
  const [order, setOrder] = useState<string[]>(value);
  const valueKey = value.join('|');
  useEffect(() => {
    setOrder(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey]);

  const orderRef = useRef(order);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const [draggingHref, setDraggingHref] = useState<string | null>(null);
  const rowEls = useRef<Map<string, HTMLLIElement>>(new Map());

  const atMax = order.length >= max;
  const atMin = order.length <= min;

  // Which slot the pointer is over, by hit-testing row midpoints - robust to gaps and live reordering.
  const indexAtY = (y: number): number => {
    const els = order.map((h) => rowEls.current.get(h)).filter(Boolean) as HTMLLIElement[];
    for (let i = 0; i < els.length; i += 1) {
      const r = els[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return Math.max(0, els.length - 1);
  };

  const commit = (next: string[]) => {
    setOrder(next);
    onChange(next);
  };

  const onHandleDown = (href: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDraggingHref(href);
  };
  const onHandleMove = (href: string) => (e: React.PointerEvent) => {
    if (draggingHref !== href) return;
    const target = indexAtY(e.clientY);
    setOrder((prev) => {
      const cur = prev.indexOf(href);
      if (cur < 0 || cur === target) return prev;
      return moveItem(prev, cur, target);
    });
  };
  const onHandleUp = (href: string) => (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (draggingHref === href) {
      setDraggingHref(null);
      onChange(orderRef.current);
    }
  };
  const onHandleKey = (href: string) => (e: React.KeyboardEvent) => {
    const cur = order.indexOf(href);
    if (cur < 0) return;
    if (e.key === 'ArrowUp' && cur > 0) {
      e.preventDefault();
      commit(moveItem(order, cur, cur - 1));
    } else if (e.key === 'ArrowDown' && cur < order.length - 1) {
      e.preventDefault();
      commit(moveItem(order, cur, cur + 1));
    }
  };

  const remove = (href: string) => {
    if (order.length <= min) return;
    commit(order.filter((h) => h !== href));
  };
  const add = (href: string) => {
    if (order.includes(href) || order.length >= max) return;
    commit([...order, href]);
  };

  const addable = buckets
    .map((b) => ({ bucket: b, list: items.filter((i) => i.bucket === b.id && !order.includes(i.href)) }))
    .filter((g) => g.list.length > 0);

  return (
    <div className="space-y-4">
      {/* Live preview: exactly how the bottom bar will read, Explore always trailing. */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">Preview</p>
        <div className="flex items-stretch gap-0.5 rounded-cell border border-line bg-well p-1">
          {order.map((href) => {
            const it = byHref.get(href);
            if (!it) return null;
            const Icon = it.icon;
            return (
              <div key={href} className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded px-0.5 py-1 text-[9px] text-ink-3">
                <Icon size={16} style={{ color: colorOf(href) }} />
                <span className="max-w-full truncate leading-none">{it.short}</span>
              </div>
            );
          })}
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded px-0.5 py-1 text-[9px] text-ink-dim">
            <LayoutGrid size={16} />
            <span className="leading-none">Explore</span>
          </div>
        </div>
      </div>

      {/* On your bar: the reorderable, removable list. Top -> bottom maps to left -> right on the bar. */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            On your bar - {order.length}/{max}
          </p>
          <button
            type="button"
            onClick={onReset}
            disabled={isDefault}
            className={`flex items-center gap-1 rounded-cell border px-2 py-1 text-[10px] transition ${
              isDefault ? 'border-line text-ink-dim' : 'border-line-strong text-ink-2 hover:text-ink'
            }`}
          >
            <RotateCcw size={11} /> Reset
          </button>
        </div>
        <ul className="space-y-1.5">
          {order.map((href) => {
            const it = byHref.get(href);
            if (!it) return null;
            const Icon = it.icon;
            const dragging = draggingHref === href;
            return (
              <li
                key={href}
                ref={(el) => {
                  if (el) rowEls.current.set(href, el);
                  else rowEls.current.delete(href);
                }}
                className={`flex h-11 items-center gap-2 rounded-cell border px-2 transition ${
                  dragging ? 'border-accent/60 bg-panel shadow-lg ring-1 ring-accent/30' : 'border-line bg-panel-deep'
                }`}
              >
                <button
                  type="button"
                  aria-label={`Reorder ${it.label} - drag, or use arrow keys`}
                  onPointerDown={onHandleDown(href)}
                  onPointerMove={onHandleMove(href)}
                  onPointerUp={onHandleUp(href)}
                  onPointerCancel={onHandleUp(href)}
                  onKeyDown={onHandleKey(href)}
                  style={{ touchAction: 'none' }}
                  className="grid h-8 w-7 shrink-0 cursor-grab place-items-center rounded text-ink-dim transition hover:text-ink-2 active:cursor-grabbing"
                >
                  <GripVertical size={16} />
                </button>
                <Icon size={16} className="shrink-0" style={{ color: colorOf(href) }} />
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink-title">{it.label}</span>
                <button
                  type="button"
                  onClick={() => remove(href)}
                  disabled={atMin}
                  aria-label={`Remove ${it.label} from your bar`}
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded transition ${
                    atMin ? 'text-ink-dim' : 'text-ink-3 hover:text-negative-soft'
                  }`}
                >
                  <X size={15} />
                </button>
              </li>
            );
          })}
        </ul>
        {atMin && <p className="mt-1 text-[10px] text-ink-dim">Keep at least {min} on your bar.</p>}
      </div>

      {/* Add anything from the map, coloured by its job. */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">Add to your bar</p>
        {atMax ? (
          <p className="rounded-cell border border-line bg-panel-deep px-2.5 py-2 text-[11px] text-ink-dim">
            Your bar is full ({max}). Remove one to add another.
          </p>
        ) : (
          <div className="space-y-3">
            {addable.map(({ bucket, list }) => (
              <div key={bucket.id}>
                <div className="mb-1 flex items-center gap-1.5">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: bucket.color }} />
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: bucket.color }}>
                    {bucket.label}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {list.map((it) => {
                    const Icon = it.icon;
                    return (
                      <button
                        key={it.href}
                        type="button"
                        onClick={() => add(it.href)}
                        className="flex items-center gap-2 rounded-cell border border-line bg-panel-deep px-2.5 py-2 text-[12px] text-ink-2 transition hover:border-line-strong hover:bg-panel"
                      >
                        <Icon size={15} className="shrink-0" style={{ color: bucket.color, opacity: 0.9 }} />
                        <span className="min-w-0 flex-1 truncate text-left">{it.label}</span>
                        <Plus size={13} className="shrink-0 text-positive" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
