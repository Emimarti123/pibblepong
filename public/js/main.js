// Controlador de pantallas y de la interfaz.
import * as game from './game.js';
import { MODES, getMode, isModeUnlocked, modeUnlockText } from './modes.js';
import { THEMES, getTheme, themeExists, isThemeUnlocked, themeUnlockText } from './themes.js';
import { drawPibble, drawPaddle, Background, loadSprites } from './art.js';
import { playMusic, stopMusic, setMusicMuted, duckMusic, playHit } from './audio.js';
import { api } from './api.js';
import {
  settings, saveSettings, resetKeys, keyLabel, TAG_RE, RESERVED_KEYS,
  getBests, mergeBests, recordBest, addLocalScore, getLocalScores,
} from './settings.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Prepara un canvas para dibujar con coordenadas lógicas (w x h) a la resolución real de la pantalla
function hiDpiContext(canvas, w, h) {
  const ratio = Math.max(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

let currentScreen = 'menu';
let bests = getBests(settings.lastTag);

// ============================================================
// Tema: cambia todo a la vez (pibble, barra, fondo, colores, música y Game Over)
// ============================================================
function applyTheme() {
  document.body.dataset.theme = settings.theme;
}

function setMuted(muted) {
  settings.musicMuted = muted;
  saveSettings();
  setMusicMuted(muted);
  const btn = $('#mute-btn');
  btn.setAttribute('aria-pressed', String(muted));
  btn.setAttribute('aria-label', muted ? 'Unmute music' : 'Mute music');
  btn.title = `${muted ? 'Unmute' : 'Mute'} music (M)`;
}

$('#mute-btn').addEventListener('click', (e) => {
  setMuted(!settings.musicMuted);
  e.currentTarget.blur();
});

// ============================================================
// Navegación
// ============================================================
function show(name) {
  currentScreen = name;
  for (const el of $$('.screen')) el.hidden = el.dataset.screen !== name;
  const enter = SCREEN_ENTER[name];
  if (enter) enter();
  const first = $(`[data-screen="${name}"] .btn-primary, [data-screen="${name}"] .btn`);
  if (first) first.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

const SCREEN_ENTER = {
  menu: enterMenu,
  settings: renderSettings,
  scores: () => renderScoresScreen(settings.mode),
};

// Si la selección guardada ya no está desbloqueada para este jugador, la corrige
function ensureValidSelections() {
  if (!isModeUnlocked(getMode(settings.mode), bests)) settings.mode = 1;
  if (!themeExists(settings.theme) || !isThemeUnlocked(getTheme(settings.theme), bests)) settings.theme = 'classic';
  saveSettings();
  applyTheme();
}

// ============================================================
// Main Menu
// ============================================================
let menuRaf = null;

function enterMenu() {
  $('#menu-status').innerHTML = `MODE <b>${escapeHtml(getMode(settings.mode).name.toUpperCase())}</b>`;
  $('#player-input').value = settings.lastTag;
  $('#player-error').textContent = '';

  const canvas = $('#menu-pibble');
  const ctx = hiDpiContext(canvas, 220, 220);
  cancelAnimationFrame(menuRaf);
  const frame = (ts) => {
    if (currentScreen !== 'menu') return;
    const t = ts / 1000;
    ctx.clearRect(0, 0, 220, 220);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(110, 208, 56 - Math.sin(t * 3) * 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    drawPibble(ctx, 110, 108 + Math.sin(t * 3) * 6, 56, settings.theme, Math.sin(t * 1.5) * 0.08);
    menuRaf = requestAnimationFrame(frame);
  };
  menuRaf = requestAnimationFrame(frame);
}

// ---- Jugador: se edita abajo del menú ----
const playerInput = $('#player-input');

playerInput.addEventListener('input', () => {
  // Filtra caracteres no permitidos mientras se escribe
  const clean = playerInput.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 12);
  if (clean !== playerInput.value) playerInput.value = clean;
  $('#player-error').textContent = '';
});

/** Guarda el tag escrito. Regresa true si es válido. */
async function savePlayer() {
  const tag = playerInput.value.trim();
  if (!TAG_RE.test(tag)) {
    $('#player-error').textContent = 'TAG: 3-12 LETTERS, NUMBERS OR _';
    return false;
  }
  if (tag === settings.lastTag) return true;
  const changed = tag.toLowerCase() !== settings.lastTag.toLowerCase();
  settings.lastTag = tag;
  saveSettings();
  bests = getBests(tag);
  // Trae los récords del servidor para que los desbloqueos sigan al jugador
  try {
    bests = mergeBests(tag, await api.getBests(tag));
  } catch {
    /* sin servidor: usamos solo los datos locales */
  }
  if (changed) ensureValidSelections();
  return true;
}

$('#player-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (await savePlayer()) playerInput.blur();
});

playerInput.addEventListener('blur', () => {
  if (playerInput.value.trim()) savePlayer();
});

async function play() {
  if (!(await savePlayer())) {
    playerInput.focus();
    return;
  }
  startGame();
}

// ============================================================
// Settings
// ============================================================
let listeningFor = null;

function renderSettings() {
  $('#keys-error').textContent = '';
  renderKeys();
  renderModes();
  renderPointsPicker();
  renderThemeGrid();
}

function renderKeys() {
  for (const btn of $$('[data-bind]')) {
    const action = btn.dataset.bind;
    btn.classList.toggle('listening', listeningFor === action);
    btn.textContent = listeningFor === action ? 'PRESS KEY' : keyLabel(settings.keys[action]);
  }
}

for (const btn of $$('[data-bind]')) {
  btn.addEventListener('click', () => {
    listeningFor = listeningFor === btn.dataset.bind ? null : btn.dataset.bind;
    $('#keys-error').textContent = '';
    renderKeys();
  });
}

$('#reset-keys').addEventListener('click', () => {
  resetKeys();
  listeningFor = null;
  $('#keys-error').textContent = '';
  renderKeys();
});

// Captura de teclas: se ejecuta antes que cualquier otro manejador
window.addEventListener('keydown', (e) => {
  if (!listeningFor) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const error = $('#keys-error');
  if (e.code === 'Escape') {
    listeningFor = null;
  } else if (RESERVED_KEYS.includes(e.code) || e.code === 'KeyM') {
    error.textContent = `${keyLabel(e.code)} IS RESERVED`;
    return;
  } else {
    const other = listeningFor === 'up' ? 'down' : 'up';
    if (settings.keys[other] === e.code) {
      error.textContent = `${keyLabel(e.code)} IS ALREADY MOVE ${other.toUpperCase()}`;
      return;
    }
    settings.keys[listeningFor] = e.code;
    saveSettings();
    error.textContent = '';
    listeningFor = null;
  }
  renderKeys();
}, true);

function renderModes() {
  const grid = $('#mode-grid');
  grid.innerHTML = '';
  for (const mode of MODES) {
    const unlocked = isModeUnlocked(mode, bests);
    const best = bests[mode.id] ?? 0;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card' + (settings.mode === mode.id ? ' selected' : '');
    card.disabled = !unlocked;
    card.innerHTML = `
      <span class="badge">MODE ${mode.id}</span>
      <span class="card-title">${escapeHtml(mode.name)}</span>
      ${best ? `<span class="card-meta">BEST ${best}</span>` : ''}
      ${unlocked ? '' : `<span class="lock">LOCKED · ${escapeHtml(modeUnlockText(mode))}</span>`}`;
    card.addEventListener('click', () => {
      settings.mode = mode.id;
      saveSettings();
      renderModes();
    });
    grid.append(card);
  }
}

// Puntos por golpe (1-5). Solo con 1 la partida cuenta para desbloqueos y leaderboard.
function renderPointsPicker() {
  const picker = $('#points-picker');
  picker.innerHTML = '';
  for (let n = 1; n <= 5; n++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab';
    btn.role = 'radio';
    btn.textContent = `+${n}`;
    btn.setAttribute('aria-checked', String(settings.pointsPerHit === n));
    btn.setAttribute('aria-selected', String(settings.pointsPerHit === n));
    btn.addEventListener('click', () => {
      settings.pointsPerHit = n;
      saveSettings();
      renderPointsPicker();
      const warning = $('#points-warning');
      warning.classList.remove('active');
      if (n > 1) requestAnimationFrame(() => warning.classList.add('active'));
    });
    picker.append(btn);
  }
}

// Vista previa de un tema: una mini escena con su fondo, su barra y su pibble
function drawThemePreview(ctx, id, w, h) {
  const bg = new Background(id, w, h, 2);
  for (let i = 0; i < 30; i++) bg.update(1);
  bg.draw(ctx, 0.5);
  drawPaddle(ctx, w * 0.06, h * 0.3, w * 0.035, h * 0.38, id);
  drawPibble(ctx, w * 0.55, h * 0.5, h * 0.2, id);
}

function renderThemeGrid() {
  const grid = $('#theme-grid');
  grid.innerHTML = '';
  for (const theme of THEMES) {
    const unlocked = isThemeUnlocked(theme, bests);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card' + (settings.theme === theme.id ? ' selected' : '');
    card.disabled = !unlocked;
    const canvas = document.createElement('canvas');
    drawThemePreview(hiDpiContext(canvas, 240, 135), theme.id, 240, 135);
    card.append(canvas);
    card.insertAdjacentHTML('beforeend', `
      <span class="card-title">${theme.name}</span>
      ${unlocked ? '' : `<span class="lock">LOCKED · ${themeUnlockText(theme)}</span>`}`);
    card.addEventListener('click', () => {
      settings.theme = theme.id;
      saveSettings();
      applyTheme();
      renderThemeGrid();
    });
    grid.append(card);
  }
}

// ============================================================
// Leaderboards
// ============================================================
const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

async function fetchLeaderboard(mode) {
  try {
    return { rows: await api.getLeaderboard(mode, 10), offline: false };
  } catch {
    return { rows: getLocalScores(mode, 10), offline: true };
  }
}

function renderTable(container, { rows, offline }, highlightId = null) {
  const notice = offline ? '<p class="notice">OFFLINE · SCORES SAVED ON THIS DEVICE</p>' : '';
  if (!rows.length) {
    container.innerHTML = `${notice}<p class="empty">NO SCORES YET</p>`;
    return;
  }
  const body = rows.map((r, i) => `
    <tr class="${highlightId !== null && String(r.id) === String(highlightId) ? 'me' : ''}">
      <td class="rank">${String(i + 1).padStart(2, '0')}</td>
      <td>${escapeHtml(r.tag)}</td>
      <td class="points">${r.points}</td>
      <td class="date">${dateFmt.format(new Date(r.date))}</td>
    </tr>`).join('');
  container.innerHTML = `${notice}<div class="table-wrap"><table>
    <thead><tr><th>RANK</th><th>PLAYER</th><th>SCORE</th><th>DATE</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

async function renderScoresScreen(modeId) {
  const tabs = $('#score-tabs');
  tabs.innerHTML = '';
  for (const mode of MODES) {
    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.role = 'tab';
    tab.textContent = mode.name;
    tab.setAttribute('aria-selected', String(mode.id === modeId));
    tab.addEventListener('click', () => renderScoresScreen(mode.id));
    tabs.append(tab);
  }
  const container = $('#scores-table');
  container.innerHTML = '<p class="empty blink">LOADING...</p>';
  renderTable(container, await fetchLeaderboard(modeId));
}

// ============================================================
// Juego
// ============================================================
game.setup({
  onPauseChange: (paused) => {
    $('#pause-overlay').hidden = !paused;
    duckMusic(paused);
    if (paused) $('#pause-overlay .btn-primary').focus();
  },
  onHit: (intensity) => playHit(intensity),
  onGameOver: handleGameOver,
});

function startGame() {
  $('#pause-overlay').hidden = true;
  // La música solo suena durante la partida (en bucle)
  duckMusic(false);
  playMusic(settings.theme);
  show('game');
  game.start({
    mode: getMode(settings.mode),
    keys: { ...settings.keys },
    theme: settings.theme,
    accent: getTheme(settings.theme).accent,
    pointsPerHit: settings.pointsPerHit,
  });
}

// Lista de nombres desbloqueados con los récords actuales
function unlockedSet(b) {
  const names = new Set();
  for (const m of MODES) if (isModeUnlocked(m, b)) names.add(`NEW MODE · ${m.name}`);
  for (const t of THEMES) if (isThemeUnlocked(t, b)) names.add(`NEW THEME · ${t.name}`);
  return names;
}

async function handleGameOver({ score, mode, pointsPerHit }) {
  const tag = settings.lastTag;
  // Solo las partidas a +1 por golpe cuentan (récords, desbloqueos y leaderboard)
  const counts = pointsPerHit === 1;
  const before = unlockedSet(bests);
  const isNewBest = counts && recordBest(tag, mode.id, score);
  bests = getBests(tag);
  const newUnlocks = [...unlockedSet(bests)].filter((name) => !before.has(name));

  // El mensaje de Game Over depende del pibble elegido
  const pibble = getTheme(settings.theme);
  $('#over-banner').className = `over-banner pibble-${pibble.id}`;
  $('#over-title').textContent = pibble.gameOverTitle;
  $('#over-score').textContent = String(score).padStart(4, '0');
  if (!counts) {
    $('#over-best').innerHTML = `<span class="notice">PLAYED AT +${pointsPerHit} · NOT SAVED</span>`;
  } else {
    $('#over-best').innerHTML = isNewBest && score > 0
      ? '<span class="badge-new">★ NEW PERSONAL BEST ★</span>'
      : `BEST · ${bests[mode.id] ?? 0}`;
  }
  $('#over-unlocks').innerHTML = newUnlocks.map((n) => `<li>${escapeHtml(n)}</li>`).join('');
  $('#over-board-title').textContent = `TOP 10 · ${mode.name.toUpperCase()}`;
  const ctx = hiDpiContext($('#over-pibble'), 140, 140);
  drawPibble(ctx, 70, 72, 40, settings.theme, -0.15);

  const table = $('#over-table');
  table.innerHTML = '<p class="empty blink">LOADING...</p>';
  show('gameover');

  if (!counts) {
    const board = await fetchLeaderboard(mode.id);
    if (currentScreen === 'gameover') renderTable(table, board);
    return;
  }

  const entry = { id: `local-${Date.now()}`, tag, mode: mode.id, points: score, date: new Date().toISOString() };
  let highlightId = entry.id;
  try {
    const { id } = await api.submitScore(tag, mode.id, score);
    highlightId = id;
  } catch {
    addLocalScore(entry);
  }
  const board = await fetchLeaderboard(mode.id);
  if (currentScreen === 'gameover') renderTable(table, board, highlightId);
}

// ============================================================
// Botones y atajos globales
// ============================================================
const ACTIONS = {
  play,
  settings: () => show('settings'),
  scores: () => show('scores'),
  menu: () => { game.stop(); listeningFor = null; stopMusic(); show('menu'); },
  resume: () => game.resume(),
  restart: () => { $('#pause-overlay').hidden = true; duckMusic(false); game.restart(); },
  quit: () => { game.stop(); $('#pause-overlay').hidden = true; stopMusic(); show('menu'); },
  again: () => startGame(),
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (btn && ACTIONS[btn.dataset.action]) ACTIONS[btn.dataset.action]();
});

window.addEventListener('keydown', (e) => {
  const typing = e.target instanceof HTMLInputElement;
  if (e.code === 'KeyM' && !typing && !e.repeat) {
    setMuted(!settings.musicMuted);
    return;
  }
  if (e.code === 'Escape' && ['settings', 'scores'].includes(currentScreen)) show('menu');
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ============================================================
// Inicio
// ============================================================
document.fonts?.load("16px 'Press Start 2P'").catch(() => {});
document.fonts?.load("22px 'VT323'").catch(() => {});
ensureValidSelections();
setMuted(settings.musicMuted);
// Carga las imágenes que existan antes de mostrar el menú
loadSprites(THEMES.map((t) => t.id)).then(() => show('menu'));
