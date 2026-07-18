/**
 * Native share - Web Share API first, clipboard fallback, zero plugins.
 *
 * `navigator.share` opens the system share sheet in iOS Safari and Android
 * Chrome; WKWebView exposes it on modern iOS but that must be confirmed on a
 * TestFlight device (if absent in the shell, callers gated on capability
 * 'share' simply hide - coherent either way, and the @capacitor/share plugin
 * is the Phase 2 fallback, see docs/product/native-app.md). When the sheet
 * errors mid-share we fall back to copying the link, matching the existing
 * PineExportButton clipboard precedent.
 */

export type ShareCapability = 'share' | 'clipboard' | 'none';

export interface ShareLinkData {
  title: string;
  text?: string;
  /** Absolute URL, or a path resolved against the current origin at call time. */
  url: string;
}

export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'failed';

/** SSR-safe capability probe. Callers hide the affordance on 'none'. */
export function shareCapability(): ShareCapability {
  if (typeof navigator === 'undefined') return 'none';
  if (typeof navigator.share === 'function') return 'share';
  if (typeof navigator.clipboard?.writeText === 'function') return 'clipboard';
  return 'none';
}

/** Resolve a path against the current origin so shares work on any deployment. */
export function absoluteShareUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  if (typeof window === 'undefined') return url;
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

/**
 * Share a link via the system sheet, falling back to clipboard copy. A user
 * cancelling the share sheet is 'dismissed', not a failure - callers must not
 * show a success state for it.
 */
export async function shareLink(data: ShareLinkData): Promise<ShareOutcome> {
  const url = absoluteShareUrl(data.url);
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: data.title, text: data.text, url });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'dismissed';
      // fall through to clipboard - e.g. NotAllowedError outside a user gesture
    }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  return 'failed';
}
