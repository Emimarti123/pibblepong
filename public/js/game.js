// PibblePong — basado en "Entrenamiento: Pong vs Pared" (código original del proyecto).
// Se conservan los objetos paddle/ball y las funciones update(), resetGame(), draw()
// y gameLoop(). Todo lo agregado está marcado con "MEJORA:".
import { drawPibble, drawPaddle, drawWall, Background, WALL_WIDTH } from "./art.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// MEJORA: el juego siempre calcula en 800x450, pero el canvas se dibuja
// a la resolución real de la pantalla para que se vea nítido.
const WIDTH = 800;
const HEIGHT = 450;
let pixelScale = 1;

// Estado del juego
const paddle = {
    x: 30,
    y: 175,
    width: 16,
    height: 100, // MEJORA: cambia según el modo
    speed: 6,    // MEJORA: cambia según el modo
    dy: 0
};

const ball = {
    x: 400,
    y: 225,
    radius: 20,  // MEJORA: más grande, ahora es un pibble
    speedX: 5,
    speedY: 5,
    speed: 5,    // MEJORA: rapidez total (para calcular ángulos de rebote)
    tilt: 0,     // MEJORA: inclinación del pibble según su movimiento
    squash: 0    // MEJORA: efecto de "aplastado" al rebotar
};

let score = 0;

// MEJORA: estado de la partida, opciones elegidas en el menú y efectos visuales
let state = "idle"; // idle | countdown | playing | paused | ending
let options = null;  // { mode, keys, theme, accent, pointsPerHit }
let callbacks = { onGameOver() {}, onPauseChange() {}, onHit() {} };
let background = null;
let countdown = 0;
let endTimer = 0;
let time = 0;
let lastTime = 0;
let rafId = null;
let particles = [];
let popups = [];

const MAX_BOUNCE_ANGLE = (55 * Math.PI) / 180;
const PAUSE_KEYS = ["Escape", "KeyP"];
const HIT_COLORS = {
    classic: ["#FFF4E6", "#E8C39E", "#F48FB1"],
    chief: ["#FFE49A", "#7C9A4E", "#6FD3FF"],
    ashen: ["#FFB347", "#B3ADA4", "#FFD27A"],
    slayer: ["#FF5A2A", "#FFB347", "#FFE2A0"]
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => min + Math.random() * (max - min);

// Captura de eventos del teclado
// MEJORA: las teclas se eligen en Settings y se recuerdan las que están presionadas,
// así soltar una tecla ya no detiene la paleta si la otra sigue presionada.
const pressed = new Set();

function updatePaddleDirection() {
    const { up, down } = options.keys;
    const direction = (pressed.has(down) ? 1 : 0) - (pressed.has(up) ? 1 : 0);
    paddle.dy = direction * paddle.speed;
}

document.addEventListener("keydown", (e) => {
    if (state === "idle") return;
    // MEJORA: pausa con Esc o P
    if (PAUSE_KEYS.includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) togglePause();
        return;
    }
    if (e.code === options.keys.up || e.code === options.keys.down) {
        e.preventDefault();
        pressed.add(e.code);
        updatePaddleDirection();
    }
});
document.addEventListener("keyup", (e) => {
    if (state === "idle") return;
    if (pressed.delete(e.code)) updatePaddleDirection();
});

// MEJORA: si la ventana pierde el foco, se pausa
window.addEventListener("blur", () => {
    pressed.clear();
    if (state !== "idle") updatePaddleDirection();
    pause();
});

// MEJORA: al cambiar el tamaño de la ventana se ajusta la resolución del canvas
window.addEventListener("resize", () => {
    if (state !== "idle" && updateResolution()) {
        background = new Background(options.theme, WIDTH, HEIGHT, pixelScale);
    }
});

