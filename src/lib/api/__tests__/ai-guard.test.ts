/**
 * Who a caller is, for rate limiting. Pins that an IPv6 caller is counted by their /64 - the block
 * one connection is handed - so rotating through its addresses does not mint a fresh allowance per
 * request. That is the difference between "40 free answers a day" and "as many as you like".
 */
import { describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ getSessionUser: async () => null }));

import { clientIp, rateLimitKeyForIp } from '../ai-guard';

const request = (headers: Record<string, string>) => ({ headers: new Headers(headers) }) as unknown as NextRequest;

describe('rateLimitKeyForIp', () => {
  it('leaves an IPv4 address as it is', () => {
    expect(rateLimitKeyForIp('203.0.113.7')).toBe('203.0.113.7');
    expect(rateLimitKeyForIp(' 203.0.113.7 ')).toBe('203.0.113.7');
  });

  it('counts every address in one IPv6 /64 as the same caller', () => {
    const key = '2001:db8:1:2::/64';
    expect(rateLimitKeyForIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe(key);
    expect(rateLimitKeyForIp('2001:db8:1:2::1')).toBe(key);
    expect(rateLimitKeyForIp('2001:0DB8:0001:0002:0000:0000:0000:0001')).toBe(key);
    expect(rateLimitKeyForIp('[2001:db8:1:2::1]')).toBe(key);
    expect(rateLimitKeyForIp('2001:db8:1:2::1%eth0')).toBe(key);
    // The next /64 along is somebody else.
    expect(rateLimitKeyForIp('2001:db8:1:3::1')).toBe('2001:db8:1:3::/64');
    expect(rateLimitKeyForIp('::1')).toBe('0:0:0:0::/64');
  });

  it('reads an IPv4 address carried inside IPv6 as that IPv4 address', () => {
    expect(rateLimitKeyForIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(rateLimitKeyForIp('0:0:0:0:0:ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('reads an IPv4 address written as two hex groups as that IPv4 address too', () => {
    // Without this every such caller shared one bucket (0:0:0:0::/64) with every other.
    expect(rateLimitKeyForIp('::ffff:cb00:7107')).toBe('203.0.113.7');
    expect(rateLimitKeyForIp('::ffff:cc00:7107')).toBe('204.0.113.7');
    expect(rateLimitKeyForIp('0:0:0:0:0:FFFF:CB00:7107')).toBe('203.0.113.7');
  });

  it('drops a port, so one caller is not a new caller on every connection', () => {
    expect(rateLimitKeyForIp('203.0.113.7:5678')).toBe('203.0.113.7');
    expect(rateLimitKeyForIp('203.0.113.7:443')).toBe('203.0.113.7');
    expect(rateLimitKeyForIp('[2001:db8:1:2::1]:443')).toBe('2001:db8:1:2::/64');
    expect(rateLimitKeyForIp('[2001:db8:1:2::9]:8080')).toBe('2001:db8:1:2::/64');
  });

  it('returns what it cannot read unchanged, so a strange header still gets a bucket of its own', () => {
    expect(rateLimitKeyForIp('not-an-address')).toBe('not-an-address');
    expect(rateLimitKeyForIp('1::2::3')).toBe('1::2::3');
    expect(rateLimitKeyForIp('2001:db8:zzzz::1')).toBe('2001:db8:zzzz::1');
    expect(rateLimitKeyForIp('1:2:3:4:5:6:7:8:9')).toBe('1:2:3:4:5:6:7:8:9');
  });
});

describe('clientIp', () => {
  it('prefers the address the platform set, and keys IPv6 by /64', () => {
    expect(clientIp(request({ 'x-real-ip': '2001:db8:1:2:aaaa::9', 'x-forwarded-for': '9.9.9.9' }))).toBe('2001:db8:1:2::/64');
    expect(clientIp(request({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
  });

  it('takes the nearest hop of x-forwarded-for, never the one the caller wrote', () => {
    expect(clientIp(request({ 'x-forwarded-for': '6.6.6.6, 2001:db8:1:2::77' }))).toBe('2001:db8:1:2::/64');
    expect(clientIp(request({}))).toBe('anon');
  });
});
