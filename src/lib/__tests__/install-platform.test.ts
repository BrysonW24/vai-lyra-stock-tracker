/**
 * Home-screen install platform detection - drives which walkthrough the final onboarding
 * beat shows. Wrong classification = wrong instructions (or a skipped beat), so the pure
 * classifier is pinned across the real user-agent shapes.
 */
import { describe, expect, it } from 'vitest';
import { detectInstallPlatform } from '../install-platform';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

describe('detectInstallPlatform', () => {
  it('classifies an iPhone as ios (gets the Safari screenshot walkthrough)', () => {
    expect(detectInstallPlatform(IPHONE_UA, false)).toBe('ios');
  });

  it('classifies Android as android (gets the Chrome steps)', () => {
    expect(detectInstallPlatform(ANDROID_UA, false)).toBe('android');
  });

  it('classifies desktop as other (gets the grab-your-phone pointer)', () => {
    expect(detectInstallPlatform(MAC_UA, false)).toBe('other');
  });

  it('standalone display-mode means installed - the beat is skipped, on ANY platform', () => {
    expect(detectInstallPlatform(IPHONE_UA, true)).toBe('installed');
    expect(detectInstallPlatform(ANDROID_UA, true)).toBe('installed');
  });
});