// Lógica de físicas y colisiones
// MEJORA: dt = cuántos "frames de 60 fps" pasaron, para que la velocidad sea igual en cualquier monitor
function update(dt) {
    if (state === "paused" || state === "idle") return;
    time += dt / 60;
    background.update(dt);
    updateEffects(dt);

    // MEJORA: pequeña espera tras perder para ver al pibble salir
    if (state === "ending") {
        endTimer -= dt / 60;
        if (endTimer <= 0) finish();
        return;
    }

    // 1. Movimiento de la paleta
    paddle.y += paddle.dy * dt;

    // Limitar la paleta para que no salga del Canvas
    if (paddle.y < 0) paddle.y = 0;
    if (paddle.y + paddle.height > HEIGHT) paddle.y = HEIGHT - paddle.height;

    // MEJORA: cuenta regresiva antes de que la pelota se mueva
    if (state === "countdown") {
        countdown -= dt / 60;
        if (countdown <= 0) state = "playing";
        return;
    }

    const mode = options.mode;
    const prevX = ball.x;
    const prevY = ball.y;

    // 2. Movimiento de la pelota
    ball.x += ball.speedX * dt;
    ball.y += ball.speedY * dt;

    // Rebote superior e inferior
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > HEIGHT) {
        ball.speedY *= -1;
        // MEJORA: se regresa la pelota adentro para que no se quede pegada al borde
        ball.y = clamp(ball.y, ball.radius, HEIGHT - ball.radius);
    }

    // Rebote en la pared derecha (simulando el modo práctica)
    // MEJORA: rebota en la cara de la pared dibujada, no en el borde del canvas
    if (ball.x + ball.radius > WIDTH - WALL_WIDTH) {
        ball.speedX *= -1;
        ball.x = WIDTH - WALL_WIDTH - ball.radius;
        // MEJORA: en el modo Nightmare la pared desvía la pelota al azar
        if (mode.randomBounce) {
            const angle = Math.atan2(ball.speedY, Math.abs(ball.speedX)) + rand(-0.4, 0.4);
            setBallDirection(clamp(angle, -MAX_BOUNCE_ANGLE, MAX_BOUNCE_ANGLE), -1);
        }
        ball.squash = 1;
    }

    // 3. Colisión de la pelota con la paleta
    const touchingPaddle =
        ball.x - ball.radius < paddle.x + paddle.width &&
        ball.x + ball.radius > paddle.x &&
        ball.y > paddle.y &&
        ball.y < paddle.y + paddle.height;

    // MEJORA: a alta velocidad la pelota podía atravesar la paleta entre un frame y otro,
    // así que también se revisa si cruzó la cara de la paleta en este frame
    const face = paddle.x + paddle.width;
    let hitY = ball.y;
    let crossedPaddle = false;
    if (prevX - ball.radius >= face - 1 && ball.x - ball.radius < face) {
        hitY = prevY + (ball.y - prevY) * clamp((prevX - ball.radius - face) / (prevX - ball.x), 0, 1);
        const reach = ball.radius * 0.7;
        crossedPaddle = hitY + reach > paddle.y && hitY - reach < paddle.y + paddle.height;
    }

    if (ball.speedX < 0 && (touchingPaddle || crossedPaddle)) {
        // Aumentar ligeramente la velocidad para dar progresión al juego
        ball.speed = Math.min(ball.speed + mode.speedUpPerHit, mode.ballSpeed * mode.maxSpeedFactor);
        // MEJORA: el ángulo de salida depende de en qué parte de la paleta pega
        const offset = clamp((hitY - (paddle.y + paddle.height / 2)) / (paddle.height / 2), -1, 1);
        let angle = offset * MAX_BOUNCE_ANGLE;
        if (mode.randomBounce) angle = clamp(angle + rand(-0.25, 0.25), -MAX_BOUNCE_ANGLE, MAX_BOUNCE_ANGLE);
        setBallDirection(angle, 1); // equivale a ball.speedX *= -1 con el nuevo ángulo
        ball.x = paddle.x + paddle.width + ball.radius; // Evitar que la pelota se "atasque"
        ball.y = hitY;
        ball.squash = 1;
        // MEJORA: los puntos por golpe se eligen en Settings
        score += options.pointsPerHit;
        // MEJORA: chispas, "+N" flotante y sonido de impacto
        burst(ball.x - ball.radius, ball.y);
        popups.push({ x: ball.x + 10, y: ball.y - 20, text: `+${options.pointsPerHit}`, life: 1 });
        callbacks.onHit((ball.speed - mode.ballSpeed) / (mode.ballSpeed * (mode.maxSpeedFactor - 1) || 1));
    }

    // MEJORA: el pibble se inclina según su movimiento y se recupera del "aplastado"
    ball.tilt += (clamp(ball.speedY * 0.05, -0.5, 0.5) - ball.tilt) * 0.2 * dt;
    ball.squash = Math.max(0, ball.squash - 0.08 * dt);

    // 4. Reinicio si la pelota sale por la izquierda
    // MEJORA: en vez de reiniciar en silencio, termina la partida y se muestra el Game Over
    if (ball.x < 0) {
        state = "ending";
        endTimer = 0.6;
    }
}

// MEJORA: apunta la pelota con un ángulo; dirX = 1 hacia la pared, -1 hacia la paleta
function setBallDirection(angle, dirX) {
    ball.speedX = Math.cos(angle) * ball.speed * dirX;
    ball.speedY = Math.sin(angle) * ball.speed;
}

// Función para reiniciar el estado
function resetGame() {
    const mode = options.mode;
    ball.x = WIDTH / 2;
    ball.y = HEIGHT / 2;
    // MEJORA: la velocidad depende del modo y el saque sale con un ángulo aleatorio hacia la pared
    ball.speed = mode.ballSpeed;
    setBallDirection(rand(-0.5, 0.5), 1);
    ball.tilt = 0;
    ball.squash = 0;
    score = 0;
    // MEJORA: tamaño y velocidad de la paleta según el modo
    paddle.height = mode.paddleHeight;
    paddle.speed = mode.paddleSpeed;
    paddle.y = (HEIGHT - paddle.height) / 2;
    pressed.clear();
    paddle.dy = 0;
    // MEJORA: efectos, cuenta regresiva y reloj de animación
    particles = [];
    popups = [];
    time = 0;
    countdown = 3;
    state = "countdown";
}

