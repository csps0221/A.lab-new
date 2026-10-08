import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getUser } from '@/lib/db';

const COOKIE = 'alab_session';
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET || '');

export async function createSession(username) {
  const token = await new SignJWT({ u: username })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(key());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSession() {
  cookies().delete(COOKIE);
}

export async function getSessionUser() {
  const token = cookies().get(COOKIE)?.value;
  if (!token || !process.env.SESSION_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return await getUser(payload.u);
  } catch {
    return null;
  }
}
