import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const USERS = 'alab:users';
const HISTORY = 'alab:history';
const BUGS = 'alab:bugs';
const LOGINS = 'alab:logins';
const CONFIG = 'alab:config';

export const DEFAULT_CONFIG = {
  selected_gemini_model: 'gemini-3.8-flash',
  selected_openai_model: 'gpt-4o-mini',
  enable_gemini: true,
  enable_openai: true,
  subjects: ['化學', '理化', '生物', '地科', '數學', '其他'],
};
// LAB AI(聊天助教)的每日次數,和「解題」的額度分開計算
export const DEFAULT_LAB_LIMIT = 10;
export const DEPTHS = ['精簡解答', '標準詳解', '深度解析'];

export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
export const nowStr = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' });
export const hashPw = (pw) => bcrypt.hashSync(pw, 10);

// ---------- 設定 ----------
export async function getConfig() {
  const c = await redis.get(CONFIG);
  return { ...DEFAULT_CONFIG, ...(c || {}) };
}
export const saveConfig = (c) => redis.set(CONFIG, c);

// ---------- 使用者 ----------
// 每日額度:換日自動歸零(原 Streamlit 版本不會重設)
function normalize(u) {
  if (!u) return null;
  return u.used_date === today() ? u : { ...u, used_today: 0, lab_used_today: 0, used_date: today() };
}
export function publicUser(u) {
  const { password_hash, ...rest } = u;
  return { ...rest, limit: u.custom_limit || 15, lab_limit: u.lab_limit ?? DEFAULT_LAB_LIMIT, lab_used_today: u.lab_used_today || 0 };
}
export const putUser = (u) => redis.hset(USERS, { [u.username]: u });
export async function getUser(name) {
  if (!name) return null;
  return normalize(await redis.hget(USERS, name));
}
export async function listUsers() {
  const all = await redis.hgetall(USERS);
  return Object.values(all || {}).map(normalize);
}
export const delUser = (name) => redis.hdel(USERS, name);
export async function incrementUsage(name) {
  const u = await getUser(name);
  if (!u) return;
  u.used_today += 1;
  u.total_used = (u.total_used || 0) + 1;
  await putUser(u);
}
export async function ensureSeed() {
  const name = process.env.ADMIN_USERNAME || 'admin';
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error('伺服器尚未設定 ADMIN_PASSWORD 環境變數');
  if (!(await redis.hexists(USERS, name))) {
    await putUser({
      username: name, password_hash: hashPw(pw), class_name: '系統管理員', role: 'admin',
      first_login: false, used_today: 0, used_date: today(), total_used: 0, custom_limit: 99999,
    });
  }
}
export async function logLogin(user) {
  await redis.lpush(LOGINS, { user, time: nowStr() });
  await redis.ltrim(LOGINS, 0, 999);
}

// ---------- 解題紀錄(圖片另存;用索引避免每次讀取全部紀錄) ----------
const HIDX = 'alab:hall';
const STATS = 'alab:stats';
const IDXFLAG = 'alab:idx_v1';
const uidx = (u) => `alab:uh:${u}`;
let idxChecked = false;

const stampOf = (r) => Number(String(r.id).split('-')[0]) || Date.parse(r.time) || 0;

// 第一次執行時,為舊的紀錄補上索引與統計(之後不會再跑)
async function ensureIndex() {
  if (idxChecked) return;
  if (await redis.get(IDXFLAG)) { idxChecked = true; return; }
  const recs = Object.values((await redis.hgetall(HISTORY)) || {});
  let correct = 0, incorrect = 0;
  for (let i = 0; i < recs.length; i += 50) {
    await Promise.all(recs.slice(i, i + 50).flatMap((r) => [
      redis.zadd(HIDX, { score: stampOf(r), member: r.id }),
      redis.zadd(uidx(r.user), { score: stampOf(r), member: r.id }),
    ]));
  }
  recs.forEach((r) => {
    const st = r.admin_feedback?.status;
    if (st === 'correct') correct += 1; else if (st === 'incorrect') incorrect += 1;
  });
  await redis.hset(STATS, { total: recs.length, correct, incorrect });
  await redis.set(IDXFLAG, '1');
  idxChecked = true;
}