// Dibujo de los elementos en el Canvas
function draw() {
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    ctx.imageSmoothingQuality = "high";

    // Limpiar el fotograma anterior
    // MEJORA: el fondo animado del tema cubre todo el canvas en cada frame
    background.draw(ctx, time);

    // Dibujar pared derecha (visual)
    drawWall(ctx, WIDTH, HEIGHT, options.theme);

    // Dibujar paleta
    drawPaddle(ctx, paddle.x, paddle.y, paddle.width, paddle.height, options.theme);

    // MEJORA: chispas del impacto
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Dibujar pelota
    // MEJORA: la pelota es el pibble del tema, con inclinación y "aplastado" al rebotar
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.scale(1 - ball.squash * 0.15, 1 + ball.squash * 0.1);
    drawPibble(ctx, 0, 0, ball.radius, options.theme, ball.tilt);
    ctx.restore();

    // MEJORA: "+N" flotante en cada golpe
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const pop of popups) {
        ctx.globalAlpha = pop.life;
        outlinedText(pop.text, pop.x, pop.y, "16px 'Press Start 2P'", "#FFE49A");
    }
    ctx.globalAlpha = 1;

    // Dibujar marcador
    // MEJORA: estilo arcade, con el modo y los controles de pausa
    const accent = options.accent;
    outlinedText(String(score).padStart(4, "0"), WIDTH / 2, 40, "28px 'Press Start 2P'", "#FFFFFF");
    ctx.textAlign = "left";
    outlinedText(`${options.mode.name.toUpperCase()} · +${options.pointsPerHit}`, 54, 24, "22px 'VT323', monospace", accent);
    ctx.textAlign = "right";
    outlinedText("ESC · PAUSE", WIDTH - 24, 24, "22px 'VT323', monospace", accent);

    // MEJORA: cuenta regresiva
    if (state === "countdown") {
        ctx.textAlign = "center";
        outlinedText(String(Math.ceil(countdown)), WIDTH / 2, HEIGHT / 2, "64px 'Press Start 2P'", "#FFFFFF");
    }
}

// MEJORA: texto con contorno para que se lea sobre cualquier fondo
function outlinedText(str, x, y, font, color) {
    ctx.font = font;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(20,14,12,0.85)";
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
}

// MEJORA: chispas al golpear la paleta
function burst(x, y) {
    const colors = HIT_COLORS[options.theme] ?? HIT_COLORS.classic;
    for (let i = 0; i < 14; i++) {
        const a = rand(-Math.PI / 2, Math.PI / 2);
        const s = rand(1.5, 4.5);
        particles.push({
            x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1,
            color: colors[i % colors.length], size: rand(2, 4.5)
        });
    }
}

function updateEffects(dt) {
    for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.08 * dt;
        p.life -= 0.03 * dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const pop of popups) {
        pop.y -= 0.8 * dt;
        pop.life -= 0.02 * dt;
    }
    popups = popups.filter((pop) => pop.life > 0);
}

// Bucle de animación principal
function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / (1000 / 60), 3);
    lastTime = timestamp;
    update(dt);
    draw();
    if (state !== "idle") rafId = requestAnimationFrame(gameLoop);
}

// MEJORA: ajusta la resolución interna del canvas al tamaño real en pantalla
function updateResolution() {
    const cssWidth = canvas.getBoundingClientRect().width || WIDTH;
    const scale = Math.max(1, (cssWidth * (window.devicePixelRatio || 1)) / WIDTH);
    if (Math.abs(scale - pixelScale) < 0.01 && background) return false;
    pixelScale = scale;
    canvas.width = Math.round(WIDTH * scale);
    canvas.height = Math.round(HEIGHT * scale);
    return true;
}

function finish() {
    const finalScore = score;
    stop();
    callbacks.onGameOver({ score: finalScore, mode: options.mode, pointsPerHit: options.pointsPerHit });
}

function togglePause() {
    if (state === "paused") resume();
    else pause();
}

// ============================================================
// MEJORA: control del juego desde el menú
// ============================================================

/** Registra las funciones que el menú quiere escuchar (fin de partida, pausa, golpe). */
export function setup(handlers) {
    callbacks = { ...callbacks, ...handlers };
}

// Iniciar el juego
// MEJORA: ya no arranca solo al cargar la página; el menú lo inicia con las opciones elegidas
export function start(newOptions) {
    stop();
    options = newOptions;
    background = null;
    updateResolution();
    background = new Background(options.theme, WIDTH, HEIGHT, pixelScale);
    resetGame();
    lastTime = performance.now();
    rafId = requestAnimationFrame(gameLoop);
}

export function restart() {
    start(options);
}

export function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    state = "idle";
}

export function pause() {
    if (state !== "playing" && state !== "countdown") return;
    state = "paused";
    pressed.clear();
    paddle.dy = 0;
    callbacks.onPauseChange(true);
}

export function resume() {
    if (state !== "paused") return;
    // Pequeña cuenta regresiva para que el jugador se prepare
    countdown = 1;
    state = "countdown";
    lastTime = performance.now();
    callbacks.onPauseChange(false);
}
