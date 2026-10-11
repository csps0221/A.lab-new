'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import Md from './Md';

const GEMINI = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.1-pro'];
const OPENAI = ['gpt-4o-mini', 'gpt-4o', 'o3-mini'];
const STATUS = { pending: '待審核', correct: '回答正確', incorrect: '需補強' };
const statusOf = (l) => l.admin_feedback?.status || 'pending';

export default function Admin() {
  const [d, setD] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [sub, setSub] = useState('users');
  const [toast, setToast] = useState(null);

  const load = async () => setD(await api('/api/admin'));
  useEffect(() => { load().catch((e) => setLoadErr(e.message)); }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const act = async (action, payload = {}, ok = '已完成') => {
    try {
      await api('/api/admin', { method: 'POST', body: { action, ...payload } });
      setToast({ text: ok });
      await load();
      return true;
    } catch (e) {
      setToast({ text: e.message, bad: true });
      return false;
    }
  };

  if (loadErr) return <div className="alert bad">{loadErr}</div>;
  if (!d) return <div className="alert">載入中...</div>;

  const reviewed = d.history.filter((l) => statusOf(l) !== 'pending');
  const acc = reviewed.length ? (reviewed.filter((l) => statusOf(l) === 'correct').length / reviewed.length) * 100 : 0;
  const aiOn = d.config.enable_gemini || d.config.enable_openai;
  const pending = d.history.length - reviewed.length;
  const students = d.users.filter((u) => u.role !== 'admin').length;

  const TABS = [
    ['users', '使用者', students],
    ['review', '點評紀錄', pending],
    ['subjects', '科目'],
    ['ai', 'AI 設定'],
    ['bugs', '回報', d.bugs.length],
  ];

  return (
    <div className="stack">
      <div className="row between">
        <h3>A.lab 後台管理</h3>
        <button className="sec small" onClick={() => load().then(() => setToast({ text: '已更新資料' }))}>重新整理</button>
      </div>

      <div className="admin-stats">
        <Stat n={d.users.length} l="註冊帳號" />
        <Stat n={d.history.length} l="累積解題量" />
        <Stat n={`${acc.toFixed(0)}%`} l={`正確率(${reviewed.length} 筆已審)`} />
        <Stat n={aiOn ? '正常' : '停用'} l="AI 引擎" tone={aiOn ? 'ok' : 'bad'} />
      </div>

      <div className="subtabs-scroll" role="tablist">
        {TABS.map(([k, name, n]) => (
          <button key={k} role="tab" aria-selected={sub === k} className={sub === k ? '' : 'sec'} onClick={() => setSub(k)}>
            {name}{n > 0 && <span className="cnt">{n}</span>}
          </button>
        ))}
      </div>

      {sub === 'users' && <UsersTab d={d} act={act} />}
      {sub === 'review' && <ReviewTab d={d} act={act} />}
      {sub === 'subjects' && <SubjectsTab d={d} act={act} />}
      {sub === 'ai' && <AITab d={d} act={act} />}
      {sub === 'bugs' && <BugsTab d={d} />}

      {toast && <div className={`toast ${toast.bad ? 'bad' : ''}`} role="status">{toast.text}</div>}
    </div>
  );
}

const Stat = ({ n, l, tone }) => (
  <div className="stat"><div className={`num ${tone || ''}`}>{n}</div><div className="muted">{l}</div></div>
);

const Toggle = ({ checked, onChange, label }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}><i /></button>
);

