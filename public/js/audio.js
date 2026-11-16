// Música por tema y efectos de sonido.
//   Música: assets/music/<tema>.mp3 (si no existe, simplemente no suena)
//   Efecto de impacto: se genera con Web Audio, no necesita archivos.
const MUSIC_VOLUME = 0.4;

let track = null;       // { id, audio }
let musicMuted = false;
let ctx = null;         // AudioContext (se crea tras la primera interacción)

function audioContext() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Los navegadores bloquean el audio hasta que el usuario interactúa: reintenta en el primer clic/tecla
function unlockOnFirstGesture() {
  const unlock = () => {
    audioContext();
    if (track && track.audio.paused && !musicMuted) track.audio.play().catch(() => {});
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}
unlockOnFirstGesture();

export function setMusicMuted(muted) {
  musicMuted = muted;
  if (!track) return;
  track.audio.muted = muted;
  if (!muted && track.audio.paused) track.audio.play().catch(() => {});
}

/** Cambia la canción al tema indicado (no hace nada si ya está sonando). */
export function playMusic(themeId) {
  if (track?.id === themeId) {
    if (track.audio.paused && !musicMuted) track.audio.play().catch(() => {});
    return;
  }
  stopMusic();
  const audio = new Audio(`assets/music/${themeId}.mp3`);
  audio.loop = true;
  audio.volume = MUSIC_VOLUME;
  audio.muted = musicMuted;
  audio.addEventListener('error', () => { if (track?.audio === audio) track = null; });
  track = { id: themeId, audio };
  audio.play().catch(() => { /* bloqueado hasta la primera interacción */ });
}

export function stopMusic() {
  if (!track) return;
  track.audio.pause();
  track.audio.src = '';
  track = null;
}

/** Baja el volumen de la música (pausa) o lo restaura. */
export function duckMusic(ducked) {
  if (track) track.audio.volume = ducked ? MUSIC_VOLUME * 0.3 : MUSIC_VOLUME;
}

/** Sonido de impacto arcade al golpear la barra. intensity 0..1 sube el tono. */
export function playHit(intensity = 0) {
  const ac = audioContext();
  if (!ac) return;
  const now = ac.currentTime;
  const out = ac.createGain();
  out.gain.value = 0.35;
  out.connect(ac.destination);

  // "Blip" cuadrado que cae de tono
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'square';
  const base = 520 + intensity * 360;
  osc.frequency.setValueAtTime(base, now);
  osc.frequency.exponentialRampToValueAtTime(base * 0.45, now + 0.09);
  g.gain.setValueAtTime(0.5, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(g).connect(out);
  osc.start(now);
  osc.stop(now + 0.13);

  // Golpe seco de ruido para darle cuerpo
  const len = Math.floor(ac.sampleRate * 0.05);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const noise = ac.createBufferSource();
  noise.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1800;
  const ng = ac.createGain();
  ng.gain.value = 0.6;
  noise.connect(filter).connect(ng).connect(out);
  noise.start(now);
}
