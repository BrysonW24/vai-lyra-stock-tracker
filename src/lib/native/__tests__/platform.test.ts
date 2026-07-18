/**
 * Pins the native-shell detection contract. Every shell-only behavior in the
 * app (external-link escape, A2HS suppression) gates on isNativeShell, so a
 * false positive here would break the web experience for every browser user
 * and a false negative would break the iOS shell. Also pins the hydration
 * contract: the hook must render `false` on the server-side first render even
 * when the Capacitor bridge is present, so server and client HTML never
 * mismatch.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { isNativeShell, useIsNativeShell } from '@/lib/native/platform';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isNativeShell', () => {
  it('is false on the server (no window)', () => {
    expect(typeof window).toBe('undefined');
    expect(isNativeShell()).toBe(false);
  });

  it('is false in a normal browser (window without Capacitor)', () => {
    vi.stubGlobal('window', {});
    expect(isNativeShell()).toBe(false);
  });

  it('is false when a Capacitor-like global lacks isNativePlatform', () => {
    vi.stubGlobal('window', { Capacitor: {} });
    expect(isNativeShell()).toBe(false);
  });

  it('is false when isNativePlatform reports web', () => {
    vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => false } });
    expect(isNativeShell()).toBe(false);
  });

  it('is true only inside the native shell', () => {
    vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => true } });
    expect(isNativeShell()).toBe(true);
  });

  it('is false and does not throw when the bridge is broken', () => {
    vi.stubGlobal('window', {
      Capacitor: {
        isNativePlatform: () => {
          throw new Error('bridge exploded');
        },
      },
    });
    expect(isNativeShell()).toBe(false);
  });

  it('rejects truthy non-boolean returns from a shim', () => {
    vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => 'yes' as unknown as boolean } });
    expect(isNativeShell()).toBe(false);
  });
});

describe('useIsNativeShell hydration contract', () => {
  it('renders false on the server-side first render even when the bridge is present', () => {
    vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => true } });
    const Probe = () => createElement('span', null, useIsNativeShell() ? 'native' : 'web');
    // Effects never run in renderToString, so this IS the first-render output
    // that client hydration must match.
    expect(renderToString(createElement(Probe))).toContain('web');
  });
});