/* ---------------- 使用者 ---------------- */
function UsersTab({ d, act }) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [nu, setNu] = useState('');
  const [np, setNp] = useState('2580');
  const [nl, setNl] = useState(15);
  const [all, setAll] = useState(15);

  const normal = d.users.filter((u) => u.role !== 'admin');
  const list = normal.filter((u) => u.username.toLowerCase().includes(q.trim().toLowerCase()));

  async function add() {
    const ok = await act('addUser', { username: nu, password: np, limit: nl }, `已新增使用者:${nu}`);
    if (ok) { setNu(''); setAdding(false); }
  }

  return (
    <div className="stack">
      <div className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋學生帳號" aria-label="搜尋學生帳號" />
        <button className={adding ? 'sec' : ''} style={{ flex: 'none' }} onClick={() => setAdding((a) => !a)}>{adding ? '取消' : '＋ 新增'}</button>
      </div>

      {adding && (
        <div className="card stack">
          <h4>新增學生帳號</h4>
          <input value={nu} onChange={(e) => setNu(e.target.value)} placeholder="帳號,例如:張小明" />
          <div className="grid2e">
            <label>預設密碼<input value={np} onChange={(e) => setNp(e.target.value)} /></label>
            <label>每日額度(題)<input type="number" min={1} value={nl} onChange={(e) => setNl(e.target.value)} /></label>
          </div>
          <div className="muted">學生第一次登入時,會被要求改密碼。</div>
          <button disabled={!nu.trim()} onClick={add}>建立帳號</button>
        </div>
      )}

      <details className="card slim">
        <summary>批量設定每日額度(全體學生)</summary>
        <div className="row" style={{ marginTop: 10 }}>
          <input type="number" min={1} value={all} onChange={(e) => setAll(e.target.value)} aria-label="每日額度" />
          <button style={{ flex: 'none' }} onClick={() => act('setAllLimit', { limit: all }, `已將全體學生的每日額度調為 ${all} 題`)}>套用至全體</button>
        </div>
      </details>

      <div className="muted">共 {list.length} 位學生{q && '(符合搜尋)'}。點學生可調整額度、科目或刪除。</div>
      {list.map((u) => <UserCard key={u.username} u={u} subjects={d.config.subjects} act={act} />)}
      {!normal.length && <div className="alert">還沒有學生帳號,按右上角「＋ 新增」建立。</div>}
    </div>
  );
}

