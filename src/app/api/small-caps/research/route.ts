import { NextResponse } from 'next/server';
import { getDashboardData } from '@/lib/data';
import { buildSmallCapResearchBackend } from '@/lib/small-cap-research';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await getDashboardData();
  return NextResponse.json(buildSmallCapResearchBackend(data.signals));
}
