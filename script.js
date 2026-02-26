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
let paddle;
let balls = [];
let bricks = [];
let particles = [];
let powerUps = [];

const COLORS = {
    1: ['#00f2ff', '#0097a7'], // Cyan - 1 hit
    2: ['#7000ff', '#4a00aa'], // Purple - 2 hits
    3: ['#ff007a', '#aa0051'], // Pink - 3 hits
    4: ['#ff9d00', '#c17700'], // Orange - 4 hits (nova camada)
    paddle: '#ffffff',
    ball: '#ffffff',
    powerUpExpand: '#00ff88',
    powerUpExtra: '#ffdd00'
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

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'expand' ou 'extra'
        this.width = 30;
        this.height = 15;
        this.speed = 3;
        this.color = type === 'expand' ? COLORS.powerUpExpand : COLORS.powerUpExtra;
    }

    update() {
        this.y += this.speed;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.roundRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height, 10);
        ctx.fill();

        // Ícone simples
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.font = '10px Arial bold';
        ctx.fillText(this.type === 'expand' ? '↔' : '+●', this.x, this.y + 4);
        ctx.shadowBlur = 0;
    }
}

class Paddle {
    constructor() {
        this.baseWidth = 120;
        this.width = this.baseWidth;
        this.height = 15;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - 40;
        this.color = COLORS.paddle;
        this.expandTimer = 0;
        this.speed = 10; // Velocidade da paleta
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

    update() {
        // Movimento por teclas
        if (keys.a || keys.A || keys.ArrowLeft) {
            this.x -= this.speed;
        }
        if (keys.d || keys.D || keys.ArrowRight) {
            this.x += this.speed;
        }

        // Limites do canvas
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;

        // Gerenciar tempo da expansão
        if (this.expandTimer > 0) {
            this.expandTimer--;
            if (this.expandTimer <= 0) {
                this.width = this.baseWidth;
            }
        }
    }

    expand() {
        this.width = this.baseWidth * 1.6;
        this.expandTimer = 600; // ~10 segundos a 60fps
    }
}

class Ball {
    constructor(x, y, speedX, speedY) {
        this.radius = 8;
        this.x = x || canvas.width / 2;
        this.y = y || canvas.height - 60;
        this.speedX = speedX || (Math.random() - 0.5) * 10;
        this.speedY = speedY || -6;
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

        // Colisões com paredes (com correção de posição para evitar bugs)
        // Parede Direita
        if (this.x + this.radius > canvas.width) {
            this.x = canvas.width - this.radius; // Reposiciona na borda
            this.speedX = -Math.abs(this.speedX); // Garante que vá para a esquerda
            createExplosion(this.x, this.y, this.color, 5);
        }
        // Parede Esquerda
        else if (this.x - this.radius < 0) {
            this.x = this.radius; // Reposiciona na borda
            this.speedX = Math.abs(this.speedX); // Garante que vá para a direita
            createExplosion(this.x, this.y, this.color, 5);
        }

        // Teto
        if (this.y - this.radius < 0) {
            this.y = this.radius; // Reposiciona na borda
            this.speedY = Math.abs(this.speedY); // Garante que vá para baixo
            createExplosion(this.x, this.y, this.color, 5);
        }



        // Colisão com Paddle
        if (this.y + this.radius > paddle.y &&
            this.y - this.radius < paddle.y + paddle.height &&
            this.x > paddle.x &&
            this.x < paddle.x + paddle.width) {

            let collidePoint = this.x - (paddle.x + paddle.width / 2);
            collidePoint = collidePoint / (paddle.width / 2);
            let angle = collidePoint * (Math.PI / 3);

            this.speedY = -Math.abs(this.speedY) * 1.02;
            this.speedX = Math.sin(angle) * 10;
            this.y = paddle.y - this.radius;
            createExplosion(this.x, this.y, this.color, 8);
        }
    }
}

class Brick {
    constructor(x, y, width, height, health) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.health = health;
        this.status = 1;
    }