function UserCard({ u, subjects, act }) {
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(u.limit);
  const [sel, setSel] = useState(u.allowed_subjects?.length ? u.allowed_subjects : subjects);
  const pct = Math.min(100, (u.used_today / (u.limit || 1)) * 100);
  const toggle = (s) => setSel((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const shown = u.allowed_subjects?.length ? u.allowed_subjects : ['全部科目'];

  return (
    <div className="card ucard">
      <button type="button" className="ucard-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="avatar sm">{u.username[0]}</span>
        <span className="ucard-main">
          <b>{u.username}</b>
          <small className="muted">{u.class_name} · 今日 {u.used_today}/{u.limit} 題</small>
          <span className="bar thin"><i style={{ width: `${pct}%` }} /></span>
        </span>
        {u.first_login && <span className="tag">待改密碼</span>}
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      <div className="tags">{shown.map((s) => <span key={s} className="tag">{s}</span>)}</div>

      {open && (
        <div className="stack ucard-body">
          <div>
            <div className="field-label">每日解題額度</div>
            <div className="row" style={{ marginTop: 6 }}>
              <input type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} />
              <button style={{ flex: 'none' }} onClick={() => act('setLimit', { username: u.username, limit }, `已更新 ${u.username} 的每日額度`)}>儲存</button>
            </div>
          </div>
          <div>
            <div className="field-label">可詢問的科目</div>
            <div className="muted" style={{ margin: '4px 0 8px' }}>只勾部分科目時,問到其他科目會顯示「請問○○相關的題目」。全部勾選 = 不限制。</div>
            <div className="tags" style={{ marginTop: 0 }}>
              {subjects.map((s) => (
                <button key={s} type="button" className={`tchip ${sel.includes(s) ? 'on' : ''}`} aria-pressed={sel.includes(s)} onClick={() => toggle(s)}>{s}</button>
              ))}
            </div>
            <button style={{ marginTop: 10, width: '100%' }} disabled={!sel.length}
              onClick={() => act('setSubjects', { username: u.username, subjects: sel }, `已更新 ${u.username} 的可問科目`)}>儲存科目權限</button>
          </div>
          <button className="danger" onClick={() => { if (confirm(`確定要刪除帳號「${u.username}」嗎?`)) act('deleteUser', { username: u.username }, `已刪除帳號:${u.username}`); }}>刪除這個帳號</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- 點評與紀錄 ---------------- */
function ReviewTab({ d, act }) {
  const [st, setSt] = useState('all');
  const [u, setU] = useState('');
  const [q, setQ] = useState('');
  const [n, setN] = useState(20);

  let logs = d.history;
  const counts = { all: logs.length, pending: 0, correct: 0, incorrect: 0 };
  logs.forEach((l) => { counts[statusOf(l)] += 1; });
  if (st !== 'all') logs = logs.filter((l) => statusOf(l) === st);
  if (u) logs = logs.filter((l) => l.user === u);
  if (q.trim()) logs = logs.filter((l) => JSON.stringify(l).toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="stack">
      <div className="seg">
        {[['all', '全部'], ['pending', '待審核'], ['correct', '正確'], ['incorrect', '需補強']].map(([k, v]) => (
          <button key={k} type="button" className={st === k ? 'on' : ''} onClick={() => { setSt(k); setN(20); }}>{v} <small>{counts[k]}</small></button>
        ))}
      </div>
      <div className="grid2">
        <select value={u} onChange={(e) => { setU(e.target.value); setN(20); }} aria-label="過濾使用者">
          <option value="">全部使用者</option>
          {d.users.map((x) => <option key={x.username}>{x.username}</option>)}
        </select>
        <input value={q} onChange={(e) => { setQ(e.target.value); setN(20); }} placeholder="關鍵字:題目、答案、解析..." />
      </div>
      <div className="muted">符合條件 {logs.length} 筆</div>
      {!logs.length && <div className="alert">沒有符合條件的紀錄。</div>}
      {logs.slice(0, n).map((l) => <ReviewItem key={l.id} log={l} act={act} />)}
      {logs.length > n && <button className="sec" onClick={() => setN((x) => x + 20)}>顯示更多(還有 {logs.length - n} 筆)</button>}
    </div>
  );
}

const Sec = ({ title, children }) => (<div><div className="eyebrow" style={{ marginBottom: 4 }}>{title}</div>{children}</div>);

function ReviewItem({ log, act }) {
  const fb = log.admin_feedback || { status: 'pending', comment: '' };
  const [status, setStatus] = useState(fb.status);
  const [comment, setComment] = useState(fb.comment || '');
  const [imgs, setImgs] = useState(null);
  const cur = statusOf(log);

  return (
    <details className="card rv">
      <summary>
        <span className="rv-top">
          <b>{log.subject}</b><span className="muted">{log.user}</span>
          <span className={`tag ${cur === 'correct' ? 'ok' : cur === 'incorrect' ? 'bad' : ''}`}>{STATUS[cur]}</span>
        </span>
        <span className="rv-sub muted">{log.time} · AI 答案:{log.ans}</span>
      </summary>

      <div className="stack rv-body">
        <div className="muted">解說深度:{log.depth_mode} · 標準參考答案:{log.ref_answer}</div>
        {log.note && log.note !== '無' && <Sec title="題目文字"><div style={{ whiteSpace: 'pre-wrap' }}>{log.note}</div></Sec>}
        {log.image_count > 0 && (
          <Sec title={`原圖(${log.image_count})`}>
            {imgs
              ? <div className="grid3">{imgs.map((b, i) => <img key={i} alt="" src={`data:image/jpeg;base64,${b}`} style={{ width: '100%', borderRadius: 8 }} />)}</div>
              : <button className="sec small" onClick={async () => setImgs((await api(`/api/history/${log.id}`)).images)}>載入原圖</button>}
          </Sec>
        )}
        <Sec title={`AI 答案:${log.ans}`}><Md>{log.reasoning}</Md></Sec>
        {log.options_analysis?.length > 0 && (
          <Sec title="選項解析">
            <div className="stack">{log.options_analysis.map((o, i) => (
              <div key={i} className={`opt ${o.is_correct ? 'ok' : 'bad'}`}><b>{o.is_correct ? '✔' : '✘'} {o.text || o.option}</b><Md>{o.explanation}</Md></div>
            ))}</div>
          </Sec>
        )}
        {log.followups?.length > 0 && (
          <Sec title={`學生追問(${log.followups.length}/3)`}>
            <div className="stack">{log.followups.map((f, i) => (
              <div key={i} className="opt"><div><b>問:</b>{f.q}</div><Md>{f.a}</Md></div>
            ))}</div>
          </Sec>
        )}

        <hr style={{ margin: '4px 0' }} />
        <Sec title="管理員點評(計入正確率)">
          <div className="seg">
            {Object.entries(STATUS).map(([k, v]) => (
              <button key={k} type="button" className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{v}</button>
            ))}
          </div>
        </Sec>
        <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="給學生的觀念補充、錯誤更正或學習建議..." />
        <button onClick={() => act('review', { id: log.id, status, comment }, '點評已儲存')}>儲存點評</button>
      </div>
    </details>
  );
}

/* ---------------- 科目 ---------------- */
function SubjectsTab({ d, act }) {
  const [name, setName] = useState('');
  const subs = d.config.subjects;
  return (
    <div className="card stack">
      <h4>系統科目</h4>
      <div className="muted">新增或移除後,首頁的科目按鈕會同步更新,AI 也會依所選科目切換專業解題模式。</div>
      <div className="tags" style={{ marginTop: 0 }}>
        {subs.map((s) => (
          <span key={s} className="subchip">{s}
            <button type="button" aria-label={`刪除${s}`} disabled={subs.length <= 1}
              onClick={() => { if (confirm(`確定刪除科目「${s}」?`)) act('deleteSubject', { name: s }, `已刪除科目:${s}`); }}>✕</button>
          </span>
        ))}
      </div>
      {subs.length <= 1 && <div className="muted">系統至少需保留一種科目。</div>}
      <div className="row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="新科目名稱,例如:物理、歷史" />
        <button style={{ flex: 'none' }} disabled={!name.trim()} onClick={async () => { if (await act('addSubject', { name }, `已新增科目:${name.trim()}`)) setName(''); }}>新增</button>
      </div>
    </div>
  );
}

/* ---------------- AI 設定 ---------------- */
function Engine({ title, on, setOn, model, setModel, options }) {
  return (
    <div className="card stack">
      <div className="row between"><b>{title}</b><Toggle checked={on} onChange={setOn} label={`啟用 ${title}`} /></div>
      <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!on} aria-label={`${title} 模型`}>
        {[...new Set([model, ...options])].map((m) => <option key={m}>{m}</option>)}
      </select>
    </div>
  );
}

function AITab({ d, act }) {
  const c = d.config;
  const [g, setG] = useState(c.enable_gemini);
  const [o, setO] = useState(c.enable_openai);
  const [gm, setGm] = useState(c.selected_gemini_model);
  const [om, setOm] = useState(c.selected_openai_model);
  return (
    <div className="stack">
      <Engine title="Google Gemini" on={g} setOn={setG} model={gm} setModel={setGm} options={GEMINI} />
      <Engine title="OpenAI GPT" on={o} setOn={setO} model={om} setModel={setOm} options={OPENAI} />
      <div className="muted">兩個都開啟時,會先用 Gemini;太忙或失敗時,自動換備用 Gemini 模型,最後才用 OpenAI。</div>
      <button onClick={() => act('saveSettings', { enable_gemini: g, enable_openai: o, selected_gemini_model: gm, selected_openai_model: om }, '已儲存 AI 設定')}>儲存 AI 設定</button>
    </div>
  );
}

/* ---------------- Bug 回報 ---------------- */
function BugsTab({ d }) {
  return (
    <div className="stack">
      {!d.bugs.length && <div className="alert">目前沒有任何問題回報。</div>}
      {d.bugs.map((b, i) => (
        <div key={i} className="card">
          <div className="row between"><b>{b.user}</b><small className="muted">{b.time}</small></div>
          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{b.message}</div>
        </div>
      ))}
    </div>
  );
}
