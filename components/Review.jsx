'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import Md from './Md';

const COUNTS = [5, 10, 20, 30];
const STATE_TXT = { new: '新題目', retry: '之前答錯,再試一次', review: '之前答對,複習一次' };
const enc = encodeURIComponent;

export default function Review({ onBack }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [stage, setStage] = useState('setup'); // setup 選科目與題數 / practice 作答 / summary 結果
  const [subject, setSubject] = useState('');
  const [source, setSource] = useState('');
  const [count, setCount] = useState(0);
  const [starting, setStarting] = useState(false);
  const [qs, setQs] = useState([]);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [results, setResults] = useState([]);
  const [used, setUsed] = useState(0);

  async function loadInfo() {
    try { const d = await api('/api/review'); setInfo(d); setUsed(d.used || 0); } catch (e) { setErr(e.message); }
  }
  useEffect(() => { loadInfo(); }, []);

  const remainNum = info?.limit == null ? Infinity : Math.max(0, info.limit - used);
  const remainLabel = info?.limit == null ? '無限' : remainNum;
  const countFor = (sub, src) => (info?.index || []).filter(([s, r]) => s === sub && (!src || r === src)).length;
  const avail = subject ? countFor(subject, source) : 0;
  const maxN = Math.min(avail, remainNum, 50);
  const options = COUNTS.filter((n) => n <= maxN);
  if (maxN > 0 && !options.includes(maxN)) options.push(maxN);

  // 換科目或來源後,預設選 10 題(題目不夠就選最多)
  useEffect(() => {
    setCount(maxN <= 0 ? 0 : (maxN >= 10 ? 10 : maxN));
  }, [subject, source, maxN]);

  const resetQ = () => { setRes(null); setSel([]); setText(''); };

  async function start() {
    setStarting(true); setErr('');
    try {
      const d = await api(`/api/review?session=1&subject=${enc(subject)}&source=${enc(source)}&count=${count}`);
      if (!d.questions.length) { setErr('這個條件下沒有題目'); return; }
      setQs(d.questions); setIdx(0); setResults([]); resetQ(); setStage('practice');
    } catch (e) { setErr(e.message); }
    finally { setStarting(false); }
  }

  const q = qs[idx];

  async function submit() {
    const answer = q.type === 'choice' ? sel.join('') : text.trim();
    if (!answer || busy) return;
    setBusy(true); setErr('');
    try {
      const r = await api('/api/review', { method: 'POST', body: { id: q.id, answer } });
      setRes(r); setUsed(r.used ?? used);
      setResults((p) => [...p, { q, correct: r.correct, answer: r.answer, answer_by: r.answer_by, explanation: r.explanation, mine: answer }]);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  function next() {
    if (idx + 1 < qs.length) { setIdx(idx + 1); resetQ(); }
    else { setStage('summary'); loadInfo(); }
  }
  const toggle = (k) => {
    if (res) return;
    setSel((p) => (q.multi ? (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]) : [k]));
  };
  function leave() {
    if (stage === 'practice') {
      if (!confirm('要結束這次練習嗎?已作答的題目會保留在結果中。')) return;
      setStage(results.length ? 'summary' : 'setup'); loadInfo();
    } else if (stage === 'summary') { setStage('setup'); setErr(''); }
    else onBack();
  }

  const sub = stage === 'practice' ? `${subject} · 第 ${idx + 1} / ${qs.length} 題` : stage === 'summary' ? '練習結果' : '選擇科目與題數';
  const head = (
    <div className="lab-head">
      <button type="button" className="icon-btn" onClick={leave} aria-label="返回">←</button>
      <div className="lab-title"><b>考前複習</b><small className="muted">{sub}</small></div>
      <span className="lab-quota">今日剩餘 <b>{remainLabel}</b>{info?.limit != null && <> / {info.limit}</>}</span>
    </div>
  );

  if (!info && !err) return <div className="lab">{head}<div className="muted">載入中...</div></div>;
  if (info && !info.enabled) {
    return (
      <div className="lab">{head}
        <div className="card center stack" style={{ padding: '28px 16px' }}>
          <div style={{ fontSize: 38 }} aria-hidden="true">📚</div>
          <b style={{ fontSize: 18 }}>考前複習尚未開放</b>
          <div className="muted">考試前,管理員會開放這個功能,屆時就可以在這裡練習題目。</div>
        </div>
      </div>
    );
  }

  /* ---------- 作答 ---------- */
  if (stage === 'practice' && q) {
    return (
      <div className="lab">{head}
        <div className="bar" style={{ marginBottom: 12 }}><i style={{ width: `${((idx + (res ? 1 : 0)) / qs.length) * 100}%` }} /></div>
        {err && <div className="alert bad" style={{ marginBottom: 10 }}>{err}</div>}
        <div className="stack">
          <div className="card stack">
            <div className="row between"><span className="tag">{q.subject} · {q.source}</span><small className="muted">{STATE_TXT[q.state]}</small></div>
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
              <button type="button" disabled={busy || (q.type === 'choice' ? !sel.length : !text.trim())} onClick={submit}>
                {busy ? 'AI 批改中...' : '送出答案'}
              </button>
            )}
          </div>

          {res && (
            <div className={`card stack ${res.correct ? 'res-ok' : 'res-bad'}`}>
              <b style={{ fontSize: 17 }}>{res.correct ? '✓ 答對了!' : '✗ 答錯了'}</b>
              <div>正確答案:<b>{res.answer}</b>{res.answer_by === 'ai' && <small className="muted"> (答案由 AI 產生,僅供參考)</small>}</div>
              {!res.correct && res.explanation && <div><div className="eyebrow" style={{ marginBottom: 4 }}>解析</div><Md>{res.explanation}</Md></div>}
              <button type="button" onClick={next}>{idx + 1 < qs.length ? '下一題' : '看結果'}</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- 結果 ---------- */
  if (stage === 'summary') {
    const right = results.filter((r) => r.correct).length;
    const pct = results.length ? Math.round((right / results.length) * 100) : 0;
    return (
      <div className="lab">{head}
        <div className="stack">
          <div className="card center stack">
            <div className="eyebrow">{subject}</div>
            <div className="pf-num" style={{ fontSize: 42 }}>{right} / {results.length}</div>
            <div className="muted">答對率 {pct}%</div>
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          </div>
          {results.map((r, i) => (
            <details key={r.q.id} className="card rv">
              <summary>
                <span className="rv-top"><span className={`rv-dot ${r.correct ? 'correct' : 'incorrect'}`} aria-hidden="true" /><b>第 {i + 1} 題</b><span className={`tag rv-tag ${r.correct ? 'ok' : 'bad'}`}>{r.correct ? '答對' : '答錯'}</span></span>
                <span className="rv-sub muted">{r.q.stem.replace(/\s+/g, ' ')}</span>
              </summary>
              <div className="stack rv-body">
                <Md>{r.q.stem}</Md>
                <div>你的答案:<b>{r.mine}</b> · 正確答案:<b>{r.answer}</b></div>
                {!r.correct && r.explanation && <div><div className="eyebrow" style={{ marginBottom: 4 }}>解析</div><Md>{r.explanation}</Md></div>}
              </div>
            </details>
          ))}
          <div className="row">
            <button type="button" style={{ flex: 1 }} onClick={() => { setStage('setup'); setErr(''); }}>再練一組</button>
            <button type="button" className="sec" style={{ flex: 'none' }} onClick={onBack}>回首頁</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 選科目與題數 ---------- */
  const noQuota = remainNum === 0;
  return (
    <div className="lab">{head}
      {err && <div className="alert bad" style={{ marginBottom: 10 }}>{err}</div>}
      <div className="stack">
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-around', textAlign: 'center' }}>
            <div><div className="pf-num">{info.total}</div><small className="muted">題庫題數</small></div>
            <div><div className="pf-num">{info.answered}</div><small className="muted">已作答</small></div>
            <div><div className="pf-num">{info.correct}</div><small className="muted">答對</small></div>
          </div>
        </div>

        <div className="card stack">
          <div className="stephead" style={{ margin: 0 }}><span className="step">1</span>選擇要練習的科目</div>
          {!info.subjects.length && <div className="alert">題庫還沒有可練習的題目。</div>}
          <div className="tags" role="radiogroup" aria-label="科目">
            {info.subjects.map((s) => (
              <button key={s.name} type="button" role="radio" aria-checked={subject === s.name} className={`tchip ${subject === s.name ? 'on' : ''}`}
                onClick={() => { setSubject(s.name); setSource(''); }}>{s.name}({s.count})</button>
            ))}
          </div>
          {subject && info.sources.length > 1 && (
            <label><span className="field-label">題目來源(選填)</span>
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">全部來源</option>
                {[...new Set(info.index.filter(([s]) => s === subject).map(([, r]) => r))].map((r) => <option key={r} value={r}>{r}({countFor(subject, r)})</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="card stack">
          <div className="stephead" style={{ margin: 0 }}><span className="step">2</span>選擇要練習的題數</div>
          {!subject && <div className="muted">請先選擇科目。</div>}
          {subject && noQuota && <div className="alert bad">今天的考前複習題數已用完,明天再來!</div>}
          {subject && !noQuota && (
            <>
              <div className="tags" role="radiogroup" aria-label="題數">
                {options.map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={count === n} className={`tchip ${count === n ? 'on' : ''}`} onClick={() => setCount(n)}>
                    {n} 題{n === maxN && !COUNTS.includes(n) ? (maxN === avail ? '(全部)' : '(最多)') : ''}
                  </button>
                ))}
              </div>
              <div className="muted">這個條件共有 {avail} 題{info.limit != null && ` · 今天還能作答 ${remainNum} 題`}。每作答一題(不論對錯)用掉 1 題,沒做過的題目會先出。</div>
            </>
          )}
        </div>

        <button type="button" disabled={starting || !subject || !count || noQuota} onClick={start}>
          {starting ? '出題中...' : count ? `開始複習(${count} 題)` : '開始複習'}
        </button>
      </div>
    </div>
  );
}
