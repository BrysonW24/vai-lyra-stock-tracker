import { AppShell } from '@/components/AppShell';
import { EducationHub } from '@/components/education/EducationHub';
import { EducationCarousel } from '@/components/education/EducationCarousel';
import { getDashboardData } from '@/lib/data';

export default async function EducationPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const data = await getDashboardData();
  const { track } = await searchParams;

  return (
    <AppShell data={data}>
      <div className="space-y-4 pb-28 xl:pb-6">
        {track === 'beginner' && <EducationCarousel />}
        <EducationHub signals={data.signals} />
      </div>
    </AppShell>
  );
}
