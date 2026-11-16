// Arte del juego: pibbles (imágenes), barras, fondos y pared de cada tema.
const TAU = Math.PI * 2;
const OUTLINE = '#2a1d17';

const rand = (min, max) => min + Math.random() * (max - min);

// ============================================================
// IMÁGENES
//   assets/pibbles/<tema>.png      -> pelota (PNG recortado, fondo transparente)
//   assets/backgrounds/<tema>.jpg  -> fondo (Classic usa un fondo dibujado)
// ============================================================
const PHOTO_BACKGROUNDS = ['chief', 'ashen', 'slayer'];
const sprites = {};

function loadImage(key, src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { sprites[key] = img; resolve(); };
    img.onerror = () => resolve();
    img.src = src;
  });
}

export function loadSprites(themeIds) {
  const jobs = themeIds.map((id) => loadImage(`pibble:${id}`, `assets/pibbles/${id}.png`));
  for (const id of PHOTO_BACKGROUNDS) jobs.push(loadImage(`bg:${id}`, `assets/backgrounds/${id}.jpg`));
  return Promise.all(jobs);
}

// Dibuja una imagen ajustada a una caja de size x size, centrada en (0, 0)
function drawFitted(ctx, img, size) {
  const scale = size / Math.max(img.naturalWidth, img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
}

function ellipsePath(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ============================================================
// PIBBLES
// ============================================================

/** Dibuja el pibble del tema centrado en (x, y); r es el radio de la pelota. */
export function drawPibble(ctx, x, y, r, themeId, rotation = 0) {
  const img = sprites[`pibble:${themeId}`];
  if (!img) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  // Halo suave para que el pibble se distinga sobre fondos oscuros
  ctx.shadowColor = 'rgba(255,250,235,0.6)';
  ctx.shadowBlur = r * 0.6;
  drawFitted(ctx, img, r * 3.2);
  ctx.restore();
}

// ============================================================
// BARRAS
// ============================================================

const PADDLES = {
  // Hueso
  classic(ctx, x, y, w, h) {
    const knob = w * 0.42;
    const shapes = [
      () => ctx.rect(x + w * 0.18, y + knob, w * 0.64, h - knob * 2),
      () => ctx.arc(x + w * 0.27, y + knob, knob, 0, TAU),
      () => ctx.arc(x + w * 0.73, y + knob, knob, 0, TAU),
      () => ctx.arc(x + w * 0.27, y + h - knob, knob, 0, TAU),
      () => ctx.arc(x + w * 0.73, y + h - knob, knob, 0, TAU),
    ];
    // Primero el contorno de todas las piezas, luego el relleno encima
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#B88F66';
    for (const s of shapes) { ctx.beginPath(); s(); ctx.stroke(); }
    ctx.fillStyle = '#FFF4E6';
    for (const s of shapes) { ctx.beginPath(); s(); ctx.fill(); }
    ctx.fillStyle = 'rgba(232,195,158,0.6)';
    ctx.fillRect(x + w * 0.6, y + knob, w * 0.18, h - knob * 2);
  },

  chief(ctx, x, y, w, h) {
    roundRectPath(ctx, x, y, w, h, w / 2);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#3D5224');
    g.addColorStop(0.5, '#7C9A4E');
    g.addColorStop(1, '#3D5224');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,40,18,0.7)';
    for (let sy = y + 18; sy < y + h - 10; sy += 18) {
      ctx.beginPath();
      ctx.moveTo(x + 2, sy);
      ctx.lineTo(x + w - 2, sy);
      ctx.stroke();
    }
    const visor = ctx.createLinearGradient(0, y, 0, y + h);
    visor.addColorStop(0, '#FFE49A');
    visor.addColorStop(1, '#C27A20');
    ctx.fillStyle = visor;
    roundRectPath(ctx, x + w * 0.36, y + 10, w * 0.28, h - 20, 3);
    ctx.fill();
  },

  ashen(ctx, x, y, w, h) {
    roundRectPath(ctx, x, y, w, h, 3);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#55504B');
    g.addColorStop(0.5, '#B3ADA4');
    g.addColorStop(1, '#55504B');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1C1816';
    ctx.stroke();
    ctx.fillStyle = 'rgba(122,72,38,0.6)';
    ellipsePath(ctx, x + w * 0.4, y + h * 0.3, w * 0.3, 7);
    ctx.fill();
    ellipsePath(ctx, x + w * 0.6, y + h * 0.72, w * 0.25, 5);
    ctx.fill();
    ctx.fillStyle = '#E2DCD2';
    for (const ry of [y + 7, y + h / 2, y + h - 7]) {
      ellipsePath(ctx, x + w / 2, ry, 2.2, 2.2);
      ctx.fill();
    }
  },

  slayer(ctx, x, y, w, h) {
    roundRectPath(ctx, x, y, w, h, 4);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#262626');
    g.addColorStop(0.5, '#5A5A5A');
    g.addColorStop(1, '#262626');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0C0C0C';
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = '#FF3B1F';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#FF5A2A';
    ctx.fillRect(x + w * 0.42, y + 8, w * 0.16, h - 16);
    ctx.restore();
    ctx.fillStyle = '#141414';
    for (let vy = y + 12; vy < y + h - 10; vy += 14) {
      ctx.fillRect(x + 2, vy, w * 0.25, 3);
      ctx.fillRect(x + w * 0.73, vy, w * 0.25, 3);
    }
  },
};

export function drawPaddle(ctx, x, y, w, h, themeId = 'classic') {
  ctx.save();
  (PADDLES[themeId] ?? PADDLES.classic)(ctx, x, y, w, h);
  ctx.restore();
}

// ============================================================
// FONDOS Y PARED
// ============================================================

function drawPaw(ctx, x, y, s, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ellipsePath(ctx, 0, 0.35 * s, 0.55 * s, 0.45 * s);
  ctx.fill();
  for (const [tx, ty] of [[-0.6, -0.25], [-0.22, -0.6], [0.22, -0.6], [0.6, -0.25]]) {
    ellipsePath(ctx, tx * s, ty * s, 0.2 * s, 0.26 * s);
    ctx.fill();
  }
  ctx.restore();
}

// Fondo dibujado de Classic (los demás temas usan una imagen)
function drawClassicBackground(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
  g.addColorStop(0, '#3A2D2A');
  g.addColorStop(1, '#1E1A1D');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(232,195,158,0.07)';
  const s = w / 40;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 9; col++) {
      const px = (col + (row % 2) * 0.5) * (w / 8.5) + s;
      const py = row * (h / 5.5) + s * 1.5;
      drawPaw(ctx, px, py, s, (row + col) % 2 ? 0.3 : -0.3);
    }
  }
}

