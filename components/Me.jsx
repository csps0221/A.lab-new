'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { ThemeChooser } from './ThemePicker';
import { getTheme } from '@/lib/themes';

const FONTS = [['small', '小'], ['medium', '中'], ['large', '大']];
const DEPTHS = ['精簡解答', '標準詳解', '深度解析'];
const TITLES = {
  ann: '實驗室公告', tutorial: '使用教學', install: '加入主畫面', password: '修改密碼',
  favorites: '收藏題目', font: '閱讀字體大小', depth: '預設解析深度', theme: '主題配色',
};

const Section = ({ title, children }) => (
  <>
    <div className="sect">{title}</div>
    <div className="card menu">{children}</div>
  </>
);

const Row = ({ label, value, strong, badge, onClick }) => (
  <button type="button" className="mrow" onClick={onClick}>
    <span style={{ fontWeight: strong ? 700 : 400 }}>{label}</span>
    <span className="mrow-r">
      {badge && <span className="new">{badge}</span>}
      {value && <span>{value}</span>}
      <span aria-hidden="true">›</span>
    </span>
  </button>
);

function SubPage({ title, onBack, children }) {
  return (
    <div className="stack">
      <div className="row">
        <button type="button" className="sec" onClick={onBack}>← 返回</button>
        <h3>{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function Me({ me, remains, pct, theme, onTheme, prefs, setPrefs, anns, unread, markSeen, favIds, onOpenRecord, onGo, canInstall, onInstall, onLogout }) {
  const [view, setView] = useState('root');
  const isAdmin = me.role === 'admin';
  const back = () => setView('root');
  const fontLabel = FONTS.find(([k]) => k === prefs.font)?.[1] || '小';

  if (view === 'root') {
    return (
      <div className="stack">
        <div className="card profile">
          <div className="row" style={{ gap: 14 }}>
            <div className="pf-avatar">{me.username[0]}</div>
            <div style={{ minWidth: 0 }}>
              <div className="pf-name">{me.username}</div>
              <div className="muted">{me.class_name}</div>
            </div>
          </div>
          <div className="pf-divider" />
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <span>今日剩餘題數</span>
            <span><b className="pf-num">{remains}</b> <small className="muted">{isAdmin ? '題' : `/ ${me.limit} 題`}</small></span>
          </div>
          <div className="bar" style={{ marginTop: 12 }}><i style={{ width: `${pct}%` }} /></div>
        </div>

        <Section title="我的學習">
          <Row strong label="我的解題紀錄" onClick={() => onGo('history')} />
          <Row strong label="收藏題目" value={favIds.length ? `${favIds.length} 題` : ''} onClick={() => setView('favorites')} />
        </Section>

        <Section title="個人化設定">
          <Row label="主題配色" value={getTheme(theme).name} onClick={() => setView('theme')} />
          <Row label="閱讀字體大小" value={fontLabel} onClick={() => setView('font')} />
          <Row label="預設解析深度" value={prefs.depth} onClick={() => setView('depth')} />
        </Section>

        <Section title="服務與帳號">
          <Row label="實驗室公告" badge={unread ? 'NEW' : ''} onClick={() => { markSeen(); setView('ann'); }} />
          <Row label="使用教學" onClick={() => setView('tutorial')} />
          <Row label="加入主畫面" onClick={() => setView('install')} />
          <Row label="修改密碼" onClick={() => setView('password')} />
        </Section>

        <button type="button" className="sec" onClick={onLogout}>登出</button>
      </div>
    );
  }

  return (
    <SubPage title={TITLES[view]} onBack={back}>
      {view === 'ann' && <Announcements anns={anns} />}
      {view === 'tutorial' && <Tutorial />}
      {view === 'install' && <Install canInstall={canInstall} onInstall={onInstall} />}
      {view === 'password' && <Password username={me.username} onDone={back} />}
      {view === 'favorites' && <Favorites favIds={favIds} onOpen={onOpenRecord} />}
      {view === 'theme' && <div className="card"><ThemeChooser theme={theme} onChange={onTheme} /></div>}
      {view === 'font' && (
        <>
          <div className="card menu">
            {FONTS.map(([k, label]) => (
              <Row key={k} label={label} value={prefs.font === k ? '✓' : ''} onClick={() => setPrefs({ font: k })} />
            ))}
          </div>
          <div className="card">
            <div className="eyebrow">PREVIEW</div>
            <div className="md" style={{ marginTop: 6 }}><p>這是「解題解析」的閱讀字體預覽:氧化劑會得到電子,自己被還原。</p></div>
          </div>
        </>
      )}
      {view === 'depth' && (
        <>
          <div className="card menu">
            {DEPTHS.map((k) => (
              <Row key={k} label={k} value={prefs.depth === k ? '✓' : ''} onClick={() => setPrefs({ depth: k })} />
            ))}
          </div>
          <div className="muted">首頁的「解說深度」會預設選這一個,每次解題仍可以自己改。</div>
        </>
      )}
    </SubPage>
  );
}

function Announcements({ anns }) {
  if (!anns.length) return <div className="alert">目前沒有公告。</div>;
  return (
    <div className="stack">
      {anns.map((a) => (
        <div key={a.id} className="card">
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <b style={{ fontSize: 17, overflowWrap: 'anywhere' }}>{a.title}</b>
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
    ['上傳題目', '在首頁上傳題目圖片(最多 5 張),按「編輯」可以框選要解的範圍;也可以在「補充敘述」直接輸入題目文字。'],
    ['設定題目資訊', '選擇科目與解說深度,知道答案的話可以填「標準參考答案」。'],
    ['開始解題', '按「開始解題」,大約等 10~30 秒,過程中請先不要離開頁面。'],
    ['查看解析', '到「解析」看答案、觀念詳解與選項解析。'],
    ['追問不懂的地方', '解完的題目下方可以追問,每一題最多追問 3 次。'],
    ['收藏與回顧', '按解析頁的「☆ 收藏」存起來,在「我 → 收藏題目」複習;所有題目都在「紀錄」。'],
  ];
  return (
    <div className="stack">
      {steps.map(([t, d], i) => (
        <div key={t} className="card">
          <div className="secthead"><span className="num">{String(i + 1).padStart(2, '0')}</span><b>{t}</b></div>
          <div style={{ lineHeight: 1.7 }}>{d}</div>
        </div>
      ))}
      <div className="card">
        <b>常見問題</b>
        <ul style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
          <li>每日額度每天會重新計算,AI 沒有成功回答的題目不扣額度。</li>
          <li>問到管理員沒有開放給你的科目,畫面會提示「請問○○相關的題目」。</li>
          <li>AI 太忙時請等一兩分鐘再試。遇到問題可以在首頁最下方「回報問題或建議」。</li>
        </ul>
      </div>
    </div>
  );
}

function Install({ canInstall, onInstall }) {
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    setStandalone(!!window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
  }, []);
  return (
    <div className="stack">
      {standalone && <div className="alert">你已經是從主畫面開啟的了 🎉</div>}
      {canInstall && <button onClick={onInstall}>立即加入主畫面</button>}
      <div className="card">
        <b>Android(Chrome)</b>
        <ol style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
          <li>點右上角的「⋮」選單。</li>
          <li>選「加到主畫面」或「安裝應用程式」。</li>
          <li>按「新增」或「安裝」,桌面就會出現 A.lab 圖示。</li>
        </ol>
      </div>
      <div className="card">
        <b>iPhone(Safari)</b>
        <ol style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
          <li>用 Safari 開啟本網站,點下方的「分享」按鈕。</li>
          <li>往下滑,選「加入主畫面」。</li>
          <li>按右上角「新增」。</li>
        </ol>
      </div>
      <div className="muted">加入之後,從桌面圖示開啟會是全螢幕,不會看到瀏覽器的網址列。</div>
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
    <form className="card stack" onSubmit={submit}>
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
  if (!logs) return <div className="muted">載入中...</div>;
  if (!logs.length) return <div className="alert">還沒有收藏的題目。在「解析」頁面按「☆ 收藏」就會出現在這裡。</div>;
  return (
    <div className="stack">
      {logs.map((l) => (
        <div key={l.id} className="card clickable" onClick={() => onOpen(l)}>
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
