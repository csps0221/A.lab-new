import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });
  return NextResponse.json({ announcements: await db.listActiveAnnouncements() });
}

// 學生按「了解」:記下時間,3 天內不再彈出
export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });
  const { ids } = await req.json().catch(() => ({}));
  const active = (await db.listActiveAnnouncements()).map((a) => a.id);
  const now = Date.now();
  const ack = {};
  for (const [k, v] of Object.entries(user.ann_ack || {})) {
    if (active.includes(k) && now - v < THREE_DAYS) ack[k] = v;
  }
  for (const id of Array.isArray(ids) ? ids : []) if (active.includes(id)) ack[id] = now;
  user.ann_ack = ack;
  await db.putUser(user);
  return NextResponse.json({ ann_ack: ack });
}
