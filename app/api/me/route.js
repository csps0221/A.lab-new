import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

// 一次回傳:使用者、可用科目、目前有效的公告(少一次網路往返)
export async function GET() {
  const [u, cfg, announcements] = await Promise.all([getSessionUser(), db.getConfig(), db.listActiveAnnouncements()]);
  if (!u) return NextResponse.json({ error: '未登入' }, { status: 401 });
  return NextResponse.json({ user: db.publicUser(u), subjects: db.allowedSubjects(u, cfg), announcements });
}
