// 外觀主題:iPhone / F1 賽車 / 經典 三類,全部是低彩度深色底,不刺眼
const diag = (a, b) => `linear-gradient(135deg, ${a} 0%, ${a} 50%, ${b} 50%, ${b} 100%)`;
const stripe = (bg, line) => `linear-gradient(135deg, ${bg} 0%, ${bg} 44%, ${line} 44%, ${line} 54%, ${bg} 54%, ${bg} 100%)`;

const mk = (id, name, cat, o) => ({
  id, name, cat,
  swatch: o.sw || `linear-gradient(135deg, ${o.c1} 0%, ${o.bg} 100%)`,
  vars: {
    '--bg': o.bg,
    '--card': `linear-gradient(135deg, ${o.c1} 0%, ${o.c2 || o.bg} 100%)`,
    '--border': o.border,
    '--btn': `linear-gradient(135deg, ${o.b1} 0%, ${o.b2} 100%)`,
    '--btn-text': o.bt || '#F4F4F5',
    '--hl': o.hl,
    '--badge': o.c1,
  },
});

export const CATEGORIES = ['iPhone', 'F1 賽車', '經典'];
export const DEFAULT_THEME = 'midnight_red';

export const THEMES = [
  // ----- iPhone -----
  mk('wine_red', '醇釀酒紅', 'iPhone', { bg: '#140509', c1: '#26101A', border: '#4A1F2C', b1: '#A33A4E', b2: '#7A2437', hl: '#D98A98', sw: 'linear-gradient(135deg,#4A0B14,#14040A)' }),
  mk('glacier_blue', '冰川霧藍', 'iPhone', { bg: '#08131B', c1: '#11293A', border: '#24465E', b1: '#4F86A8', b2: '#376783', hl: '#8DB8D3', sw: 'linear-gradient(135deg,#17324A,#0A1824)' }),
  mk('mist_silver', '霧光銀白', 'iPhone', { bg: '#1B1C1F', c1: '#2B2D31', border: '#4A4D54', b1: '#C9CDD3', b2: '#A4A9B2', bt: '#1B1C1F', hl: '#D5D8DD', sw: 'linear-gradient(135deg,#2A2C31,#16171A)' }),
  mk('obsidian', '曜石純黑', 'iPhone', { bg: '#060709', c1: '#121418', border: '#2A2D36', b1: '#D4D6DB', b2: '#9DA1AA', bt: '#060709', hl: '#B7BED0', sw: 'linear-gradient(135deg,#10131C,#050609)' }),
  // ----- F1 賽車 -----
  mk('silver_arrow', '賓士銀箭', 'F1 賽車', { bg: '#071211', c1: '#10201F', border: '#25423F', b1: '#5FA89A', b2: '#3F7A6E', bt: '#04100E', hl: '#8CC5B9', sw: stripe('#0A1514', '#2F6B52') }),
  mk('bull_blue', '紅牛競速', 'F1 賽車', { bg: '#070B1E', c1: '#121A45', border: '#26337A', b1: '#4764C9', b2: '#34479A', hl: '#8CA0E6', sw: diag('#13209A', '#A8261E') }),
  mk('ferrari_red', '法拉利躍馬', 'F1 賽車', { bg: '#0E0506', c1: '#2A0E10', border: '#5A1D20', b1: '#B33A32', b2: '#872620', hl: '#E08A82', sw: diag('#A8221A', '#0C0C10') }),
  mk('papaya_orange', '麥拉倫疾橙', 'F1 賽車', { bg: '#120A05', c1: '#2B170B', border: '#5E3A1C', b1: '#C9803F', b2: '#9A5D28', bt: '#1A0E05', hl: '#E0AE7A', sw: diag('#7A1A10', '#0A0A0E') }),
  // ----- 經典 -----
  mk('quiet_blue', '靜謐深藍', '經典', { bg: '#0A1224', c1: '#14203D', border: '#2D4268', b1: '#4C78B8', b2: '#365A91', hl: '#8FB0E0', sw: diag('#050A1C', '#0F2A6B') }),
  mk('forest_light', '森語晨光', '經典', { bg: '#121B14', c1: '#1F2E22', border: '#3B5740', b1: '#6FA578', b2: '#4F7F58', bt: '#07110A', hl: '#A5CDAB', sw: diag('#1B2A1D', '#0A2C0E') }),
  mk('aurora_blue', '極光藍境', '經典', { bg: '#0C1426', c1: '#1A2A46', border: '#2E4366', b1: '#4D7FD6', b2: '#3358A8', hl: '#8DB4F0', sw: diag('#0E1FB5', '#16233C') }),
  mk('dark_gold', '墨夜流金', '經典', { bg: '#131110', c1: '#26201A', border: '#4D4136', b1: '#B48A4A', b2: '#8A6730', bt: '#130F0A', hl: '#D9BC86', sw: diag('#0B0B0E', '#3A1F0C') }),
  mk('graphite_gray', '玄霧石墨', '經典', { bg: '#17191C', c1: '#25282D', border: '#3F444B', b1: '#B9BEC5', b2: '#8F959D', bt: '#17191C', hl: '#CDD1D6', sw: diag('#080A10', '#162230') }),
  mk('midnight_red', '曜黑競速', '經典', { bg: '#07080C', c1: '#15161C', c2: '#0A0B10', border: '#2B2D38', b1: '#B53A3A', b2: '#8A2626', hl: '#E3A09A', sw: diag('#0A0A0F', '#B02A22') }),
];

// 舊版主題代號 → 新版(讓之前選過主題的人不會被重設)
const LEGACY = { pine_green: 'forest_light', dusk_purple: 'quiet_blue', race_red: 'ferrari_red', nitro_blue: 'bull_blue', yellow_flag: 'dark_gold' };
export const resolveThemeId = (id) => {
  const k = LEGACY[id] || id;
  return THEMES.some((t) => t.id === k) ? k : null;
};
export const getTheme = (id) => THEMES.find((t) => t.id === resolveThemeId(id)) || THEMES.find((t) => t.id === DEFAULT_THEME);

export function applyTheme(id) {
  const t = getTheme(id);
  const root = document.documentElement;
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.theme = t.id;
  return t.id;
}
