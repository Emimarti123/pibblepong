import { UNLOCK_ALL } from './config.js';

// Temas: cada uno cambia todo a la vez (pibble, barra, fondo, colores, música y Game Over).
// Se desbloquean según el mejor puntaje en una sola partida (cualquier modo).
//   gameOverTitle: texto al perder
//   accent: color de la estética arcade (también se usa en el HUD del juego)
export const THEMES = [
  { id: 'classic', name: 'Classic', unlockScore: 0, gameOverTitle: 'GOOD TRY, PUP!', accent: '#F2C14E' },
  { id: 'chief', name: 'Halo', unlockScore: 20, gameOverTitle: 'SPARTAN MISSING IN ACTION', accent: '#6FD3FF' },
  { id: 'ashen', name: 'Dark Souls', unlockScore: 40, gameOverTitle: 'YOU DIED', accent: '#FFB347' },
  { id: 'slayer', name: 'Doom', unlockScore: 60, gameOverTitle: 'RIP AND TEAR', accent: '#FF5A2A' },
];

export const getTheme = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export const themeExists = (id) => THEMES.some((t) => t.id === id);

const bestSingleGame = (bests) => Math.max(0, ...Object.values(bests));

export const isThemeUnlocked = (theme, bests) => UNLOCK_ALL || bestSingleGame(bests) >= theme.unlockScore;

export const themeUnlockText = (theme) => `SCORE ${theme.unlockScore} IN ONE GAME`;
