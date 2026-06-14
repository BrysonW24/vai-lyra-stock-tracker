import { AppShell } from '@/components/AppShell';
import { PaperBotView } from '@/components/paper-bot/PaperBotView';
import { getDashboardData } from '@/lib/data';

/**
 * Paper Bot page - the human-in-the-loop surface for the deterministic, paper-only spine.
 * Live trading is disabled by design; the AI explains, the user approves, deterministic code fills
 * on paper through the existing risk engine + simulator.
 */
export default async function PaperBotPage() {
  const data = await getDashboardData();
  return (
    <AppShell data={data}>
      <PaperBotView />
    </AppShell>
  );
}
