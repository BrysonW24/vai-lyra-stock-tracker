import { NextResponse } from 'next/server';
import { runPaperBotCommand } from '@/lib/trading/paper-bot-commands';
import type { AiCreds } from '@/lib/ai/run-agent';

export const dynamic = 'force-dynamic';

/**
 * Paper-bot CLI endpoint. POST { line, ai } -> runs one command through the same paper-only engine the
 * UI buttons use. No live path exists in the command allowlist.
 */
export async function POST(req: Request) {
  let body: { line?: unknown; ai?: AiCreds };
  try {
    body = (await req.json()) as { line?: unknown; ai?: AiCreds };
  } catch {
    return NextResponse.json({ ok: false, kind: 'error', lines: ['Bad request.'] }, { status: 400 });
  }
  const line = typeof body.line === 'string' ? body.line : '';
  // Resolve the AI key the same way every AI route does: user's key wins, else the shared Google
  // free-tier key (GOOGLE_AI_KEY) so the CLI's `propose` works with zero setup. Server-side only.
  const provider = body.ai?.provider ?? 'google';
  const userKey = body.ai?.apiKey?.trim();
  const sharedKey = provider === 'google' ? (process.env.GOOGLE_AI_KEY ?? '').trim() : '';
  const creds: AiCreds = { provider, apiKey: userKey || sharedKey, model: body.ai?.model };
  const result = await runPaperBotCommand(line, creds);
  return NextResponse.json(result);
}
