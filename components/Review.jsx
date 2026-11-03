'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import Md from './Md';

const STATE_TXT = { new: '新題目', retry: '之前答錯,再試一次', review: '全部答對了,隨機複習' };

export default function Review({ onBack }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [source, setSource] = useState('');
  const [subject, setSubject] = useState('');
  const [practice, setPractice] = useState(false);
  const [q, setQ] = useState(null);
  const [qState, setQState] = useState('');
  const [loadingQ, setLoadingQ] = useState(false);
  const [sel, setSel] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [used, setUsed] = useState(0);

  async function loadInfo() {
    try { const d = await api('/api/review'); setInfo(d); setUsed(d.used || 0); } catch (e) { setErr(e.message); }
  }
  useEffect(() => { loadInfo(); }, []);

  const remain = info?.limit == null ? '無限' : Math.max(0, info.limit - used);
  const noQuota = remain === 0;

  async function loadNext(exclude = '') {
    setLoadingQ(true); setRes(null); setSel([]); setText(''); setErr('');
    try {
      const d = await api(`/api/review?next=1&source=${encodeURIComponent(source)}&subject=${encodeURIComponent(subject)}&exclude=${encodeURIComponent(exclude)}`);
      setQ(d.question); setQState(d.state || ''); setPractice(true);
    } catch (e) { setErr(e.message); }
    finally { setLoadingQ(false); }
  }

  async function submit() {
    const answer = q.type === 'choice' ? sel.join('') : text.trim();
    if (!answer || busy) return;
    setBusy(true); setErr('');
    try {
      const r = await api('/api/review', { method: 'POST', body: { id: q.id, answer } });
      setRes(r); setUsed(r.used);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const toggle = (k) => {
    if (res) return;
    setSel((p) => (q.multi ? (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]) : [k]));
  };
  const leave = () => { setPractice(false); setQ(null); setRes(null); loadInfo(); };

  const head = (
    <div className="lab-head">
      <button type="button" className="icon-btn" onClick={practice ? leave : onBack} aria-label="返回">←</button>
      <div className="lab-title"><b>考前複習</b><small className="muted">{practice && q ? `${q.source} · ${q.subject}` : '題庫練習'}</small></div>
      <span className="lab-quota">今日剩餘 <b>{remain}</b>{info?.limit != null && <> / {info.limit}</>}</span>
    </div>
  );

  if (!info && !err) return <div className="lab">{head}<div className="muted">載入中...</div></div>;
  if (info && !info.enabled) {
    return (
      <div className="lab">{head}
        <div className="card center stack" style={{ padding: '28px 16px' }}>
          <div style={{ fontSize: 38 }} aria-hidden="true">📚</div>
          <b style={{ fontSize: 18 }}>考前複習尚未開放</b>
          <div className="muted">考試前,老師會開放這個功能,屆時就可以在這裡練習題目。</div>
        </div>
      </div>
    );
  }

  /* ---------- 作答畫面 ---------- */
  if (practice) {
    return (
      <div className="lab">{head}
        {err && <div className="alert bad" style={{ marginBottom: 10 }}>{err}</div>}
        {loadingQ && <div className="muted">出題中...</div>}
        {!loadingQ && !q && (
          <div className="card center stack"><b>目前沒有符合條件的題目</b><button type="button" onClick={leave}>回到篩選</button></div>
        )}
        {!loadingQ && q && (
          <div className="stack">
            <div className="card stack">
              <div className="row between"><span className="tag">{q.subject}</span><small className="muted">{STATE_TXT[qState]}</small></div>
              <Md>{q.stem}</Md>
              {q.images?.map((b, i) => <img key={i} alt="題目附圖" src={`data:image/jpeg;base64,${b}`} style={{ width: '100%', borderRadius: 10 }} />)}

              {q.type === 'choice' ? (
                <div className="stack" style={{ gap: 8 }} role={q.multi ? 'group' : 'radiogroup'}>
                  {q.multi && <small className="muted">這題是複選題</small>}
                  {q.options.map((o) => {
                    const picked = sel.includes(o.k);
                    const right = res && res.answer.includes(o.k);
                    const wrong = res && picked && !right;
                    return (
                      <button key={o.k} type="button" className={`ropt ${picked ? 'on' : ''} ${right ? 'right' : ''} ${wrong ? 'wrongp' : ''}`}
                        role={q.multi ? 'checkbox' : 'radio'} aria-checked={picked} disabled={!!res} onClick={() => toggle(o.k)}>
                        <b>{o.k}</b><span className="ropt-t"><Md inline>{o.t}</Md></span>
                        {right && <span aria-hidden="true">✓</span>}{wrong && <span aria-hidden="true">✗</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea rows={3} maxLength={500} value={text} disabled={!!res} onChange={(e) => setText(e.target.value)} placeholder="輸入你的答案" />
              )}

              {!res && (
                <div className="row">
                  <button type="button" style={{ flex: 1 }} disabled={busy || noQuota || (q.type === 'choice' ? !sel.length : !text.trim())} onClick={submit}>
                    {busy ? 'AI 批改中...' : noQuota ? '今天題數已用完' : '送出答案'}
                  </button>
                  <button type="button" className="sec" style={{ flex: 'none' }} disabled={busy} onClick={() => loadNext(q.id)}>跳過</button>
                </div>
              )}
            </div>

            {res && (
              <div className={`card stack ${res.correct ? 'res-ok' : 'res-bad'}`}>
                <b style={{ fontSize: 17 }}>{res.correct ? '✓ 答對了!' : '✗ 答錯了'}</b>
                <div>正確答案:<b>{res.answer}</b>{res.answer_by === 'ai' && <small className="muted"> (答案由 AI 產生,僅供參考)</small>}</div>
                {!res.correct && res.explanation && <div><div className="eyebrow" style={{ marginBottom: 4 }}>解析</div><Md>{res.explanation}</Md></div>}
                <button type="button" onClick={() => loadNext(q.id)}>下一題</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ---------- 篩選與開始 ---------- */
  return (
    <div className="lab">{head}
      {err && <div className="alert bad" style={{ marginBottom: 10 }}>{err}</div>}
      <div className="card stack">
        <div className="row" style={{ justifyContent: 'space-around', textAlign: 'center' }}>
          <div><div className="pf-num">{info.total}</div><small className="muted">題庫題數</small></div>
          <div><div className="pf-num">{info.answered}</div><small className="muted">已作答</small></div>
          <div><div className="pf-num">{info.correct}</div><small className="muted">答對</small></div>
        </div>
      </div>

      <div className="card stack" style={{ marginTop: 10 }}>
        <label><span className="field-label">題目來源</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">全部來源</option>
            {info.sources.map((s) => <option key={s.name} value={s.name}>{s.name}({s.count})</option>)}
          </select>
        </label>
        <div>
          <div className="field-label">科目</div>
          <div className="tags">
            <button type="button" className={`tchip ${!subject ? 'on' : ''}`} onClick={() => setSubject('')}>全部</button>
            {info.subjects.map((s) => <button key={s.name} type="button" className={`tchip ${subject === s.name ? 'on' : ''}`} onClick={() => setSubject(s.name)}>{s.name}({s.count})</button>)}
          </div>
        </div>
        <button type="button" disabled={loadingQ || !info.total || noQuota} onClick={() => loadNext()}>
          {!info.total ? '題庫還沒有題目' : noQuota ? '今天題數已用完' : loadingQ ? '出題中...' : '開始複習'}
        </button>
        <div className="muted">每次作答(不論對錯)都會用掉 1 題。沒做過的題目會先出,答錯的會再出現。</div>
      </div>
    </div>
  );
}
