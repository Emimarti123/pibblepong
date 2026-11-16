// Preferencias y datos locales (localStorage). Todo envuelto en try/catch
// porque el almacenamiento puede no estar disponible (modo privado, etc.).
const SETTINGS_KEY = 'pibblepong.settings';
const BESTS_KEY = 'pibblepong.bests';
const LOCAL_SCORES_KEY = 'pibblepong.localScores';

export const TAG_RE = /^[A-Za-z0-9_]{3,12}$/;
export const RESERVED_KEYS = ['Escape', 'KeyP']; // reservadas para pausa

const DEFAULTS = {
  keys: { up: 'KeyW', down: 'KeyS' },
  mode: 1,
  theme: 'classic', // classic | chief | ashen | slayer
  lastTag: '',
  musicMuted: false,
  pointsPerHit: 1, // solo con 1 cuentan los desbloqueos y el leaderboard
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento: seguimos solo en memoria */
  }
}

const stored = read(SETTINGS_KEY, {});
export const settings = {
  ...DEFAULTS,
  ...stored,
  keys: { ...DEFAULTS.keys, ...(stored.keys ?? {}) },
};

export const saveSettings = () => write(SETTINGS_KEY, settings);

export function resetKeys() {
  settings.keys = { ...DEFAULTS.keys };
  saveSettings();
}

// Nombre legible de una tecla a partir de KeyboardEvent.code
export function keyLabel(code) {
  if (!code) return '?';
  const arrows = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  if (arrows[code]) return arrows[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code.replace(/(Left|Right)$/, (s) => ' ' + s[0]).replace(/([a-z])([A-Z])/g, '$1 $2');
}

// ---- Mejores puntajes por jugador (los tags no distinguen mayúsculas) ----
const tagKey = (tag) => tag.toLowerCase();

export function getBests(tag) {
  if (!tag) return {};
  return read(BESTS_KEY, {})[tagKey(tag)] ?? {};
}

function setBests(tag, bests) {
  const all = read(BESTS_KEY, {});
  all[tagKey(tag)] = bests;
  write(BESTS_KEY, all);
}

// Combina los mejores del servidor con los locales (se queda con el mayor)
export function mergeBests(tag, serverBests) {
  const bests = { ...getBests(tag) };
  for (const [mode, best] of Object.entries(serverBests ?? {})) {
    bests[mode] = Math.max(bests[mode] ?? 0, Number(best) || 0);
  }
  setBests(tag, bests);
  return bests;
}

// Registra una partida; regresa true si es nuevo récord personal en ese modo
export function recordBest(tag, mode, points) {
  const bests = { ...getBests(tag) };
  const isNew = points > (bests[mode] ?? 0);
  if (isNew) bests[mode] = points;
  setBests(tag, bests);
  return isNew;
}

// ---- Tabla local de respaldo (cuando el servidor no responde) ----
export function addLocalScore(entry) {
  const list = read(LOCAL_SCORES_KEY, []);
  list.push(entry);
  write(LOCAL_SCORES_KEY, list.slice(-500));
}

export function getLocalScores(mode, limit = 10) {
  return read(LOCAL_SCORES_KEY, [])
    .filter((s) => s.mode === mode)
    .sort((a, b) => b.points - a.points || new Date(a.date) - new Date(b.date))
    .slice(0, limit);
}
