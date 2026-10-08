'use client';
import { useEffect, useState } from 'react';
import Md from './Md';

const STEPS = [
  [15, '正在啟動 AI 解題引擎...'],
  [35, '正在辨識題目內容與選項...'],
  [60, '正在進行觀念推導...'],
  [85, '正在生成選項分析與步驟說明...'],
  [100, '正在整理最終答題報告...'],
];

export default function Analysis({ loading, error, record, onHome }) {
  const [p, setP] = useState(5);
  useEffect(() => {
    if (!loading) return;
    setP(5);
    const t = setInterval(() => setP((x) => Math.min(95, x + (x < 60 ? 5 : x < 85 ? 2 : 0.4))), 700);
    return () => clearInterval(t);
  }, [loading]);

  if (loading) {
    const msg = STEPS.find(([v]) => p <= v)?.[1] || STEPS[4][1];
    return (
      <div className="card center" style={{ padding: '30px 20px' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>已送出題目,分析題目中</div>
        <div className="muted" style={{ margin: '10px 0 16px' }}>{msg}</div>
        <progress max="100" value={p} style={{ width: '100%' }} />
        <div className="muted">解題進度 {Math.round(p)}%</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="stack">
        <div className="alert bad"><b>解題失敗</b><br />{error}</div>
        <button onClick={onHome}>回到首頁重試</button>
      </div>
    );
  }
  if (!record) return <div className="alert">目前尚無最新的解題結果,請至「首頁」輸入或上傳題目。</div>;

  const fb = record.admin_feedback || {};
  return (
    <div className="stack">
      <h3>解題解析</h3>
      <div className="card">
        <div className="row between">
          <b className="hl">[{record.subject}] 觀念拆解與解答 <small>({record.depth_mode})</small></b>
          {fb.status === 'correct' && <span className="tag ok">管理員審核:正確</span>}
          {fb.status === 'incorrect' && <span className="tag bad">管理員審核:需再加強</span>}
        </div>
        <div className="muted" style={{ margin: '6px 0' }}>
          標準參考答案:<b>{record.ref_answer}</b> | AI 答案:<b className="hl">{record.ans}</b>
        </div>
        <b>觀念推導過程:</b>
        <Md>{record.reasoning}</Md>
      </div>

      {record.options_analysis?.length > 0 && (
        <>
          <h4>選項解析</h4>
          {record.options_analysis.map((o, i) => (
            <div key={i} className={`opt ${o.is_correct ? 'ok' : 'bad'}`}>
              <b>{o.is_correct ? '✔' : '✘'} {o.text || o.option}</b>
              <Md>{o.explanation}</Md>
            </div>
          ))}
        </>
      )}

      {fb.comment && (
        <div className="card" style={{ borderColor: '#F59E0B' }}>
          <b style={{ color: '#F59E0B' }}>管理員點評與觀念加強:</b>
          <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{fb.comment}</div>
        </div>
      )}
      <button onClick={onHome}>回到解題主頁</button>
    </div>
  );
}
