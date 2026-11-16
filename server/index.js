import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Mismas reglas que el cliente
const TAG_RE = /^[A-Za-z0-9_]{3,12}$/;
const MODE_COUNT = 5;
const MAX_POINTS = 100000;

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const parseMode = (value) => {
  const mode = Number(value);
  return Number.isInteger(mode) && mode >= 1 && mode <= MODE_COUNT ? mode : null;
};

// Envuelve handlers async y responde 503 si la base de datos no está disponible
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error('[api]', err.code || err.message);
    res.status(503).json({ error: 'Database unavailable' });
  }
};

// Guarda una partida terminada
app.post('/api/scores', handle(async (req, res) => {
  const { tag, mode: rawMode, points } = req.body ?? {};
  const mode = parseMode(rawMode);

  if (typeof tag !== 'string' || !TAG_RE.test(tag)) {
    return res.status(400).json({ error: 'Invalid tag' });
  }
  // Solo se guardan partidas a +1 por golpe, así que los puntos son la cantidad de golpes
  if (!mode || !Number.isInteger(points) || points < 0 || points > MAX_POINTS) {
    return res.status(400).json({ error: 'Invalid score' });
  }

  // Inserta el jugador si no existe y obtiene su id en una sola consulta
  const [playerResult] = await pool.query(
    'INSERT INTO players (tag) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
    [tag],
  );
  const [scoreResult] = await pool.query(
    'INSERT INTO scores (player_id, mode, points) VALUES (?, ?, ?)',
    [playerResult.insertId, mode, points],
  );
  res.status(201).json({ id: scoreResult.insertId });
}));

// Top de puntajes de un modo
app.get('/api/scores', handle(async (req, res) => {
  const mode = parseMode(req.query.mode);
  if (!mode) return res.status(400).json({ error: 'Invalid mode' });
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);

  const [rows] = await pool.query(
    `SELECT s.id, p.tag, s.points, s.created_at AS date
       FROM scores s JOIN players p ON p.id = s.player_id
      WHERE s.mode = ?
      ORDER BY s.points DESC, s.created_at ASC
      LIMIT ?`,
    [mode, limit],
  );
  res.json(rows);
}));

// Mejor puntaje por modo de un jugador (para calcular desbloqueos)
app.get('/api/players/:tag/bests', handle(async (req, res) => {
  const { tag } = req.params;
  if (!TAG_RE.test(tag)) return res.status(400).json({ error: 'Invalid tag' });

  const [rows] = await pool.query(
    `SELECT s.mode, MAX(s.points) AS best
       FROM scores s JOIN players p ON p.id = s.player_id
      WHERE p.tag = ?
      GROUP BY s.mode`,
    [tag],
  );
  const bests = {};
  for (const row of rows) bests[row.mode] = row.best;
  res.json(bests);
}));

app.listen(PORT, () => {
  console.log(`🐶 PibblePong running at http://localhost:${PORT}`);
});
