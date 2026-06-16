import { NextResponse } from 'next/server';
import { runPaperBotCommand } from '@/lib/trading/paper-bot-commands';
import type { AiCreds } from '@/lib/ai/run-agent';
import { resolveAiCredentials } from '@/lib/ai/credentials';

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
  // Resolve the AI key the same way every AI route does. Server-side only.
  const resolved = resolveAiCredentials(body.ai);
  const creds: AiCreds = { provider: resolved.provider, apiKey: resolved.apiKey, model: resolved.model };
  const result = await runPaperBotCommand(line, creds);
  return NextResponse.json(result);
}
