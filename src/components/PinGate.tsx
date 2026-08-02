'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { UNLOCK_FLAG, clearAllLocalData, hashPin, loadLock } from '@/lib/account';

/**
 * Optional local lock. If the user enabled a PIN in Account settings, this overlays
 * the app until the correct PIN is entered. It is a convenience lock for this browser
 * only - there is always a reset escape so no one is ever permanently locked out.
 *
 * Renders nothing until mounted (avoids any SSR flash) and stays unlocked for the
 * rest of the browser session once the PIN is accepted.
 */
export function PinGate() {
  const [mounted, setMounted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const lock = loadLock();
    const alreadyUnlocked = window.sessionStorage.getItem(UNLOCK_FLAG) === '1';
    if (lock.enabled && lock.pinHash && !alreadyUnlocked) {
      setPinHash(lock.pinHash);
      setLocked(true);
    }
  }, []);

  async function attempt() {
    setError(null);
    const candidate = await hashPin(entry);
    if (candidate === pinHash) {
      window.sessionStorage.setItem(UNLOCK_FLAG, '1');
      setLocked(false);
      setEntry('');
    } else {
      setError('Incorrect PIN.');
      setEntry('');
    }
  }

  function resetLock() {
    if (!window.confirm('Reset Lyra on this device? This clears your local data (including the PIN) so you can get back in. It cannot be undone.')) return;
    clearAllLocalData();
    setLocked(false);
  }

  if (!mounted || !locked) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-ground/95 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-panel border border-line-strong bg-panel-deep p-6 text-center shadow-2xl">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-line-strong bg-panel text-accent">
          <Lock size={20} />
        </span>
        <h1 className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-ink-title">Lyra is locked</h1>
        <p className="mt-1 text-xs text-ink-3">Enter your PIN to continue on this device.</p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void attempt();
          }}
          className="mt-4 space-y-3"
        >
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={entry}
            onChange={(event) => setEntry(event.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            className="w-full rounded-cell border border-line-strong bg-well px-3 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-ink outline-none focus:border-blue-focus/60 focus:ring-1 focus:ring-blue-focus/30"
            aria-label="PIN"
          />
          {error && <p className="text-xs text-negative">{error}</p>}
          <button
            type="submit"
            disabled={entry.length < 4}
            className="w-full rounded-cell border border-accent-border bg-accent-tint px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-accent transition hover:brightness-110 disabled:opacity-40"
          >
            Unlock
          </button>
        </form>

        <button type="button" onClick={resetLock} className="mt-4 text-[11px] text-ink-dim underline-offset-2 hover:text-ink-2 hover:underline">
          Forgot PIN? Reset this device
        </button>
      </div>
    </div>
  );
}
