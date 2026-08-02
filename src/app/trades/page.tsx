import { AppShell } from '@/components/AppShell';
import { TradeLogView } from '@/components/trades/TradeLogView';
import { getDashboardData } from '@/lib/data';

export const metadata = { title: 'Trade Log' };

export default async function TradesPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <div className="terminal-panel overflow-hidden rounded-panel">
          <div className="border-b border-line px-3 py-3">
            <h1 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Trade Log</h1>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
              Every buy you have logged through Lyra, newest first. Undo reverses the latest logged change for that symbol. Tracking and research only - not a brokerage.
            </p>
          </div>
          <div className="p-3">
            <TradeLogView />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
