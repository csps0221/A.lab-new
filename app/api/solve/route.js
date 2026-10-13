import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';
import { solve, friendlyError } from '@/lib/ai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const err = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req) {
  const [user, cfg] = await Promise.all([getSessionUser(), db.getConfig()]);
  if (!user) return err('請先登入', 401);

  const b = await req.json().catch(() => ({}));
  const text = String(b.text || '').trim();
  const images = (Array.isArray(b.images) ? b.images : []).filter((s) => typeof s === 'string').slice(0, 5);
  if (!text && !images.length) return err('請輸入文字題目或上傳題目圖片!');

  const allowed = db.allowedSubjects(user, cfg);
  if (!allowed.length) return err('管理員尚未開放任何科目給你,請聯絡管理員。', 403);
  const offTopicMsg = `請問${allowed.join('、')}相關的題目`;
  if (b.subject && !allowed.includes(b.subject)) return err(offTopicMsg, 403);
  const subject = b.subject || allowed[0];
  const restricted = user.role !== 'admin' && allowed.length < cfg.subjects.length;
  const depth = db.DEPTHS.includes(b.depth) ? b.depth : '標準詳解';
  const refAnswer = String(b.refAnswer || '').slice(0, 200);

  if (!cfg.enable_gemini && !cfg.enable_openai) return err('管理員目前已關閉所有 AI 解題服務。', 503);
  if (user.role !== 'admin' && user.used_today >= (user.custom_limit || 15)) {
    return err('今日解題額度已用完,請明日再試!', 429);
  }

  // 圖片直接和題目一起送給 AI(不再先辨識再解題,速度約快一倍)
  const question = text ? `使用者文字題目/補充:\n${text}` : '(題目在附圖中,請依圖片作答)';
  let result;
  try {
    result = await solve(question, subject, depth, cfg, restricted ? allowed : null, images);
  } catch (e) {
    return err(friendlyError(e), 502);
  }

  if (result.off_topic) return err(subject === '其他' ? offTopicMsg : `這題不屬於「${subject}」,請改問${subject}相關的題目,或切換到正確的科目。`, 422); // 不扣額度、不存紀錄

  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user: user.username,
    time: db.nowStr(),
    subject,
    depth_mode: depth,
    ref_answer: refAnswer || '無',
    note: text || '無',
    ans: result.ans,
    reasoning: result.reasoning,
    options_analysis: result.options_analysis,
    question: [text && `使用者文字題目/補充:\n${text}`, result.question_text && `圖片題目內容:\n${result.question_text}`].filter(Boolean).join('\n\n').slice(0, 6000),
    followups: [],
    image_count: images.length,
    admin_feedback: { status: 'pending', comment: '' },
  };
  await Promise.all([db.saveRecord(record, images), db.incrementUsage(user.username)]); // 成功才扣額度
  return NextResponse.json(record);
}
