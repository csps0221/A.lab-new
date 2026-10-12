'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { ThemeChooser } from './ThemePicker';
import { getTheme } from '@/lib/themes';

const FONTS = [['small', '小'], ['medium', '中'], ['large', '大']];
const DEPTHS = ['精簡解答', '標準詳解', '深度解析'];

const Section = ({ title, children }) => (
  <>
    <div className="sect">{title}</div>
    <div className="card menu">{children}</div>
  </>
);

// 會跳頁的列(解題紀錄、公告)
const Row = ({ label, value, badge, onClick }) => (
  <button type="button" className="mrow" onClick={onClick}>
    <span>{label}</span>
    <span className="mrow-r">
      {badge && <span className="new">{badge}</span>}
      {value && <span>{value}</span>}
      <span aria-hidden="true">›</span>
    </span>
  </button>
);

// 下拉式選單:點一下在原地展開,再點收合
const Acc = ({ label, value, open, onToggle, children }) => (
  <div className={`acc${open ? ' open' : ''}`}>
    <button type="button" className="mrow" aria-expanded={open} onClick={onToggle}>
      <span>{label}</span>
      <span className="mrow-r">
        {value && <span>{value}</span>}
        <span className="chev" aria-hidden="true">›</span>
      </span>
    </button>
    {open && <div className="acc-body">{children}</div>}
  </div>
);

const Seg = ({ options, value, onChange }) => (
  <div className="seg" role="radiogroup">
    {options.map(([k, label]) => (
      <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{label}</button>
    ))}
  </div>
);

