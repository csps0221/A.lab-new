'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/client';
import Login from '@/components/Login';
import Home from '@/components/Home';
const Analysis = dynamic(() => import('@/components/Analysis'), { ssr: false, loading: () => <div className="muted">載入中...</div> });
const History = dynamic(() => import('@/components/History'), { ssr: false, loading: () => <div className="muted">載入中...</div> });
const Admin = dynamic(() => import('@/components/Admin'), { ssr: false, loading: () => <div className="muted">載入中...</div> });
const LabAI = dynamic(() => import('@/components/LabAI'), { ssr: false, loading: () => <div className="muted">載入中...</div> });
const Me = dynamic(() => import('@/components/Me'), { ssr: false, loading: () => <div className="muted">載入中...</div> });
import ThemePicker from '@/components/ThemePicker';
import AnnouncementModal from '@/components/AnnouncementModal';
import { THEMES, DEFAULT_THEME, applyTheme } from '@/lib/themes';

const Icon = ({ k }) => {
  const p = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (k === 'home') return <svg {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></svg>;
  if (k === 'analysis') return <svg {...p}><rect x="5" y="3.5" width="14" height="17" rx="3" /><path d="m9 12.5 2 2 4-4.5" /><path d="M9 7.5h6" /></svg>;
  if (k === 'history') return <svg {...p}><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3.5 4.5v4h4" /><path d="M12 7.5V12l3 2" /></svg>;
  if (k === 'lab') return <svg {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h8A2.5 2.5 0 0 1 17 5.5v5a2.5 2.5 0 0 1-2.5 2.5H9l-3.5 3v-3A2.5 2.5 0 0 1 4 10.5Z" /><path d="M20 8.5v6a2.5 2.5 0 0 1-2.5 2.5H17v3l-3-3h-2.5" /><path d="M8 7.5h5.5M8 10h3" /></svg>;
  if (k === 'me') return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" /></svg>;
  return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>;
};

export default function Page() {
  const [me, setMe] = useState(undefined); // undefined=載入中, null=未登入
  const [subjects, setSubjects] = useState([]);
  const [tab, setTab] = useState('home');
  const [latest, setLatest] = useState(null);
  const [solving, setSolving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [prefs, setPrefsState] = useState({ font: 'small', depth: '標準詳解' });
  const [anns, setAnns] = useState([]);
  const [seenAnn, setSeenAnn] = useState('');
  const [installEvt, setInstallEvt] = useState(null);

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem('alab_prefs') || 'null');
      if (p) setPrefsState((s) => ({ ...s, ...p }));
      setSeenAnn(localStorage.getItem('alab_ann_seen') || '');
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty('--read', { small: '14px', medium: '16px', large: '18px' }[prefs.font] || '14px');
  }, [prefs.font]);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  function setPrefs(p) {
    const n = { ...prefs, ...p };
    setPrefsState(n);
    try { localStorage.setItem('alab_prefs', JSON.stringify(n)); } catch {}
  }
  async function loadAnns() {
    try { setAnns((await api('/api/announcements')).announcements); } catch {}
  }
  const latestAnnId = anns.reduce((m, a) => (a.id > m ? a.id : m), '');
  const unread = !!latestAnnId && latestAnnId > seenAnn;
  function markSeen() {
    if (!latestAnnId) return;
    setSeenAnn(latestAnnId);
    try { localStorage.setItem('alab_ann_seen', latestAnnId); } catch {}
  }
  const favIds = me?.favorites || [];
  async function toggleFav() {
    if (!latest) return;
    try {
      await api('/api/favorite', { method: 'POST', body: { id: latest.id, on: !favIds.includes(latest.id) } });
      await refresh();
    } catch (e) { setNotice(e.message); }
  }

  useEffect(() => {
    const t = localStorage.getItem('alab_theme');
    if (t && THEMES.some((x) => x.id === t)) { setTheme(t); applyTheme(t); }
  }, []);

  function changeTheme(t) {
    setTheme(t);
    applyTheme(t);
    localStorage.setItem('alab_theme', t);
  }

  async function refresh(quiet = false) {
    try {
      const d = await api('/api/me');
      setMe(d.user); setSubjects(d.subjects); setAnns(d.announcements || []);
    } catch { if (!quiet) setMe(null); }
  }
  useEffect(() => { refresh(); }, []);

  // 進站後在背景預先載入其他頁面,切換時不用再等;並定期檢查有沒有新公告
  const uname = me?.username;
  useEffect(() => {
    if (!uname) return;
    const pre = setTimeout(() => { import('@/components/Analysis'); import('@/components/History'); import('@/components/Me'); import('@/components/LabAI'); }, 1500);
    const tick = () => { if (document.visibilityState === 'visible') refresh(true); };
    const iv = setInterval(tick, 180000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearTimeout(pre); clearInterval(iv); document.removeEventListener('visibilitychange', tick); };
  }, [uname]); // eslint-disable-line react-hooks/exhaustive-deps

  // 公告:沒按過「了解」,或按了超過 3 天,就彈出
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
  const ackMap = me?.ann_ack || {};
  const pendingAnns = anns.filter((a) => !(ackMap[a.id] && Date.now() - ackMap[a.id] < THREE_DAYS));
  async function ackAnns() {
    const ids = pendingAnns.map((a) => a.id);
    const now = Date.now();
    setMe((m) => ({ ...m, ann_ack: { ...(m.ann_ack || {}), ...Object.fromEntries(ids.map((id) => [id, now])) } }));
    markSeen();
    try { await api('/api/announcements', { method: 'POST', body: { ids } }); } catch {}
  }

  async function openRecord(l) {
    setError('');
    let rec = l;
    try { rec = (await api(`/api/history/${l.id}?full=1`)).record; } catch {}
    setLatest(rec);
    go('analysis');
  }

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
  const NAV = [['home', 'home', '首頁'], ['analysis', 'analysis', '解析'], ['history', 'history', '紀錄'], ['lab', 'lab', 'LAB AI'], ['me', 'me', '我']]; // 管理員的「後台」放在「我」頁面裡

  return (
    <div className="wrap with-nav">
      <header className="hdr">
        <div className="logo">🧪</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title">A.lab | 解題實驗室</div>
          <div className="sub">Science Lab</div>
        </div>
        <ThemePicker theme={theme} onChange={changeTheme} disabled={solving} />
        <button className="sec small" disabled={solving} onClick={logout}>登出</button>
      </header>

      {!['me', 'lab'].includes(tab) && (
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
      )}

      {notice && <div className="alert bad" style={{ marginTop: 10 }}>{notice}</div>}

      {/* Home 常駐掛載,切換分頁時不會遺失已輸入的題目 */}
      <div hidden={tab !== 'home'} style={{ marginTop: 12 }}>
        <Home subjects={subjects} remains={remains} locked={solving} onSolve={handleSolve} defaultDepth={prefs.depth} />
      </div>
      <div style={{ marginTop: 12 }}>
        {tab === 'analysis' && <Analysis loading={solving} error={error} record={latest} onHome={() => go('home')} username={me.username} onUpdate={setLatest}
          isFav={!!latest && favIds.includes(latest.id)} onFav={latest && latest.user === me.username ? toggleFav : null} />}
        {tab === 'history' && <History onOpen={openRecord} />}
        {tab === 'me' && (
          <Me me={me} remains={remains} pct={pct} theme={theme} onTheme={changeTheme} prefs={prefs} setPrefs={setPrefs}
            anns={anns} unread={unread} markSeen={markSeen} favIds={favIds} onGo={go}
            onOpenRecord={openRecord}
            canInstall={!!installEvt}
            onInstall={async () => { installEvt.prompt(); await installEvt.userChoice; setInstallEvt(null); }}
            onLogout={logout} />
        )}
        {tab === 'lab' && <LabAI me={me} subjects={subjects} onBack={() => go('home')} onUsed={() => refresh(true)} />}
        {tab === 'admin' && isAdmin && <Admin />}
      </div>

      {!solving && <AnnouncementModal items={pendingAnns} onAck={ackAnns} />}

      <footer className="foot">
        <b>SCIENCE LAB</b>
        <div>A.lab | 解題實驗室 v2.2.0</div>
      </footer>

      <nav className="bottomnav" aria-label="主要導覽">
        <div className="navin">
          {NAV.map(([k, icon, label]) => (
            <button key={k} className={`navbtn ${tab === k || (k === 'me' && tab === 'admin') ? 'on' : ''}`} disabled={solving} onClick={() => navTo(k)}>
              <Icon k={icon} />{label}
              {k === 'me' && unread && <i className="navdot" aria-label="有新公告" />}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
