/**
 * WhatsApp Cloud API outbound adapter - architecture stub, no real send required. [Part 9]
 *
 * Behaviour:
 * - WHATSAPP_ACCESS_TOKEN unset (the default): every send resolves to a
 *   'demo_logged' DeliveryRecord-shaped result with the note
 *   "WhatsApp not configured - this would be sent". Nothing leaves the box.
 * - Token set: POSTs graph.facebook.com/<version>/<phone_number_id>/messages with
 *   appsecret_proof appended (sha256 HMAC of the access token keyed with the app
 *   secret) so a leaked token alone cannot call the API.
 * - NEVER throws. Failures resolve to a 'failed' record with a redacted error.
 * - NEVER logs tokens or full phone numbers. Secrets are server-side env only -
 *   never NEXT_PUBLIC_*, never imported by client components.
 *
 * Doctrine: this adapter delivers what the deterministic router already approved
 * (src/lib/notifications/types.ts). It has no decision logic and no AI.
 */
import { createHmac } from 'node:crypto';
import type { DeliveryRecord } from './types';
import type { WhatsAppOutboundMessage, WhatsAppTemplateComponent } from './whatsapp-templates';

/**
 * DeliveryRecord minus the event/user context the caller owns. The notification
 * router merges this back into a full DeliveryRecord when persisting.
 */
export type WhatsAppDeliveryResult = Omit<DeliveryRecord, 'eventId' | 'userId'> & {
  idempotencyKey: string;
  /** Human note for demo mode and operational logs. */
  note?: string;
};

interface WhatsAppEnv {
  accessToken: string | undefined;
  phoneNumberId: string | undefined;
  appSecret: string | undefined;
  apiVersion: string;
}

/**
 * Server-side env read. Intentionally NOT in src/lib/env.ts - that module is imported
 * by frontend code and none of these values may ever reach a browser bundle.
 */
function readWhatsAppEnv(): WhatsAppEnv {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || undefined,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || undefined,
    appSecret: process.env.WHATSAPP_APP_SECRET || undefined,
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
  };
}

/**
 * Meta appsecret_proof: HMAC-SHA256 of the access token keyed with the app secret.
 * Required by Graph API calls when "Require app secret" is enabled - a stolen access
 * token is useless without the app secret. Pure and deterministic.
 */
export function buildAppSecretProof(accessToken: string, appSecret: string): string {
  return createHmac('sha256', appSecret).update(accessToken, 'utf8').digest('hex');
}

/** Mask a phone number for logs: keep a short prefix and the last two digits. */
export function maskDestination(destination: string): string {
  const compact = destination.replace(/\s+/g, '');
  if (compact.length <= 6) return '***';
  return `${compact.slice(0, 4)}***${compact.slice(-2)}`;
}

/** Strip secret material out of any text that might end up in a record or log. */
function redactSecrets(text: string, env: WhatsAppEnv): string {
  let out = text;
  if (env.accessToken) out = out.split(env.accessToken).join('[redacted]');
  if (env.appSecret) out = out.split(env.appSecret).join('[redacted]');
  return out;
}

// --- Graph API payload shapes ---------------------------------------------------

interface GraphTextPayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: { body: string; preview_url: false };
}

interface GraphTemplatePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components: WhatsAppTemplateComponent[];
  };
}

type GraphMessagePayload = GraphTextPayload | GraphTemplatePayload;

function buildGraphPayload(destination: string, message: WhatsAppOutboundMessage | string): GraphMessagePayload {
  if (typeof message === 'string' || message.kind === 'text') {
    const body = typeof message === 'string' ? message : message.body;
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: destination,
      type: 'text',
      text: { body, preview_url: false },
    };
  }
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: destination,
    type: 'template',
    template: {
      name: message.name,
      language: { code: message.languageCode },
      components: message.components,
    },
  };
}

function buildMessagesUrl(env: WhatsAppEnv): string {
  const base = `https://graph.facebook.com/${env.apiVersion}/${env.phoneNumberId}/messages`;
  if (!env.accessToken || !env.appSecret) return base;
  return `${base}?appsecret_proof=${buildAppSecretProof(env.accessToken, env.appSecret)}`;
}

function previewOf(message: WhatsAppOutboundMessage | string): string {
  if (typeof message === 'string') return message;
  return message.kind === 'text' ? message.body : message.previewText;
}

// --- public entry point -----------------------------------------------------------

/**
 * Send (or demo-log) one WhatsApp message. Never throws.
 *
 * @param destination     E.164 phone number of a PAIRED channel - callers resolve
 *                        pairing via notification_channels, never from inbound text.
 * @param templateOrText  A typed template (whatsapp-templates.ts) for
 *                        business-initiated sends, or free text only inside the
 *                        24-hour customer-service window (e.g. command replies).
 * @param idempotencyKey  Exactly-once key from the notification event - the same key
 *                        must never produce two provider sends once persistence lands.
 */
export async function sendWhatsAppMessage(
  destination: string,
  templateOrText: WhatsAppOutboundMessage | string,
  idempotencyKey: string,
): Promise<WhatsAppDeliveryResult> {
  const env = readWhatsAppEnv();
  const base = {
    id: `wa-${idempotencyKey}`,
    channel: 'whatsapp' as const,
    destination,
    attempt: 1,
    idempotencyKey,
    createdAt: new Date().toISOString(),
  };

  if (!env.accessToken || !env.phoneNumberId) {
    const note = 'WhatsApp not configured - this would be sent';
    console.info(
      `[whatsapp] demo_logged to=${maskDestination(destination)} key=${idempotencyKey} ${note}: ${previewOf(templateOrText).slice(0, 160)}`,
    );
    return { ...base, status: 'demo_logged', note };
  }

  try {
    const res = await fetch(buildMessagesUrl(env), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.accessToken}`,
      },
      body: JSON.stringify(buildGraphPayload(destination, templateOrText)),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      const errorMessage = redactSecrets(`graph_api ${res.status}: ${errorBody.slice(0, 300)}`, env);
      console.warn(`[whatsapp] send failed to=${maskDestination(destination)} key=${idempotencyKey} ${errorMessage}`);
      return { ...base, status: 'failed', errorMessage };
    }

    const data = (await res.json().catch(() => ({}))) as { messages?: Array<{ id?: string }> };
    return { ...base, status: 'sent', providerMessageId: data.messages?.[0]?.id };
  } catch (err) {
    const errorMessage = redactSecrets(err instanceof Error ? err.message : 'unknown send error', env);
    console.warn(`[whatsapp] send threw to=${maskDestination(destination)} key=${idempotencyKey} ${errorMessage}`);
    return { ...base, status: 'failed', errorMessage };
  }
}
