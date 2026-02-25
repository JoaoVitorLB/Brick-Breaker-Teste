const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesContainer = document.getElementById('lives-container');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');

// Configurações do Canvas
canvas.width = 800;
canvas.height = 600;

// Estado do Jogo
let score = 0;
let lives = 3;
let gameRunning = false;
let animationId;

// Entidades
let paddle, ball, bricks, particles;

const COLORS = {
    1: ['#00f2ff', '#0097a7'], // Cyan - 1 hit
    2: ['#7000ff', '#4a00aa'], // Purple - 2 hits
    3: ['#ff007a', '#aa0051'], // Pink - 3 hits
    paddle: '#ffffff',
    ball: '#ffffff',
    particle: '#ffffff'
};

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() - 0.5) * 8;
        this.speedY = (Math.random() - 0.5) * 8;
        this.alpha = 1;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.alpha -= 0.02;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Paddle {
    constructor() {
        this.width = 120;
        this.height = 15;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - 40;
        this.color = COLORS.paddle;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 8);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    update(mouseX) {
        const rect = canvas.getBoundingClientRect();
        const root = document.documentElement;
        this.x = mouseX - rect.left - root.scrollLeft - this.width / 2;

        // Limites
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
    }
}

class Ball {
    constructor() {
        this.reset();
    }

    reset() {
        this.radius = 8;
        this.x = canvas.width / 2;
        this.y = canvas.height - 60;
        this.speedX = (Math.random() - 0.5) * 10;
        this.speedY = -6;
        this.color = COLORS.ball;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Colisões com paredes
        if (this.x + this.radius > canvas.width || this.x - this.radius < 0) {
            this.speedX *= -1;
            createExplosion(this.x, this.y, this.color, 5);
        }
        if (this.y - this.radius < 0) {
            this.speedY *= -1;
            createExplosion(this.x, this.y, this.color, 5);
        }

        // Queda (morte)
        if (this.y + this.radius > canvas.height) {
            handleLifeLoss();
        }

        // Colisão com Paddle
        if (this.y + this.radius > paddle.y &&
            this.y - this.radius < paddle.y + paddle.height &&
            this.x > paddle.x &&
            this.x < paddle.x + paddle.width) {

            // Ângulo baseado no ponto de impacto
            let collidePoint = this.x - (paddle.x + paddle.width / 2);
            collidePoint = collidePoint / (paddle.width / 2);
            let angle = collidePoint * (Math.PI / 3); // Max 60 graus

            this.speedY = -Math.abs(this.speedY) * 1.05; // Aumenta velocidade levemente
            this.speedX = Math.sin(angle) * 10;

            this.y = paddle.y - this.radius; // Corrigir sobreposição
            createExplosion(this.x, this.y, this.color, 8);
        }
    }
}

class Brick {
    constructor(x, y, health) {
        this.x = x;
        this.y = y;
        this.width = 70;
        this.height = 25;
        this.health = health;
        this.status = 1;
    }

    draw() {
        if (this.status === 0) return;

        const colors = COLORS[this.health];
        const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        gradient.addColorStop(0, colors[0]);
        gradient.addColorStop(1, colors[1]);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 4);
        ctx.fill();

        // Brilho interno
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    hit() {
        this.health--;
        score += 100;
        updateUI();
        createExplosion(this.x + this.width / 2, this.y + this.height / 2, COLORS[this.health + 1][0], 15);

        if (this.health <= 0) {
            this.status = 0;
            score += 500;
        }
    }
}

// Funções Auxiliares
function createExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function initBricks() {
    bricks = [];
    const rows = 5;
    const cols = 9;
    const padding = 10;
    const offsetTop = 80;
    const offsetLeft = 45;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const bx = (c * (70 + padding)) + offsetLeft;
            const by = (r * (25 + padding)) + offsetTop;
            // Cores por linha: 2 linhas de 3 hits, 2 de 2 hits, 1 de 1 hit
            let health = 1;
            if (r < 2) health = 3;
            else if (r < 4) health = 2;

            bricks.push(new Brick(bx, by, health));
        }
    }
}

function updateUI() {
    scoreEl.innerText = score.toString().padStart(4, '0');
    livesContainer.innerHTML = '';
    for (let i = 0; i < lives; i++) {
        const dot = document.createElement('div');
        dot.className = 'life-dot';
        livesContainer.appendChild(dot);
    }
}

function handleLifeLoss() {
    lives--;
    updateUI();
    if (lives <= 0) {
        endGame('GAME OVER', 'Sua persistência foi notável, mas os blocos venceram.');
    } else {
        ball.reset();
    }
}

function checkWin() {
    if (bricks.every(b => b.status === 0)) {
        endGame('VITÓRIA!', 'Você destruiu todos os núcleos de energia!');
    }
}

function endGame(title, msg) {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    overlayTitle.innerText = title;
    overlayMsg.innerText = msg;
    overlay.classList.remove('hidden');
}

function init() {
    paddle = new Paddle();
    ball = new Ball();
    particles = [];
    initBricks();
    score = 0;
    lives = 3;
    updateUI();
}

function gameLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update & Draw
    paddle.draw();
    ball.update();
    ball.draw();

    bricks.forEach(brick => {
        if (brick.status === 1) {
            brick.draw();

            // Colisão Ball vs Brick
            if (ball.x + ball.radius > brick.x &&
                ball.x - ball.radius < brick.x + brick.width &&
                ball.y + ball.radius > brick.y &&
                ball.y - ball.radius < brick.y + brick.height) {

                brick.hit();
                ball.speedY *= -1;
                checkWin();
            }
        }
    });

    particles.forEach((p, index) => {
        p.update();
        p.draw();
        if (p.alpha <= 0) particles.splice(index, 1);
    });

    animationId = requestAnimationFrame(gameLoop);
}

// Event Listeners
window.addEventListener('mousemove', (e) => {
    if (gameRunning) paddle.update(e.clientX);
});

startBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    init();
    gameRunning = true;
    gameLoop();
});

// Inicializar UI vazia
updateUI();
