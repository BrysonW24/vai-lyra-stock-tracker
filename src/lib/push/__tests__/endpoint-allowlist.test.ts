import { describe, expect, it } from 'vitest';
import { isAllowedPushEndpoint } from '@/lib/push/server';

/**
 * SSRF fence for Web Push endpoints. Only real push services over https may be stored/sent;
 * an internal or attacker URL must be rejected so sendWebPush cannot be turned into a
 * server-side request forwarder.
 */
describe('isAllowedPushEndpoint', () => {
  it('allows the real push services (https)', () => {
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc123')).toBe(true);
    expect(isAllowedPushEndpoint('https://web.push.apple.com/QABC')).toBe(true);
    expect(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/xyz')).toBe(true);
    expect(isAllowedPushEndpoint('https://abc.notify.windows.com/w/?token=x')).toBe(true);
  });

  it('rejects internal, loopback and metadata targets (the SSRF payloads)', () => {
    expect(isAllowedPushEndpoint('http://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isAllowedPushEndpoint('http://localhost:3000/admin')).toBe(false);
    expect(isAllowedPushEndpoint('http://127.0.0.1/')).toBe(false);
    expect(isAllowedPushEndpoint('http://10.0.0.5:8080/')).toBe(false);
    expect(isAllowedPushEndpoint('http://internal-service:9200/')).toBe(false);
  });

  it('rejects non-https and lookalike / spoofed hosts', () => {
    expect(isAllowedPushEndpoint('http://fcm.googleapis.com/fcm/send/x')).toBe(false); // must be https
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com.evil.com/x')).toBe(false); // suffix trick
    expect(isAllowedPushEndpoint('https://evil.com/fcm.googleapis.com')).toBe(false); // path trick
    expect(isAllowedPushEndpoint('https://notfcm.googleapis.com/x')).toBe(false);
    expect(isAllowedPushEndpoint('not a url')).toBe(false);
    expect(isAllowedPushEndpoint('')).toBe(false);
  });
});
