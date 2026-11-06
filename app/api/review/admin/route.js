import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';
import { recognizeQuestions, friendlyError } from '@/lib/ai';

export const maxDuration = 120; // PDF 辨識題目較多時需要比較久
export const dynamic = 'force-dynamic';

const err = (m, s = 400) => NextResponse.json({ error: m }, { status: s });
const norm = (s) => [...new Set(String(s || '').toUpperCase().match(/[A-Z]/g) || [])].sort().join('');
async function admin() {
  const u = await getSessionUser();
  return u && u.role === 'admin' ? u : null;
}

// 把 "(A) 內容" 拆成 { k:'A', t:'內容' }
function parseOptions(list) {
  return list.map((s, i) => {
    const m = String(s).trim().match(/^[(（]?([A-Za-z])[)）.．、:]?\s*(.*)$/s);
    return m ? { k: m[1].toUpperCase(), t: m[2].trim() } : { k: String.fromCharCode(65 + i), t: String(s).trim() };
  });
}

export async function GET(req) {
  if (!(await admin())) return err('無權限', 403);
  const sp = new URL(req.url).searchParams;
  const id = sp.get('id');
  if (id) {
    const q = await db.getQuestion(id);
    if (!q) return err('找不到這題', 404);
    return NextResponse.json({ images: await db.getQuestionImages(id, q.image_count || 0) });
  }
  const [cfg, questions] = await Promise.all([db.getConfig(), db.listQuestions(true)]);
  return NextResponse.json({ config: { enabled: !!cfg.review_enabled, default_limit: cfg.review_default_limit ?? 10 }, questions });
}

export async function POST(req) {
  if (!(await admin())) return err('無權限', 403);
  const b = await req.json().catch(() => ({}));
  const cfg = await db.getConfig();

  switch (b.action) {
    case 'setEnabled': {
      cfg.review_enabled = !!b.enabled;
      await db.saveConfig(cfg);
      return NextResponse.json({ ok: true, message: cfg.review_enabled ? '考前複習已開放' : '考前複習已關閉' });
    }
    case 'setDefaultLimit': {
      cfg.review_default_limit = Math.min(9999, Math.max(1, parseInt(b.limit, 10) || 10));
      await db.saveConfig(cfg);
      return NextResponse.json({ ok: true, message: `預設每人每天可作答 ${cfg.review_default_limit} 題` });
    }
    case 'create': {
      const source = String(b.source || '').trim().slice(0, 60);
      if (!source) return err('請填寫題目來源(例如:113 學測、第二次段考)');
      const subject = cfg.subjects.includes(b.subject) ? b.subject : cfg.subjects[0];
      const text = String(b.text || '').trim().slice(0, 6000);
      const pdf = typeof b.pdf === 'string' ? b.pdf : '';
      if (pdf.length > 4_300_000) return err('PDF 檔案太大(上限約 3 MB),請壓縮或分成幾個檔案上傳');
      if (!text && !pdf) return err('請上傳題目 PDF 檔,或貼上題目文字');
      if (!cfg.enable_gemini && !cfg.enable_openai) return err('AI 服務目前已關閉,請先到「AI 設定」開啟。', 503);

      let found;
      try { found = await recognizeQuestions({ pdf, text, subject }, cfg); }
      catch (e) { return err(friendlyError(e), 502); }
      if (!found.length) return err('AI 沒有辨識出題目,請確認 PDF 內容清楚可讀(掃描檔請確保文字清晰),或直接貼上文字。');

      // 管理員提供的答案(依題號順序,以逗號或空白分隔);沒提供的由 AI 判斷
      const given = String(b.answers || '').split(/[,\s,、;;]+/).map((s) => s.trim()).filter(Boolean);
      const ts = Date.now();
      let noAnswer = 0, byAdmin = 0;
      for (let i = 0; i < found.length; i++) {
        const f = found[i];
        const options = f.type === 'choice' ? parseOptions(f.options) : [];
        const adminAns = given[i] ? (f.type === 'choice' ? norm(given[i]) : given[i]) : '';
        const answer = adminAns || (f.type === 'choice' ? norm(f.answer) : f.answer);
        const answer_by = adminAns ? 'admin' : answer ? 'ai' : 'none';
        if (adminAns) byAdmin++;
        if (!answer) noAnswer++;
        const q = {
          id: `${ts}-${String(i).padStart(2, '0')}-${Math.random().toString(36).slice(2, 6)}`,
          ts, idx: i, source, subject, type: f.type, stem: f.stem, options, answer, answer_by,
          active: !!answer, explanation: null, has_figure: f.has_figure, image_count: 0, created: db.nowStr(),
        };
        await db.putQuestion(q);
      }
      return NextResponse.json({
        ok: true,
        message: `已新增 ${found.length} 題(管理員答案 ${byAdmin} 題、AI 答案 ${found.length - byAdmin - noAnswer} 題${noAnswer ? `、無答案 ${noAnswer} 題,需補答案才會開放` : ''})`,
      });
    }
    case 'update': {
      const q = await db.getQuestion(String(b.id || ''));
      if (!q) return err('找不到這題');
      if (typeof b.source === 'string' && b.source.trim()) q.source = b.source.trim().slice(0, 60);
      if (cfg.subjects.includes(b.subject)) q.subject = b.subject;
      if (typeof b.stem === 'string' && b.stem.trim()) q.stem = b.stem.trim().slice(0, 6000);
      if (typeof b.answer === 'string') {
        const a = q.type === 'choice' ? norm(b.answer) : b.answer.trim();
        if (a !== q.answer) { q.answer = a; q.answer_by = a ? 'admin' : 'none'; q.explanation = null; } // 答案變了,舊解析作廢
      }
      if (typeof b.active === 'boolean') q.active = b.active;
      if (!q.answer) q.active = false; // 沒有答案不能開放
      await db.putQuestion(q);
      return NextResponse.json({ ok: true, message: '題目已更新' });
    }
    case 'delete': {
      const ok = await db.deleteQuestion(String(b.id || ''));
      return ok ? NextResponse.json({ ok: true, message: '題目已刪除' }) : err('找不到這題');
    }
    default:
      return err('未知的操作');
  }
}
