'use client';

import { useEffect, useRef, useState } from 'react';
import { BrainCircuit, Check, ClipboardPaste, KeyRound, Lock, Send, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import {
  CURRENCIES,
  DEFAULT_AI,
  DEFAULT_LOCK,
  DEFAULT_PROFILE,
  REGIONS,
  type AiSettings,
  type AccountProfile,
  type LockSettings,
  clearAllLocalData,
  hashPin,
  loadAi,
  loadAgent,
  loadLock,
  loadProfile,
  saveAi,
  saveAgent,
  saveLock,
  saveProfile,
  withoutAiKey,
} from '@/lib/account';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { syncAccountProfile } from '@/lib/sync-onboarding';
import { loadInterest, saveInterest, registerInterest } from '@/lib/interest';
import { NotificationsSetup } from '@/components/NotificationsSetup';
import { pageTitleClass } from '@/lib/ui';

function Panel({ icon: Icon, title, subtitle, children }: { icon: typeof UserRound; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex items-start gap-2.5 border-b border-[#1b2530] px-3 py-2">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#f3a33a]">
          <Icon size={14} />
        </span>
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#c8d3de]">{title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-[#8190a0]">{subtitle}</p>
        </div>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

// One consistent sans face across every field so the form reads calm, not typewriter-bouncy. Genuinely
// tabular data (tables, code, tickers) keeps font-mono elsewhere; prose inputs like name/email do not.
const inputClass =
  'w-full rounded border border-[#263241] bg-[#0d141c] px-2.5 py-1.5 text-[13px] text-[#dbe5ee] outline-none transition focus:border-[#3a4754] focus:ring-1 focus:ring-[#f3a33a]/30';
const labelClass = 'mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-[#8190a0]';
const buttonPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded border border-[#1d7f55] bg-[#0d251b] px-3 py-1.5 text-[11px] font-medium text-[#43d18b] transition hover:bg-[#103626] disabled:opacity-40';

/**
 * Per-provider display + key sourcing. `hosted` uses the server-side OpenAI beta key when present;
 * user-entered keys still override it. `free`/`byo` remain available for testers who want control.
 */
const PROVIDER_META: Record<
  AiSettings['provider'],
  { label: string; modelPlaceholder: string; group: 'hosted' | 'free' | 'byo'; keyUrl: string; keyHost: string; keyPlaceholder: string }
> = {
  google: { label: 'Google Gemini', modelPlaceholder: 'gemini-3.1-flash-lite', group: 'free', keyUrl: 'https://aistudio.google.com/apikey', keyHost: 'Google AI Studio', keyPlaceholder: 'AIza…' },
  openrouter: { label: 'Llama (OpenRouter)', modelPlaceholder: 'meta-llama/llama-3.1-70b-instruct', group: 'free', keyUrl: 'https://openrouter.ai/keys', keyHost: 'openrouter.ai', keyPlaceholder: 'sk-or-…' },
  anthropic: { label: 'Anthropic (Claude)', modelPlaceholder: 'claude-haiku-4-5', group: 'byo', keyUrl: 'https://console.anthropic.com/settings/keys', keyHost: 'console.anthropic.com', keyPlaceholder: 'sk-ant-…' },
  openai: { label: 'OpenAI (hosted)', modelPlaceholder: 'gpt-5.5', group: 'hosted', keyUrl: 'https://platform.openai.com/api-keys', keyHost: 'platform.openai.com', keyPlaceholder: 'optional sk-…' },
  xai: { label: 'xAI (Grok)', modelPlaceholder: 'grok-2-latest', group: 'byo', keyUrl: 'https://console.x.ai', keyHost: 'console.x.ai', keyPlaceholder: 'xai-…' },
};

function SavedTick({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-[#43d18b]">
      <Check size={13} /> Saved
    </span>
  );
}

export type SettingsSection = 'account' | 'ai' | 'notifications';

const SECTION_HEADERS: Record<SettingsSection, { title: string; subtitle: string }> = {
  account: {
    title: 'Account',
    subtitle: 'Your profile, a local device lock, and your data - stored in this browser. Lyra is research software, not a broker, and never holds your money or trades.',
  },
  ai: {
    title: 'AI Settings',
    subtitle: 'Choose the model that powers Lyra explanations - the hosted beta by default, or bring your own key.',
  },
  notifications: {
    title: 'Notifications',
    subtitle: 'Where Lyra sends your alerts - push, Telegram, WhatsApp or Slack - and how they are worded.',
  },
};

export function AccountSettings({ section }: { section: SettingsSection }) {
  const soloMode = !isSupabaseConfigured();
  const sectionHeader =
    section === 'ai' && soloMode
      ? {
          title: 'AI Settings',
          subtitle: 'Solo has no hosted model. Choose a provider and add your own key; it stays in this browser.',
        }
      : SECTION_HEADERS[section];
  const [profile, setProfile] = useState<AccountProfile>(DEFAULT_PROFILE);
  const [ai, setAi] = useState<AiSettings>(DEFAULT_AI);
  const [lock, setLock] = useState<LockSettings>(DEFAULT_LOCK);

  const [profileSaved, setProfileSaved] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [lockNote, setLockNote] = useState<string | null>(null);
  const [botInterest, setBotInterest] = useState(false);
  const [agentActions, setAgentActions] = useState(false);
  const [serverDeleteBusy, setServerDeleteBusy] = useState(false);
  const [privacyNote, setPrivacyNote] = useState<string | null>(null);
  const emojiInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfile(loadProfile());
    setAi(loadAi());
    setLock(loadLock());
    setBotInterest(loadInterest().tradingBot);
    setAgentActions(loadAgent().actionsEnabled);
  }, []);

  function toggleBotInterest(checked: boolean) {
    setBotInterest(checked);
    saveInterest({ tradingBot: checked });
    if (checked) void registerInterest('Trading bot (paper trading)', loadProfile().email);
  }

  function toggleAgentActions(checked: boolean) {
    setAgentActions(checked);
    saveAgent({ actionsEnabled: checked });
  }

  // Deep link from other UI elements (e.g. Account dropdown or chat onboarding).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const hash = window.location.hash.substring(1);
    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // Take the last emoji (grapheme) the user typed/inserted so the icon is always one glyph,
  // even for multi-codepoint emoji (flags, skin tones, ZWJ sequences).
  function pickEmoji(raw: string) {
    const value = raw.trim();
    if (!value) {
      setProfile({ ...profile, avatarEmoji: '' });
      return;
    }
    let last = value;
    try {
      const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
      if (Seg) {
        const parts = Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(value), (s) => s.segment);
        last = parts[parts.length - 1] ?? value;
      } else {
        const arr = Array.from(value);
        last = arr[arr.length - 1] ?? value;
      }
    } catch {
      last = value;
    }
    setProfile({ ...profile, avatarEmoji: last });
  }

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

  async function pasteAiKey() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setAi((prev) => ({ ...prev, apiKey: text.trim() }));
    } catch {
      /* clipboard unavailable - the user can long-press the field to paste instead */
    }
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

  // Server-side erase: deletes the signed-in user's account and every user-keyed row via
  // DELETE /api/account (auth.admin.deleteUser -> on-delete cascade). Honest backing for the
  // privacy promise, distinct from the local-only wipe above.
  async function deleteServerAccount() {
    if (!window.confirm('Permanently delete your Lyra account and ALL server-side data (profile, settings, watchlist, paper-trade history)? This cannot be undone.')) return;
    setServerDeleteBusy(true);
    setPrivacyNote(null);
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        clearAllLocalData();
        setPrivacyNote('Your account and all server-side data were deleted. Signing you out...');
        setTimeout(() => { window.location.href = '/'; }, 1600);
      } else {
        setPrivacyNote(data.error || 'Could not delete server data. Please try again.');
      }
    } catch {
      setPrivacyNote('Could not reach the server. Please try again.');
    } finally {
      setServerDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="terminal-panel rounded-md px-3 py-2.5">
        <h1 className={pageTitleClass}>{sectionHeader.title}</h1>
        <p className="mt-0.5 text-[11px] leading-snug text-[#8190a0]">{sectionHeader.subtitle}</p>
      </div>

      <div className={section === 'account' ? 'grid gap-2.5 lg:grid-cols-2' : 'space-y-2.5'}>
        {section === 'account' && (
        <Panel icon={UserRound} title="Profile" subtitle="Light details used to personalise the dashboard.">
          <div className="space-y-2.5">
            <div>
              <label className={labelClass}>Your icon</label>
              <div className="mt-0.5 flex items-center gap-2.5">
                {/* The circle IS the picker: a <label> wraps a real (transparent) input so a tap
                    natively focuses it and opens the device keyboard - no text box to type into.
                    A <label> is the most reliable keyboard trigger on iOS. */}
                <label className="relative grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-full border border-[#263241] bg-[#0d141c] text-2xl">
                  <span aria-hidden>{profile.avatarEmoji || '🦎'}</span>
                  <input
                    ref={emojiInputRef}
                    value={profile.avatarEmoji}
                    onChange={(event) => pickEmoji(event.target.value)}
                    aria-label="Tap to pick an emoji from your keyboard"
                    className="absolute inset-0 h-full w-full cursor-pointer rounded-full bg-transparent text-transparent caret-transparent opacity-0"
                  />
                </label>
                <p className="text-[10px] leading-snug text-[#8190a0]">Tap the circle to pick any emoji from your keyboard.</p>
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
        )}

        {section === 'account' && (
        <Panel icon={Lock} title="Security · local PIN" subtitle="A light lock for this browser. Not account-level security.">
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded border border-[#263241] bg-[#0d141c] px-3 py-2 text-xs">
              <ShieldCheck size={14} className={lock.enabled ? 'text-[#43d18b]' : 'text-[#8190a0]'} />
              <span className={lock.enabled ? 'text-[#43d18b]' : 'text-[#8190a0]'}>
                {lock.enabled ? 'PIN lock is ON for this device' : 'PIN lock is off'}
              </span>
            </div>

            {lock.enabled ? (
              <button type="button" onClick={disablePin} className="inline-flex items-center gap-1.5 rounded border border-[#7f1d1d] bg-[#2b1214] px-3 py-2 text-xs font-medium text-[#ff6b6b] transition hover:bg-[#3a1518]">
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
        )}

        {section === 'ai' && (
        <div id="ai-settings" className="scroll-mt-4">
          <Panel
            icon={BrainCircuit}
            title="AI assistance"
            subtitle={soloMode ? 'Bring your own provider key. Lyra stores it only on this device.' : 'Hosted OpenAI beta by default. Optional BYOK when you want control.'}
          >
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass} htmlFor="acct-provider">Model</label>
                  <select
                    id="acct-provider"
                    className={`${inputClass} !text-[11px]`}
                    value={ai.provider}
                    onChange={(event) => {
                      const provider = event.target.value as AiSettings['provider'];
                      const sameProvider = provider === ai.provider;
                      commitAi({
                        ...ai,
                        provider,
                        mode: PROVIDER_META[provider].group,
                        apiKey: sameProvider ? ai.apiKey : '',
                        model: sameProvider ? ai.model : '',
                      });
                    }}
                  >
                    <optgroup label={soloMode ? 'Your own key' : 'Hosted beta'}>
                      <option value="openai" className="bg-[#0d141c]">
                        {soloMode ? 'OpenAI GPT-5.5 (BYOK)' : 'OpenAI GPT-5.5'}
                      </option>
                    </optgroup>
                    <optgroup label="Free / open">
                      <option value="google" className="bg-[#0d141c]">Google Gemini (free)</option>
                      <option value="openrouter" className="bg-[#0d141c]">Llama 3.1 (open-source)</option>
                    </optgroup>
                    <optgroup label="Your own key">
                      <option value="anthropic" className="bg-[#0d141c]">Claude</option>
                      <option value="xai" className="bg-[#0d141c]">Grok (xAI)</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="acct-model">Version <span className="text-[#6f7d8a]">(optional)</span></label>
                  <input
                    id="acct-model"
                    type="text"
                    autoComplete="off"
                    className={inputClass}
                    value={ai.model}
                    placeholder={PROVIDER_META[ai.provider].modelPlaceholder}
                    onChange={(event) => setAi({ ...ai, model: event.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="acct-key">
                  {PROVIDER_META[ai.provider].group === 'hosted'
                    ? 'Optional API key'
                    : PROVIDER_META[ai.provider].group === 'free'
                      ? 'Free API key'
                      : 'API key'}
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="acct-key"
                    type="password"
                    autoComplete="off"
                    className={`${inputClass} min-w-0 flex-1`}
                    value={ai.apiKey}
                    placeholder={PROVIDER_META[ai.provider].keyPlaceholder}
                    onChange={(event) => setAi({ ...ai, apiKey: event.target.value })}
                  />
                  <button
                    type="button"
                    onClick={pasteAiKey}
                    className="inline-flex shrink-0 items-center gap-1 rounded border border-[#8aa2ff]/40 bg-[#101a2e] px-2.5 text-[11px] font-semibold text-[#8aa2ff] transition hover:bg-[#13203a]"
                  >
                    <ClipboardPaste size={13} /> Paste
                  </button>
                  {ai.apiKey && (
                    <button
                      type="button"
                      onClick={() => commitAi(withoutAiKey(ai))}
                      className="inline-flex shrink-0 items-center gap-1 rounded border border-[#ff6b6b]/35 bg-[#251113] px-2.5 text-[11px] font-semibold text-[#ff8c8c] transition hover:bg-[#331619]"
                    >
                      <Trash2 size={13} /> Remove key
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button type="button" className={buttonPrimary} onClick={() => commitAi(ai)}>Save AI settings</button>
                <div className="flex items-center gap-2.5">
                  <SavedTick show={aiSaved} />
                  <a
                    href={PROVIDER_META[ai.provider].keyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-semibold text-[#8aa2ff] transition hover:text-[#aab8ff]"
                  >
                    {PROVIDER_META[ai.provider].group === 'hosted' ? 'Use your own key from' : 'Get a key from'} {PROVIDER_META[ai.provider].keyHost} →
                  </a>
                </div>
              </div>

              <p className="text-[9.5px] leading-snug text-[#6f7d8a]">
                {PROVIDER_META[ai.provider].group === 'hosted'
                  ? isSupabaseConfigured()
                    ? `Hosted beta uses Lyra's server-side OpenAI key when available. Add your own key here only if you want to override it; browser keys are never stored on Lyra's servers.`
                    : // Solo deployments hold no server keys and have no signed-in users, so the
                      // hosted fallback can never activate - without this branch the copy promises
                      // a key that will never arrive.
                      `Solo mode has no hosted key - paste your own OpenAI key to turn AI on. It stays in this browser, only ever sent to the provider.`
                  : PROVIDER_META[ai.provider].group === 'free'
                    ? `Free open model - grab a free key from ${PROVIDER_META[ai.provider].keyHost} (no card needed). It stays in this browser, only ever sent to the provider.`
                    : `Your key stays in this browser and is only used for ${PROVIDER_META[ai.provider].label} requests - never committed or stored by Lyra.`}
              </p>

              <label className="flex cursor-pointer items-start gap-2 rounded border border-[#1d2733] bg-[#0b1016] p-2.5">
                <input
                  type="checkbox"
                  checked={botInterest}
                  onChange={(event) => toggleBotInterest(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#8aa2ff]"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[12px] font-semibold text-[#dbe5ee]">Trading bot (paper)</span>
                    <span className="rounded-full border border-[#8aa2ff]/30 bg-[#101a2e] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-[#8aa2ff]">Coming soon</span>
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-[#8190a0]">
                    Let Lyra paper-trade your portfolio behind an approval gate - never live. Tick to register interest and join the beta.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-2 rounded border border-[#1d2733] bg-[#0b1016] p-2.5">
                <input
                  type="checkbox"
                  checked={agentActions}
                  onChange={(event) => toggleAgentActions(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#8aa2ff]"
                />
                <span className="min-w-0">
                  <span className="text-[12px] font-semibold text-[#dbe5ee]">AI actions (confirm-to-act)</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-[#8190a0]">
                    When on, Lyra can <span className="text-[#a8b5c2]">propose</span> reversible actions in chat - like adding a stock to your watchlist, portfolio, or trade log - and you confirm each one. Lyra never changes your data on its own, never trades, and every action can be undone.
                  </span>
                </span>
              </label>
            </div>
          </Panel>
        </div>
        )}

        {section === 'notifications' && (
        <div id="notifications" className="scroll-mt-4">
          <Panel icon={Send} title="Notifications" subtitle="Get signal alerts on Telegram or WhatsApp. Stored to your account only.">
            <NotificationsSetup />
          </Panel>
        </div>
        )}

        {section === 'account' && (
        <Panel icon={Trash2} title="Data &amp; privacy" subtitle="See it, keep it, or delete it - your call.">
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-[#a8b5c2]">
              On this device, Lyra keeps your profile, preferences, board layout and any AI key in local storage. When you are signed in, your profile, settings, watchlist and paper-trade history are also saved to your private Lyra account so they follow you across devices - visible only to you, never sold. Behavioural &ldquo;twin&rdquo; capture stays off until you opt in.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={wipeEverything}
                className="inline-flex items-center gap-1.5 rounded border border-[#7f1d1d] bg-[#2b1214] px-3 py-2 text-xs font-medium text-[#ff6b6b] transition hover:bg-[#3a1518]"
              >
                <Trash2 size={13} /> Clear local data (this device)
              </button>
              {isSupabaseConfigured() && (
                <>
                  <a
                    href="/api/account/export"
                    className="inline-flex items-center gap-1.5 rounded border border-[#263241] bg-[#0d141c] px-3 py-2 text-xs font-medium text-[#7fb0ff] transition hover:bg-[#101a2e]"
                  >
                    <ClipboardPaste size={13} /> Export my data
                  </a>
                  <button
                    type="button"
                    onClick={deleteServerAccount}
                    disabled={serverDeleteBusy}
                    className="inline-flex items-center gap-1.5 rounded border border-[#7f1d1d] bg-[#2b1214] px-3 py-2 text-xs font-medium text-[#ff6b6b] transition hover:bg-[#3a1518] disabled:opacity-40"
                  >
                    <Trash2 size={13} /> {serverDeleteBusy ? 'Deleting…' : 'Delete my account data'}
                  </button>
                </>
              )}
            </div>
            {privacyNote && <p className="text-[11px] leading-snug text-[#f3a33a]">{privacyNote}</p>}
          </div>
        </Panel>
        )}
      </div>

      {lockNote && (
        <div className="terminal-panel rounded-md border-[#1d4f3a] px-4 py-2 text-xs text-[#43d18b]">{lockNote}</div>
      )}
    </div>
  );
}
