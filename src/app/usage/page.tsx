import { AppShell } from '@/components/AppShell';
import { UsageDashboard } from '@/components/UsageDashboard';
import { getDashboardData } from '@/lib/data';

export const metadata = { title: 'Your Activity' };

/**
 * Your Activity - a private, on-device usage dashboard (time on app, sessions, AI requests, and a
 * surface heatmap). The stats live in the browser, so the page shell is server-rendered and the
 * dashboard itself reads local storage on the client.
 */
export default async function UsagePage() {
  const data = await getDashboardData();
  return (
    <AppShell data={data}>
      <UsageDashboard />
    </AppShell>
  );
}
