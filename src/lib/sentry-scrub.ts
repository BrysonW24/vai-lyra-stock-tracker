/**
 * What must never leave for Sentry.
 *
 * The SDK attaches the incoming request to error events and sampled traces, and by default that
 * includes up to 10 KB of the request BODY. On this app those bodies are the sensitive part: an
 * AI request carries the user's own provider key (`ai.apiKey`) and their conversation, feedback
 * carries free text and an email address, onboarding and portfolio writes carry a person's
 * holdings. None of it helps debug a stack trace, and shipping it contradicts what the app says
 * about itself ("never logged or persisted"). So the body is dropped outright, along with cookies
 * and any header that is a credential.
 *
 * Done in a `beforeSend` hook on purpose: it is the last step before an event leaves the process,
 * so it holds whatever the integrations upstream of it decided to collect.
 */
const CREDENTIAL_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'apikey',
  'x-api-key',
  'x-notification-secret',
  'x-telegram-bot-api-secret-token',
  'x-hub-signature',
  'x-hub-signature-256',
]);

interface SentryRequestLike {
  data?: unknown;
  cookies?: unknown;
  headers?: Record<string, unknown>;
}

export function scrubSentryEvent<T extends { request?: SentryRequestLike }>(event: T): T {
  const request = event.request;
  if (!request) return event;
  delete request.data;
  delete request.cookies;
  if (request.headers) {
    for (const name of Object.keys(request.headers)) {
      if (CREDENTIAL_HEADERS.has(name.toLowerCase())) delete request.headers[name];
    }
  }
  return event;
}
