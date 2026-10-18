import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });
  const params = new URL(req.url).searchParams;

  // 收藏題目:依 id 讀取(只能讀自己的)
  const ids = (params.get('ids') || '').split(',').filter(Boolean).slice(0, 200);
  if (ids.length) {
    const logs = (await db.getRecords(ids)).filter((l) => l.user === user.username);
    return NextResponse.json({ logs: logs.map(db.lightRecord) });
  }

  const q = (params.get('q') || '').toLowerCase();
  let logs = user.role === 'admin' ? await db.listHistoryAll(300) : await db.listHistoryFor(user.username, 300);
  if (q) logs = logs.filter((l) => JSON.stringify(l).toLowerCase().includes(q));
  return NextResponse.json({ logs: logs.slice(0, 100).map(db.lightRecord) });
}
