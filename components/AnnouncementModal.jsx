'use client';

// 進站時彈出的公告;按「了解」後 3 天內不會再出現
export default function AnnouncementModal({ items, onAck }) {
  if (!items.length) return null;
  return (
    <div className="modal-ov">
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="ann-h">
        <div className="eyebrow">ANNOUNCEMENT</div>
        <h3 id="ann-h">實驗室公告</h3>
        <div className="modal-body stack">
          {items.map((a) => (
            <div key={a.id} className="inner">
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <b style={{ overflowWrap: 'anywhere' }}>{a.title}</b>
                {a.pinned && <span className="tag ok" style={{ flex: 'none' }}>置頂</span>}
              </div>
              <small className="muted">{a.time}{a.ends ? ` · 顯示到 ${a.ends}` : ''}</small>
              <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.7, marginTop: 6 }}>{a.body}</div>
            </div>
          ))}
        </div>
        <button autoFocus onClick={onAck}>了解</button>
        <div className="muted center">按「了解」後,這些公告 3 天內不會再彈出</div>
      </div>
    </div>
  );
}
