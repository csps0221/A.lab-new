import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });
  const q = (new URL(req.url).searchParams.get('q') || '').toLowerCase();
  let logs = await db.listHistory();
  if (user.role !== 'admin') logs = logs.filter((l) => l.user === user.username);
  if (q) logs = logs.filter((l) => JSON.stringify(l).toLowerCase().includes(q));
  return NextResponse.json({ logs });
}
