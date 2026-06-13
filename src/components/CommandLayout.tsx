'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { DetailDrawer } from '@/components/DetailDrawer';
import {
  COMMAND_SECTION_LABELS,
  defaultLayout,
  loadCommandLayout,
  saveCommandLayout,
  type CommandLayoutState,
} from '@/lib/command-layout';

export interface CommandSectionNode {
  id: string;
  node: ReactNode;
}

/**
 * Command layout orderer. The server page builds every section node; this renders them
 * in the user's chosen order, skipping hidden ones, and exposes a "Customise" panel to
 * reorder (arrows - reliable on touch) and show/hide sections. Order + hidden set persist
 * per device. The initial state is deterministic (default order, default-hidden) so it
 * matches the server render; saved overrides apply after mount.
 */
export function CommandLayout({ sections }: { sections: CommandSectionNode[] }) {
  const knownIds = useMemo(() => sections.map((s) => s.id), [sections]);
  const byId = useMemo(() => new Map(sections.map((s) => [s.id, s.node])), [sections]);
  const knownKey = knownIds.join(',');

  const [state, setState] = useState<CommandLayoutState>(() => defaultLayout(knownIds));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setState(loadCommandLayout(knownIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownKey]);

  const persist = (next: CommandLayoutState) => {
    setState(next);
    saveCommandLayout(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const next = [...state.order];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    persist({ ...state, order: next });
  };
  const toggleHidden = (id: string) => {
    const hidden = state.hidden.includes(id) ? state.hidden.filter((x) => x !== id) : [...state.hidden, id];
    persist({ ...state, hidden });
  };
  const reset = () => persist(defaultLayout(knownIds));

  const hiddenSet = new Set(state.hidden);

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8190a0] transition hover:border-[#3a4754] hover:text-[#eef3f8]"
        >
          <SlidersHorizontal size={12} /> Customise
        </button>
      </div>

      <div className="space-y-3">
        {state.order.map((id) => (!hiddenSet.has(id) && byId.has(id) ? <div key={id}>{byId.get(id)}</div> : null))}
      </div>

      <DetailDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Customise your command centre"
        subtitle="Reorder or hide sections - saved on this device"
      >
        <div className="space-y-1.5">
          {state.order.map((id, i) => {
            const isHidden = hiddenSet.has(id);
            return (
              <div
                key={id}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-2 transition ${
                  isHidden ? 'border-[#1b2530] bg-[#0b1016]' : 'border-[#263241] bg-[#0d141c]'
                }`}
              >
                <span className="w-4 shrink-0 text-center font-mono text-[10px] text-[#5e6b78]">{i + 1}</span>
                <span className={`min-w-0 flex-1 truncate text-[12px] ${isHidden ? 'text-[#6f7d8a] line-through' : 'text-[#dbe5ee]'}`}>
                  {COMMAND_SECTION_LABELS[id] ?? id}
                </span>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  className="grid h-6 w-6 place-items-center rounded border border-[#263241] text-[#a8b5c2] transition enabled:hover:text-[#eef3f8] disabled:opacity-30"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === state.order.length - 1}
                  aria-label="Move down"
                  className="grid h-6 w-6 place-items-center rounded border border-[#263241] text-[#a8b5c2] transition enabled:hover:text-[#eef3f8] disabled:opacity-30"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleHidden(id)}
                  aria-label={isHidden ? 'Show section' : 'Hide section'}
                  className={`grid h-6 w-6 place-items-center rounded border transition ${
                    isHidden ? 'border-[#263241] text-[#5e6b78] hover:text-[#a8b5c2]' : 'border-[#1d4f3a] text-[#43d18b]'
                  }`}
                >
                  {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={reset}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[#263241] bg-[#0d141c] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8190a0] transition hover:text-[#eef3f8]"
        >
          <RotateCcw size={12} /> Reset to default
        </button>
        <p className="mt-2 font-mono text-[10px] leading-snug text-[#5e6b78]">
          Arrows reorder; the eye hides a section. Saved to this device - reset anytime.
        </p>
      </DetailDrawer>
    </>
  );
}
