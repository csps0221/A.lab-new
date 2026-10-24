import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';
import { labReply, friendlyError } from '@/lib/ai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const err = (m, s = 400) => NextResponse.json({ error: m }, { status: s });
const MAX_LEN = 500;     // 每則問題最多字數
const MAX_TURNS = 30;    // 每個對話最多問幾次

export async function GET(req) {
  const user = await getSessionUser();
  if (!user) return err('請先登入', 401);
  const id = new URL(req.url).searchParams.get('id');
  if (id) {
    const chat = await db.getChat(id);
    if (!chat || chat.user !== user.username) return err('找不到這個對話', 404);
    return NextResponse.json({ chat });
  }
  return NextResponse.json({ chats: await db.listChats(user.username) });
}

export async function DELETE(req) {
  const user = await getSessionUser();
  if (!user) return err('請先登入', 401);
  const id = new URL(req.url).searchParams.get('id');
  const chat = id && (await db.getChat(id));
  if (chat && chat.user === user.username) await db.deleteChat(user.username, id);
  return NextResponse.json({ ok: true });
}

export async function POST(req) {
  const [user, cfg] = await Promise.all([getSessionUser(), db.getConfig()]);
  if (!user) return err('請先登入', 401);

  const lm = db.lockRemaining(user);
  if (lm) return err(db.lockMessage(lm), 423);

  const b = await req.json().catch(() => ({}));
  const text = String(b.text || '').trim().slice(0, MAX_LEN);
  if (!text) return err('請輸入問題');
  if (!cfg.enable_gemini && !cfg.enable_openai) return err('管理員目前已關閉 AI 服務。', 503);

  // LAB AI 不需選科目:可問任何學科相關的問題(非學科問題才算偏題)
  let chat = null;
  if (b.id) {
    chat = await db.getChat(String(b.id));
    if (!chat || chat.user !== user.username) return err('找不到這個對話,請開新對話。', 404);
  }

  // LAB AI 有自己的每日次數(管理員可在後台調整)
  const limit = user.lab_limit ?? db.DEFAULT_LAB_LIMIT;
  const used = user.lab_used_today || 0;
  if (user.role !== 'admin' && used >= limit) return err('今天的 LAB AI 次數已用完,明天再來!', 429);
  if (chat && chat.messages.filter((m) => m.role === 'user').length >= MAX_TURNS) {
    return err('這個對話已經問很多次了,請開一個新對話。', 429);
  }

  const history = [...(chat ? chat.messages.slice(-6) : []), { role: 'user', text }].map(({ role, text: t }) => ({ role, text: t }));
  let reply;
  try {
    reply = await labReply(history, cfg);
  } catch (e) {
    return err(friendlyError(e), 502);
  }
  if (reply.includes('[[OFF_TOPIC]]')) { // 不存紀錄;第 1 次偏題不扣次數,第 2 次起扣 1 次,連續 3 次鎖定
    const r = await db.recordOffTopic(user.username, 'lab');
    if (r.locked) return err(db.lockMessage(db.LOCK_MS), 423);
    const note = r.charged ? '已扣 1 次次數' : '這次不扣次數';
    return err(`請問學科相關的問題就好(連續偏題 ${r.strikes}/${db.LOCK_STRIKES} 次,${note};滿 ${db.LOCK_STRIKES} 次將鎖定 24 小時)`, 422);
  }

  const now = db.nowStr();
  if (!chat) {
    chat = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, user: user.username, subject: '不限科目', title: text.slice(0, 24), created: now, messages: [] };
  }
  chat.messages.push({ role: 'user', text, time: now }, { role: 'ai', text: reply, time: now });
  chat.updated = now;
  await Promise.all([db.saveChat(chat), user.role === 'admin' ? null : db.bumpLab(user.username)]);
  return NextResponse.json({ chat, lab_used: user.role === 'admin' ? used : used + 1, lab_limit: limit });
}
