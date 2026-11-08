import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';
import { explainWrong, judgeText, weaknessAnalysis, friendlyError } from '@/lib/ai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const err = (m, s = 400) => NextResponse.json({ error: m }, { status: s });
const norm = (s) => [...new Set(String(s || '').toUpperCase().match(/[A-Z]/g) || [])].sort().join('');
// 給使用者的題目:不含答案
const pub = (q) => ({
  id: q.id, source: q.source, subject: q.subject, type: q.type, stem: q.stem, options: q.options || [],
  multi: q.type === 'choice' && norm(q.answer).length > 1, image_count: q.image_count || 0,
});

// 彙整成績與弱點:各科/各來源答對率、最近幾次練習、常答錯的題目
async function buildStats(username) {
  const [log, all] = await Promise.all([db.getReviewLog(username), db.listQuestions()]);
  const qmap = Object.fromEntries(all.map((q) => [q.id, q]));
  const tally = (key) => {
    const m = {};
    log.forEach((l) => { const k = l[key] || '(未分類)'; (m[k] ||= { name: k, total: 0, correct: 0 }); m[k].total += 1; if (l.c) m[k].correct += 1; });
    return Object.values(m).sort((a, b) => b.total - a.total);
  };
  const sess = new Map(); // log 由新到舊
  log.forEach((l) => {
    const id = l.sid || l.t;
    if (!sess.has(id)) sess.set(id, { sid: id, time: l.t, subject: l.subject, source: l.source, total: 0, correct: 0, items: [] });
    const x = sess.get(id); x.total += 1; if (l.c) x.correct += 1; x.items.push({ qid: l.qid, c: l.c });
  });
  const wrong = {}, seen = {};
  log.forEach((l) => { seen[l.qid] = (seen[l.qid] || 0) + 1; if (!l.c) wrong[l.qid] = (wrong[l.qid] || 0) + 1; });
  const missed = Object.entries(wrong).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([id, w]) => ({ id, q: qmap[id], wrong: w, total: seen[id] })).filter((m) => m.q)
    .map((m) => ({ id: m.id, subject: m.q.subject, source: m.q.source, stem: m.q.stem.replace(/\s+/g, ' ').slice(0, 160), wrong: m.wrong, total: m.total }));
  return {
    overall: { answers: log.length, correct: log.filter((l) => l.c).length, sessions: sess.size },
    sessions: [...sess.values()].slice(0, 20).map((s) => ({
      ...s,
      items: s.items.reverse().map((it) => ({ c: it.c, stem: (qmap[it.qid]?.stem || '(題目已刪除)').replace(/\s+/g, ' ').slice(0, 70) })),
    })),
    bySubject: tally('subject'), bySource: tally('source'), missed,
  };
}

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

  if (sp.get('stats')) {
    const [stats, analysis] = await Promise.all([buildStats(user.username), db.getAnalysis(user.username)]);
    return NextResponse.json({ ...stats, analysis: analysis || null });
  }

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
    answer: q.answer, answer_by: q.answer_by, // 連答案一起載入,畫面上就能立刻批改
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
  if (b.action === 'analyze') {
    const prev = await db.getAnalysis(user.username);
    if (prev && Date.now() - prev.ts < 3600000) return NextResponse.json({ analysis: prev, cached: true });
    const st = await buildStats(user.username);
    if (!st.missed.length) return err('還沒有答錯的題目可以分析,先去練習幾題吧!');
    let text;
    try { text = await weaknessAnalysis({ subjectStats: st.bySubject, missed: st.missed }, cfg); }
    catch (e) { return err(friendlyError(e), 502); }
    const analysis = { text, time: db.nowStr(), ts: Date.now() };
    await db.setAnalysis(user.username, analysis);
    return NextResponse.json({ analysis });
  }

  const sid = String(b.sid || '').slice(0, 40);
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
    db.logReview(user.username, { sid, qid: q.id, subject: q.subject, source: q.source, c: correct, t: db.nowStr() }),
    isAdmin ? null : db.bumpReview(user.username),
  ]);
  return NextResponse.json({
    correct, answer: q.answer, answer_by: q.answer_by, explanation: correct ? '' : explanation,
    used: isAdmin ? used : used + 1, limit: isAdmin ? null : limit,
  });
}
