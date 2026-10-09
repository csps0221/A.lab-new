'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import Login from '@/components/Login';
import Home from '@/components/Home';
import Analysis from '@/components/Analysis';
import History from '@/components/History';
import Admin from '@/components/Admin';

const THEMES = {
  midnight_red: '深夜赤焰', quiet_blue: '靜謐深藍', forest_light: '森語晨光', aurora_blue: '極光藍境',
  dark_gold: '墨夜流金', graphite_gray: '玄霧石墨',
};

export default function Page() {
  const [me, setMe] = useState(undefined); // undefined=載入中, null=未登入
  const [subjects, setSubjects] = useState([]);
  const [tab, setTab] = useState('home');
  const [latest, setLatest] = useState(null);
  const [solving, setSolving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState('midnight_red');

  useEffect(() => {
    const t = localStorage.getItem('alab_theme');
    if (t && THEMES[t]) { setTheme(t); document.documentElement.dataset.theme = t; }
  }, []);

  function changeTheme(t) {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    localStorage.setItem('alab_theme', t);
  }

  async function refresh() {
    try {
      const d = await api('/api/me');
      setMe(d.user); setSubjects(d.subjects);
    } catch { setMe(null); }
  }
  useEffect(() => { refresh(); }, []);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setMe(null); setLatest(null); setTab('home');
  }

  async function handleSolve(payload) {
    setError(''); setLatest(null); setNotice(''); setSolving(true); setTab('analysis');
    try {
      setLatest(await api('/api/solve', { method: 'POST', body: payload }));
    } catch (e) { setError(e.message); }
    finally { setSolving(false); refresh(); }
  }

  if (me === undefined) return <div className="wrap muted">載入中...</div>;
  if (me === null) return <Login onDone={() => { refresh(); setTab('home'); }} />;

  const isAdmin = me.role === 'admin';
  const remains = isAdmin ? '無限' : Math.max(0, me.limit - me.used_today);
  const go = (t) => { setNotice(''); setTab(t); };

  const limit = me.limit || 15;
  const pct = isAdmin ? 100 : Math.max(0, Math.min(100, (remains / limit) * 100));
  const quotaLabel = isAdmin ? '管理員' : remains <= 0 ? '額度已用完' : remains / limit > 0.3 ? '題數充足' : '題數偏少';
  const navTo = (t) => {
    if (t === 'analysis' && !latest && !error && !solving) { setNotice('請先在首頁輸入或上傳題目並點擊「開始解題」!'); return; }
    go(t);
  };
  const NAV = [['home', '🏠', '首頁'], ['analysis', '📝', '解析'], ['history', '🕘', '紀錄'], ...(isAdmin ? [['admin', '⚙️', '後台']] : [])];

  return (
    <div className="wrap with-nav">
      <header className="hdr">
        <div className="logo">🧪</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title">A.lab | 解題實驗室</div>
          <div className="sub">Science Lab</div>
        </div>
        <select className="theme-sel" value={theme} disabled={solving} onChange={(e) => changeTheme(e.target.value)} aria-label="外觀主題">
          {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="sec small" disabled={solving} onClick={logout}>登出</button>
      </header>

      <div className="card userbar">
        <div className="row">
          <div className="avatar">{me.username[0]}</div>
          <div><b style={{ fontSize: 18 }}>{me.username}</b><div className="muted">{me.class_name}</div></div>
        </div>
        <div className="quota">
          <div className="row between"><small><b>{quotaLabel}</b></small><small className="muted">每日額度 {isAdmin ? '無限' : limit} 題</small></div>
          <div className="row between" style={{ alignItems: 'baseline' }}><small>今日還能解</small><span><b className="big">{remains}</b> 題</span></div>
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        </div>
      </div>

      {notice && <div className="alert bad" style={{ marginTop: 10 }}>{notice}</div>}

      {/* Home 常駐掛載,切換分頁時不會遺失已輸入的題目 */}
      <div hidden={tab !== 'home'} style={{ marginTop: 12 }}>
        <Home subjects={subjects} remains={remains} locked={solving} onSolve={handleSolve} />
      </div>
      <div style={{ marginTop: 12 }}>
        {tab === 'analysis' && <Analysis loading={solving} error={error} record={latest} onHome={() => go('home')} username={me.username} onUpdate={setLatest} />}
        {tab === 'history' && <History onOpen={(r) => { setError(''); setLatest(r); go('analysis'); }} />}
        {tab === 'admin' && isAdmin && <Admin />}
      </div>

      <footer className="foot">
        <b>SCIENCE LAB</b>
        <div>A.lab | 解題實驗室 v2.2.0</div>
      </footer>

      <nav className="bottomnav" aria-label="主要導覽">
        <div className="navin">
          {NAV.map(([k, icon, label]) => (
            <button key={k} className={`navbtn ${tab === k ? 'on' : ''}`} disabled={solving} onClick={() => navTo(k)}>
              <span aria-hidden="true" style={{ fontSize: 20 }}>{icon}</span>{label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
