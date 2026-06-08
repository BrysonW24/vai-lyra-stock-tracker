import { AppShell } from '@/components/AppShell';
import { EducationHub } from '@/components/education/EducationHub';
import { LearningPath } from '@/components/education/LearningPath';
import { getDashboardData } from '@/lib/data';

export default async function EducationPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <LearningPath />
        <EducationHub signals={data.signals} />
      </div>
    </AppShell>
  );
}
