import { NextResponse } from 'next/server';
import { buildAiSystemCard } from '@/lib/ai/system-card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * AI System Card - the public governance/transparency readout of Lyra's AI layer, assembled from the
 * policy, agent registry, guardrails, and LIVE eval gates. Non-sensitive by construction (no secrets,
 * no prompts, no user data), so it is public: anyone can see what the AI may and may never do, which
 * guards run, and whether the safety + quality evals are currently green.
 */
export async function GET() {
  return NextResponse.json({ ok: true, card: buildAiSystemCard() });
}