    draw() {
        if (this.status === 0) return;

        const colors = COLORS[this.health] || COLORS[1];
        const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        gradient.addColorStop(0, colors[0]);
        gradient.addColorStop(1, colors[1]);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 4);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    hit() {
        this.health--;
        score += 100;
        createExplosion(this.x + this.width / 2, this.y + this.height / 2, COLORS[this.health + 1][0], 10);

        if (this.health <= 0) {
            this.status = 0;
            score += 500;
            updateUI();

            // Chance de soltar Power-up (15%)
            if (Math.random() < 0.15) {
                const type = Math.random() < 0.5 ? 'expand' : 'extra';
                powerUps.push(new PowerUp(this.x + this.width / 2, this.y + this.height / 2, type));
            }
        }
    }
}

function createExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function initBricks() {
    bricks = [];
    const cols = 14; // Mais colunas
    const rows = 9;  // Mais linhas
    const padding = 4;
    const offsetTop = 60;

    // Calcula largura exata para ocupar o espaço inteiro (800px)
    const brickWidth = (canvas.width - (cols + 1) * padding) / cols;
    const brickHeight = 20;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const bx = c * (brickWidth + padding) + padding;
            const by = r * (brickHeight + padding) + offsetTop;

            let health = 1;
            if (r < 2) health = 4;
            else if (r < 4) health = 3;
            else if (r < 7) health = 2;

            bricks.push(new Brick(bx, by, brickWidth, brickHeight, health));
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

function endGame(title, msg) {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    overlayTitle.innerText = title;
    overlayMsg.innerText = msg;
    overlay.classList.remove('hidden');
}

function init() {
    paddle = new Paddle();
    balls = [new Ball()];
    powerUps = [];
    particles = [];
    initBricks();
    score = 0;
    lives = 3;
    updateUI();
}

// Sistema de Teclas
let keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

function gameLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    paddle.update(); // Atualiza movimento por teclado
    paddle.draw();

    // Bolas
    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];
        ball.update();
        ball.draw();

        // Verificar se a bola caiu
        if (ball.y - ball.radius > canvas.height) {
            balls.splice(i, 1);

            // Se foi a última bola a cair do nível
            if (balls.length === 0) {
                lives--;
                updateUI();

                if (lives <= 0) {
                    endGame('GAME OVER', 'Sua persistência foi notável.');
                    return; // Para o loop aqui
                } else {
                    // Cria uma nova bola na posição inicial
                    balls.push(new Ball());
                }
            }
            continue; // Pula a colisão de tijolos para esta bola que já saiu
        }

        // Colisão com Blocos
        for (let j = bricks.length - 1; j >= 0; j--) {
            const brick = bricks[j];
            if (brick.status === 1) {
                if (ball.x + ball.radius > brick.x &&
                    ball.x - ball.radius < brick.x + brick.width &&
                    ball.y + ball.radius > brick.y &&
                    ball.y - ball.radius < brick.y + brick.height) {

                    brick.hit();
                    ball.speedY *= -1;

                    if (bricks.every(b => b.status === 0)) {
                        endGame('VITÓRIA!', 'Você destruiu tudo!');
                        return;
                    }
                    break; // Uma bola só atinge um tijolo por frame
                }
            }
        }
    }

    // Power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const p = powerUps[i];
        p.update();
        p.draw();

        // Colisão com Paddle
        if (p.y + p.height / 2 > paddle.y &&
            p.y - p.height / 2 < paddle.y + paddle.height &&
            p.x > paddle.x &&
            p.x < paddle.x + paddle.width) {

            if (p.type === 'expand') paddle.expand();
            if (p.type === 'extra') balls.push(new Ball(paddle.x + paddle.width / 2, paddle.y - 10));

            powerUps.splice(i, 1);
            score += 200;
            updateUI();
        } else if (p.y > canvas.height) {
            powerUps.splice(i, 1);
        }
    }

    // Tijolos
    bricks.forEach(brick => brick.draw());

    // Partículas
    particles.forEach((p, index) => {
        p.update();
        p.draw();
        if (p.alpha <= 0) particles.splice(index, 1);
    });

    animationId = requestAnimationFrame(gameLoop);
}

startBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    init();
    gameRunning = true;
    gameLoop();
});

updateUI();
