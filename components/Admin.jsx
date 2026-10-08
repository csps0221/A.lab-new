'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import Md from './Md';

const SUBS = [['users', '使用者與權限'], ['subjects', '科目管理'], ['review', '點評與紀錄'], ['ai', 'AI 模型設定'], ['bugs', 'Bug 回報']];
const GEMINI = ['gemini-3.1-pro', 'gemini-3.6-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'];
const OPENAI = ['gpt-4o-mini', 'gpt-4o', 'o3-mini'];

export default function Admin() {
  const [d, setD] = useState(null);
  const [sub, setSub] = useState('users');
  const [msg, setMsg] = useState('');

  const load = async () => setD(await api('/api/admin'));
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);
  const act = async (action, payload = {}, ok = '已完成') => {
    try { await api('/api/admin', { method: 'POST', body: { action, ...payload } }); setMsg(ok); await load(); }
    catch (e) { setMsg(e.message); }
  };

  if (!d) return <div className="alert">{msg || '載入中...'}</div>;

  const reviewed = d.history.filter((l) => ['correct', 'incorrect'].includes(l.admin_feedback?.status));
  const acc = reviewed.length ? (reviewed.filter((l) => l.admin_feedback.status === 'correct').length / reviewed.length) * 100 : 0;
  const aiOn = d.config.enable_gemini || d.config.enable_openai;

  return (
    <div className="stack">
      <h3>A.lab 後台管理系統</h3>
      <div className="grid4">
        <Stat n={d.users.length} l="註冊使用者" />
        <Stat n={d.history.length} l="累積解題量" />
        <Stat n={`${acc.toFixed(1)}%`} l={`解答正確率(${reviewed.length} 筆已審)`} />
        <Stat n={aiOn ? '正常' : '停用'} l="AI 引擎狀態" />
      </div>
      <div className="subtabs">
        {SUBS.map(([k, n]) => <button key={k} className={sub === k ? '' : 'sec'} onClick={() => { setSub(k); setMsg(''); }}>{n}</button>)}
      </div>
      {msg && <div className="alert">{msg}</div>}

      {sub === 'users' && <UsersTab d={d} act={act} />}
      {sub === 'subjects' && <SubjectsTab d={d} act={act} />}
      {sub === 'review' && <ReviewTab d={d} act={act} />}
      {sub === 'ai' && <AITab d={d} act={act} />}
      {sub === 'bugs' && (
        <div className="card stack">
          <h4>使用者 Bug 與建議回報</h4>
          {!d.bugs.length && <div className="muted">目前沒有任何問題回報!</div>}
          {d.bugs.map((b, i) => (
            <div key={i} className="opt"><small className="muted">{b.time} · {b.user}</small><div style={{ whiteSpace: 'pre-wrap' }}>{b.message}</div></div>
          ))}
        </div>
      )}
    </div>
  );
}

const Stat = ({ n, l }) => <div className="stat"><div className="num">{n}</div><div className="muted">{l}</div></div>;

