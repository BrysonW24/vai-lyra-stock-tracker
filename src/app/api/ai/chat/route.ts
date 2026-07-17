import { NextRequest, NextResponse } from 'next/server';
import { complete, type AiProvider } from '@/lib/ai/gateway';
import { detectInjectionAttempt } from '@/lib/ai/guardrails/injection';
import { guardProse } from '@/lib/ai/guardrails/prose';
import { chargeHostedBudget } from '@/lib/ai/budget-tracker';
import { getDashboardData } from '@/lib/data';
import { buildGrounding, type ChatProfile } from '@/lib/ai/chat-context';
import { buildHybridKnowledgeBlock } from '@/lib/knowledge/hybrid';
import { getUserConstraints, buildConstraintsBlock } from '@/lib/ai/user-context';
import { LYRA_IDENTITY, LYRA_GUARDRAILS, LYRA_CHAT_FORMAT, composeSystem, toneFor } from '@/lib/ai/system-prompt';
import { recordAiRun, hashInput } from '@/lib/ai/audit';
import { recordQuestionSignal } from '@/lib/ai/question-signals';
import { resolveAiCredentials } from '@/lib/ai/credentials';
import { guardAiRoute } from '@/lib/api/ai-guard';
import { parseTradeLogIntent, detectSellLogIntent } from '@/lib/trading/trade-intent';
import { lookupMarketQuote } from '@/lib/market/quote';
import { loadRecentChatTurns, appendChatTurns } from '@/lib/twin/chat-memory';

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
  type: 'add_watchlist' | 'add_portfolio' | 'log_trade';
  symbol: string;
  side?: 'buy';
  notional?: number;
  /** Preview shown on the confirm card so the user approves a concrete fill, not a blind amount. */
  estPrice?: number;
  estShares?: number;
  estCashAfter?: number;
}

const ACTION_VERBS: Record<string, ProposedAction['type']> = {
  add_watchlist: 'add_watchlist',
  add_portfolio: 'add_portfolio',
  log_trade: 'log_trade',
};

const money = (n: number, currency = 'USD') =>
  currency === 'USD'
    ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    : n.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 2 });

/**
 * Grounded chat. Mirrors /api/ai/brief: BYOK key forwarded from the browser, never logged or
 * persisted; provider dispatch in the gateway. The user's question is injection-screened, the
 * deterministic dashboard is assembled into a CONTEXT block, and a profile-derived tone is
 * prepended. The model phrases; it cannot invent numbers or give advice. Any failure returns
 * ok:false so the UI degrades gracefully.
 */
/** Number of prior turns fed into the prompt - also the number screened for injection. */
const HISTORY_TURNS = 8;

