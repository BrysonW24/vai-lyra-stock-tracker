'use client';

import { useEffect, useState } from 'react';
import { Sparkles, KeyRound, ShieldCheck, ExternalLink, ClipboardPaste } from 'lucide-react';
import { DEFAULT_AI, loadAi, saveAi, type AiProvider } from '@/lib/account';
import { isSupabaseConfigured } from '@/lib/supabase/client';

interface AiInsightStepProps {
  onNext: () => void;
}

type Choice = AiProvider | 'skip';

const PROVIDERS: {
  id: AiProvider;
  label: string;
  blurb: string;
  tag?: string;
  keyUrl: string;
  keyHost: string;
  placeholder: string;
  hosted?: boolean;
}[] = [
  {
    id: 'openai',
    label: 'OpenAI GPT-5.5',
    blurb: 'Hosted beta default - no key needed for friends testing the app.',
    tag: 'Hosted beta',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHost: 'platform.openai.com',
    placeholder: 'optional sk-…',
    hosted: true,
  },
  {
    id: 'google',
    label: 'Google Gemini',
    blurb: 'Generous free tier if you want to bring your own Google AI Studio key.',
    tag: 'Free',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHost: 'Google AI Studio',
    placeholder: 'AIza…',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    blurb: 'One key, open-source models (Llama, Mistral, Qwen) + many more.',
    tag: 'Open source',
    keyUrl: 'https://openrouter.ai/keys',
    keyHost: 'openrouter.ai',
    placeholder: 'sk-or-…',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    blurb: 'Claude models - strong, careful reasoning.',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHost: 'console.anthropic.com',
    placeholder: 'sk-ant-…',
  },
];

/**
 * Onboarding AI step (optional) - lets the user pick which model powers Lyra's insights
 * and optionally paste their own key. Hosted OpenAI is the default beta path; browser keys are
 * still supported and override the server key. Writes straight to browser-local AI settings.
 */
export function AiInsightStep({ onNext }: AiInsightStepProps) {
  const soloMode = !isSupabaseConfigured();
  const [choice, setChoice] = useState<Choice>('openai');
  const [apiKey, setApiKey] = useState('');

  // Prefill from any existing settings (returning user re-running onboarding).
  useEffect(() => {
    const ai = loadAi();
    setChoice(ai.provider);
    if (ai.apiKey) setApiKey(ai.apiKey);
  }, []);

  const selected = PROVIDERS.find((p) => p.id === choice);
  const selectedHosted = Boolean(selected?.hosted && !soloMode);

  const pasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setApiKey(text.trim());
    } catch {
      /* clipboard unavailable - the user can long-press the field to paste instead */
    }
  };

  const handleNext = () => {
    const current = loadAi();
    if (choice === 'skip' || choice === 'openai') {
      const key = choice === 'openai' ? apiKey.trim() : '';
      saveAi({
        ...DEFAULT_AI,
        ...current,
        mode: key ? 'byo' : soloMode ? 'off' : 'hosted',
        provider: 'openai',
        apiKey: key,
        model: choice === 'openai' ? current.model : '',
      });
    } else {
      const group: 'free' | 'byo' = choice === 'google' || choice === 'openrouter' ? 'free' : 'byo';
      const key = apiKey.trim();
      saveAi({ ...current, provider: choice, apiKey: key, mode: key ? group : 'off' });
    }
    onNext();
  };

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-2">
        <Sparkles className="mt-px shrink-0 text-pending" size={14} />
        <span>
          {soloMode
            ? 'Ask Lyra anything about your dashboard in plain English. Solo has no shared AI key: paste your own provider key to enable it, or continue without AI. Your key stays in this browser.'
            : 'Ask Lyra anything about your dashboard in plain English. Hosted OpenAI is on by default for the beta; bring your own key only if you want to override it. You can change this anytime in Settings.'}
        </span>
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {PROVIDERS.map((p) => {
          const sel = choice === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setChoice(p.id)}
              aria-pressed={sel}
              className={`rounded-cell border p-3 text-left transition ${
                sel ? 'border-pending bg-blue-tint' : 'border-line-strong bg-panel hover:border-line-hair'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-semibold ${sel ? 'text-pending' : 'text-ink'}`}>{p.label}</span>
                {(p.id !== 'openai' || !soloMode) && p.tag && (
                  <span className="shrink-0 rounded-full border border-positive/40 bg-positive-tint px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-positive">
                    {p.tag}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-ink-2">{p.blurb}</p>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="space-y-2 rounded-cell border border-pending/25 bg-chrome p-3">
          <div className="flex items-center justify-between">
            <label htmlFor="onboard-ai-key" className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
              <KeyRound size={12} /> {selected.label} key{selectedHosted ? ' (optional)' : ''}
            </label>
            <a
              href={selected.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-pending transition hover:brightness-125"
            >
              {selectedHosted ? 'Use your own key from' : 'Get a key from'} {selected.keyHost} <ExternalLink size={10} />
            </a>
          </div>
          <div className="flex gap-1.5">
            <input
              id="onboard-ai-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={selected.placeholder}
              className="min-w-0 flex-1 rounded-cell border border-line-strong bg-well px-3 py-2 font-mono text-[13px] text-ink placeholder:text-ink-dim outline-none focus:border-pending/50"
            />
            <button
              type="button"
              onClick={pasteKey}
              className="inline-flex shrink-0 items-center gap-1 rounded-cell border border-pending/40 bg-blue-tint/80 px-2.5 text-[11px] font-semibold text-pending transition hover:bg-blue-tint"
            >
              <ClipboardPaste size={13} /> Paste
            </button>
          </div>
          <p className="flex items-center gap-1 text-[10px] leading-relaxed text-ink-dim">
            <ShieldCheck size={11} className="shrink-0 text-positive" />
            {selectedHosted
              ? "Leave blank to use Lyra's hosted beta key. A pasted key stays in this browser and overrides the hosted key."
              : `Stays in this browser, only ever used for ${selected.label} requests. Paste it later in Settings if you prefer.`}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setChoice('skip')}
        className={`min-h-[44px] w-full rounded-cell border px-3 py-2 text-left text-[12px] transition ${
          choice === 'skip' ? 'border-pending bg-blue-tint text-pending' : 'border-line-strong bg-panel text-ink-2 hover:border-line-hair'
        }`}
      >
        {soloMode ? 'Not now - continue without AI.' : 'Not now - use the hosted beta model.'}
      </button>

      <button
        onClick={handleNext}
        type="button"
        className="min-h-[44px] w-full rounded-cell bg-[image:var(--lyra-cta-gradient)] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110"
      >
        {choice === 'skip' || !apiKey.trim() ? 'Finish setup' : 'Save key & finish setup'}
      </button>
    </div>
  );
}
