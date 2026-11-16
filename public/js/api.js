// Cliente del API del servidor. Todas las llamadas fallan rápido (timeout)
// para que el juego siga funcionando sin base de datos.
async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(path, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  submitScore: (tag, mode, points) =>
    request('/api/scores', { method: 'POST', body: JSON.stringify({ tag, mode, points }) }),
  getLeaderboard: (mode, limit = 10) => request(`/api/scores?mode=${mode}&limit=${limit}`),
  getBests: (tag) => request(`/api/players/${encodeURIComponent(tag)}/bests`),
};
