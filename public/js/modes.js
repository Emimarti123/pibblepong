import { UNLOCK_ALL } from './config.js';

// Los 5 modos de juego (solo cambian la dificultad; los puntos por golpe son un ajuste aparte).
export const MODES = [
  {
    id: 1, name: 'Pup',
    ballSpeed: 4, paddleHeight: 130, paddleSpeed: 6,
    speedUpPerHit: 0.15, maxSpeedFactor: 1.8, randomBounce: false,
    unlock: null,
  },
  {
    id: 2, name: 'Not Too Ruff',
    ballSpeed: 5.5, paddleHeight: 105, paddleSpeed: 7,
    speedUpPerHit: 0.2, maxSpeedFactor: 1.9, randomBounce: false,
    unlock: { mode: 1, score: 15 },
  },
  {
    id: 3, name: 'Hurt Me',
    ballSpeed: 7, paddleHeight: 100, paddleSpeed: 8,
    speedUpPerHit: 0.25, maxSpeedFactor: 2, randomBounce: false,
    unlock: { mode: 2, score: 15 },
  },
  {
    id: 4, name: 'Vicious',
    ballSpeed: 9, paddleHeight: 90, paddleSpeed: 9,
    speedUpPerHit: 0.45, maxSpeedFactor: 2.1, randomBounce: false,
    unlock: { mode: 3, score: 20 },
  },
  {
    id: 5, name: 'Nightmare',
    ballSpeed: 11, paddleHeight: 70, paddleSpeed: 10,
    speedUpPerHit: 0.45, maxSpeedFactor: 2.2, randomBounce: true,
    unlock: { mode: 4, score: 25 },
  },
];

export const getMode = (id) => MODES.find((m) => m.id === Number(id)) ?? MODES[0];

// bests = { [modeId]: mejorPuntaje }
export const isModeUnlocked = (mode, bests) =>
  UNLOCK_ALL || !mode.unlock || (bests[mode.unlock.mode] ?? 0) >= mode.unlock.score;

// Se menciona el número del modo anterior (no su nombre, que puede seguir oculto)
export const modeUnlockText = (mode) =>
  mode.unlock ? `SCORE ${mode.unlock.score} IN MODE ${mode.unlock.mode}` : '';
