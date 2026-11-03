'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

// 從左邊滑出的選單
export default function SideMenu({ open, onClose, user, items }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="drawer-ov" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="選單" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="row" style={{ gap: 10, minWidth: 0 }}>
            <div className="avatar sm">{user.username[0]}</div>
            <div style={{ minWidth: 0 }}>
              <b style={{ overflowWrap: 'anywhere' }}>{user.username}</b>
              <div className="muted">{user.class_name}</div>
            </div>
          </div>
          <button type="button" className="sec small" onClick={onClose} aria-label="關閉選單">✕</button>
        </div>
        <div className="drawer-list">
          {items.map((it) => (
            <button key={it.key} type="button" className="drawer-item" disabled={it.disabled} onClick={() => { onClose(); it.onClick(); }}>
              <span className="drawer-ico" aria-hidden="true">{it.icon}</span>
              <span className="drawer-txt"><b>{it.label}</b><small className="muted">{it.desc}</small></span>
              {it.badge && <span className="new" style={{ background: 'rgba(255,255,255,.18)' }}>{it.badge}</span>}
            </button>
          ))}
        </div>
        <div className="drawer-foot muted">A.lab | 解題實驗室</div>
      </aside>
    </div>,
    document.body,
  );
}
