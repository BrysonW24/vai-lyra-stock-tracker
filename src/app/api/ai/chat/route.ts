import { NextRequest, NextResponse } from 'next/server';
import { complete, type AiProvider } from '@/lib/ai/gateway';
import { detectInjectionAttempt } from '@/lib/ai/guardrails/injection';
import { getDashboardData } from '@/lib/data';
import { buildGrounding, type ChatProfile } from '@/lib/ai/chat-context';
import { LYRA_IDENTITY, LYRA_GUARDRAILS, LYRA_CHAT_FORMAT, composeSystem, toneFor } from '@/lib/ai/system-prompt';
import { recordAiRun, hashInput } from '@/lib/ai/audit';
import { recordQuestionSignal } from '@/lib/ai/question-signals';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  ai: { mode: 'free' | 'byo' | 'off' | 'hosted'; provider: AiProvider; apiKey: string; model?: string };
  profile?: ChatProfile;
  agentActions?: boolean;
}

interface ProposedAction {
  type: 'add_watchlist' | 'add_portfolio';
  symbol: string;
}

const ACTION_VERBS: Record<string, ProposedAction['type']> = {
  add_watchlist: 'add_watchlist',
  add_portfolio: 'add_portfolio',
};

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
    const { messages, ai, profile, agentActions } = body;

    if (!ai) return NextResponse.json({ ok: false, reason: 'disabled' });
    if (!Array.isArray(messages) || messages.length === 0) return NextResponse.json({ ok: false, reason: 'empty' });

    // Key resolution: the user's own key wins; otherwise the free open-model tier may use a
    // shared server-side Google free-tier key (GOOGLE_AI_KEY) so the AI is on with zero setup.
    const userKey = ai.apiKey?.trim();
    const sharedKey = ai.provider === 'google' ? (process.env.GOOGLE_AI_KEY ?? '').trim() : '';
    const apiKey = userKey || sharedKey;
    if (!apiKey) return NextResponse.json({ ok: false, reason: 'no_key' });

    const last = messages[messages.length - 1];
    const inputHash = hashInput({ messages, profile });
    if (last?.role === 'user' && detectInjectionAttempt(last.content)) {
      void recordAiRun({
        userId: 'local',
        agentName: 'portfolio_assistant',
        provider: ai.provider,
        model: ai.model || 'n/a',
        inputHash,
        outputHash: null,
        toolsUsed: [],
        injectionFlags: ['user_message'],
        validationErrors: [],
        citationCount: 0,
        status: 'refused',
        refusalReason: 'injection_attempt',
        latencyMs: null,
      }).catch(() => {});
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
      // Action proposals are opt-in. Even when enabled, Lyra only PROPOSES; the user confirms and
      // deterministic code performs the (reversible) action. Lyra never acts on its own.
      agentActions
        ? 'ACTIONS (enabled): ONLY when the user EXPLICITLY asks to add, track, watch, or save a specific stock, you may PROPOSE one action by adding a line BEFORE the FOLLOW_UPS line, in exactly this form: "ACTION: add_watchlist || SYMBOL" (to track it on their watchlist) or "ACTION: add_portfolio || SYMBOL" (to add it as a holding). Use the real ticker. Propose at most ONE action, and only the one they asked for. CRITICAL: you do NOT perform the action - the user confirms it via a button. So phrase your reply as an OFFER awaiting their confirmation, e.g. "I can add NVDA to your watchlist - confirm below to save it." NEVER claim you have already added, saved, or processed it. NEVER propose selling, ordering, money movement, or anything they did not explicitly request.'
        : 'You cannot take actions or change the user data; you explain and answer only.',
      'NEXT STEPS: After your answer, add one final line in exactly this form: "FOLLOW_UPS: question one || question two || question three". Give 2-3 short, natural questions THIS user would most likely want to ask next, each fully answerable from the same dashboard data and specific (name the tickers or sections). Phrase them as the user would ask ("Why is...", "Compare...", "What about..."). Put nothing after that line.',
      toneFor(profile),
      `CONTEXT (deterministic, from the latest scan):\n${buildGrounding(data, new Date())}`,
    ]);
    const history = messages.slice(-8).map((m) => `${m.role === 'user' ? 'User' : 'Lyra'}: ${m.content}`).join('\n');
    const prompt = `${history}\nLyra:`;

    const startedAt = Date.now();
    const { text, model: usedModel } = await complete({ provider: ai.provider, apiKey, model: ai.model, system, prompt, maxTokens: 600 });
    const latencyMs = Date.now() - startedAt;
    if (!text) return NextResponse.json({ ok: false, reason: 'empty' });
    // Strip an echoed "Lyra:" turn label, then split off the FOLLOW_UPS line into suggestion chips.
    let cleaned = text.replace(/^\s*(?:Lyra|Assistant)\s*:\s*/i, '').trim();

    // Parse an optional ACTION line (only honoured when actions are enabled) into a confirm-to-act
    // proposal, and strip it from the visible answer. The user confirms; Lyra never executes.
    let action: ProposedAction | null = null;
    if (agentActions) {
      const am = cleaned.match(/\n?\s*ACTION\s*:\s*(add_watchlist|add_portfolio)\s*\|\|\s*([A-Za-z.\-]{1,8})\s*$/im);
      if (am) {
        const type = ACTION_VERBS[am[1].toLowerCase()];
        const symbol = am[2].toUpperCase().trim();
        if (type && symbol) action = { type, symbol };
        cleaned = cleaned.replace(am[0], '').trim();
      }
    }

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

    // Durable-by-design audit (hash-only) + the Listening layer (captures the question on purpose).
    void recordAiRun({
      userId: 'local',
      agentName: 'portfolio_assistant',
      provider: ai.provider,
      model: usedModel,
      inputHash,
      outputHash: hashInput(answer),
      toolsUsed: [],
      injectionFlags: [],
      validationErrors: [],
      citationCount: 0,
      status: 'ok',
      refusalReason: null,
      latencyMs,
    }).catch(() => {});
    if (last?.role === 'user') recordQuestionSignal(last.content);

    return NextResponse.json({ ok: true, text: answer || cleaned, suggestions, action });
  } catch {
    return NextResponse.json({ ok: false, reason: 'error' });
  }
}
