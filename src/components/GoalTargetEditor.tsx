'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';

/**
 * Inline editor for the user's OWN money goal. Lets them anchor the whole cockpit to a real number
 * ("$50,000") instead of the milestone-ladder default. Posts to /api/account/goal (RLS-scoped) and
 * refreshes the server-rendered cockpit so the progress bar re-anchors immediately.
 */
export function GoalTargetEditor({ currentTarget }: { currentTarget: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentTarget ? String(currentTarget) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (clear: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/account/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAmount: clear ? null : Number(value) }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || 'Could not save.');
        setSaving(false);
        return;
      }
      setSaving(false);
      setOpen(false);
      router.refresh();
    } catch {
      setError('Could not save.');
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#8190a0] transition hover:text-[#dbe5ee]"
      >
        <Pencil size={9} /> {currentTarget ? 'Edit target' : 'Set your target'}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        type="number"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. 50000"
        className="w-28 rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-xs text-[#eef3f8] focus:border-[#3a4c60] focus:outline-none"
      />
      <button
        type="button"
        onClick={() => submit(false)}
        disabled={saving || !value}
        className="rounded border border-[#1f5132] bg-[#0f2417] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#5fd08a] transition hover:brightness-125 disabled:opacity-50"
      >
        {saving ? 'Saving' : 'Save'}
      </button>
      {currentTarget && (
        <button type="button" onClick={() => submit(true)} disabled={saving} className="font-mono text-[10px] text-[#8190a0] transition hover:text-[#f0758a]">
          Clear
        </button>
      )}
      <button type="button" onClick={() => setOpen(false)} disabled={saving} className="font-mono text-[10px] text-[#5e6b78] transition hover:text-[#8190a0]">
        Cancel
      </button>
      {error && <span className="w-full font-mono text-[9px] text-[#f0758a]">{error}</span>}
    </div>
  );
}
