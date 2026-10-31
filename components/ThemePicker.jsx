'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { THEMES, CATEGORIES, getTheme } from '@/lib/themes';

const IBack = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
);

// 依類別分區、兩欄的主題卡片(右上角的主題頁與「我 → 主題配色」共用)
export function ThemeSections({ theme, onChange }) {
  return (
    <div className="th-sections">
      {CATEGORIES.map((c) => (
        <section key={c}>
          <div className="th-cat">{c}</div>
          <div className="th-grid">
            {THEMES.filter((t) => t.cat === c).map((t) => (
              <button key={t.id} type="button" className={`th-card ${t.id === theme ? 'on' : ''}`} aria-pressed={t.id === theme} onClick={() => onChange(t.id)}>
                <span className="th-sw" style={{ background: t.swatch }} />
                <span className="th-name">{t.name}</span>
                {t.id === theme && <span className="th-check" aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function ThemePicker({ theme, onChange, disabled }) {
  const cur = getTheme(theme);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <button type="button" className="swatch-btn" disabled={disabled} aria-label="主題配色" aria-expanded={open}
        style={{ background: cur.swatch }} onClick={() => setOpen(true)} />

      {open && createPortal(
        <div className="th-page" role="dialog" aria-modal="true" aria-label="主題配色">
          <div className="th-head">
            <div className="th-head-in">
              <button type="button" className="th-back" onClick={() => setOpen(false)} aria-label="返回"><IBack /></button>
              <h2>主題配色</h2>
            </div>
          </div>
          <div className="th-inner"><ThemeSections theme={theme} onChange={onChange} /></div>
        </div>,
        document.body,
      )}
    </>
  );
}
