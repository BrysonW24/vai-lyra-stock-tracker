'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ViewMode } from '@/lib/view-mode';

/**
 * Carries the server-read view mode to every AppShell in the tree.
 *
 * Every page renders its own AppShell, so without this the shell would have to read the
 * cookie client-side on 56 pages - which means SSR emits the dense nav and hydration
 * swaps it, the exact flash of complexity Simple view exists to remove. The root layout
 * reads the cookie once on the server and provides it here, so the FIRST byte of HTML
 * already carries the right shell.
 */
const ViewModeContext = createContext<ViewMode>('simple');

export function ViewModeProvider({ mode, children }: { mode: ViewMode; children: ReactNode }) {
  return <ViewModeContext.Provider value={mode}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewMode {
  return useContext(ViewModeContext);
}
