'use client';
import Md from './Md';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

const DEPTHS = ['精簡解答', '標準詳解', '深度解析'];
const REVIEWS = [['', '全部'], ['pending', '待審核'], ['correct', '已核可'], ['incorrect', '需加強']];
const RANGES = [['all', '全部時間'], ['7', '近 7 天'], ['30', '近 30 天']];
const cutoff = (days) => new Date(Date.now() - days * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
const EMPTY = { subject: '', depth: '', review: '', range: 'all', fav: false };

const Chip = ({ on, onClick, children }) => (
  <button type="button" className={`tchip ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>{children}</button>
);

export default function History({ subjects = [], favIds = [], onOpen, onOpenChat, onStartSolve, onStartChat }) {
  const [tab, setTab] = useState('solve');        // solve = 解題紀錄 / chat = 提問紀錄(LAB AI)
  const [text, setText] = useState('');           // 輸入框內容
  const [q, setQ] = useState('');                 // 已套用的搜尋關鍵字
  const [adv, setAdv] = useState(false);          // 進階篩選是否展開
  const [f, setF] = useState(EMPTY);
  const [solves, setSolves] = useState(null);
  const [chats, setChats] = useState(null);
  const [err, setErr] = useState('');

  // 解題紀錄:關鍵字由伺服器搜尋,其他條件在畫面上篩選
  useEffect(() => {
    if (tab !== 'solve') return;
    setSolves(null); setErr('');
    api(`/api/history?q=${encodeURIComponent(q)}`).then((d) => setSolves(d.logs)).catch((e) => setErr(e.message));
  }, [tab, q]);

  useEffect(() => {
    if (tab !== 'chat' || chats) return;
    api('/api/lab').then((d) => setChats(d.chats)).catch((e) => setErr(e.message));
  }, [tab, chats]);

  const apply = () => setQ(text.trim());
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const activeCount = (f.subject ? 1 : 0) + (tab === 'solve' ? (f.depth ? 1 : 0) + (f.review ? 1 : 0) + (f.fav ? 1 : 0) : 0) + (f.range !== 'all' ? 1 : 0);
  const inRange = (t) => f.range === 'all' || String(t || '').slice(0, 10) >= cutoff(Number(f.range));

  const shownSolves = (solves || []).filter((l) =>
    (!f.subject || l.subject === f.subject) &&
    (!f.depth || l.depth_mode === f.depth) &&
    (!f.review || (l.admin_feedback?.status || 'pending') === f.review) &&
    (!f.fav || favIds.includes(l.id)) &&
    inRange(l.time));
  const kw = q.toLowerCase();
  const shownChats = (chats || []).filter((c) =>
    (!f.subject || c.subject === f.subject) && inRange(c.updated) &&
    (!kw || `${c.title} ${c.subject}`.toLowerCase().includes(kw)));

  async function removeChat(id) {
    if (!confirm('確定要刪除這個對話嗎?')) return;
    await api(`/api/lab?id=${id}`, { method: 'DELETE' }).catch(() => {});
    setChats((l) => (l || []).filter((c) => c.id !== id));
  }

  const list = tab === 'solve' ? shownSolves : shownChats;
  const loading = tab === 'solve' ? solves === null : chats === null;

  return (
    <div className="stack">
      <div className="rtabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'solve'} className={`rtab ${tab === 'solve' ? 'on' : ''}`} onClick={() => setTab('solve')}>解題紀錄</button>
        <button type="button" role="tab" aria-selected={tab === 'chat'} className={`rtab ${tab === 'chat' ? 'on' : ''}`} onClick={() => setTab('chat')}>提問紀錄</button>
      </div>

      <div className="row between">
        <h2 className="rec-title">{tab === 'solve' ? '解題紀錄' : '提問紀錄'}</h2>
        <button type="button" className="softbtn small" onClick={tab === 'solve' ? onStartSolve : onStartChat}>＋ {tab === 'solve' ? '開始解題' : '新提問'}</button>
      </div>

      <div className="card stack">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }}
          placeholder={tab === 'solve' ? '搜尋答案、題目補充、解析內容…' : '搜尋提問標題、科目…'} aria-label="搜尋" />
        <div className="row">
          <button type="button" className="softbtn" style={{ flex: 1 }} onClick={apply}>搜尋</button>
          <button type="button" className="softbtn gray" style={{ flex: 'none' }} aria-expanded={adv} onClick={() => setAdv((a) => !a)}>
            進階篩選{activeCount > 0 && <span className="cnt">{activeCount}</span>} {adv ? '↑' : '↓'}
          </button>
        </div>

        {adv && (
          <div className="stack adv-panel">
            <div>
              <div className="field-label">科目</div>
              <div className="tags"><Chip on={!f.subject} onClick={() => set('subject', '')}>全部</Chip>{subjects.map((s) => <Chip key={s} on={f.subject === s} onClick={() => set('subject', s)}>{s}</Chip>)}</div>
            </div>
            {tab === 'solve' && (
              <>
                <div>
                  <div className="field-label">解說深度</div>
                  <div className="tags"><Chip on={!f.depth} onClick={() => set('depth', '')}>全部</Chip>{DEPTHS.map((s) => <Chip key={s} on={f.depth === s} onClick={() => set('depth', s)}>{s}</Chip>)}</div>
                </div>
                <div>
                  <div className="field-label">管理員審核</div>
                  <div className="tags">{REVIEWS.map(([k, v]) => <Chip key={k || 'all'} on={f.review === k} onClick={() => set('review', k)}>{v}</Chip>)}</div>
                </div>
              </>
            )}
            <div>
              <div className="field-label">時間</div>
              <div className="tags">{RANGES.map(([k, v]) => <Chip key={k} on={f.range === k} onClick={() => set('range', k)}>{v}</Chip>)}</div>
            </div>
            {tab === 'solve' && <div className="tags"><Chip on={f.fav} onClick={() => set('fav', !f.fav)}>★ 只看收藏</Chip></div>}
            <button type="button" className="sec small" style={{ alignSelf: 'flex-start' }} onClick={() => setF(EMPTY)}>清除篩選</button>
          </div>
        )}
      </div>

      {err && <div className="alert bad">{err}</div>}
      {loading && !err && <div className="muted">載入中...</div>}
      {!loading && <div className="muted">共 {list.length} 筆{(q || activeCount > 0) && '(符合條件)'}{tab === 'solve' && solves?.length >= 100 && ' · 僅顯示最近 100 筆'}{tab === 'chat' && ' · 提問紀錄保留 30 天'}</div>}
      {!loading && !list.length && <div className="alert">{tab === 'solve' ? '沒有符合條件的解題紀錄。' : '沒有符合條件的提問紀錄。'}</div>}

      {tab === 'solve' && shownSolves.map((l) => {
        const st = l.admin_feedback?.status;
        return (
          <div key={l.id} className="card clickable" onClick={() => onOpen(l)}>
            <div className="row between">
              <b>{favIds.includes(l.id) && '★ '}{l.subject} <small>[{l.depth_mode}]</small>
                {st === 'correct' && <span className="tag ok">已核可</span>}
                {st === 'incorrect' && <span className="tag bad">需加強</span>}
              </b>
              <small className="muted">{l.time}</small>
            </div>
            <div style={{ marginTop: 3 }}>答案:<Md inline>{l.ans}</Md></div>
            <div className="muted clamp">{l.note && l.note !== '無' ? l.note : l.reasoning}</div>
            {l.image_count > 0 && <small className="muted">附圖 {l.image_count} 張</small>}
          </div>
        );
      })}

      {tab === 'chat' && shownChats.map((c) => (
        <div key={c.id} className="card clickable" onClick={() => onOpenChat(c.id)}>
          <div className="row between">
            <b style={{ overflowWrap: 'anywhere' }}>{c.title}</b>
            <button type="button" className="danger small" onClick={(e) => { e.stopPropagation(); removeChat(c.id); }}>刪除</button>
          </div>
          <small className="muted">{c.subject} · {c.updated} · {Math.floor(c.count / 2)} 次提問</small>
        </div>
      ))}
    </div>
  );
}
