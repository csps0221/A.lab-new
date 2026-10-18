import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';

const err = (m, s = 400) => NextResponse.json({ error: m }, { status: s });
async function requireAdmin() {
  const u = await getSessionUser();
  return u && u.role === 'admin' ? u : null;
}
const clampLimit = (n) => Math.min(999999, Math.max(1, parseInt(n, 10) || 15));

export async function GET() {
  if (!(await requireAdmin())) return err('存取被拒絕:沒有後台權限', 403);
  const [users, config, history, bugs, announcements, stats] = await Promise.all([
    db.listUsers(), db.getConfig(), db.listHistoryAll(300), db.listBugs(), db.listAnnouncements(), db.getStats(),
  ]);
  return NextResponse.json({ users: users.map(db.publicUser), config, history: history.map(db.lightRecord), bugs, announcements, stats });
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return err('存取被拒絕:沒有後台權限', 403);
  const b = await req.json();

  switch (b.action) {
    case 'addUser': {
      const name = String(b.username || '').trim();
      if (!name) return err('請輸入使用者帳號!');
      if (await db.getUser(name)) return err(`帳號「${name}」已經存在!`);
      await db.putUser({
        username: name, password_hash: db.hashPw(String(b.password || '2580')), class_name: '使用者',
        role: 'user', first_login: true, used_today: 0, used_date: db.today(), total_used: 0,
        custom_limit: clampLimit(b.limit),
      });
      break;
    }
    case 'deleteUser': {
      const u = await db.getUser(b.username);
      if (!u) return err('找不到帳號');
      if (u.role === 'admin' || u.username === admin.username) return err('無法刪除管理員帳號');
      await db.delUser(u.username);
      break;
    }
    case 'setLimit': {
      const u = await db.getUser(b.username);
      if (!u) return err('找不到帳號');
      u.custom_limit = clampLimit(b.limit);
      await db.putUser(u);
      break;
    }
    case 'setSubjects': {
      const u = await db.getUser(b.username);
      if (!u) return err('找不到帳號');
      if (u.role === 'admin') return err('管理員不受科目限制');
      const cfg = await db.getConfig();
      const list = (Array.isArray(b.subjects) ? b.subjects : []).filter((x) => cfg.subjects.includes(x));
      if (!list.length) return err('至少要開放一個科目');
      u.allowed_subjects = list.length === cfg.subjects.length ? [] : list; // 空陣列 = 不限制
      await db.putUser(u);
      break;
    }
    case 'setProfile': {
      const u = await db.getUser(b.username);
      if (!u) return err('找不到帳號');
      u.class_name = String(b.class_name || '').trim().slice(0, 20) || '使用者';
      await db.putUser(u);
      break;
    }
    case 'addAnnouncement': {
      const title = String(b.title || '').trim().slice(0, 80);
      const body = String(b.body || '').trim().slice(0, 3000);
      if (!title) return err('請輸入公告標題');
      if (!body) return err('請輸入公告內容');
      const ends = /^\d{4}-\d{2}-\d{2}$/.test(String(b.ends || '')) ? String(b.ends) : '';
      if (ends && ends < db.today()) return err('公告截止日不能早於今天');
      await db.putAnnouncement({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title, body, pinned: !!b.pinned, ends, time: db.nowStr(),
      });
      break;
    }
    case 'pinAnnouncement': {
      const a = await db.getAnnouncement(String(b.id || ''));
      if (!a) return err('找不到這則公告');
      a.pinned = !!b.pinned;
      await db.putAnnouncement(a);
      break;
    }
    case 'setAnnouncementEnd': {
      const a = await db.getAnnouncement(String(b.id || ''));
      if (!a) return err('找不到這則公告');
      const ends = /^\d{4}-\d{2}-\d{2}$/.test(String(b.ends || '')) ? String(b.ends) : '';
      if (ends && ends < db.today()) return err('公告截止日不能早於今天');
      a.ends = ends;
      await db.putAnnouncement(a);
      break;
    }
    case 'deleteAnnouncement':
      await db.delAnnouncement(String(b.id || ''));
      break;
    case 'setLabLimit': {
      const u = await db.getUser(b.username);
      if (!u) return err('找不到帳號');
      u.lab_limit = clampLimit(b.limit);
      await db.putUser(u);
      break;
    }
    case 'setAllLabLimit': {
      const limit = clampLimit(b.limit);
      for (const u of await db.listUsers()) {
        if (u.role !== 'admin') await db.putUser({ ...u, lab_limit: limit });
      }
      break;
    }
    case 'setAllLimit': {
      const limit = clampLimit(b.limit);
      for (const u of await db.listUsers()) {
        if (u.role !== 'admin') await db.putUser({ ...u, custom_limit: limit });
      }
      break;
    }
    case 'addSubject': {
      const cfg = await db.getConfig();
      const name = String(b.name || '').trim();
      if (!name) return err('請輸入科目名稱!');
      if (cfg.subjects.includes(name)) return err(`科目「${name}」已經存在!`);
      cfg.subjects.push(name);
      await db.saveConfig(cfg);
      break;
    }
    case 'deleteSubject': {
      const cfg = await db.getConfig();
      if (cfg.subjects.length <= 1) return err('系統至少需保留一種科目');
      cfg.subjects = cfg.subjects.filter((s) => s !== b.name);
      await db.saveConfig(cfg);
      break;
    }
    case 'saveSettings': {
      const cfg = await db.getConfig();
      cfg.enable_gemini = !!b.enable_gemini;
      cfg.enable_openai = !!b.enable_openai;
      if (b.selected_gemini_model) cfg.selected_gemini_model = String(b.selected_gemini_model);
      if (b.selected_openai_model) cfg.selected_openai_model = String(b.selected_openai_model);
      await db.saveConfig(cfg);
      break;
    }
    case 'review': {
      const rec = await db.getRecord(b.id);
      if (!rec) return err('找不到紀錄');
      if (!['pending', 'correct', 'incorrect'].includes(b.status)) return err('狀態不正確');
      const oldStatus = rec.admin_feedback?.status || 'pending';
      rec.admin_feedback = { status: b.status, comment: String(b.comment || '').slice(0, 2000) };
      await Promise.all([db.updateRecord(rec), db.adjustStats(oldStatus, b.status)]);
      break;
    }
    case 'deleteRecords': {
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).slice(0, 300);
      let n = 0;
      for (let i = 0; i < ids.length; i += 10) {
        const res = await Promise.all(ids.slice(i, i + 10).map((id) => db.deleteRecord(id)));
        n += res.filter(Boolean).length;
      }
      return NextResponse.json({ ok: true, message: `已刪除 ${n} 筆解題紀錄` });
    }
    case 'purgeOldImages': {
      const r = await db.purgeOldImages();
      return NextResponse.json({ ok: true, message: `已刪除 ${r.deleted} 張超過 30 天的圖片;其餘 ${r.kept} 張會在 30 天後自動刪除` });
    }
    case 'deleteBug':
      if (!(await db.deleteBug({ time: b.time, user: b.user, message: b.message }))) return err('找不到這則回報,可能已被刪除');
      break;
    case 'clearBugs':
      await db.clearBugs();
      break;
    default:
      return err('未知的操作');
  }
  return NextResponse.json({ ok: true });
}
