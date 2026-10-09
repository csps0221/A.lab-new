import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';
import { followup, friendlyError, MAX_FOLLOWUPS } from '@/lib/ai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const err = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return err('請先登入', 401);

  const { id, question } = await req.json().catch(() => ({}));
  const q = String(question || '').trim().slice(0, 500);
  if (!q) return err('請輸入追問內容');

  const rec = await db.getRecord(String(id || ''));
  if (!rec) return err('找不到這題的紀錄', 404);
  if (rec.user !== user.username) return err('只能追問自己的題目', 403);
  if ((rec.followups || []).length >= MAX_FOLLOWUPS) return err(`這一題的追問已達 ${MAX_FOLLOWUPS} 次上限`, 429);

  const cfg = await db.getConfig();
  if (!cfg.enable_gemini && !cfg.enable_openai) return err('管理員目前已關閉所有 AI 服務。', 503);

  let answer;
  try {
    answer = await followup(rec, q, cfg);
  } catch (e) {
    return err(friendlyError(e), 502);
  }

  // 重新讀取再寫入,避免連按兩次造成超過上限
  const fresh = await db.getRecord(rec.id);
  fresh.followups = fresh.followups || [];
  if (fresh.followups.length >= MAX_FOLLOWUPS) return err(`這一題的追問已達 ${MAX_FOLLOWUPS} 次上限`, 429);
  fresh.followups.push({ q, a: answer, time: db.nowStr() });
  await db.updateRecord(fresh);
  return NextResponse.json({ followups: fresh.followups });
}
