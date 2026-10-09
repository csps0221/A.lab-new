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
  const [users, config, history, bugs] = await Promise.all([
    db.listUsers(), db.getConfig(), db.listHistory(), db.listBugs(),
  ]);
  return NextResponse.json({ users: users.map(db.publicUser), config, history, bugs });
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
      rec.admin_feedback = { status: b.status, comment: String(b.comment || '').slice(0, 2000) };
      await db.updateRecord(rec);
      break;
    }
    default:
      return err('未知的操作');
  }
  return NextResponse.json({ ok: true });
}