function UsersTab({ d, act }) {
  const [nu, setNu] = useState('');
  const [np, setNp] = useState('2580');
  const [nl, setNl] = useState(15);
  const [del, setDel] = useState('');
  const [all, setAll] = useState(15);
  const [one, setOne] = useState('');
  const [oneLimit, setOneLimit] = useState(15);
  const normal = d.users.filter((u) => u.role !== 'admin');
  const target = one || d.users[0]?.username;

  return (
    <>
      <div className="card">
        <h4>帳號總覽與狀態</h4>
        <div className="scroll">
          <table>
            <thead><tr><th>帳號</th><th>身分類別</th><th>今日已用</th><th>每日上限</th><th>密碼狀態</th></tr></thead>
            <tbody>
              {normal.map((u) => (
                <tr key={u.username}><td>{u.username}</td><td>{u.class_name}</td><td>{u.used_today} 題</td><td>{u.limit} 題</td><td>{u.first_login ? '待修改密碼' : '已修改'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card stack">
        <h4>新增使用者帳號</h4>
        <input value={nu} onChange={(e) => setNu(e.target.value)} placeholder="使用者帳號,例如:張小明" />
        <input type="text" value={np} onChange={(e) => setNp(e.target.value)} placeholder="預設密碼(首次登入需修改)" />
        <label>每日解題額度<input type="number" min={1} value={nl} onChange={(e) => setNl(e.target.value)} /></label>
        <button onClick={() => { act('addUser', { username: nu, password: np, limit: nl }, `已新增使用者:${nu}`); setNu(''); }}>新增帳號</button>
      </div>

      <div className="card stack">
        <h4>刪除使用者帳號</h4>
        {normal.length ? (
          <>
            <select value={del || normal[0].username} onChange={(e) => setDel(e.target.value)}>{normal.map((u) => <option key={u.username}>{u.username}</option>)}</select>
            <button className="danger" onClick={() => { if (confirm('確定要刪除這個帳號嗎?')) act('deleteUser', { username: del || normal[0].username }, '已刪除帳號'); }}>確定刪除帳號</button>
          </>
        ) : <div className="muted">目前沒有可供刪除的一般使用者帳號。</div>}
      </div>

      <div className="card stack">
        <h4>解題額度調整</h4>
        <b>全體一般使用者統一上限</b>
        <div className="row"><input type="number" min={1} value={all} onChange={(e) => setAll(e.target.value)} /><button onClick={() => act('setAllLimit', { limit: all }, `已將所有一般使用者的每日上限調為 ${all} 題`)}>套用至全體</button></div>
        <hr />
        <b>單一帳號獨立調整</b>
        <select value={target} onChange={(e) => setOne(e.target.value)}>{d.users.map((u) => <option key={u.username}>{u.username}</option>)}</select>
        <div className="row"><input type="number" min={1} value={oneLimit} onChange={(e) => setOneLimit(e.target.value)} /><button onClick={() => act('setLimit', { username: target, limit: oneLimit }, `已更新 ${target} 的每日額度`)}>儲存</button></div>
      </div>
    </>
  );
}

function SubjectsTab({ d, act }) {
  const [name, setName] = useState('');
  const [del, setDel] = useState('');
  const subs = d.config.subjects;
  return (
    <div className="card stack">
      <h4>系統科目類別管理</h4>
      <div className="muted">新增或移除解題科目,前端選單會同步更新,AI 也會依所選科目切換專業解題模式。</div>
      <div>{subs.map((s) => <span key={s} className="tag">{s}</span>)}</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="新科目名稱,例如:物理、歷史" />
      <button onClick={() => { act('addSubject', { name }, `已新增科目:${name}`); setName(''); }}>新增科目</button>
      <hr />
      {subs.length > 1 ? (
        <>
          <select value={del || subs[0]} onChange={(e) => setDel(e.target.value)}>{subs.map((s) => <option key={s}>{s}</option>)}</select>
          <button className="danger" onClick={() => act('deleteSubject', { name: del || subs[0] }, '已刪除科目')}>確定刪除科目</button>
        </>
      ) : <div className="muted">系統至少需保留一種科目。</div>}
    </div>
  );
}

function ReviewTab({ d, act }) {
  const [u, setU] = useState('');
  const [q, setQ] = useState('');
  let logs = d.history;
  if (u) logs = logs.filter((l) => l.user === u);
  if (q) logs = logs.filter((l) => JSON.stringify(l).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="stack">
      <div className="grid2">
        <select value={u} onChange={(e) => setU(e.target.value)}><option value="">全部使用者</option>{d.users.map((x) => <option key={x.username}>{x.username}</option>)}</select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="關鍵字過濾" />
      </div>
      <div className="muted">符合條件的紀錄共 {logs.length} 筆</div>
      {logs.slice(0, 100).map((l) => <ReviewItem key={l.id} log={l} act={act} />)}
      {logs.length > 100 && <div className="muted">僅顯示最新 100 筆,請用上方過濾縮小範圍。</div>}
    </div>
  );
}

function ReviewItem({ log, act }) {
  const fb = log.admin_feedback || { status: 'pending', comment: '' };
  const [status, setStatus] = useState(fb.status);
  const [comment, setComment] = useState(fb.comment || '');
  const [imgs, setImgs] = useState(null);
  const label = { pending: '待審核', correct: '回答正確', incorrect: '回答錯誤/需補強' };
  return (
    <details className="card">
      <summary>[{log.time}] {log.user} - {log.subject} [{log.depth_mode}] (AI:{log.ans}) · {label[fb.status]}</summary>
      <div className="stack" style={{ marginTop: 10 }}>
        <div><b>標註參考答案:</b>{log.ref_answer}</div>
        <div><b>題目文字描述:</b><div style={{ whiteSpace: 'pre-wrap' }}>{log.note}</div></div>
        <div><b>AI 答案:</b>{log.ans}</div>
        <div><b>觀念推導:</b><Md>{log.reasoning}</Md></div>
        {log.options_analysis?.map((o, i) => <div key={i}>{o.is_correct ? '✔' : '✘'} <b>{o.text || o.option}</b>:{o.explanation}</div>)}
        {log.image_count > 0 && (imgs
          ? <div className="grid3">{imgs.map((b, i) => <img key={i} alt="" src={`data:image/jpeg;base64,${b}`} style={{ width: '100%', borderRadius: 8 }} />)}</div>
          : <button className="sec small" onClick={async () => setImgs((await api(`/api/history/${log.id}`)).images)}>載入原圖({log.image_count})</button>)}
        <hr />
        <b>管理員點評(計入正確率統計)</b>
        <div className="row wrapr">
          {Object.entries(label).map(([k, v]) => (
            <label key={k} className="inline"><input type="radio" name={`s${log.id}`} checked={status === k} onChange={() => setStatus(k)} />{v}</label>
          ))}
        </div>
        <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="給使用者的觀念補充、錯誤更正或學習建議..." />
        <button onClick={() => act('review', { id: log.id, status, comment }, '點評已儲存')}>儲存點評評語</button>
      </div>
    </details>
  );
}

function AITab({ d, act }) {
  const c = d.config;
  const [g, setG] = useState(c.enable_gemini);
  const [o, setO] = useState(c.enable_openai);
  const [gm, setGm] = useState(c.selected_gemini_model);
  const [om, setOm] = useState(c.selected_openai_model);
  return (
    <div className="card stack">
      <h4>AI 模型引擎開關與模型切換</h4>
      <label className="inline"><input type="checkbox" checked={g} onChange={(e) => setG(e.target.checked)} />啟用 Google Gemini 解題引擎</label>
      <select value={gm} onChange={(e) => setGm(e.target.value)}>{[...new Set([gm, ...GEMINI])].map((m) => <option key={m}>{m}</option>)}</select>
      <label className="inline"><input type="checkbox" checked={o} onChange={(e) => setO(e.target.checked)} />啟用 OpenAI GPT 解題引擎</label>
      <select value={om} onChange={(e) => setOm(e.target.value)}>{[...new Set([om, ...OPENAI])].map((m) => <option key={m}>{m}</option>)}</select>
      <div className="muted">兩個引擎都啟用時,會先用 Gemini,失敗再自動改用 OpenAI。</div>
      <button onClick={() => act('saveSettings', { enable_gemini: g, enable_openai: o, selected_gemini_model: gm, selected_openai_model: om }, '已儲存 AI 模型設定')}>儲存 AI 模型設定</button>
    </div>
  );
}
