import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });
  const rec = await db.getRecord(params.id);
  if (!rec) return NextResponse.json({ error: '找不到紀錄' }, { status: 404 });
  if (user.role !== 'admin' && rec.user !== user.username) {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }
  return NextResponse.json({ images: await db.getImages(rec.id, rec.image_count || 0) });
}
