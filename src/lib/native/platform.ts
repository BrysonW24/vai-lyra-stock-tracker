/**
 * Native-shell detection - the ONE module every shell-aware surface imports.
 *
 * The iOS app is a Capacitor remote shell: the WKWebView loads production, and
 * Capacitor injects its bridge into the remote page before any app script runs.
 * So `window.Capacitor.isNativePlatform()` is true inside the shell and
 * `window.Capacitor` is undefined in every normal browser. Web behavior must be
 * byte-identical: every native-only path in the app gates on this module, and
 * this module alone.
 */
import { useEffect, useState } from 'react';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

interface WindowWithCapacitor extends Window {
  Capacitor?: CapacitorGlobal;
}

/**
 * True only when running inside the Capacitor native shell. SSR-safe: returns
 * false on the server and never throws, even if a page injects a broken
 * `window.Capacitor` shim.
 */
export function isNativeShell(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const capacitor = (window as WindowWithCapacitor).Capacitor;
    return capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/**
 * Hook form for client components. Returns false on the first render (matching
 * the server-rendered HTML, so hydration never mismatches) and updates to the
 * real answer in an effect. The Capacitor bridge is injected at document start,
 * before React mounts, so the effect reads a settled value.
 */
export function useIsNativeShell(): boolean {
  const [nativeShell, setNativeShell] = useState(false);
  useEffect(() => {
    if (isNativeShell()) setNativeShell(true);
  }, []);
  return nativeShell;
}
