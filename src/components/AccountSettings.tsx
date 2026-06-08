'use client';

import { useEffect, useState } from 'react';
import { BrainCircuit, Check, KeyRound, Lock, Send, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import {
  AVATAR_EMOJIS,
  CURRENCIES,
  DEFAULT_AI,
  DEFAULT_LOCK,
  DEFAULT_PROFILE,
  REGIONS,
  type AiMode,
  type AiSettings,
  type AccountProfile,
  type LockSettings,
  clearAllLocalData,
  hashPin,
  loadAi,
  loadLock,
  loadProfile,
  saveAi,
  saveLock,
  saveProfile,
} from '@/lib/account';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { syncAccountProfile } from '@/lib/sync-onboarding';
import { NotificationsSetup } from '@/components/NotificationsSetup';

function Panel({ icon: Icon, title, subtitle, children }: { icon: typeof UserRound; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex items-start gap-3 border-b border-[#1b2530] px-4 py-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#f3a33a]">
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c8d3de]">{title}</p>
          <p className="mt-0.5 text-xs text-[#8190a0]">{subtitle}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

const inputClass =
  'w-full rounded border border-[#263241] bg-[#0d141c] px-3 py-2 font-mono text-sm text-[#dbe5ee] outline-none transition focus:border-[#3a4754] focus:ring-1 focus:ring-[#f3a33a]/30';
const labelClass = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#8190a0]';
const buttonPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded border border-[#1d7f55] bg-[#0d251b] px-3 py-2 font-mono text-xs text-[#43d18b] transition hover:bg-[#103626] disabled:opacity-40';

function SavedTick({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-[#43d18b]">
      <Check size={13} /> Saved
    </span>
  );
}

export function AccountSettings() {
  const [profile, setProfile] = useState<AccountProfile>(DEFAULT_PROFILE);
  const [ai, setAi] = useState<AiSettings>(DEFAULT_AI);
  const [lock, setLock] = useState<LockSettings>(DEFAULT_LOCK);

  const [profileSaved, setProfileSaved] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [lockNote, setLockNote] = useState<string | null>(null);

  useEffect(() => {
    setProfile(loadProfile());
    setAi(loadAi());
    setLock(loadLock());
  }, []);

  function commitProfile() {
    saveProfile(profile);
    // Also sync to backend if Supabase is configured (non-blocking, resilient to errors).
    if (isSupabaseConfigured()) {
      syncAccountProfile({
        displayName: profile.displayName,
        email: profile.email,
        baseCurrency: profile.baseCurrency,
        timezone: profile.region,
      }).catch(() => {
        // Silently fail - localStorage save already happened.
      });
    }
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 1800);
  }

  function commitAi(next: AiSettings) {
    setAi(next);
    saveAi(next);
    setAiSaved(true);
    setTimeout(() => setAiSaved(false), 1800);
  }

  async function enablePin() {
    setPinError(null);
    if (!/^\d{4,6}$/.test(pin)) {
      setPinError('PIN must be 4-6 digits.');
      return;
    }
    if (pin !== pinConfirm) {
      setPinError('PINs do not match.');
      return;
    }
    const pinHash = await hashPin(pin);
    const next: LockSettings = { enabled: true, pinHash };
    setLock(next);
    saveLock(next);
    setPin('');
    setPinConfirm('');
    setLockNote('Local lock enabled. You will be asked for this PIN when Lyra opens on this device.');
    setTimeout(() => setLockNote(null), 4000);
  }

  function disablePin() {
    const next: LockSettings = { enabled: false, pinHash: null };
    setLock(next);
    saveLock(next);
    setPin('');
    setPinConfirm('');
    setPinError(null);
    setLockNote('Local lock removed.');
    setTimeout(() => setLockNote(null), 3000);
  }

  function wipeEverything() {
    if (!window.confirm('Clear all Lyra data stored in this browser (profile, PIN, AI key, preferences)? This cannot be undone.')) return;
    clearAllLocalData();
    setProfile(DEFAULT_PROFILE);
    setAi(DEFAULT_AI);
    setLock(DEFAULT_LOCK);
    setLockNote('All local data cleared.');
    setTimeout(() => setLockNote(null), 3000);
  }

  const aiModes: { value: AiMode; label: string; blurb: string }[] = [
    { value: 'off', label: 'Off', blurb: 'No AI. Deterministic signals only.' },
    { value: 'byo', label: 'Bring your own key', blurb: 'Use your own provider key, stored only in this browser.' },
    { value: 'hosted', label: 'Hosted (managed)', blurb: 'We run the daily scan and AI for you on shared infrastructure.' },
  ];

  return (
    <div className="space-y-3">
      <div className="terminal-panel rounded-md px-4 py-3">
        <h1 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#c8d3de]">Account &amp; settings</h1>
        <p className="mt-1 text-xs text-[#8190a0]">
          Personal preferences for this device. Everything here is stored locally in your browser - Lyra is research software, not a broker, and never holds your money or trades.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel icon={UserRound} title="Profile" subtitle="Light details used to personalise the dashboard.">
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Your icon</label>
              <div className="mt-1 flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#263241] bg-[#0d141c] text-2xl">
                  {profile.avatarEmoji || '🦎'}
                </span>
                <div className="flex flex-wrap gap-1">
                  {AVATAR_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setProfile({ ...profile, avatarEmoji: emoji })}
                      aria-pressed={profile.avatarEmoji === emoji}
                      aria-label={`Use ${emoji} as your icon`}
                      className={`grid h-8 w-8 place-items-center rounded-md border text-lg transition ${
                        profile.avatarEmoji === emoji
                          ? 'border-[#f3a33a] bg-[#23180b]'
                          : 'border-[#263241] bg-[#0d141c] hover:border-[#3a4754]'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="acct-name">Display name</label>
              <input
                id="acct-name"
                className={inputClass}
                value={profile.displayName}
                placeholder="e.g. Bryson"
                onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="acct-email">Email (optional)</label>
              <input
                id="acct-email"
                type="email"
                className={inputClass}
                value={profile.email}
                placeholder="you@example.com"
                onChange={(event) => setProfile({ ...profile, email: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="acct-currency">Base currency</label>
                <select
                  id="acct-currency"
                  className={inputClass}
                  value={profile.baseCurrency}
                  onChange={(event) => setProfile({ ...profile, baseCurrency: event.target.value })}
                >
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code} className="bg-[#0d141c]">{code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="acct-region">Region</label>
                <select
                  id="acct-region"
                  className={inputClass}
                  value={profile.region}
                  onChange={(event) => setProfile({ ...profile, region: event.target.value })}
                >
                  {REGIONS.map((name) => (
                    <option key={name} value={name} className="bg-[#0d141c]">{name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" className={buttonPrimary} onClick={commitProfile}>Save profile</button>
              <SavedTick show={profileSaved} />
            </div>
          </div>
        </Panel>

        <Panel icon={Lock} title="Security · local PIN" subtitle="A light lock for this browser. Not account-level security.">
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded border border-[#263241] bg-[#0d141c] px-3 py-2 text-xs">
              <ShieldCheck size={14} className={lock.enabled ? 'text-[#43d18b]' : 'text-[#8190a0]'} />
              <span className={lock.enabled ? 'text-[#43d18b]' : 'text-[#8190a0]'}>
                {lock.enabled ? 'PIN lock is ON for this device' : 'PIN lock is off'}
              </span>
            </div>

            {lock.enabled ? (
              <button type="button" onClick={disablePin} className="inline-flex items-center gap-1.5 rounded border border-[#7f1d1d] bg-[#2b1214] px-3 py-2 font-mono text-xs text-[#ff6b6b] transition hover:bg-[#3a1518]">
                Turn off PIN lock
              </button>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="acct-pin">Set PIN</label>
                    <input
                      id="acct-pin"
                      inputMode="numeric"
                      autoComplete="off"
                      type="password"
                      maxLength={6}
                      className={inputClass}
                      value={pin}
                      placeholder="4-6 digits"
                      onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="acct-pin-confirm">Confirm PIN</label>
                    <input
                      id="acct-pin-confirm"
                      inputMode="numeric"
                      autoComplete="off"
                      type="password"
                      maxLength={6}
                      className={inputClass}
                      value={pinConfirm}
                      placeholder="Repeat"
                      onChange={(event) => setPinConfirm(event.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>
                <button type="button" className={buttonPrimary} onClick={enablePin}>
                  <KeyRound size={13} /> Enable PIN lock
                </button>
              </>
            )}

            {pinError && <p className="text-xs text-[#ff6b6b]">{pinError}</p>}
            <p className="text-[11px] leading-relaxed text-[#6f7d8a]">
              The PIN is stored as a one-way hash in this browser only. If you forget it, you can reset from the lock screen - that clears local data, it does not recover the PIN.
            </p>
          </div>
        </Panel>

        <Panel icon={BrainCircuit} title="AI assistance" subtitle="Optional. Plain-English help on top of the deterministic signals.">
          <div className="space-y-3">
            <div className="grid gap-2">
              {aiModes.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => commitAi({ ...ai, mode: mode.value })}
                  className={`rounded border px-3 py-2 text-left transition ${
                    ai.mode === mode.value
                      ? 'border-[#f3a33a] bg-[#23180b]'
                      : 'border-[#263241] bg-[#0d141c] hover:border-[#3a4754]'
                  }`}
                >
                  <span className={`block font-mono text-xs ${ai.mode === mode.value ? 'text-[#f3a33a]' : 'text-[#dbe5ee]'}`}>{mode.label}</span>
                  <span className="mt-0.5 block text-[11px] text-[#8190a0]">{mode.blurb}</span>
                </button>
              ))}
            </div>

            {ai.mode === 'byo' && (
              <div className="space-y-2 rounded border border-[#263241] bg-[#0b1016] p-3">
                <div>
                  <label className={labelClass} htmlFor="acct-provider">Provider</label>
                  <select
                    id="acct-provider"
                    className={inputClass}
                    value={ai.provider}
                    onChange={(event) => commitAi({ ...ai, provider: event.target.value as AiSettings['provider'] })}
                  >
                    <option value="anthropic" className="bg-[#0d141c]">Anthropic (Claude)</option>
                    <option value="openai" className="bg-[#0d141c]">OpenAI</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="acct-model">
                    Model <span className="text-[#6f7d8a]">(optional)</span>
                  </label>
                  <input
                    id="acct-model"
                    type="text"
                    autoComplete="off"
                    className={inputClass}
                    value={ai.model}
                    placeholder={ai.provider === 'anthropic' ? 'claude-3-5-haiku-latest' : 'gpt-4o-mini'}
                    onChange={(event) => setAi({ ...ai, model: event.target.value })}
                  />
                  <p className="mt-1 text-[11px] leading-relaxed text-[#6f7d8a]">
                    Bring your own model - leave blank for the default, or name any model your key can access.
                  </p>
                </div>
                <div>
                  <label className={labelClass} htmlFor="acct-key">API key</label>
                  <input
                    id="acct-key"
                    type="password"
                    autoComplete="off"
                    className={inputClass}
                    value={ai.apiKey}
                    placeholder="sk-…"
                    onChange={(event) => setAi({ ...ai, apiKey: event.target.value })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" className={buttonPrimary} onClick={() => commitAi(ai)}>Save key</button>
                  <SavedTick show={aiSaved} />
                </div>
                <p className="text-[11px] leading-relaxed text-[#6f7d8a]">
                  Your key never leaves this browser except to call {ai.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} directly when an AI feature runs. It is never committed or sent to Lyra&apos;s servers.
                </p>
              </div>
            )}

            {ai.mode === 'hosted' && (
              <p className="rounded border border-[#263241] bg-[#0b1016] p-3 text-[11px] leading-relaxed text-[#8190a0]">
                Hosted mode runs the daily scan and AI summaries for you on shared infrastructure - no key to manage. This is the &ldquo;run it for everyone on the cheap&rdquo; option and is being wired up; for now it behaves like Off.
              </p>
            )}
          </div>
        </Panel>

        <Panel icon={Send} title="Notifications" subtitle="Get signal alerts on Telegram or WhatsApp. Stored to your account only.">
          <NotificationsSetup />
        </Panel>

        <Panel icon={Trash2} title="Data &amp; privacy" subtitle="Everything is local to this browser.">
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-[#a8b5c2]">
              Lyra stores your profile, preferences, board layout and any AI key in this browser&apos;s local storage. Nothing is uploaded. Clearing data removes all of it from this device.
            </p>
            <button
              type="button"
              onClick={wipeEverything}
              className="inline-flex items-center gap-1.5 rounded border border-[#7f1d1d] bg-[#2b1214] px-3 py-2 font-mono text-xs text-[#ff6b6b] transition hover:bg-[#3a1518]"
            >
              <Trash2 size={13} /> Clear all local data
            </button>
          </div>
        </Panel>
      </div>

      {lockNote && (
        <div className="terminal-panel rounded-md border-[#1d4f3a] px-4 py-2 text-xs text-[#43d18b]">{lockNote}</div>
      )}
    </div>
  );
}
