const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const healthEl = document.getElementById("health");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const startBtn = document.getElementById("startBtn");

const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const shootBtn = document.getElementById("shootBtn");

const W = canvas.width;
const H = canvas.height;

let animationId = null;
let lastTime = 0;
let score = 0;
let best = Number(localStorage.getItem("mobileShooterBest") || 0);
let state = "ready";

let player;
let bullets = [];
let enemies = [];
let particles = [];
let stars = [];
let spawnTimer = 0;
let shootCooldown = 0;

const controls = {
  left: false,
  right: false,
  shoot: false,
};

function initStars() {
  stars = [];
  for (let i = 0; i < 50; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 2.2 + 0.8,
      speed: Math.random() * 50 + 30,
    });
  }
}

function resetGame() {
  score = 0;
  bullets = [];
  enemies = [];
  particles = [];
  spawnTimer = 0;
  shootCooldown = 0;

  player = {
    x: W / 2,
    y: H - 70,
    w: 42,
    h: 24,
    speed: 250,
    health: 100,
  };

  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(score);
  healthEl.textContent = String(Math.max(0, player.health));
  bestEl.textContent = String(best);
}

function startGame() {
  resetGame();
  state = "playing";
  overlay.classList.add("hidden");
  lastTime = 0;
  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(gameLoop);
}

function endGame() {
  state = "gameover";
  best = Math.max(best, score);
  localStorage.setItem("mobileShooterBest", String(best));
  updateHud();

  overlayText.textContent = "Você foi atingido! Tentar novamente?";
  overlay.classList.remove("hidden");
  startBtn.textContent = "Jogar de Novo";
}

function fireBullet() {
  if (shootCooldown > 0 || state !== "playing") return;

  bullets.push({
    x: player.x,
    y: player.y - 16,
    w: 6,
    h: 18,
    speed: 420,
  });

  shootCooldown = 0.18;
}

function spawnEnemy() {
  const size = 22 + Math.random() * 18;
  enemies.push({
    x: Math.random() * (W - size * 2) + size,
    y: -30,
    size,
    speed: 110 + Math.random() * 90 + score * 0.8,
  });
}

function addParticles(x, y, color, amount = 12) {
  for (let i = 0; i < amount; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200,
      life: 0.6 + Math.random() * 0.5,
      r: Math.random() * 3 + 2,
      color,
    });
  }
}

function hitEnemy(enemyIndex, bulletIndex = null) {
  const enemy = enemies[enemyIndex];
  if (!enemy) return;

  score += 10;
  addParticles(enemy.x, enemy.y, "#7ef0b9", 18);
  enemies.splice(enemyIndex, 1);

  if (bulletIndex !== null) {
    bullets.splice(bulletIndex, 1);
  }

  updateHud();
}

function update(dt) {
  if (state !== "playing") return;

  if (controls.left) player.x -= player.speed * dt;
  if (controls.right) player.x += player.speed * dt;

  player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));

  shootCooldown -= dt;
  if (shootCooldown < 0) shootCooldown = 0;

  if (controls.shoot) {
    fireBullet();
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.y -= bullet.speed * dt;
    if (bullet.y < -30) bullets.splice(i, 1);
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnEnemy();
    spawnTimer = Math.max(0.45, 1.15 - score * 0.01);
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    enemy.y += enemy.speed * dt;

    if (enemy.y > H + 40) {
      enemies.splice(i, 1);
      player.health -= 15;
      addParticles(enemy.x, enemy.y, "#ff5d73", 12);
      if (player.health <= 0) {
        player.health = 0;
        updateHud();
        endGame();
      }
      continue;
    }

    const enemyRect = {
      x: enemy.x - enemy.size / 2,
      y: enemy.y - enemy.size / 2,
      w: enemy.size,
      h: enemy.size,
    };

    const playerRect = {
      x: player.x - player.w / 2,
      y: player.y - player.h / 2,
      w: player.w,
      h: player.h,
    };

    if (rectsOverlap(enemyRect, playerRect)) {
      player.health -= 25;
      enemies.splice(i, 1);
      addParticles(enemy.x, enemy.y, "#ff5d73", 25);

      if (player.health <= 0) {
        player.health = 0;
        updateHud();
        endGame();
      }
      continue;
    }

    for (let j = bullets.length - 1; j >= 0; j--) {
      const bullet = bullets[j];
      const bulletRect = {
        x: bullet.x - bullet.w / 2,
        y: bullet.y - bullet.h / 2,
        w: bullet.w,
        h: bullet.h,
      };

      if (rectsOverlap(enemyRect, bulletRect)) {
        hitEnemy(i, j);
        break;
      }
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (const star of stars) {
    star.y += star.speed * dt;
    if (star.y > H) {
      star.y = -10;
      star.x = Math.random() * W;
    }
  }

  updateHud();
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function drawBackground() {
  ctx.clearRect(0, 0, W, H);

  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#071421");
  gradient.addColorStop(1, "#030c12");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (const star of stars) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.fillStyle = "#56e0ff";
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(18, 18);
  ctx.lineTo(0, 10);
  ctx.lineTo(-18, 18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#7ef0b9";
  ctx.fillRect(-8, 18, 16, 10);

  ctx.fillStyle = "rgba(86, 224, 255, 0.18)";
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBullet(bullet) {
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(bullet.x - bullet.w / 2, bullet.y - bullet.h / 2, bullet.w, bullet.h);
}

function drawEnemy(enemy) {
  ctx.fillStyle = "#ff5d73";
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, enemy.size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffd1d8";
  ctx.fillRect(enemy.x - 5, enemy.y - 8, 10, 6);
}

function drawParticles() {
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function draw() {
  drawBackground();
  bullets.forEach(drawBullet);
  enemies.forEach(drawEnemy);
  drawParticles();
  drawPlayer();
}

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  update(dt);
  draw();

  if (state === "playing") {
    animationId = requestAnimationFrame(gameLoop);
  }
}

function bindTouchButton(button, key) {
  const press = (event) => {
    event.preventDefault();
    controls[key] = true;
  };
  const release = (event) => {
    event.preventDefault();
    controls[key] = false;
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointerleave", release);
  button.addEventListener("pointercancel", release);
}

bindTouchButton(leftBtn, "left");
bindTouchButton(rightBtn, "right");
bindTouchButton(shootBtn, "shoot");

startBtn.addEventListener("click", () => {
  startGame();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") controls.left = true;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") controls.right = true;
  if (e.key === " " || e.key.toLowerCase() === "w" || e.key.toLowerCase() === "s") {
    controls.shoot = true;
  }
  if (e.key === "Enter" && state !== "playing") startGame();
});

window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") controls.left = false;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") controls.right = false;
  if (e.key === " " || e.key.toLowerCase() === "w" || e.key.toLowerCase() === "s") {
    controls.shoot = false;
  }
});

initStars();
resetGame();
draw();
updateHud();
