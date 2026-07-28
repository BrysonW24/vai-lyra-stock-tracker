import { describe, expect, it } from 'vitest';
import config from '../../../../capacitor.config';

/**
 * Shape-guard for the iOS remote-shell config (audit V14). The native binary is a thin WKWebView
 * whose whole job is to load prod and, offline, fall back to the bundled page. Nothing pinned these
 * invariants, so repointing server.url, flipping cleartext on, dropping errorPath (the offline
 * fallback), or letting contentInset drift off 'never' (the double-inset regression) would ship a
 * broken native build silently. ios/, native/, and capacitor.config.ts are now owned by check:chains;
 * these assertions are the behavioral half - the config surface finally has a red-on-regression gate.
 */
describe('capacitor.config - iOS remote shell invariants', () => {
  it('points the WKWebView at the production https host', () => {
    expect(config.server?.url).toBe('https://lyra.vivacityai.com.au');
  });

  it('forbids cleartext so the shell only ever loads over https', () => {
    expect(config.server?.cleartext).toBe(false);
  });

  it('keeps the offline fallback errorPath (no bare WKWebView error on a no-network cold start)', () => {
    expect(config.server?.errorPath).toBe('index.html');
  });

  it('bundles the offline fallback page as webDir', () => {
    expect(config.webDir).toBe('native/shell');
  });

  it("keeps ios.contentInset 'never' so the web layer owns safe areas (no double-inset)", () => {
    expect(config.ios?.contentInset).toBe('never');
  });

  it('keeps the stable bundle id and app name', () => {
    expect(config.appId).toBe('com.vivacityai.lyra');
    expect(config.appName).toBe('Lyra');
  });
});
