import webPush, { type PushSubscription as WebPushSubscription } from 'web-push';

export interface StoredPushSubscription {
  id?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  dedupeKey?: string;
  data?: Record<string, unknown>;
}

export interface WebPushSendResult {
  status: 'sent' | 'failed' | 'demo_logged';
  providerMessageId?: string;
  errorMessage?: string;
  expired?: boolean;
}

interface WebPushError extends Error {
  statusCode?: number;
  body?: string;
}

/**
 * SSRF fence for push endpoints (mirrors the Slack webhook fence). The browser gives us the
 * push-service URL, but a malicious client can send ANY url, turning `sendNotification` into
 * an outbound request to internal hosts. We only ever POST to the real push services over
 * https, so a stored endpoint pointing at 169.254.169.254 / localhost / a VPC service is
 * rejected at save time AND again defensively before every send.
 */
const PUSH_HOST_SUFFIXES = [
  '.push.apple.com', // Safari / iOS (web.push.apple.com)
  '.notify.windows.com', // Edge / Windows (WNS)
  '.notify.live.net', // legacy WNS
  '.push.services.mozilla.com', // Firefox (updates.push.services.mozilla.com)
];
const PUSH_HOSTS_EXACT = new Set([
  'fcm.googleapis.com', // Chrome / Android (FCM)
  'updates.push.services.mozilla.com',
]);

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return PUSH_HOSTS_EXACT.has(host) || PUSH_HOST_SUFFIXES.some((s) => host.endsWith(s));
  } catch {
    return false;
  }
}

let vapidConfigured = false;

export function isWebPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configureWebPush(): boolean {
  if (!isWebPushConfigured()) return false;
  if (vapidConfigured) return true;
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:alerts@vivacity.ai',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidConfigured = true;
  return true;
}

function toWebPushSubscription(subscription: StoredPushSubscription): WebPushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

export async function sendWebPush(
  subscription: StoredPushSubscription,
  payload: WebPushPayload,
): Promise<WebPushSendResult> {
  if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
    return { status: 'failed', errorMessage: 'push subscription is missing endpoint or keys' };
  }
  // Defense in depth: even a legacy row that predates the save-time fence cannot be sent to
  // an internal host. `expired` so the caller prunes the offending subscription.
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    return { status: 'failed', errorMessage: 'push endpoint is not an allowed push service', expired: true };
  }
  if (!configureWebPush()) {
    console.info(
      JSON.stringify({ at: 'webpush.send', status: 'demo_logged', endpoint: subscription.endpoint.slice(0, 36) }),
    );
    return { status: 'demo_logged' };
  }

  try {
    const result = await webPush.sendNotification(
      toWebPushSubscription(subscription),
      JSON.stringify({
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        ...payload,
      }),
    );
    return {
      status: 'sent',
      providerMessageId: result.headers.location || result.headers['x-request-id'],
    };
  } catch (error) {
    const pushError = error as WebPushError;
    const statusCode = pushError.statusCode;
    // Do NOT surface the remote response body to the caller - reflecting it turns a failed
    // send into an SSRF oracle. Log details server-side; return only the status code.
    if (statusCode) {
      console.info(JSON.stringify({ at: 'webpush.send', status: 'failed', statusCode, body: pushError.body?.slice(0, 200) }));
    }
    return {
      status: 'failed',
      errorMessage: statusCode ? `web push failed (${statusCode})` : 'web push failed',
      expired: statusCode === 404 || statusCode === 410,
    };
  }
}
