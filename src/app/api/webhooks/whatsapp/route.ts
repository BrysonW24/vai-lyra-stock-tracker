/**
 * WhatsApp Cloud API webhook - verification + signed inbound intake. [Part 9]
 *
 * GET  - Meta's one-time subscription handshake (hub.challenge echo).
 * POST - signed change notifications. The X-Hub-Signature-256 HMAC is verified
 *        against the RAW body before anything is parsed; unsigned or mis-signed
 *        traffic gets 401 and is never processed.
 *
 * Hard rules enforced here:
 * - Inbound text is UNTRUSTED INPUT. It is normalised, matched against a closed
 *   command grammar, logged (redacted), and acknowledged. Nothing free-form ever
 *   reaches business logic.
 * - No account creation from inbound. Unpaired numbers get a "pair in the web app"
 *   reply via the outbound stub (src/lib/notifications/whatsapp.ts) - pairing only
 *   happens in the authenticated web app (src/app/api/notifications/route.ts).
 * - Commands are parsed and logged only in this architecture pass. APPROVE/REJECT
 *   codes would have to exactly match a server-minted pending approval, and even a
 *   real approval can only record a paper decision - the deterministic pre-trade
 *   engine refuses every live mode (src/lib/trading/risk-engine.ts). LLMs are
 *   nowhere in this path.
 * - Return 200 fast once authenticity is established so Meta does not retry-storm.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { InboundCommand } from '@/lib/notifications/types';
import { maskDestination, sendWhatsAppMessage } from '@/lib/notifications/whatsapp';
import { verifyWhatsAppSignature } from '@/lib/notifications/whatsapp-signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- GET: Meta subscription verification ------------------------------------------

export function GET(request: NextRequest): NextResponse {
  const params = request.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const verifyToken = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  // Fail closed: unset env token can never verify; everything must match exactly.
  if (mode === 'subscribe' && expectedToken && verifyToken === expectedToken && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// --- POST: signed change notifications ---------------------------------------------

const inboundMessageSchema = z.object({
  from: z.string().min(1),
  id: z.string().min(1),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
});

const changeValueSchema = z.object({
  messaging_product: z.string().optional(),
  metadata: z
    .object({
      display_phone_number: z.string().optional(),
      phone_number_id: z.string().optional(),
    })
    .optional(),
  contacts: z
    .array(
      z.object({
        wa_id: z.string().optional(),
        profile: z.object({ name: z.string().optional() }).optional(),
      }),
    )
    .optional(),
  messages: z.array(inboundMessageSchema).optional(),
  statuses: z.array(z.record(z.unknown())).optional(),
});

const webhookPayloadSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(z.object({ field: z.string(), value: changeValueSchema })),
    }),
  ),
});

type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
type InboundMessage = z.infer<typeof inboundMessageSchema>;

interface ParsedCommand {
  command: InboundCommand;
  /** Present only for approve/reject - already pattern-validated, still untrusted. */
  code?: string;
}

/** Server-minted approval codes only: short, uppercase alphanumeric with hyphens. */
const APPROVAL_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{3,31}$/;
const MAX_COMMAND_LENGTH = 64;

/**
 * Closed command grammar over untrusted text. Anything that does not match exactly
 * collapses to 'unknown' - there is no free-form fallback and no LLM in this path.
 */
