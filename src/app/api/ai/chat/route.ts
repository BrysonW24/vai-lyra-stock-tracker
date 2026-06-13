import { NextRequest, NextResponse } from 'next/server';
import { complete, type AiProvider } from '@/lib/ai/gateway';
import { detectInjectionAttempt } from '@/lib/ai/guardrails/injection';
import { getDashboardData } from '@/lib/data';
import { buildGrounding, type ChatProfile } from '@/lib/ai/chat-context';
import { LYRA_IDENTITY, LYRA_GUARDRAILS, LYRA_CHAT_FORMAT, composeSystem, toneFor } from '@/lib/ai/system-prompt';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  ai: { mode: 'free' | 'byo' | 'off' | 'hosted'; provider: AiProvider; apiKey: string; model?: string };
  profile?: ChatProfile;
}

/**
 * Grounded chat. Mirrors /api/ai/brief: BYOK key forwarded from the browser, never logged or
 * persisted; provider dispatch in the gateway. The user's question is injection-screened, the
 * deterministic dashboard is assembled into a CONTEXT block, and a profile-derived tone is
 * prepended. The model phrases; it cannot invent numbers or give advice. Any failure returns
 * ok:false so the UI degrades gracefully.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest;
    const { messages, ai, profile } = body;

    if (!ai) return NextResponse.json({ ok: false, reason: 'disabled' });
    if (!Array.isArray(messages) || messages.length === 0) return NextResponse.json({ ok: false, reason: 'empty' });

    // Key resolution: the user's own key wins; otherwise the free open-model tier may use a
    // shared server-side Google free-tier key (GOOGLE_AI_KEY) so the AI is on with zero setup.
    const userKey = ai.apiKey?.trim();
    const sharedKey = ai.provider === 'google' ? (process.env.GOOGLE_AI_KEY ?? '').trim() : '';
    const apiKey = userKey || sharedKey;
    if (!apiKey) return NextResponse.json({ ok: false, reason: 'no_key' });

    const last = messages[messages.length - 1];
    if (last?.role === 'user' && detectInjectionAttempt(last.content)) {
      return NextResponse.json({
        ok: true,
        text: "I can only answer research questions grounded in your dashboard - I won't act on instructions hidden in messages or data. Ask me about your holdings, watchlist, the signals, prime setups, catalysts or the macro picture.",
      });
    }

    const data = await getDashboardData();
    const system = composeSystem([
      LYRA_IDENTITY,
      'The user is chatting with you. Answer their question directly.',
      LYRA_GUARDRAILS,
      LYRA_CHAT_FORMAT,
      'NEXT STEPS: After your answer, add one final line in exactly this form: "FOLLOW_UPS: question one || question two || question three". Give 2-3 short, natural questions THIS user would most likely want to ask next, each fully answerable from the same dashboard data and specific (name the tickers or sections). Phrase them as the user would ask ("Why is...", "Compare...", "What about..."). Put nothing after that line.',
      toneFor(profile),
      `CONTEXT (deterministic, from the latest scan):\n${buildGrounding(data, new Date())}`,
    ]);
    const history = messages.slice(-8).map((m) => `${m.role === 'user' ? 'User' : 'Lyra'}: ${m.content}`).join('\n');
    const prompt = `${history}\nLyra:`;

    const { text } = await complete({ provider: ai.provider, apiKey, model: ai.model, system, prompt, maxTokens: 600 });
    if (!text) return NextResponse.json({ ok: false, reason: 'empty' });
    // Strip an echoed "Lyra:" turn label, then split off the FOLLOW_UPS line into suggestion chips.
    const cleaned = text.replace(/^\s*(?:Lyra|Assistant)\s*:\s*/i, '').trim();
    let answer = cleaned;
    let suggestions: string[] = [];
    const m = cleaned.match(/^([\s\S]*?)\n+\s*FOLLOW[_ ]?UPS\s*:\s*([\s\S]*)$/i);
    if (m) {
      answer = m[1].trim();
      suggestions = m[2]
        .split(/\s*\|\|\s*|\n+/)
        .map((s) => s.replace(/^[-*\d.)\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 3);
    }
    return NextResponse.json({ ok: true, text: answer || cleaned, suggestions });
  } catch {
    return NextResponse.json({ ok: false, reason: 'error' });
  }
}
