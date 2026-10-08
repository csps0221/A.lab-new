'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

export default function History({ onOpen }) {
  const [q, setQ] = useState('');
  const [logs, setLogs] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api(`/api/history?q=${encodeURIComponent(q)}`).then((d) => setLogs(d.logs)).catch((e) => setErr(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="stack">
      <h3>我的解題紀錄</h3>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋答案、題目文字、解析內容..." />
      {err && <div className="alert bad">{err}</div>}
      {logs && <div className="muted">共 {logs.length} 筆紀錄</div>}
      {logs && !logs.length && <div className="alert">尚無解題紀錄!</div>}
      {logs?.map((l) => {
        const st = l.admin_feedback?.status;
        return (
          <div key={l.id} className="card clickable" onClick={() => onOpen(l)}>
            <div className="row between">
              <b>{l.subject} ({l.user}) <small>[{l.depth_mode}]</small>
                {st === 'correct' && <span className="tag ok">已核可</span>}
                {st === 'incorrect' && <span className="tag bad">需加強</span>}
              </b>
              <small className="muted">{l.time}</small>
            </div>
            <div style={{ marginTop: 3 }}>答案:{l.ans}</div>
            <div className="muted clamp">{l.note && l.note !== '無' ? l.note : l.reasoning}</div>
            {l.image_count > 0 && <small className="muted">附圖 {l.image_count} 張</small>}
          </div>
        );
      })}
    </div>
  );
}
