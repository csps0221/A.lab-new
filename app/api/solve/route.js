import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';
import { ocrImages, solve, friendlyError } from '@/lib/ai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const err = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return err('請先登入', 401);

  const b = await req.json().catch(() => ({}));
  const text = String(b.text || '').trim();
  const images = (Array.isArray(b.images) ? b.images : []).filter((s) => typeof s === 'string').slice(0, 5);
  if (!text && !images.length) return err('請輸入文字題目或上傳題目圖片!');

  const cfg = await db.getConfig();
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

  let ocr = '';
  if (images.length) {
    try {
      ocr = await ocrImages(images, text, subject, cfg);
    } catch (e) {
      if (!text) return err(friendlyError(e), 502); // 沒有文字可用時,辨識失敗就直接回報,不要拿空內容去解題
      ocr = '[圖片辨識失敗,以下僅依文字內容解題]';
    }
  }
  let question = '';
  if (text) question += `使用者文字題目/補充:\n${text}\n\n`;
  if (ocr) question += `圖片題目辨識內容:\n${ocr}`;

  let result;
  try {
    result = await solve(question, subject, depth, cfg, restricted ? allowed : null);
  } catch (e) {
    return err(friendlyError(e), 502);
  }

  if (result.off_topic) return err(offTopicMsg, 422); // 不扣額度、不存紀錄

  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user: user.username,
    time: db.nowStr(),
    subject,
    depth_mode: depth,
    ref_answer: refAnswer || '無',
    note: text || '無',
    ...result,
    question: question.slice(0, 6000),
    followups: [],
    image_count: images.length,
    admin_feedback: { status: 'pending', comment: '' },
  };
  await db.saveRecord(record, images);
  await db.incrementUsage(user.username); // 成功才扣額度
  return NextResponse.json(record);
}
