'use client';
import { useState } from 'react';
import Cropper from './Cropper';
import { api } from '@/lib/client';

const DEPTHS = [
  ['精簡解答', '直接給答案與關鍵重點,快速核對。'],
  ['標準詳解', '用少量步驟說清楚主要解法。'],
  ['深度解析', '完整推導,並補充易錯點與延伸觀念。'],
];
const DOT_COLORS = ['#34D399', '#60A5FA', '#F5B93B', '#F87171', '#A78BFA', '#2DD4BF', '#FB923C', '#F472B6'];

export default function Home({ subjects, remains, locked, onSolve }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [crops, setCrops] = useState({});
  const [editing, setEditing] = useState({});
  const [depth, setDepth] = useState('標準詳解');
  const [subject, setSubject] = useState('');
  const [ref, setRef] = useState('');
  const [warn, setWarn] = useState('');
  const [bug, setBug] = useState('');
  const [bugMsg, setBugMsg] = useState('');

  function addFiles(e) {
    const list = [...e.target.files].slice(0, 5 - files.length).map((f) => ({
      id: Math.random().toString(36).slice(2), url: URL.createObjectURL(f),
    }));
    setFiles((p) => [...p, ...list]);
    e.target.value = '';
  }
  function removeFile(id) {
    setFiles((p) => p.filter((f) => f.id !== id));
    setCrops((p) => { const n = { ...p }; delete n[id]; return n; });
  }
  function clearAll() { setText(''); setFiles([]); setCrops({}); setEditing({}); setRef(''); setWarn(''); }

  function submit() {
    setWarn('');
    if (!subjects.length) return setWarn('管理員尚未開放任何科目給你,請聯絡管理員。');
    if (remains !== '無限' && remains <= 0) return setWarn('今日解題額度已用完,請明日再試!');
    const images = files.map((f) => crops[f.id]).filter(Boolean);
    if (!text.trim() && !images.length) return setWarn('請上傳題目圖片,或在「補充敘述」輸入題目文字!');
    onSolve({ text, images, subject: subject || subjects[0], depth, refAnswer: ref });
  }

  async function sendBug() {
    try {
      await api('/api/bugs', { method: 'POST', body: { message: bug } });
      setBug(''); setBugMsg('已送出,感謝你的回報!');
    } catch (e) { setBugMsg(e.message); }
  }

  const full = files.length >= 5;
  return (
    <div className="stack">
      {/* 1 上傳題目圖片 */}
      <div className="card stack">
        <div className="row between">
          <div className="stephead" style={{ margin: 0 }}><span className="step">1</span>上傳題目圖片</div>
          {files.length > 0 && !full && (
            <label className="pillbtn">＋ 繼續加入圖片
              <input type="file" accept="image/png,image/jpeg" multiple hidden disabled={locked} onChange={addFiles} />
            </label>
          )}
        </div>

        {files.length === 0 && (
          <label className="drop">
            <input type="file" accept="image/png,image/jpeg" multiple hidden disabled={locked} onChange={addFiles} />
            <span className="plus">＋</span>
            <b>選擇題目圖片</b>
            <small className="muted">可上傳 1~5 張,題目與解答皆可上傳</small>
          </label>
        )}

        {files.map((f, i) => (
          <div key={f.id} className="imgitem">
            <div className="row">
              <img className="thumb" src={f.url} alt="" />
              <div style={{ flex: 1 }}>
                <b>圖片 {i + 1}</b>
                <div className="muted">{i === 0 ? '主要題目圖片' : '補充圖片'}</div>
              </div>
              <button type="button" className="sec small" disabled={locked} onClick={() => setEditing((p) => ({ ...p, [f.id]: !p[f.id] }))}>
                {editing[f.id] ? '完成' : '編輯'}
              </button>
              <button type="button" className="danger small" disabled={locked} onClick={() => removeFile(f.id)}>刪除</button>
            </div>
            {/* 常駐掛載(僅隱藏),確保裁切結果一定會被取得 */}
            <div hidden={!editing[f.id]} style={{ marginTop: 10 }}>
              <div className="muted" style={{ marginBottom: 6 }}>拖曳選取要解的範圍</div>
              <Cropper src={f.url} onChange={(b64) => setCrops((p) => ({ ...p, [f.id]: b64 }))} />
            </div>
          </div>
        ))}
      </div>

      {/* 2 設定題目資訊 */}
      <div className="card stack">
        <div className="stephead" style={{ margin: 0 }}><span className="step">2</span>設定題目資訊</div>

        <div className="field-label">科目</div>
        {subjects.length === 0 && <div className="alert bad">管理員尚未開放任何科目給你,請聯絡管理員。</div>}
        <div className="chips">
          {subjects.map((sub, i) => (
            <button key={sub} type="button" className={`chip ${(subject || subjects[0]) === sub ? 'on' : ''}`}
              style={{ '--c': DOT_COLORS[i % DOT_COLORS.length] }} disabled={locked} onClick={() => setSubject(sub)}>
              <span className="dot" />{sub}
            </button>
          ))}
        </div>

        <label><span className="field-label">標準參考答案 <small className="opt-tag">選填</small></span>
          <input value={ref} disabled={locked} onChange={(e) => setRef(e.target.value)} placeholder="例如 B、ACD、2.5 mol..." />
        </label>

        <label><span className="field-label">補充敘述 <small className="opt-tag">選填</small></span>
          <textarea rows={3} value={text} disabled={locked} onChange={(e) => setText(e.target.value)}
            placeholder="有需要再補充,例如:想特別問 C 選項(沒有圖片時,也可直接在這裡輸入題目)" />
        </label>

        <div className="field-label">解說深度</div>
        <div className="depths">
          {DEPTHS.map(([k]) => (
            <button key={k} type="button" className={`depth ${depth === k ? 'on' : ''}`} disabled={locked} onClick={() => setDepth(k)}>
              {depth === k && <span aria-hidden="true">✓ </span>}{k}
            </button>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 14 }}>{DEPTHS.find(([k]) => k === depth)[1]}</div>

        {warn && <div className="alert bad">{warn}</div>}
        <div className="row">
          <button className="bigbtn" style={{ flex: 3 }} disabled={locked} onClick={submit}>開始解題</button>
          <button className="sec" style={{ flex: 1.2 }} disabled={locked} onClick={clearAll}>清除目前題目</button>
        </div>
      </div>

      <details className="card">
        <summary>回報問題或建議</summary>
        <div className="stack" style={{ marginTop: 10 }}>
          <textarea rows={3} value={bug} onChange={(e) => setBug(e.target.value)} placeholder="請描述你遇到的問題或想要的功能" />
          <button className="sec" onClick={sendBug} disabled={!bug.trim()}>送出回報</button>
          {bugMsg && <div className="muted">{bugMsg}</div>}
        </div>
      </details>
    </div>
  );
}