// 題目圖片只保留 30 天(自動刪除),避免資料庫空間被塞滿
const IMG_TTL = 30 * 24 * 60 * 60;
const imgKeys = (id, n) => Array.from({ length: n }, (_, i) => `alab:img:${id}:${i}`);

export async function saveRecord(record, images) {
  await ensureIndex();
  const ts = stampOf(record);
  await Promise.all([
    redis.hset(HISTORY, { [record.id]: record }),
    redis.zadd(HIDX, { score: ts, member: record.id }),
    redis.zadd(uidx(record.user), { score: ts, member: record.id }),
    redis.hincrby(STATS, 'total', 1),
    ...images.map((b64, i) => redis.set(`alab:img:${record.id}:${i}`, b64, { ex: IMG_TTL })),
  ]);
}

async function recordsByIds(ids) {
  if (!ids.length) return [];
  const m = await redis.hmget(HISTORY, ...ids);
  return ids.map((id) => m?.[id]).filter(Boolean);
}
export async function listHistoryFor(username, limit = 300) {
  await ensureIndex();
  return recordsByIds(await redis.zrange(uidx(username), 0, limit - 1, { rev: true }));
}
export async function listHistoryAll(limit = 300) {
  await ensureIndex();
  return recordsByIds(await redis.zrange(HIDX, 0, limit - 1, { rev: true }));
}
export async function getRecords(ids) {
  return (await recordsByIds(ids)).sort((a, b) => (a.id < b.id ? 1 : -1));
}
export async function getStats() {
  await ensureIndex();
  const s = (await redis.hgetall(STATS)) || {};
  return { total: Number(s.total) || 0, correct: Number(s.correct) || 0, incorrect: Number(s.incorrect) || 0 };
}
export async function adjustStats(oldStatus, newStatus) {
  if (oldStatus === newStatus) return;
  await ensureIndex();
  const ops = [];
  if (oldStatus === 'correct' || oldStatus === 'incorrect') ops.push(redis.hincrby(STATS, oldStatus, -1));
  if (newStatus === 'correct' || newStatus === 'incorrect') ops.push(redis.hincrby(STATS, newStatus, 1));
  await Promise.all(ops);
}
// 列表只需要精簡欄位,完整內容點開時再讀
export function lightRecord(r) {
  return {
    id: r.id, user: r.user, time: r.time, subject: r.subject, depth_mode: r.depth_mode,
    ref_answer: r.ref_answer, note: String(r.note || '').slice(0, 200), ans: r.ans,
    reasoning: String(r.reasoning || '').slice(0, 140), image_count: r.image_count || 0,
    admin_feedback: r.admin_feedback, followup_count: (r.followups || []).length,
  };
}
export const getRecord = (id) => redis.hget(HISTORY, id);

// 刪除一筆解題紀錄:同時清掉索引、統計、圖片,以及學生的收藏
export async function deleteRecord(id) {
  await ensureIndex();
  const rec = await redis.hget(HISTORY, id);
  if (!rec) return false;
  const st = rec.admin_feedback?.status;
  const ops = [
    redis.hdel(HISTORY, id),
    redis.zrem(HIDX, id),
    redis.zrem(uidx(rec.user), id),
    redis.hincrby(STATS, 'total', -1),
  ];
  if (st === 'correct' || st === 'incorrect') ops.push(redis.hincrby(STATS, st, -1));
  if (rec.image_count) ops.push(redis.del(...imgKeys(id, rec.image_count)));
  await Promise.all(ops);
  const u = await getUser(rec.user);
  if (u?.favorites?.includes(id)) {
    u.favorites = u.favorites.filter((x) => x !== id);
    await putUser(u);
  }
  return true;
}

