const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
// Estado del juego
const paddle = {
    x: 30,
    y: 175,
    width: 15,
    height: 100,
    speed: 6,
    dy: 0
};

const ball = {
    x: 400,
    y: 225,
    radius: 10,
    speedX: 5,
    speedY: 5
};

let score = 0;
// Captura de eventos del teclado
document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        paddle.dy = -paddle.speed;
    } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        paddle.dy = paddle.speed;
    }
});
document.addEventListener("keyup", (e) => {
    if (
        e.key === "ArrowUp" || e.key === "ArrowDown" ||
        e.key === "w" || e.key === "s" || e.key === "W" || e.key === "S"
    ) {
        paddle.dy = 0;
    }
});
// Lógica de físicas y colisiones
function update() {
    // 1. Movimiento de la paleta
    paddle.y += paddle.dy;

    // Limitar la paleta para que no salga del Canvas
    if (paddle.y < 0) paddle.y = 0;
    if (paddle.y + paddle.height > canvas.height) paddle.y = canvas.height - paddle.height;

    // 2. Movimiento de la pelota
    ball.x += ball.speedX;
    ball.y += ball.speedY;

    // Rebote superior e inferior
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
        ball.speedY *= -1;
    }

    // Rebote en la pared derecha (simulando el modo práctica)
    if (ball.x + ball.radius > canvas.width) {
        ball.speedX *= -1;
    }
    // 3. Colisión de la pelota con la paleta
    if (
        ball.x - ball.radius < paddle.x + paddle.width &&
        ball.x + ball.radius > paddle.x &&
        ball.y > paddle.y &&
        ball.y < paddle.y + paddle.height
    ) {
        ball.speedX *= -1;
        // Aumentar ligeramente la velocidad para dar progresión al juego
        ball.speedX += (ball.speedX > 0) ? 0.2 : -0.2;
        ball.x = paddle.x + paddle.width + ball.radius; // Evitar que la pelota se "atasque"
        score++;
    }
    // 4. Reinicio si la pelota sale por la izquierda
    if (ball.x < 0) {
        resetGame();
    }
}

// Función para reiniciar el estado
function resetGame() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speedX = 5;
    ball.speedY = 5;
    score = 0;
}

// Dibujo de los elementos en el Canvas
function draw() {
    // Limpiar el fotograma anterior
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar pared derecha (visual)
    ctx.fillStyle = "#555";
    ctx.fillRect(canvas.width - 10, 0, 10, canvas.height);

    // Dibujar paleta
    ctx.fillStyle = "#fff";
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);

    // Dibujar pelota
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.closePath();

    // Dibujar marcador
    ctx.font = "30px Arial";
    ctx.fillText("Puntos: " + score, canvas.width / 2 - 60, 40);
}

// Bucle de animación principal
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Iniciar el juego
gameLoop();
