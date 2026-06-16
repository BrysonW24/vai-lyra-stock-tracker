import { NextResponse } from 'next/server';
import { getAiRuntimeStatus } from '@/lib/ai/credentials';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getAiRuntimeStatus());
}
