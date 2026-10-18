'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import Md from './Md';

const MAX = 500;
const P = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const IBack = () => <svg {...P}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>;
const IHist = () => <svg {...P}><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3.5 4.5v4h4" /><path d="M12 7.5V12l3 2" /></svg>;
const INew = () => <svg {...P}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
const ISend = () => <svg {...P}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>;

export default function LabAI({ me, subjects, onBack, onUsed }) {
  const isAdmin = me.role === 'admin';
  const limit = me.lab_limit ?? 10;
  const [used, setUsed] = useState(me.lab_used_today || 0);
  useEffect(() => { setUsed(me.lab_used_today || 0); }, [me.lab_used_today]);
  const remain = isAdmin ? '無限' : Math.max(0, limit - used);

  const [subject, setSubject] = useState('');
  const [chat, setChat] = useState(null);       // { id, subject, title, messages }
  const [pending, setPending] = useState(null); // 正在送出的問題(先顯示在畫面上)
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [view, setView] = useState('chat');     // chat | history
  const [list, setList] = useState(null);
  const endRef = useRef(null);

  const messages = chat?.messages || [];
  const started = messages.length > 0 || !!pending;
  const curSubject = chat ? chat.subject : (subject || subjects[0] || '');
  const noQuota = remain === 0;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length, pending, sending, view]);

  async function send() {
    const q = text.trim();
    if (!q || sending || noQuota || !curSubject) return;
    setErr(''); setSending(true); setPending(q); setText('');
    try {
      const r = await api('/api/lab', { method: 'POST', body: { id: chat?.id, subject: curSubject, text: q } });
      setChat(r.chat); setUsed(r.lab_used); onUsed?.();
    } catch (e) { setErr(e.message); setText(q); }
    finally { setPending(null); setSending(false); }
  }

  function newChat() { setChat(null); setPending(null); setErr(''); setText(''); setView('chat'); }
  async function openHistory() {
    setView('history'); setList(null);
    try { setList((await api('/api/lab')).chats); } catch (e) { setErr(e.message); setList([]); }
  }
  async function openChat(id) {
    try { setChat((await api(`/api/lab?id=${id}`)).chat); setErr(''); setView('chat'); } catch (e) { setErr(e.message); }
  }
  async function removeChat(id) {
    if (!confirm('確定要刪除這個對話嗎?')) return;
    await api(`/api/lab?id=${id}`, { method: 'DELETE' }).catch(() => {});
    setList((l) => (l || []).filter((c) => c.id !== id));
    if (chat?.id === id) { newChat(); setView('history'); }
  }

  return (
    <div className="lab">
      <div className="lab-head">
        <button type="button" className="icon-btn" onClick={view === 'history' ? () => setView('chat') : onBack} aria-label="返回"><IBack /></button>
        <div className="lab-title">
          <b>LAB AI | 課業助教</b>
          <small className="muted">{view === 'history' ? '聊天紀錄' : (chat?.title || '新對話')}</small>
        </div>
        <button type="button" className="icon-btn" onClick={openHistory} aria-label="聊天紀錄"><IHist /></button>
        <button type="button" className="icon-btn accent" onClick={newChat} aria-label="新對話"><INew /></button>
      </div>

      <div className="lab-chips">
        <div className="lab-chiprow" role="radiogroup" aria-label="提問科目">
          {subjects.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={curSubject === s}
              className={`lab-chip ${curSubject === s ? 'on' : ''}`} disabled={started && curSubject !== s || sending}
              onClick={() => setSubject(s)}>{s}</button>
          ))}
        </div>
        <span className="lab-quota">今日 <b>{remain}</b>{!isAdmin && <> / {limit}</>}</span>
      </div>

      <div className="lab-body">
        {view === 'history' ? (
          <div className="stack">
            {list === null && <div className="muted">載入中...</div>}
            {list?.length === 0 && <div className="alert">還沒有聊天紀錄。聊天紀錄會保留 30 天。</div>}
            {list?.map((c) => (
              <div key={c.id} className="card clickable" onClick={() => openChat(c.id)}>
                <div className="row between">
                  <b style={{ overflowWrap: 'anywhere' }}>{c.title}</b>
                  <button type="button" className="danger small" onClick={(e) => { e.stopPropagation(); removeChat(c.id); }}>刪除</button>
                </div>
                <small className="muted">{c.subject} · {c.updated} · {Math.floor(c.count / 2)} 次提問</small>
              </div>
            ))}
          </div>
        ) : !started ? (
          <div className="lab-empty">
            <div className="lab-eyebrow">LAB AI 課業助教</div>
            <div className="lab-h1">把卡住的觀念,<br />一起弄懂</div>
            <div className="lab-steps">
              <span><i>1</i> 選科目</span><span aria-hidden="true">→</span><span><i>2</i> 問觀念、公式</span>
            </div>
          </div>
        ) : (
          <div className="stack" style={{ gap: 14 }}>
            {messages.map((m, i) => (
              <div key={i} className={`bub ${m.role === 'user' ? 'me' : 'ai'}`}>
                {m.role === 'user' ? <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.text}</div> : <Md>{m.text}</Md>}
              </div>
            ))}
            {pending && <div className="bub me"><div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{pending}</div></div>}
            {sending && <div className="bub ai"><span className="typing" aria-label="AI 思考中"><i /><i /><i /></span></div>}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {err && <div className={`alert ${err.startsWith('請問') ? '' : 'bad'}`} role="alert" style={{ marginBottom: 10 }}>{err}</div>}

      {view === 'chat' && (
        <>
          <div className="lab-input">
            <div className="lab-inrow">
              <textarea rows={3} maxLength={MAX} value={text} disabled={sending || noQuota}
                placeholder={noQuota ? '今天的 LAB AI 次數已用完' : '輸入你的問題…'}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }} />
              <button type="button" className="lab-send" onClick={send} disabled={!text.trim() || sending || noQuota} aria-label="送出"><ISend /></button>
            </div>
            <div className="lab-foot"><span>送出後自動建立聊天紀錄</span><span>{text.length} / {MAX}</span></div>
          </div>
          <div className="lab-note">僅限學科問題,AI回答僅供參考,若有問題請與課本或老師核對</div>
        </>
      )}
    </div>
  );
}