function parseInboundCommand(rawText: string): ParsedCommand {
  const normalized = rawText.trim().replace(/\s+/g, ' ').toUpperCase();
  if (!normalized || normalized.length > MAX_COMMAND_LENGTH) return { command: 'unknown' };

  const parts = normalized.split(' ');
  const verb = parts[0] ?? '';
  const args = parts.slice(1);

  switch (verb) {
    case 'STATUS':
      return args.length === 0 ? { command: 'status' } : { command: 'unknown' };
    case 'PORTFOLIO':
      return args.length === 0 ? { command: 'portfolio' } : { command: 'unknown' };
    case 'TODAY':
      return args.length === 0 ? { command: 'today' } : { command: 'unknown' };
    case 'MUTE':
      return args.length === 0 ? { command: 'mute' } : { command: 'unknown' };
    case 'UNMUTE':
      return args.length === 0 ? { command: 'unmute' } : { command: 'unknown' };
    case 'KILLSWITCH':
      // One-way by design: chat may only ACTIVATE the user kill switch, never clear it.
      return args.length === 0 ? { command: 'killswitch' } : { command: 'unknown' };
    case 'HELP':
      return args.length === 0 ? { command: 'help' } : { command: 'unknown' };
    case 'APPROVE':
    case 'REJECT': {
      const code = args[0];
      if (args.length !== 1 || !code || !APPROVAL_CODE_PATTERN.test(code)) {
        return { command: 'unknown' };
      }
      return { command: verb === 'APPROVE' ? 'approve' : 'reject', code };
    }
    default:
      return { command: 'unknown' };
  }
}

function extractInboundTextMessages(payload: WebhookPayload): InboundMessage[] {
  const messages: InboundMessage[] = [];
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;
      for (const message of change.value.messages ?? []) {
        if (message.type === 'text' && message.text?.body) messages.push(message);
      }
    }
  }
  return messages;
}

/**
 * Pairing lookup STUB. The real implementation resolves the sender's number against
 * the notification_channels rows written by the authenticated web app
 * (src/app/api/notifications/route.ts, channel_type = 'whatsapp', is_active = true)
 * using a server-side service-role client. Until that wiring lands, every inbound
 * number is treated as unpaired - which fails safe: no inbound message can ever act
 * on an account through this webhook.
 */
async function lookupPairedUser(phoneNumber: string): Promise<{ userId: string } | null> {
  void phoneNumber;
  return null;
}

const PAIRING_REPLY =
  'This number is not paired to a Lyra account. To pair it, sign in to the Lyra web app ' +
  'and add this number under Settings > Notifications. Accounts are never created from ' +
  'WhatsApp. Lyra is a research platform - not financial advice.';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Raw body FIRST - the signature is over the exact bytes, not a re-serialisation.
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('x-hub-signature-256');

  if (!verifyWhatsAppSignature(rawBody, signatureHeader, process.env.WHATSAPP_APP_SECRET)) {
    // Covers missing header, unset secret (fail closed), and any HMAC mismatch.
    return NextResponse.json({ ok: false, error: 'invalid signature' }, { status: 401 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    // Authentic but unparseable - acknowledge so Meta does not retry forever.
    console.warn('[whatsapp-webhook] signed but non-JSON body - ignored');
    return NextResponse.json({ ok: true, ignored: true });
  }

  const parsed = webhookPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    // Authentic but unrecognised shape (e.g. status-only or new Meta fields).
    console.warn('[whatsapp-webhook] signed payload failed schema validation - ignored');
    return NextResponse.json({ ok: true, ignored: true });
  }

  for (const message of extractInboundTextMessages(parsed.data)) {
    const parsedCommand = parseInboundCommand(message.text?.body ?? '');
    console.info(
      `[whatsapp-webhook] inbound from=${maskDestination(message.from)} msg=${message.id} ` +
        `command=${parsedCommand.command}${parsedCommand.code ? ` code=${parsedCommand.code}` : ''}`,
    );

    const pairedUser = await lookupPairedUser(message.from);
    if (!pairedUser) {
      // Reply goes through the outbound stub - demo_logged until WhatsApp is configured.
      await sendWhatsAppMessage(message.from, PAIRING_REPLY, `pair-prompt:${message.id}`);
      continue;
    }

    // Paired-number command EXECUTION is intentionally not implemented in this
    // architecture pass: commands are parsed, validated, and logged only. When it
    // lands, approve/reject must exact-match a pending approval and route through
    // runPreTradeChecks (src/lib/trading/risk-engine.ts) - deterministic code
    // decides, AI only explains, and live execution stays disabled.
  }

  return NextResponse.json({ ok: true });
}
