import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';
import { explainWrong, judgeText, friendlyError } from '@/lib/ai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const err = (m, s = 400) => NextResponse.json({ error: m }, { status: s });
const norm = (s) => [...new Set(String(s || '').toUpperCase().match(/[A-Z]/g) || [])].sort().join('');
// 給使用者的題目:不含答案
const pub = (q) => ({
  id: q.id, source: q.source, subject: q.subject, type: q.type, stem: q.stem, options: q.options || [],
  multi: q.type === 'choice' && norm(q.answer).length > 1, image_count: q.image_count || 0,
});

export async function GET(req) {
  const [user, cfg] = await Promise.all([getSessionUser(), db.getConfig()]);
  if (!user) return err('請先登入', 401);
  const isAdmin = user.role === 'admin';
  if (!isAdmin && !cfg.review_enabled) return NextResponse.json({ enabled: false });

  const limit = isAdmin ? null : (user.review_limit ?? cfg.review_default_limit ?? 10);
  const used = user.review_used_today || 0;
  const allowed = db.allowedSubjects(user, cfg);
  const sp = new URL(req.url).searchParams;
  const [all, prog] = await Promise.all([db.listQuestions(), db.getProgress(user.username)]);
  const pool = all.filter((q) => q.active && allowed.includes(q.subject));

  if (!sp.get('session')) {
    const sources = {}, subjects = {};
    pool.forEach((q) => { sources[q.source] = (sources[q.source] || 0) + 1; subjects[q.subject] = (subjects[q.subject] || 0) + 1; });
    const mine = pool.filter((q) => prog[q.id]);
    return NextResponse.json({
      enabled: true, limit, used, total: pool.length, answered: mine.length, correct: mine.filter((q) => prog[q.id].c).length,
      sources: Object.entries(sources).map(([name, count]) => ({ name, count })),
      subjects: Object.entries(subjects).map(([name, count]) => ({ name, count })),
      index: pool.map((q) => [q.subject, q.source]), // 讓畫面可以算出「這個科目 / 來源有幾題」
    });
  }

  // 組一組練習題:使用者先選科目,再選題數。沒做過的優先 → 做錯的 → 答對過的
  const subject = sp.get('subject') || '', source = sp.get('source') || '';
  if (!subject) return err('請先選擇要練習的科目');
  let count = Math.min(50, Math.max(1, parseInt(sp.get('count'), 10) || 10));
  if (!isAdmin) {
    const remain = limit - used;
    if (remain <= 0) return err('今天的考前複習題數已用完,明天再來!', 429);
    count = Math.min(count, remain);
  }
  const cand = pool.filter((q) => q.subject === subject && (!source || q.source === source));
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const unseen = shuffle(cand.filter((q) => !prog[q.id]));
  const wrong = shuffle(cand.filter((q) => prog[q.id] && !prog[q.id].c));
  const done = shuffle(cand.filter((q) => prog[q.id] && prog[q.id].c));
  const picked = shuffle([...unseen, ...wrong, ...done].slice(0, count));
  const questions = await Promise.all(picked.map(async (q) => ({
    ...pub(q),
    state: !prog[q.id] ? 'new' : prog[q.id].c ? 'review' : 'retry',
    images: q.image_count ? await db.getQuestionImages(q.id, q.image_count) : [],
  })));
  return NextResponse.json({ questions });
}

export async function POST(req) {
  const [user, cfg] = await Promise.all([getSessionUser(), db.getConfig()]);
  if (!user) return err('請先登入', 401);
  const isAdmin = user.role === 'admin';
  if (!isAdmin && !cfg.review_enabled) return err('考前複習目前尚未開放。', 403);

  const b = await req.json().catch(() => ({}));
  const answer = String(b.answer || '').trim().slice(0, 500);
  if (!answer) return err('請先作答');

  const limit = user.review_limit ?? cfg.review_default_limit ?? 10;
  const used = user.review_used_today || 0;
  if (!isAdmin && used >= limit) return err('今天的考前複習題數已用完,明天再來!', 429);

  const q = await db.getQuestion(String(b.id || ''));
  if (!q || !q.active) return err('這一題已經下架,請按「下一題」。', 410);
  if (!db.allowedSubjects(user, cfg).includes(q.subject)) return err(`請問${db.allowedSubjects(user, cfg).join('、')}相關的題目`, 403);
  if (!q.answer) return err('這一題還沒有設定答案,請按「下一題」。', 409);

  let correct;
  let explanation = q.explanation || '';
  try {
    if (q.type === 'choice') {
      correct = norm(answer) === norm(q.answer);
      if (!correct && !explanation) {
        explanation = await explainWrong({ subject: q.subject, stem: q.stem, options: q.options, answer: q.answer, studentAnswer: norm(answer) || answer }, cfg);
      }
    } else {
      const j = await judgeText({ subject: q.subject, stem: q.stem, answer: q.answer, studentAnswer: answer }, cfg);
      correct = j.correct;
      if (!correct && !explanation) explanation = j.explanation;
    }
  } catch (e) {
    return err(friendlyError(e), 502); // 不扣題數、不記錄
  }

  if (!correct && explanation && !q.explanation) {
    q.explanation = explanation; // 同一題的解析只需要產生一次,之後直接使用
    await db.putQuestion(q);
  }

  const prev = (await db.getProgress(user.username))[q.id];
  await Promise.all([
    db.setProgress(user.username, q.id, { c: correct, n: (prev?.n || 0) + 1, t: db.nowStr() }),
    isAdmin ? null : db.bumpReview(user.username),
  ]);
  return NextResponse.json({
    correct, answer: q.answer, answer_by: q.answer_by, explanation: correct ? '' : explanation,
    used: isAdmin ? used : used + 1, limit: isAdmin ? null : limit,
  });
}
