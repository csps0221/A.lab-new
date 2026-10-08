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
  selected_gemini_model: 'gemini-3.1-pro',
  selected_openai_model: 'gpt-4o-mini',
  enable_gemini: true,
  enable_openai: true,
  subjects: ['化學', '理化', '生物', '地科', '數學', '其他'],
};
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
  return u.used_date === today() ? u : { ...u, used_today: 0, used_date: today() };
}
export function publicUser(u) {
  const { password_hash, ...rest } = u;
  return { ...rest, limit: u.custom_limit || 15 };
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

// ---------- 解題紀錄(圖片另存,避免單筆資料過大) ----------
export async function saveRecord(record, images) {
  await redis.hset(HISTORY, { [record.id]: record });
  await Promise.all(images.map((b64, i) => redis.set(`alab:img:${record.id}:${i}`, b64)));
}
export async function listHistory() {
  const all = await redis.hgetall(HISTORY);
  return Object.values(all || {}).sort((a, b) => (a.id < b.id ? 1 : -1));
}
export const getRecord = (id) => redis.hget(HISTORY, id);
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
