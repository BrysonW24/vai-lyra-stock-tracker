'use client';

export interface PushSupportStatus {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  standalone: boolean;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = Boolean((window.navigator as NavigatorWithStandalone).standalone);
  return standaloneMedia || iosStandalone;
}

export function getPushSupportStatus(): PushSupportStatus {
  if (typeof window === 'undefined') {
    return { supported: false, permission: 'unsupported', standalone: false };
  }
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return {
    supported,
    permission: supported ? Notification.permission : 'unsupported',
    standalone: isStandalonePwa(),
  };
}

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser.');
  }
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!getPushSupportStatus().supported) return null;
  const registration = await registerPushServiceWorker();
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''): Promise<PushSubscription> {
  const status = getPushSupportStatus();
  if (!status.supported) {
    throw new Error('Push notifications are not supported in this browser.');
  }
  if (!publicKey) {
    throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured.');
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const registration = await registerPushServiceWorker();
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  const key = urlBase64ToUint8Array(publicKey);
  const applicationServerKey = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const existing = await getExistingPushSubscription();
  if (!existing) return true;
  return existing.unsubscribe();
}
