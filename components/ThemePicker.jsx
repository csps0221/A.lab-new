'use client';
import { useEffect, useState } from 'react';
import { THEMES, CATEGORIES, getTheme } from '@/lib/themes';

export default function ThemePicker({ theme, onChange, disabled }) {
  const cur = getTheme(theme);
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(cur.cat);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="swatch-btn" disabled={disabled} aria-label="外觀主題" aria-expanded={open}
        style={{ background: cur.swatch }} onClick={() => { setCat(cur.cat); setOpen((o) => !o); }}>
        <span className="swatch-dot" style={{ background: cur.vars['--btn'] }} />
      </button>

      {open && (
        <>
          <div className="tp-overlay" onClick={() => setOpen(false)} />
          <div className="tp-panel card" role="dialog" aria-label="外觀主題">
            <div className="tp-title">外觀主題 · 找到你的風格</div>
            <div className="tp-tabs" role="tablist">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" role="tab" aria-selected={cat === c} className={`tp-tab ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
            <div className="tp-grid">
              {THEMES.filter((t) => t.cat === cat).map((t) => (
                <button key={t.id} type="button" className={`tp-item ${t.id === theme ? 'on' : ''}`} onClick={() => onChange(t.id)}>
                  <span className="tp-sw" style={{ background: t.swatch, borderColor: t.vars['--border'] }} />
                  <span>{t.name}</span>
                  {t.id === theme && <span className="tp-check" aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
