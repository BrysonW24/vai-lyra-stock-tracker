import { AppShell } from '@/components/AppShell';
import { AccountSettings } from '@/components/AccountSettings';
import { getDashboardData } from '@/lib/data';

export const metadata = { title: 'Account' };

export default async function AccountPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="pb-28 xl:pb-6">
        <AccountSettings />
      </div>
    </AppShell>
  );
}
