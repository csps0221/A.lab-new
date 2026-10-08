import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import * as db from '@/lib/db';
import { createSession } from '@/lib/auth';

export async function POST(req) {
  const { username, oldPassword, newPassword } = await req.json();
  const u = await db.getUser(String(username || '').trim());
  if (!u || !bcrypt.compareSync(String(oldPassword || ''), u.password_hash)) {
    return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 });
  }
  if (!newPassword || String(newPassword).length < 4) {
    return NextResponse.json({ error: '新密碼至少需要 4 個字元' }, { status: 400 });
  }
  u.password_hash = db.hashPw(String(newPassword));
  u.first_login = false;
  await db.putUser(u);
  await createSession(u.username);
  await db.logLogin(u.username);
  return NextResponse.json({ ok: true });
}
