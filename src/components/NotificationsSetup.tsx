'use client';

import { useEffect, useState } from 'react';
import { Check, ExternalLink, MessageCircle, Send } from 'lucide-react';
import { loadNotifications, saveNotifications } from '@/lib/account';

/**
 * Notifications setup wizard. Lets the user choose Telegram or WhatsApp, capture where
 * alerts should be delivered, and save it to the database (RLS-scoped to them via
 * /api/notifications). Includes deep links to grab a Telegram chat ID and to install the
 * apps. localStorage mirrors the value for instant UX and demo mode.
 */
type Channel = 'telegram' | 'whatsapp';

const APP_LINKS: Record<Channel, { getApp: string; helper?: { label: string; href: string } }> = {
  telegram: {
    getApp: 'https://telegram.org/apps',
    helper: { label: 'Get your chat ID with @userinfobot', href: 'https://t.me/userinfobot' },
  },
  whatsapp: {
    getApp: 'https://www.whatsapp.com/download',
  },
};

const inputClass =
  'w-full rounded-md border border-[#263241] bg-[#0b1016] px-3 py-2.5 text-sm text-[#eef3f8] outline-none transition focus:border-[#f3a33a]/60 focus:ring-1 focus:ring-[#f3a33a]/30';

export function NotificationsSetup() {
  const [channel, setChannel] = useState<Channel>('telegram');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [saved, setSaved] = useState<Channel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const current = loadNotifications();
    setTelegramChatId(current.telegramChatId || '');
    setWhatsappPhone(current.whatsappPhone || '');
  }, []);

  const destination = channel === 'telegram' ? telegramChatId.trim() : whatsappPhone.trim();

  async function save() {
    setError(null);
    if (!destination) {
      setError(channel === 'telegram' ? 'Enter your Telegram chat ID.' : 'Enter your WhatsApp number.');
      return;
    }
    setBusy(true);

    // Mirror locally for instant UX / demo mode.
    const current = loadNotifications();
    saveNotifications({
      ...current,
      telegramEnabled: channel === 'telegram' ? true : current.telegramEnabled,
      telegramChatId: channel === 'telegram' ? destination : current.telegramChatId,
      whatsappPhone: channel === 'whatsapp' ? destination : current.whatsappPhone,
    });

    // Persist to the database (RLS-scoped). Resilient: localStorage already saved.
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelType: channel, destination }),
      });
      const data = await response.json();
      if (response.status === 401) setError('Sign in to save notifications.');
      else if (data && data.ok === false && !data.demo) setError(data.error || 'Could not save.');
      else {
        setSaved(channel);
        setTimeout(() => setSaved(null), 2000);
      }
    } catch {
      setSaved(channel);
      setTimeout(() => setSaved(null), 2000);
    }
    setBusy(false);
  }

  const tabClass = (value: Channel) =>
    `flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition ${
      channel === value
        ? 'border-[#f3a33a] bg-[#23180b] text-[#f3a33a]'
        : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:border-[#3a4754]'
    }`;

  const links = APP_LINKS[channel];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button type="button" className={tabClass('telegram')} onClick={() => setChannel('telegram')}>
          <Send size={14} /> Telegram
        </button>
        <button type="button" className={tabClass('whatsapp')} onClick={() => setChannel('whatsapp')}>
          <MessageCircle size={14} /> WhatsApp
        </button>
      </div>

      {channel === 'telegram' ? (
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#8190a0]" htmlFor="tg-id">Telegram chat ID</label>
          <input id="tg-id" inputMode="numeric" className={inputClass} value={telegramChatId} placeholder="e.g. 123456789" onChange={(e) => setTelegramChatId(e.target.value.trim())} />
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#8190a0]" htmlFor="wa-phone">WhatsApp number</label>
          <input id="wa-phone" inputMode="tel" className={inputClass} value={whatsappPhone} placeholder="+61 400 000 000" onChange={(e) => setWhatsappPhone(e.target.value)} />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded border border-[#1d7f55] bg-[#0d251b] px-3 py-2 font-mono text-xs text-[#43d18b] transition hover:bg-[#103626] disabled:opacity-40"
        >
          {busy ? 'Saving…' : `Save ${channel === 'telegram' ? 'Telegram' : 'WhatsApp'}`}
        </button>
        {saved === channel && (
          <span className="inline-flex items-center gap-1 font-mono text-xs text-[#43d18b]"><Check size={13} /> Saved</span>
        )}
      </div>

      {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
        {links.helper && (
          <a href={links.helper.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#60a5fa] hover:underline">
            {links.helper.label} <ExternalLink size={11} />
          </a>
        )}
        <a href={links.getApp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#8190a0] hover:text-[#a8b5c2]">
          Get {channel === 'telegram' ? 'Telegram' : 'WhatsApp'} <ExternalLink size={11} />
        </a>
      </div>

      <p className="text-[11px] leading-relaxed text-[#6f7d8a]">
        Your number is stored only on your account and is visible only to you. Delivery runs from the scanner worker, which holds the bot / WhatsApp credentials in its own environment - you never paste a token here.
      </p>
    </div>
  );
}
