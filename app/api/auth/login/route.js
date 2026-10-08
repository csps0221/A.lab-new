import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import * as db from '@/lib/db';
import { createSession } from '@/lib/auth';

export async function POST(req) {
  try {
    const { username, password } = await req.json();
    await db.ensureSeed();
    const u = await db.getUser(String(username || '').trim());
    if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash)) {
      return NextResponse.json({ error: '帳號或密碼錯誤,請重新確認!' }, { status: 401 });
    }
    if (u.first_login) return NextResponse.json({ mustChange: true });
    await createSession(u.username);
    await db.logLogin(u.username);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
