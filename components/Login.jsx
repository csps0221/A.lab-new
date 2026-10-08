'use client';
import { useState } from 'react';
import { api } from '@/lib/client';

export default function Login({ onDone }) {
  const [mode, setMode] = useState('login');
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function login(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: { username: u, password: p } });
      if (r.mustChange) setMode('change'); else onDone();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }

  async function change(e) {
    e.preventDefault();
    setErr('');
    if (!n1) return setErr('新密碼不可為空白!');
    if (n1 !== n2) return setErr('兩次輸入的密碼不一致,請重新確認!');
    setBusy(true);
    try {
      await api('/api/auth/change-password', { method: 'POST', body: { username: u, oldPassword: p, newPassword: n1 } });
      onDone();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }

  return (
    <div className="wrap">
      <div className="hdr" style={{ justifyContent: 'center', textAlign: 'center', marginTop: 20 }}>
        <div>
          <div style={{ fontSize: 36 }}>🧪</div>
          <div className="title" style={{ fontSize: 22 }}>A.lab | 解題實驗室</div>
          <div className="muted">Science Lab Solution Platform</div>
        </div>
      </div>
      <div className="card">
        {mode === 'login' ? (
          <form onSubmit={login} className="stack">
            <h3>使用者登入</h3>
            <label>帳號<input value={u} onChange={(e) => setU(e.target.value)} placeholder="請輸入帳號" autoComplete="username" /></label>
            <label>密碼<input type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="請輸入密碼" autoComplete="current-password" /></label>
            {err && <div className="alert bad">{err}</div>}
            <button disabled={busy}>{busy ? '登入中...' : '登入系統'}</button>
          </form>
        ) : (
          <form onSubmit={change} className="stack">
            <h3>初次登入:請修改密碼</h3>
            <div className="alert">為了您的帳號安全,第一次登入請設定新密碼。</div>
            <label>新密碼<input type="password" value={n1} onChange={(e) => setN1(e.target.value)} autoComplete="new-password" /></label>
            <label>確認新密碼<input type="password" value={n2} onChange={(e) => setN2(e.target.value)} autoComplete="new-password" /></label>
            {err && <div className="alert bad">{err}</div>}
            <button disabled={busy}>{busy ? '處理中...' : '確認修改並登入'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
