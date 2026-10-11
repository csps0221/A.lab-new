import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });
  return NextResponse.json({ announcements: await db.listAnnouncements() });
}
