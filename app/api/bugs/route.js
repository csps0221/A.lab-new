import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';

export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });
  const { message } = await req.json();
  const m = String(message || '').trim().slice(0, 2000);
  if (!m) return NextResponse.json({ error: '請輸入內容' }, { status: 400 });
  await db.addBug({ user: user.username, time: db.nowStr(), message: m });
  return NextResponse.json({ ok: true });
}