/** Fondo animado de un tema. Llamar update(dt) y draw(ctx, t) cada frame. */
export class Background {
  // pixelScale: cuántos píxeles reales por unidad (para pantallas grandes / HiDPI)
  constructor(themeId, w, h, pixelScale = 1) {
    this.themeId = themeId;
    this.w = w;
    this.h = h;
    this.layer = document.createElement('canvas');
    this.layer.width = Math.round(w * pixelScale);
    this.layer.height = Math.round(h * pixelScale);
    const layerCtx = this.layer.getContext('2d');
    layerCtx.scale(pixelScale, pixelScale);
    layerCtx.imageSmoothingQuality = 'high';
    const photo = sprites[`bg:${themeId}`];
    if (photo) {
      // Imagen tipo "cover": llena todo el canvas sin deformarse
      const scale = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
      const pw = photo.naturalWidth * scale;
      const ph = photo.naturalHeight * scale;
      layerCtx.drawImage(photo, (w - pw) / 2, (h - ph) / 2, pw, ph);
      // Oscurece un poco la foto para que la pelota y la barra resalten
      // (la hoguera ya es casi negra, así que no se oscurece)
      layerCtx.fillStyle = `rgba(0,0,0,${themeId === 'ashen' ? 0 : 0.28})`;
      layerCtx.fillRect(0, 0, w, h);
    } else {
      drawClassicBackground(layerCtx, w, h);
    }
    this.particles = [];
    const count = { chief: 18, ashen: 30, slayer: 45 }[this.themeId] ?? 0;
    for (let i = 0; i < count; i++) this.particles.push(this.spawn(true));
  }