// 一次整理舊資料:超過 30 天的圖片刪除,其餘補上 30 天後自動刪除
export async function purgeOldImages() {
  const recs = Object.values((await redis.hgetall(HISTORY)) || {});
  const now = Date.now();
  let deleted = 0, kept = 0;
  for (let i = 0; i < recs.length; i += 40) {
    await Promise.all(recs.slice(i, i + 40).flatMap((r) => {
      const n = r.image_count || 0;
      if (!n) return [];
      const ageSec = (now - stampOf(r)) / 1000;
      const keys = imgKeys(r.id, n);
      if (ageSec >= IMG_TTL) { deleted += n; return [redis.del(...keys)]; }
      kept += n;
      const left = Math.max(60, Math.ceil(IMG_TTL - ageSec));
      return keys.map((k) => redis.expire(k, left));
    }));
  }
  return { deleted, kept };
}
export const updateRecord = (r) => redis.hset(HISTORY, { [r.id]: r });
export async function getImages(id, count) {
  const keys = Array.from({ length: count }, (_, i) => `alab:img:${id}:${i}`);
  if (!keys.length) return [];
  return (await redis.mget(...keys)).filter(Boolean);
}

// ---------- Bug 回報 ----------
export const addBug = (b) => redis.lpush(BUGS, b);
export async function listBugs() {
  return (await redis.lrange(BUGS, 0, 199)) || [];
}
export async function deleteBug(m) {
  const list = (await redis.lrange(BUGS, 0, -1)) || [];
  const hit = list.find((b) => b.time === m.time && b.user === m.user && b.message === m.message);
  if (!hit) return false;
  await redis.lrem(BUGS, 1, hit);
  return true;
}
export const clearBugs = () => redis.del(BUGS);

// 學生可詢問的科目:管理員或未設限的使用者 = 全部;有設限就取交集
export function allowedSubjects(user, cfg) {
  if (user.role === 'admin' || !user.allowed_subjects?.length) return cfg.subjects;
  return cfg.subjects.filter((x) => user.allowed_subjects.includes(x));
}

// ---------- 公告 ----------
const ANN = 'alab:ann';
export const putAnnouncement = (a) => redis.hset(ANN, { [a.id]: a });
export const getAnnouncement = (id) => redis.hget(ANN, id);
export const delAnnouncement = (id) => redis.hdel(ANN, id);
export async function listAnnouncements() {
  const all = await redis.hgetall(ANN);
  return Object.values(all || {}).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.id < b.id ? 1 : -1));
}
export async function listActiveAnnouncements() {
  const t = today();
  return (await listAnnouncements()).filter((a) => !a.ends || a.ends >= t);
}

// ---------- LAB AI 聊天 ----------
const CHAT_TTL = 30 * 24 * 60 * 60; // 聊天紀錄保留 30 天
const chatKey = (id) => `alab:chat:${id}`;
const chatIdx = (u) => `alab:chatidx:${u}`;
export async function saveChat(chat) {
  await Promise.all([
    redis.set(chatKey(chat.id), chat, { ex: CHAT_TTL }),
    redis.zadd(chatIdx(chat.user), { score: Date.now(), member: chat.id }),
  ]);
}
export const getChat = (id) => redis.get(chatKey(id));
export async function listChats(user, limit = 30) {
  const ids = await redis.zrange(chatIdx(user), 0, limit - 1, { rev: true });
  if (!ids?.length) return [];
  const chats = await redis.mget(...ids.map(chatKey));
  const out = [];
  const dead = [];
  ids.forEach((id, i) => {
    const c = chats[i];
    if (c) out.push({ id: c.id, title: c.title, subject: c.subject, updated: c.updated, count: c.messages.length });
    else dead.push(id);
  });
  if (dead.length) await redis.zrem(chatIdx(user), ...dead);
  return out;
}
export async function deleteChat(user, id) {
  await Promise.all([redis.del(chatKey(id)), redis.zrem(chatIdx(user), id)]);
}
export async function bumpLab(username) {
  const u = await getUser(username);
  if (!u) return;
  u.lab_used_today = (u.lab_used_today || 0) + 1;
  await putUser(u);
}
