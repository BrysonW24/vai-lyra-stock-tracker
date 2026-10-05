import { cookies } from 'next/headers';
import { AppShellClient, type AppShellProps } from '@/components/AppShellClient';
import { parseViewMode, VIEW_MODE_COOKIE } from '@/lib/view-mode';

/**
 * The app shell every signed-in page renders.
 *
 * This server half exists for one reason: to read the visitor's Simple / Full choice from their
 * cookie so the right nav is in the first byte of HTML - no dense-then-simple flash.
 *
 * It lives HERE, not in the root layout, on purpose. Reading a cookie makes a route dynamic, and
 * the root layout wraps every route. v0.131.0 read it there, which quietly turned the public pages
 * (privacy, terms, support and the rest) from prerendered files served at the edge into a function
 * call on every request. Only pages that actually draw the shell need the cookie, so only they pay
 * for it. `npm run check:static-routes` (CI) fails the build if a public page stops being static.
 */
export async function AppShell({ viewMode, ...props }: AppShellProps) {
  const resolved = viewMode ?? parseViewMode((await cookies()).get(VIEW_MODE_COOKIE)?.value);
  return <AppShellClient {...props} viewMode={resolved} />;
}