export default function Me({ me, remains, pct, theme, onTheme, prefs, setPrefs, anns, unread, markSeen, favIds, onOpenRecord, onGo, canInstall, onInstall, onLogout }) {
  const [view, setView] = useState('root');
  const [open, setOpen] = useState(null);
  const isAdmin = me.role === 'admin';
  const toggle = (k) => setOpen((o) => (o === k ? null : k));
  const fontLabel = FONTS.find(([k]) => k === prefs.font)?.[1] || '小';

  // 公告是唯一有獨立頁面的項目
  if (view === 'ann') {
    return (
      <div className="stack">
        <div className="row">
          <button type="button" className="sec small" onClick={() => setView('root')}>← 返回</button>
          <h3 className="me-title">實驗室公告</h3>
        </div>
        <Announcements anns={anns} />
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card profile">
        <div className="row" style={{ gap: 12 }}>
          <div className="pf-avatar">{me.username[0]}</div>
          <div style={{ minWidth: 0 }}>
            <div className="pf-name">{me.username}</div>
            <div className="muted">{me.class_name}</div>
          </div>
        </div>
        <div className="pf-divider" />
        <div className="row between" style={{ alignItems: 'baseline' }}>
          <span className="muted">今日剩餘題數</span>
          <span><b className="pf-num">{remains}</b> <small className="muted">{isAdmin ? '題' : `/ ${me.limit} 題`}</small></span>
        </div>
        <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${pct}%` }} /></div>
      </div>

      <Section title="我的學習">
        <Row label="我的解題紀錄" onClick={() => onGo('history')} />
        <Acc label="收藏題目" value={favIds.length ? `${favIds.length} 題` : ''} open={open === 'favorites'} onToggle={() => toggle('favorites')}>
          <Favorites favIds={favIds} onOpen={onOpenRecord} />
        </Acc>
      </Section>

      <Section title="個人化設定">
        <Acc label="主題配色" value={getTheme(theme).name} open={open === 'theme'} onToggle={() => toggle('theme')}>
          <ThemeChooser theme={theme} onChange={onTheme} />
        </Acc>
        <Acc label="閱讀字體大小" value={fontLabel} open={open === 'font'} onToggle={() => toggle('font')}>
          <div className="acc-hint">套用至題目解析與歷史紀錄</div>
          <Seg options={FONTS} value={prefs.font} onChange={(k) => setPrefs({ font: k })} />
          <div className="md acc-preview"><p>預覽:氧化劑會得到電子,自己被還原。</p></div>
        </Acc>
        <Acc label="預設解析深度" value={prefs.depth} open={open === 'depth'} onToggle={() => toggle('depth')}>
          <div className="acc-hint">首頁的「解說深度」會預設選這一個,每次解題仍可自己改。</div>
          <Seg options={DEPTHS.map((k) => [k, k])} value={prefs.depth} onChange={(k) => setPrefs({ depth: k })} />
        </Acc>
      </Section>

      <Section title="服務與帳號">
        <Row label="實驗室公告" badge={unread ? 'NEW' : ''} onClick={() => { markSeen(); setView('ann'); }} />
        <Acc label="使用教學" open={open === 'tutorial'} onToggle={() => toggle('tutorial')}><Tutorial /></Acc>
        <Acc label="加入主畫面" open={open === 'install'} onToggle={() => toggle('install')}><Install canInstall={canInstall} onInstall={onInstall} /></Acc>
        <Acc label="修改密碼" open={open === 'password'} onToggle={() => toggle('password')}>
          <Password username={me.username} onDone={() => setOpen(null)} />
        </Acc>
      </Section>

      <button type="button" className="sec" onClick={onLogout}>登出</button>
    </div>
  );
}

function Announcements({ anns }) {
  if (!anns.length) return <div className="alert">目前沒有公告。</div>;
  return (
    <div className="stack">
      {anns.map((a) => (
        <div key={a.id} className="card">
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <b style={{ fontSize: 15, fontWeight: 600, overflowWrap: 'anywhere' }}>{a.title}</b>
            {a.pinned && <span className="tag ok" style={{ flex: 'none' }}>置頂</span>}
          </div>
          <div className="muted" style={{ margin: '2px 0 8px' }}>{a.time}{a.ends ? ` · 顯示到 ${a.ends}` : ''}</div>
          <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.7 }}>{a.body}</div>
        </div>
      ))}
    </div>
  );
}

function Tutorial() {
  const steps = [
    ['上傳題目', '在首頁上傳題目圖片(最多 5 張),按「編輯」可框選範圍;也可在「補充敘述」直接輸入題目文字。'],
    ['設定題目資訊', '選擇科目與解說深度,知道答案可填「標準參考答案」。'],
    ['開始解題', '按「開始解題」,約等 10~30 秒,過程中請先不要離開頁面。'],
    ['查看解析', '到「解析」看答案、觀念詳解與選項解析。'],
    ['追問不懂的地方', '解完的題目下方可以追問,每題最多 3 次。'],
    ['收藏與回顧', '按解析頁的「☆ 收藏」,在「我 → 收藏題目」複習;所有題目都在「紀錄」。'],
  ];
  return (
    <div className="acc-list">
      {steps.map(([t, d], i) => (
        <div key={t}><b>{String(i + 1).padStart(2, '0')} {t}</b><span>{d}</span></div>
      ))}
      <div><b>常見問題</b><span>每日額度每天重新計算,AI 沒成功回答的題目不扣額度。問到未開放的科目會提示「請問○○相關的題目」。AI 太忙時請等一兩分鐘再試,遇到問題可在首頁最下方回報。</span></div>
    </div>
  );
}

function Install({ canInstall, onInstall }) {
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    setStandalone(!!window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
  }, []);
  return (
    <div className="acc-list">
      {standalone && <div className="acc-hint">你已經是從主畫面開啟的了 🎉</div>}
      {canInstall && <button type="button" onClick={onInstall}>立即加入主畫面</button>}
      <div><b>Android(Chrome)</b><span>點右上角「⋮」→「加到主畫面」或「安裝應用程式」→「新增」。</span></div>
      <div><b>iPhone(Safari)</b><span>點下方「分享」→ 往下滑選「加入主畫面」→ 右上角「新增」。</span></div>
      <div className="acc-hint">加入後從桌面圖示開啟會是全螢幕,不會看到網址列。</div>
    </div>
  );
}

function Password({ username, onDone }) {
  const [oldP, setOldP] = useState('');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (n1.length < 4) return setMsg({ bad: true, text: '新密碼至少需要 4 個字元' });
    if (n1 !== n2) return setMsg({ bad: true, text: '兩次輸入的新密碼不一致' });
    setBusy(true);
    try {
      await api('/api/auth/change-password', { method: 'POST', body: { username, oldPassword: oldP, newPassword: n1 } });
      setMsg({ text: '密碼已更新!' });
      setOldP(''); setN1(''); setN2('');
      setTimeout(onDone, 1200);
    } catch (x) { setMsg({ bad: true, text: x.message === '帳號或密碼錯誤' ? '目前的密碼不正確' : x.message }); }
    finally { setBusy(false); }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>目前的密碼<input type="password" value={oldP} onChange={(e) => setOldP(e.target.value)} autoComplete="current-password" /></label>
      <label>新密碼<input type="password" value={n1} onChange={(e) => setN1(e.target.value)} autoComplete="new-password" /></label>
      <label>確認新密碼<input type="password" value={n2} onChange={(e) => setN2(e.target.value)} autoComplete="new-password" /></label>
      {msg && <div className={`alert ${msg.bad ? 'bad' : ''}`}>{msg.text}</div>}
      <button disabled={busy || !oldP || !n1}>{busy ? '處理中...' : '確認修改'}</button>
    </form>
  );
}

function Favorites({ favIds, onOpen }) {
  const [logs, setLogs] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api('/api/history').then((d) => setLogs(d.logs.filter((l) => favIds.includes(l.id)))).catch((e) => setErr(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <div className="alert bad">{err}</div>;
  if (!logs) return <div className="acc-hint">載入中...</div>;
  if (!logs.length) return <div className="acc-hint">還沒有收藏的題目。在「解析」頁面按「☆ 收藏」就會出現在這裡。</div>;
  return (
    <div className="acc-list">
      {logs.map((l) => (
        <div key={l.id} className="fav-item clickable" onClick={() => onOpen(l)}>
          <div className="row between">
            <b>★ {l.subject} <small>[{l.depth_mode}]</small></b>
            <small className="muted">{l.time}</small>
          </div>
          <div style={{ marginTop: 3 }}>答案:{l.ans}</div>
          <div className="muted clamp">{l.note && l.note !== '無' ? l.note : l.reasoning}</div>
        </div>
      ))}
    </div>
  );
}