export async function POST(request: NextRequest) {
  try {
    const guard = await guardAiRoute<ChatRequest>(request);
    if (!guard.ok) return guard.response;
    const { body, authenticated } = guard;
    const { messages, ai, profile, agentActions } = body;

    if (!ai) return NextResponse.json({ ok: false, reason: 'disabled' });
    if (!Array.isArray(messages) || messages.length === 0) return NextResponse.json({ ok: false, reason: 'empty' });

    const creds = resolveAiCredentials(ai, { authenticated });
    if (!creds.apiKey) return NextResponse.json({ ok: false, reason: 'no_key' });

    // Hosted/shared key rides the house budget; BYOK spends the user's own quota untouched.
    if (creds.source !== 'user') {
      const budget = chargeHostedBudget(creds.source, 600);
      if (budget.decision === 'block') return NextResponse.json({ ok: false, reason: 'budget' });
    }

    const last = messages[messages.length - 1];
    const inputHash = hashInput({ messages, profile });
    // Screen EVERY turn that will enter the prompt, not just the final message - an attacker
    // can otherwise bury injected instructions in an earlier or forged 'assistant' turn (only
    // the user's own text is trusted; assistant turns are model output being replayed).
    const screenedTurns = messages.slice(-HISTORY_TURNS);
    const injectionInHistory = screenedTurns.some((m) => detectInjectionAttempt(m.content));
    if (injectionInHistory || (last?.role === 'user' && detectInjectionAttempt(last.content))) {
      void recordAiRun({
        userId: guard.identity,
        agentName: 'portfolio_assistant',
        provider: creds.provider,
        model: creds.model || 'n/a',
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

    const explicitTrade = last?.role === 'user' ? parseTradeLogIntent(last.content) : null;

    // A request to LOG a sell is not supported yet - reply honestly instead of letting it fall
    // through to a generic LLM answer (research questions like "should I sell NVDA?" are NOT caught
    // here and still reach the AI normally).
    if (!explicitTrade && last?.role === 'user' && detectSellLogIntent(last.content)) {
      recordQuestionSignal(last.content);
      return NextResponse.json({
        ok: true,
        text: "I can't log a sell yet - right now I only log buys. You can adjust or remove the holding directly in your Portfolio and I'll keep tracking it. (Sell logging is on the roadmap.)",
        suggestions: ['Show my portfolio risk', 'What does my book look like now?', 'Which of my holdings has the weakest setup?'],
      });
    }

    if (explicitTrade) {
      recordQuestionSignal(last.content);
      // Preview the live quote + remaining cash so the confirm card shows exactly what is being
      // approved (shares, fill price, cash left), not a blind dollar amount. Best-effort: the server
      // re-prices on confirm regardless, so a failed preview just falls back to the plain proposal.
      const quote = await lookupMarketQuote(explicitTrade.symbol).catch(() => null);
      const userConstraints = await getUserConstraints().catch(() => null);
      const cash = userConstraints?.cashAvailable ?? null;
      const baseCurrency = (userConstraints?.baseCurrency || 'USD').toUpperCase();
      const tradeCurrency = (quote?.currency || 'USD').toUpperCase();
      const price = quote && quote.valid && quote.price && quote.price > 0 ? quote.price : null;

      // Cross-currency guard mirrors log_buy_trade: cash is held in one base currency, so a trade
      // priced in another (e.g. a .AX name in AUD) cannot be logged yet. Decline honestly here so we
      // never present a confirm card that the server would only reject.
      if (price && tradeCurrency !== baseCurrency) {
        return NextResponse.json({
          ok: true,
          text: `${explicitTrade.symbol} trades in ${tradeCurrency}, but your account cash is in ${baseCurrency}. I can't log a cross-currency buy yet (no FX conversion), so the cash maths would be wrong. For now, add this holding manually in Portfolio, or trade a ${baseCurrency}-quoted name.`,
          suggestions: [`What does ${explicitTrade.symbol} do?`, 'Show my portfolio', `Find ${baseCurrency} oversold setups`],
        });
      }

      const estShares = price ? Math.round((explicitTrade.notional / price) * 100) / 100 : undefined;
      const estCashAfter = typeof cash === 'number' ? Math.round((cash - explicitTrade.notional) * 100) / 100 : undefined;
      const overCash = typeof cash === 'number' && explicitTrade.notional > cash;
      const detail = price
        ? ` That is about ${estShares} shares at ${money(price, tradeCurrency)}${estCashAfter !== undefined ? `, leaving ${money(estCashAfter, baseCurrency)} cash` : ''}.`
        : '';
      return NextResponse.json({
        ok: true,
        text: overCash
          ? `A ${money(explicitTrade.notional, baseCurrency)} buy in ${explicitTrade.symbol} is more than your ${money(cash as number, baseCurrency)} available cash. I'll re-check on confirm - only confirm if you've topped up.`
          : `I can log a ${money(explicitTrade.notional, baseCurrency)} buy in ${explicitTrade.symbol}.${detail} I'll re-price at the live quote and update your holding after you confirm.`,
        suggestions: [`What does ${explicitTrade.symbol} do?`, 'Show my portfolio risk after this', 'How much cash will I have left?'],
        action: {
          type: 'log_trade',
          symbol: explicitTrade.symbol,
          side: explicitTrade.side,
          notional: explicitTrade.notional,
          estPrice: price ?? undefined,
          estShares,
          estCashAfter,
        },
      });
    }

    const data = await getDashboardData();
    const constraints = await getUserConstraints();
    const constraintsBlock = constraints ? buildConstraintsBlock(constraints) : '';
    // Tone is derived from the authoritative server-side profile when signed in: it carries the
    // beginner learning-style onboarding captured (brief vs step-by-step), which the client-sent
    // profile does not. Falls back to the client profile for demo/unauthenticated sessions.
    const profileForTone: ChatProfile = constraints
      ? {
          ...profile,
          experienceLevel: constraints.experienceLevel ?? profile?.experienceLevel,
          tradedBefore: constraints.tradedBefore ?? profile?.tradedBefore,
          riskComfort: constraints.riskComfort ?? profile?.riskComfort,
          beginnerLearningStyle: constraints.beginnerLearningStyle ?? undefined,
        }
      : (profile ?? {});
    // Knowledge layer: when the question is about Lyra itself (setup, deployment, costs, how
    // the score works), retrieve the relevant doc sections so the answer is grounded and
    // citable. Deterministic HYBRID retrieval (lexical gate + char-trigram cosine rerank);
    // '' for ordinary market/portfolio questions.
    const knowledgeBlock = last?.role === 'user' ? buildHybridKnowledgeBlock(last.content) : '';
    const system = composeSystem([
      LYRA_IDENTITY,
      'The user is chatting with you. Answer their question directly.',
      LYRA_GUARDRAILS,
      LYRA_CHAT_FORMAT,
      // Action proposals are opt-in. Even when enabled, Lyra only PROPOSES; the user confirms and
      // deterministic code performs the (reversible) action. Lyra never acts on its own.
      agentActions
        ? 'ACTIONS (enabled): ONLY when the user EXPLICITLY asks to add, track, watch, save, or log a specific stock/trade, you may PROPOSE one action by adding a line BEFORE the FOLLOW_UPS line. Forms: "ACTION: add_watchlist || SYMBOL", "ACTION: add_portfolio || SYMBOL", or "ACTION: log_trade || BUY || SYMBOL || AMOUNT". Use the real ticker and numeric dollar amount. Propose at most ONE action, and only the one they asked for. CRITICAL: you do NOT perform the action - the user confirms it via a button. So phrase your reply as an OFFER awaiting their confirmation. NEVER claim you have already added, saved, logged, or processed it. NEVER propose selling, ordering, money movement, or anything they did not explicitly request.'
        : 'You cannot take actions or change the user data; you explain and answer only.',
      'NEXT STEPS: After your answer, add one final line in exactly this form: "FOLLOW_UPS: question one || question two || question three". Give 2-3 short, natural questions THIS user would most likely want to ask next, each fully answerable from the same dashboard data and specific (name the tickers or sections). Phrase them as the user would ask ("Why is...", "Compare...", "What about..."). Put nothing after that line.',
      toneFor(profileForTone),
      constraintsBlock
        ? 'PERSONALISATION: Read everything against YOUR PROFILE & CONSTRAINTS below and tie what you say to the stated goal, horizon and risk comfort. CHECK ideas against the constraints - flag when a name sits outside their risk comfort, when a setup would breach the max position size, or when something does not fit the available cash - but do NOT prescribe a trade: never state how many shares to buy or a dollar amount to put in, and never tell them to buy, sell, hold or size a position (that is the NOT ADVICE rule, and it wins). Describe the fit and let them decide.'
        : false,
      constraintsBlock || false,
      `CONTEXT (deterministic, from the latest scan):\n${buildGrounding(data, new Date())}`,
      knowledgeBlock || false,
    ]);
    // Cross-session memory: on a fresh session (short in-session history) seed context from the user's
    // OWN prior turns (opt-in, RLS-scoped). Recalled user turns are injection-screened exactly like
    // live ones, so a poisoned memory cannot smuggle in instructions.
    let recalled: ChatMessage[] = [];
    if (authenticated && messages.length <= 2) {
      const prior = await loadRecentChatTurns(HISTORY_TURNS).catch(() => [] as ChatMessage[]);
      recalled = prior.filter((m) => !(m.role === 'user' && detectInjectionAttempt(m.content)));
    }
    const historyTurns = [...recalled, ...screenedTurns];
    const history = historyTurns.map((m) => `${m.role === 'user' ? 'User' : 'Lyra'}: ${m.content}`).join('\n');
    const prompt = `${history}\nLyra:`;

    const startedAt = Date.now();
    const { text, model: usedModel } = await complete({
      provider: creds.provider,
      apiKey: creds.apiKey,
      model: creds.model,
      system,
      prompt,
      maxTokens: 600,
      retryOn429: creds.source === 'user',
    });
    const latencyMs = Date.now() - startedAt;
    if (!text) return NextResponse.json({ ok: false, reason: 'empty' });
    // Strip an echoed "Lyra:" turn label, then split off the FOLLOW_UPS line into suggestion chips.
    let cleaned = text.replace(/^\s*(?:Lyra|Assistant)\s*:\s*/i, '').trim();

    // Parse an optional ACTION line (only honoured when actions are enabled) into a confirm-to-act
    // proposal, and strip it from the visible answer. The user confirms; Lyra never executes.
    let action: ProposedAction | null = null;
    if (agentActions) {
      const trade = cleaned.match(/\n?\s*ACTION\s*:\s*log_trade\s*\|\|\s*BUY\s*\|\|\s*([A-Za-z0-9.\-]{1,12})\s*\|\|\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*$/im);
      if (trade) {
        const symbol = trade[1].toUpperCase().trim();
        const notional = Number(trade[2].replace(/,/g, ''));
        if (symbol && Number.isFinite(notional) && notional > 0) action = { type: 'log_trade', symbol, side: 'buy', notional };
        cleaned = cleaned.replace(trade[0], '').trim();
      }
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

    // Output-side guardrails - the same doctrine the agent/GenUI paths already enforce
    // mechanically. The allow-set is every numeral in the grounding the model actually saw
    // (system context + the screened history, so the user's own figures are echoable).
    // Fabricated-figure sentences are stripped; advice / injection-echo still blocks.
    // Suggestion chips are user-voice questions, not factual claims - they stay unguarded.
    const guarded = guardProse(answer || cleaned, [system, history]);
    if (!guarded.ok) {
      void recordAiRun({
        userId: guard.identity,
        agentName: 'portfolio_assistant',
        provider: creds.provider,
        model: usedModel,
        inputHash,
        outputHash: hashInput(answer),
        toolsUsed: [],
        injectionFlags: guarded.verdict.blockedReasons,
        validationErrors: [],
        citationCount: 0,
        status: 'refused',
        refusalReason: `guardrail_block: ${guarded.verdict.blockedReasons.join('; ') || 'empty after strip'}`,
        latencyMs,
      }).catch(() => {});
      return NextResponse.json({
        ok: true,
        text: 'I drafted an answer that tripped Lyra\'s research-only guardrails (an ungrounded figure or advice-style wording), so I stopped it. Ask me to explain the data behind your question and I\'ll ground every number in the latest scan.',
        suggestions,
      });
    }
    const finalText = guarded.text;

    // Durable-by-design audit (hash-only) + the Listening layer (captures the question on purpose).
    void recordAiRun({
      userId: guard.identity,
      agentName: 'portfolio_assistant',
      provider: creds.provider,
      model: usedModel,
      inputHash,
      outputHash: hashInput(finalText),
      toolsUsed: [],
      injectionFlags: [...guarded.verdict.warnings, ...guarded.strippedFigures.map((f) => `stripped:${f}`)],
      validationErrors: [],
      citationCount: 0,
      status: 'ok',
      refusalReason: null,
      latencyMs,
    }).catch(() => {});
    if (last?.role === 'user') recordQuestionSignal(last.content);

    // Persist this exchange for cross-session recall (opt-in + RLS enforced inside; best-effort).
    if (authenticated && last?.role === 'user') {
      void appendChatTurns([
        { role: 'user', content: last.content },
        { role: 'assistant', content: finalText },
      ]).catch(() => {});
    }

    return NextResponse.json({ ok: true, text: finalText, suggestions, action });
  } catch {
    return NextResponse.json({ ok: false, reason: 'error' });
  }
}
