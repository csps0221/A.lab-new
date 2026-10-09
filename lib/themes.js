// 外觀主題:分成 iPhone / F1 賽車 / 經典 三類,全部是深色底
const mk = (id, name, cat, o) => ({
  id, name, cat,
  swatch: `linear-gradient(135deg, ${o.c1} 0%, ${o.bg} 100%)`,
  vars: {
    '--bg': o.bg,
    '--card': `linear-gradient(135deg, ${o.c1} 0%, ${o.c2 || o.bg} 100%)`,
    '--border': o.border,
    '--btn': `linear-gradient(135deg, ${o.b1} 0%, ${o.b2} 100%)`,
    '--btn-text': o.bt || '#FFFFFF',
    '--hl': o.hl,
    '--badge': o.c1,
  },
});

export const CATEGORIES = ['iPhone', 'F1 賽車', '經典'];
export const DEFAULT_THEME = 'midnight_red';

export const THEMES = [
  // ----- iPhone -----
  mk('wine_red', '醇釀酒紅', 'iPhone', { bg: '#12030A', c1: '#2A0A14', border: '#5A1A2A', b1: '#E11D48', b2: '#9F1239', hl: '#FB7185' }),
  mk('glacier_blue', '冰川霧藍', 'iPhone', { bg: '#061219', c1: '#0E2A3A', border: '#1F4A63', b1: '#38BDF8', b2: '#0369A1', bt: '#04121C', hl: '#7DD3FC' }),
  mk('mist_silver', '霧光銀白', 'iPhone', { bg: '#1A1B1D', c1: '#2A2C2F', border: '#46494F', b1: '#E5E7EB', b2: '#B8BCC4', bt: '#1A1B1D', hl: '#E5E7EB' }),
  mk('obsidian', '曜石純黑', 'iPhone', { bg: '#050608', c1: '#12141A', border: '#272B36', b1: '#F4F4F5', b2: '#A1A1AA', bt: '#050608', hl: '#A5B4FC' }),
  mk('pine_green', '松嶺青綠', 'iPhone', { bg: '#04130F', c1: '#0B2A22', border: '#1D5A49', b1: '#34D399', b2: '#047857', bt: '#031B13', hl: '#6EE7B7' }),
  mk('dusk_purple', '暮光紫', 'iPhone', { bg: '#0D0820', c1: '#1E1245', border: '#3F2D8A', b1: '#A78BFA', b2: '#6D28D9', hl: '#C4B5FD' }),
  // ----- F1 賽車 -----
  mk('race_red', '賽道紅', 'F1 賽車', { bg: '#0C0405', c1: '#240A0E', border: '#5C1620', b1: '#EF233C', b2: '#B00020', hl: '#FF6B6B' }),
  mk('silver_arrow', '銀箭青', 'F1 賽車', { bg: '#05100F', c1: '#0F2B29', border: '#1F5A55', b1: '#2DD4BF', b2: '#0F766E', bt: '#02201E', hl: '#5EEAD4' }),
  mk('nitro_blue', '氮氣藍', 'F1 賽車', { bg: '#040A1E', c1: '#0C1F55', border: '#1E3A8A', b1: '#3B82F6', b2: '#1D4ED8', hl: '#60A5FA' }),
  mk('papaya_orange', '木瓜橙', 'F1 賽車', { bg: '#120803', c1: '#2E1707', border: '#6B3A12', b1: '#FB923C', b2: '#C2410C', bt: '#1A0A02', hl: '#FDBA74' }),
  mk('racing_green', '賽車綠', 'F1 賽車', { bg: '#03120A', c1: '#0A2E1A', border: '#1B5E3A', b1: '#22C55E', b2: '#15803D', bt: '#02140A', hl: '#86EFAC' }),
  mk('yellow_flag', '黃旗金', 'F1 賽車', { bg: '#131003', c1: '#2E2807', border: '#6B5D12', b1: '#FACC15', b2: '#CA8A04', bt: '#1A1500', hl: '#FDE047' }),
  // ----- 經典 -----
  mk('midnight_red', '深夜赤焰', '經典', { bg: '#030616', c1: '#0B1438', c2: '#050A24', border: '#18265A', b1: '#D00F25', b2: '#A10018', hl: '#F5B93B' }),
  mk('graphite_gray', '玄霧石墨', '經典', { bg: '#212529', c1: '#343A40', border: '#495057', b1: '#CED4DA', b2: '#ADB5BD', bt: '#212529', hl: '#E9ECEF' }),
  mk('quiet_blue', '靜謐深藍', '經典', { bg: '#0B132B', c1: '#1C2541', border: '#3A506B', b1: '#6FFFE9', b2: '#5BC0BE', bt: '#0B132B', hl: '#6FFFE9' }),
  mk('forest_light', '森語晨光', '經典', { bg: '#1B261C', c1: '#2D3A2E', border: '#4E6B50', b1: '#A3E635', b2: '#65A30D', bt: '#121A13', hl: '#BEF264' }),
  mk('aurora_blue', '極光藍境', '經典', { bg: '#0F172A', c1: '#1E293B', border: '#334155', b1: '#38BDF8', b2: '#2563EB', hl: '#38BDF8' }),
  mk('dark_gold', '墨夜流金', '經典', { bg: '#18181B', c1: '#27272A', border: '#52525B', b1: '#FACC15', b2: '#CA8A04', bt: '#18181B', hl: '#FDE047' }),
];

export const getTheme = (id) => THEMES.find((t) => t.id === id) || THEMES.find((t) => t.id === DEFAULT_THEME);

export function applyTheme(id) {
  const t = getTheme(id);
  const root = document.documentElement;
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.theme = t.id;
  return t.id;
}