  spawn(anywhere = false) {
    const { w, h } = this;
    switch (this.themeId) {
      case 'chief': // estrellas que titilan
        return { x: Math.random() * w, y: Math.random() * h * 0.7, phase: rand(0, TAU), size: rand(1, 2.2) };
      case 'ashen': // brasas que suben de la hoguera
        return {
          x: w / 2 + rand(-w * 0.03, w * 0.03), y: anywhere ? rand(h * 0.3, h * 0.7) : h * 0.66,
          vx: rand(-0.3, 0.3), vy: rand(-0.9, -0.4), life: rand(0.4, 1),
        };
      case 'slayer': // ceniza ardiente desde el suelo
        return {
          x: Math.random() * w, y: anywhere ? Math.random() * h : h + 5,
          vx: rand(-0.4, 0.4), vy: rand(-1.4, -0.5), life: 1, size: rand(1, 2.6),
        };
      default:
        return null;
    }
  }

  update(dt) {
    const scale = this.w / 800;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (this.themeId === 'ashen') {
        p.x += p.vx * dt * scale;
        p.y += p.vy * dt * scale;
        p.life -= 0.006 * dt;
        if (p.life <= 0) this.particles[i] = this.spawn();
      } else if (this.themeId === 'slayer') {
        p.x += (p.vx + Math.sin(p.y / 30) * 0.3) * dt * scale;
        p.y += p.vy * dt * scale;
        if (p.y < this.h * 0.2) p.life -= 0.02 * dt;
        if (p.life <= 0 || p.y < -5) this.particles[i] = this.spawn();
      }
    }
  }

  draw(ctx, t = 0) {
    ctx.drawImage(this.layer, 0, 0, this.w, this.h);
    const { w, h } = this;
    if (this.themeId === 'chief') {
      for (const p of this.particles) {
        ctx.fillStyle = `rgba(200,225,255,${0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + p.phase))})`;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    } else if (this.themeId === 'ashen') {
      for (const p of this.particles) {
        ctx.fillStyle = `rgba(255,${150 + 80 * p.life | 0},80,${p.life})`;
        ctx.fillRect(p.x, p.y, 2 * (w / 800) + 0.5, 2 * (w / 800) + 0.5);
      }
      // Niebla que se desplaza
      for (let i = 0; i < 2; i++) {
        const fx = ((t * 12 * (i + 1)) % (w * 1.6)) - w * 0.3;
        const fog = ctx.createRadialGradient(fx, h * (0.55 + i * 0.2), 0, fx, h * (0.55 + i * 0.2), w * 0.35);
        fog.addColorStop(0, 'rgba(160,150,140,0.10)');
        fog.addColorStop(1, 'rgba(160,150,140,0)');
        ctx.fillStyle = fog;
        ctx.fillRect(0, 0, w, h);
      }
    } else if (this.themeId === 'slayer') {
      for (const p of this.particles) {
        ctx.fillStyle = `rgba(255,${120 + (Math.random() * 80) | 0},40,${p.life})`;
        ctx.fillRect(p.x, p.y, p.size * (w / 800) + 0.5, p.size * (w / 800) + 0.5);
      }
    }
  }
}

const WALLS = {
  classic: { fill: '#6B4F3A', line: '#4A3628', glow: null },
  chief: { fill: '#2E3D52', line: '#1B2533', glow: '#6FD3FF' },
  ashen: { fill: '#4A4540', line: '#2A2622', glow: null },
  slayer: { fill: '#3A1410', line: '#1E0806', glow: '#FF4A1F' },
};

export const WALL_WIDTH = 10;

export function drawWall(ctx, w, h, themeId = 'classic') {
  const style = WALLS[themeId] ?? WALLS.classic;
  const x = w - WALL_WIDTH;
  ctx.save();
  ctx.fillStyle = style.fill;
  ctx.fillRect(x, 0, WALL_WIDTH, h);
  ctx.strokeStyle = style.line;
  ctx.lineWidth = 2;
  for (let y = 0; y < h; y += 30) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  if (style.glow) {
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = 10;
    ctx.fillStyle = style.glow;
    ctx.fillRect(x, 0, 2, h);
  }
  ctx.restore();
}
