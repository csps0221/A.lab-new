'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import Login from '@/components/Login';
import Home from '@/components/Home';
import Analysis from '@/components/Analysis';
import History from '@/components/History';
import Admin from '@/components/Admin';

const THEMES = {
  quiet_blue: '靜謐深藍', forest_light: '森語晨光', aurora_blue: '極光藍境',
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
  const [theme, setTheme] = useState('graphite_gray');

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

  return (
    <div className="wrap">
      <div className="row">
        <div className="hdr" style={{ flex: 3, marginBottom: 0 }}>
          <span style={{ fontSize: 24 }}>🧪</span>
          <div><div className="title">A.lab | 解題實驗室</div><div className="muted">Science Lab Platform</div></div>
        </div>
        <select style={{ flex: 1 }} value={theme} disabled={solving} onChange={(e) => changeTheme(e.target.value)} aria-label="外觀主題">
          {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="row" style={{ margin: '12px 0' }}>
        <div className="card userbar" style={{ flex: 4, marginBottom: 0 }}>
          <div className="row">
            <div className="avatar">{me.username[0]}</div>
            <div><b>{me.username}</b><div className="muted">{me.class_name}</div></div>
          </div>
          <div className="badge"><small className="muted">題數狀態</small><div>今日剩餘 <b style={{ fontSize: 18 }}>{remains}</b> 題</div></div>
        </div>
        <button className="sec" style={{ flex: 1 }} disabled={solving} onClick={logout}>登出</button>
      </div>

      <div className="tabs">
        <button className={tab === 'home' ? '' : 'sec'} disabled={solving} onClick={() => go('home')}>首頁</button>
        <button className={tab === 'analysis' ? '' : 'sec'} disabled={solving} onClick={() => {
          if (!latest && !error) setNotice('請先在首頁輸入或上傳題目並點擊「開始解題」!'); else go('analysis');
        }}>解題解析</button>
        <button className={tab === 'history' ? '' : 'sec'} disabled={solving} onClick={() => go('history')}>解題紀錄</button>
        {isAdmin && <button className={tab === 'admin' ? '' : 'sec'} disabled={solving} onClick={() => go('admin')}>後台</button>}
      </div>
      {notice && <div className="alert bad" style={{ marginTop: 10 }}>{notice}</div>}
      <hr />

      {/* Home 常駐掛載,切換分頁時不會遺失已輸入的題目 */}
      <div hidden={tab !== 'home'}>
        <Home subjects={subjects} remains={remains} locked={solving} onSolve={handleSolve} />
      </div>
      {tab === 'analysis' && <Analysis loading={solving} error={error} record={latest} onHome={() => go('home')} />}
      {tab === 'history' && <History onOpen={(r) => { setError(''); setLatest(r); go('analysis'); }} />}
      {tab === 'admin' && isAdmin && <Admin />}
    </div>
  );
}
