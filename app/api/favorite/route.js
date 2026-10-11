import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';

const err = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return err('請先登入', 401);
  const { id, on } = await req.json().catch(() => ({}));
  const rec = await db.getRecord(String(id || ''));
  if (!rec) return err('找不到這題的紀錄', 404);
  if (rec.user !== user.username) return err('只能收藏自己的題目', 403);

  const set = new Set(user.favorites || []);
  if (on) set.add(rec.id); else set.delete(rec.id);
  if (set.size > 200) return err('收藏數量已達上限(200 題)');
  user.favorites = [...set];
  await db.putUser(user);
  return NextResponse.json({ favorites: user.favorites });
}
