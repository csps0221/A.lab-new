'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import Md from './Md';

const COUNTS = [5, 10, 20, 30];
const STATE_TXT = { new: '新題目', retry: '之前答錯,再試一次', review: '之前答對,複習一次' };
const enc = encodeURIComponent;
// 在畫面上批改:選擇題比對選項字母;非選擇題只做「完全相同」的快速判斷,其餘交給 AI
const normC = (s) => [...new Set(String(s || '').toUpperCase().match(/[A-Z]/g) || [])].sort().join('');
const normT = (s) => String(s || '').toLowerCase().replace(/[\s\u3000,，.。;；:：、]+/g, '');
const pctOf = (c, t) => (t ? Math.round((c / t) * 100) : 0);

export default function Review({ onBack }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [stage, setStage] = useState('setup'); // setup / practice / summary / report
  const [subject, setSubject] = useState('');
  const [source, setSource] = useState('');
  const [count, setCount] = useState(0);
  const [starting, setStarting] = useState(false);
  const [sid, setSid] = useState('');
  const [qs, setQs] = useState([]);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [results, setResults] = useState([]);
  const [used, setUsed] = useState(0);
  const [rep, setRep] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [repTab, setRepTab] = useState('history'); // history 歷史成績 / weak 弱點分析
  const [locked, setLocked] = useState(false);      // 按下「送出答案」後,不能再更改選項
  const lockRef = useRef(false);

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

  useEffect(() => { setCount(maxN <= 0 ? 0 : (maxN >= 10 ? 10 : maxN)); }, [subject, source, maxN]);

  const resetQ = () => { setRes(null); setSel([]); setText(''); lockRef.current = false; setLocked(false); };

  async function start() {
    setStarting(true); setErr('');
    try {
      const d = await api(`/api/review?session=1&subject=${enc(subject)}&source=${enc(source)}&count=${count}`);
      if (!d.questions.length) { setErr('這個條件下沒有題目'); return; }
      setSid(Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      setQs(d.questions); setIdx(0); setResults([]); resetQ(); setStage('practice');
    } catch (e) { setErr(e.message); }
    finally { setStarting(false); }
  }

  const q = qs[idx];

  async function submit() {
    const answer = q.type === 'choice' ? sel.join('') : text.trim();
    if (!answer || busy || lockRef.current) return;
    lockRef.current = true; setLocked(true); // 一按下去就鎖住,避免改選項或重複送出
    setErr('');
    const cur = q;
    const patch = (p) => setResults((prev) => prev.map((r) => (r.q.id === cur.id ? { ...r, ...p } : r)));
    const send = () => api('/api/review', { method: 'POST', body: { id: cur.id, answer, sid } });

    let local = null;
    if (cur.type === 'choice') local = normC(answer) === normC(cur.answer);
    else if (normT(answer) === normT(cur.answer)) local = true;

    if (local !== null) {
      // 答案已經在手上:畫面上立刻顯示對錯,伺服器的記錄與解析在背景進行
      setRes({ qid: cur.id, correct: local, answer: cur.answer, answer_by: cur.answer_by, explanation: '', pending: !local, error: '' });
      setResults((p) => [...p, { q: cur, mine: answer, answer: cur.answer, answer_by: cur.answer_by, correct: local, explanation: '', pending: !local, error: '' }]);
      if (info?.limit != null) setUsed((u) => u + 1);
      send().then((r) => {
        patch({ correct: r.correct, explanation: r.explanation || '', pending: false });
        setRes((p) => (p && p.qid === cur.id ? { ...p, correct: r.correct, explanation: r.explanation || '', pending: false } : p));
        if (r.used != null) setUsed(r.used);
      }).catch((e) => {
        patch({ pending: false, error: e.message });
        setRes((p) => (p && p.qid === cur.id ? { ...p, pending: false, error: e.message } : p));
      });
      return;
    }

    // 非選擇題且答案不完全相同:交給 AI 批改
    setBusy(true);
    try {
      const r = await send();
      setRes({ qid: cur.id, correct: r.correct, answer: r.answer, answer_by: r.answer_by, explanation: r.explanation || '', pending: false, error: '' });
      setResults((p) => [...p, { q: cur, mine: answer, answer: r.answer, answer_by: r.answer_by, correct: r.correct, explanation: r.explanation || '', pending: false, error: '' }]);
      if (r.used != null) setUsed(r.used);
    } catch (e) { setErr(e.message); lockRef.current = false; setLocked(false); } // 批改沒成功:解鎖讓使用者重送
    finally { setBusy(false); }
  }

  function next() {
    if (idx + 1 < qs.length) { setIdx(idx + 1); resetQ(); }
    else { setStage('summary'); loadInfo(); }
  }
  const toggle = (k) => {
    if (res || locked || lockRef.current) return;
    setSel((p) => (q.multi ? (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]) : [k]));
  };

  async function openReport() {
    setStage('report'); setRep(null); setErr(''); setRepTab('history');
    try { setRep(await api('/api/review?stats=1')); } catch (e) { setErr(e.message); }
  }
  async function analyze() {
    setAnalyzing(true); setErr('');
    try { const r = await api('/api/review', { method: 'POST', body: { action: 'analyze' } }); setRep((p) => ({ ...p, analysis: r.analysis })); }
    catch (e) { setErr(e.message); }
    finally { setAnalyzing(false); }
  }

  function leave() {
    if (stage === 'practice') {
      if (!confirm('要結束這次練習嗎?已作答的題目會保留在結果中。')) return;
      setStage(results.length ? 'summary' : 'setup'); loadInfo();
    } else if (stage === 'summary' || stage === 'report') { setStage('setup'); setErr(''); loadInfo(); }
    else onBack();
  }

  const sub = stage === 'practice' ? `${subject} · 第 ${idx + 1} / ${qs.length} 題` : stage === 'summary' ? '練習結果' : stage === 'report' ? '歷史成績與弱點分析' : '選擇科目與題數';
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
                      role={q.multi ? 'checkbox' : 'radio'} aria-checked={picked} disabled={!!res || locked} onClick={() => toggle(o.k)}>
                      <b>{o.k}</b><span className="ropt-t"><Md inline>{o.t}</Md></span>
                      {right && <span aria-hidden="true">✓</span>}{wrong && <span aria-hidden="true">✗</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea rows={3} maxLength={500} value={text} disabled={!!res || locked} onChange={(e) => setText(e.target.value)} placeholder="輸入你的答案" />
            )}

            {!res && (
              <button type="button" disabled={busy || locked || (q.type === 'choice' ? !sel.length : !text.trim())} onClick={submit}>
                {busy ? 'AI 批改中...' : '送出答案'}
              </button>
            )}
          </div>

          {res && (
            <div className={`card stack ${res.correct ? 'res-ok' : 'res-bad'}`}>
              <b style={{ fontSize: 17 }}>{res.correct ? '✓ 答對了!' : '✗ 答錯了'}</b>
              <div>正確答案:<b>{res.answer}</b>{res.answer_by === 'ai' && <small className="muted"> (答案由 AI 產生,僅供參考)</small>}</div>
              {!res.correct && res.pending && <div className="muted">解析產生中…(可以先按「下一題」,解析稍後會出現在結果頁)</div>}
              {!res.correct && !res.pending && res.explanation && <div><div className="eyebrow" style={{ marginBottom: 4 }}>解析</div><Md>{res.explanation}</Md></div>}
              {res.error && <div className="alert bad">這題沒有成功記錄:{res.error}</div>}
              <button type="button" onClick={next}>{idx + 1 < qs.length ? '下一題' : '看結果'}</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- 練習結果 ---------- */
  if (stage === 'summary') {
    const right = results.filter((r) => r.correct).length;
    const pct = pctOf(right, results.length);
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
                {!r.correct && r.pending && <div className="muted">解析產生中…</div>}
                {!r.correct && !r.pending && r.explanation && <div><div className="eyebrow" style={{ marginBottom: 4 }}>解析</div><Md>{r.explanation}</Md></div>}
                {r.error && <div className="alert bad">這題沒有成功記錄:{r.error}</div>}
              </div>
            </details>
          ))}
          <div className="row">
            <button type="button" style={{ flex: 1 }} onClick={() => { setStage('setup'); setErr(''); }}>再練一組</button>
            <button type="button" className="sec" style={{ flex: 'none' }} onClick={openReport}>📊 歷史成績與弱點分析</button>
          </div>
          <button type="button" className="sec" onClick={onBack}>回首頁</button>
        </div>
      </div>
    );
  }

  /* ---------- 成績與弱點分析 ---------- */
  if (stage === 'report') {
    const weak = (s) => s.total >= 3 && pctOf(s.correct, s.total) < 60;
    const Bars = ({ rows }) => (
      <div className="stack" style={{ gap: 10 }}>
        {rows.map((s) => (
          <div key={s.name}>
            <div className="row between"><span style={{ overflowWrap: 'anywhere' }}>{s.name}{weak(s) && <span className="tag bad" style={{ marginLeft: 6 }}>弱點</span>}</span><small className="muted">{s.correct}/{s.total} · {pctOf(s.correct, s.total)}%</small></div>
            <div className="bar"><i className={weak(s) ? 'low' : ''} style={{ width: `${pctOf(s.correct, s.total)}%` }} /></div>
          </div>
        ))}
      </div>
    );
    return (
      <div className="lab">{head}
        {err && <div className="alert bad" style={{ marginBottom: 10 }}>{err}</div>}
        {!rep && !err && <div className="muted">計算中...</div>}
        {rep && !rep.overall.answers && <div className="alert">還沒有作答紀錄。去練習幾題,這裡就會出現你的成績和弱點分析。</div>}
        {rep && rep.overall.answers > 0 && (
          <div className="stack">
            <div className="card">
              <div className="row" style={{ justifyContent: 'space-around', textAlign: 'center' }}>
                <div><div className="pf-num">{pctOf(rep.overall.correct, rep.overall.answers)}%</div><small className="muted">總答對率</small></div>
                <div><div className="pf-num">{rep.overall.answers}</div><small className="muted">累計作答</small></div>
                <div><div className="pf-num">{rep.overall.sessions}</div><small className="muted">練習次數</small></div>
              </div>
            </div>

            <div className="rtabs" role="tablist">
              <button type="button" role="tab" aria-selected={repTab === 'history'} className={`rtab ${repTab === 'history' ? 'on' : ''}`} onClick={() => setRepTab('history')}>歷史成績</button>
              <button type="button" role="tab" aria-selected={repTab === 'weak'} className={`rtab ${repTab === 'weak' ? 'on' : ''}`} onClick={() => setRepTab('weak')}>弱點分析</button>
            </div>

            {repTab === 'history' && (
              <>
                {rep.sessions.map((s) => (
                  <details key={s.sid} className="card rv">
                    <summary>
                      <span className="rv-top"><b>{s.subject}</b><span className="muted">{s.time?.slice(0, 16)}</span><span className={`tag rv-tag ${pctOf(s.correct, s.total) >= 60 ? 'ok' : 'bad'}`}>{s.correct}/{s.total} · {pctOf(s.correct, s.total)}%</span></span>
                      <span className="bar" style={{ marginTop: 6 }}><i style={{ width: `${pctOf(s.correct, s.total)}%` }} /></span>
                    </summary>
                    <div className="stack rv-body" style={{ gap: 6 }}>
                      {s.source && <small className="muted">題目來源:{s.source}</small>}
                      {s.items.map((it, i) => (
                        <div key={i} className={`opt ${it.c ? 'ok' : 'bad'}`} style={{ overflowWrap: 'anywhere' }}>{it.c ? '✔' : '✘'} 第 {i + 1} 題:{it.stem}</div>
                      ))}
                    </div>
                  </details>
                ))}
                <div className="muted">顯示最近 20 次練習。</div>
              </>
            )}

            {repTab === 'weak' && (
              <>
                <div className="card stack"><h4>各科表現</h4><Bars rows={rep.bySubject} /><div className="muted">答對率低於 60% 且至少作答 3 題的,會標示為弱點。</div></div>
                {rep.bySource.length > 1 && <div className="card stack"><h4>各題目來源</h4><Bars rows={rep.bySource.slice(0, 8)} /></div>}

                <div className="card stack">
                  <h4>常答錯的題目</h4>
                  {!rep.missed.length && <div className="muted">目前沒有答錯的題目,太棒了!</div>}
                  {rep.missed.map((m) => (
                    <details key={m.id} className="opt bad">
                      <summary style={{ cursor: 'pointer' }}><b>答錯 {m.wrong} 次</b> <small className="muted">· {m.subject} · {m.source}</small></summary>
                      <div style={{ marginTop: 6, overflowWrap: 'anywhere' }}>{m.stem}</div>
                    </details>
                  ))}
                </div>

            <div className="card stack">
              <h4>AI 弱點分析</h4>
              {rep.analysis ? (
                <>
                  <Md>{rep.analysis.text}</Md>
                  <small className="muted">產生於 {rep.analysis.time}(1 小時內不會重複產生)</small>
                </>
              ) : <div className="muted">根據你答錯的題目,AI 會歸納需要加強的觀念並給複習建議。</div>}
              <button type="button" className={rep.analysis ? 'sec' : ''} disabled={analyzing || !rep.missed.length} onClick={analyze}>
                {analyzing ? 'AI 分析中...' : rep.analysis ? '重新分析' : '產生 AI 弱點分析'}
              </button>
            </div>
              </>
            )}
          </div>
        )}
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
        <button type="button" className="sec" onClick={openReport}>📊 查看歷史成績與弱點分析</button>

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
