import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await getSessionUser();
  if (!u) return NextResponse.json({ error: '未登入' }, { status: 401 });
  const cfg = await db.getConfig();
  return NextResponse.json({ user: db.publicUser(u), subjects: db.allowedSubjects(u, cfg) });
}
