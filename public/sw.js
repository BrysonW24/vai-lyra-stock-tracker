self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Lyra alert';
  const body = payload.body || 'A market alert is ready to review.';
  const url = payload.url || '/';
  const tag = payload.tag || payload.dedupeKey || 'lyra-alert';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: true,
      icon: payload.icon || '/icons/icon-192.png',
      badge: payload.badge || '/icons/badge-72.png',
      data: { url, payload },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  // Trading-twin attention: record the OPEN (the missing half of open-vs-mute). Best-effort; the
  // server enforces the opt-in consent gate, so this is inert until the user turns capture on.
  try {
    const p = (event.notification.data && event.notification.data.payload) || {};
    event.waitUntil(
      fetch('/api/interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        keepalive: true,
        body: JSON.stringify({
          eventType: 'notification_open',
          entityType: 'notification',
          entityId: p.symbol ? String(p.symbol).slice(0, 40) : null,
          meta: { tag: (p.tag || p.dedupeKey || '').toString().slice(0, 40) },
        }),
      }).catch(() => {}),
    );
  } catch {
    /* never let capture break notification handling */
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url === absoluteUrl && 'focus' in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(absoluteUrl);
        return undefined;
      }),
  );
});
