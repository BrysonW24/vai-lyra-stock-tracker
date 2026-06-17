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
    return {
      status: 'failed',
      errorMessage: statusCode ? `web push ${statusCode}: ${pushError.body || pushError.message}` : pushError.message,
      expired: statusCode === 404 || statusCode === 410,
    };
  }
}
