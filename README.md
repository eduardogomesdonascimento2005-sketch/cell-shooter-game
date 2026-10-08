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
let best = Number(localStorage.getItem("galacticSiegeBest") || 0);
let state = "menu";
let soundEnabled = true;

const controls = { left: false, right: false, shoot: false };

let player;
let bullets = [];
let enemies = [];
let particles = [];
let stars = [];
let powerUps = [];
let boss = null;
let spawnTimer = 0;
let shootCooldown = 0;
let powerTimer = 0;
let fireRateBoost = 0;
let shieldTime = 0;
let lastEnemySpawn = 0;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, duration, type = "square", gainValue = 0.03) {
  if (!soundEnabled) return;

  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = freq;
  gain.gain.value = gainValue;

  oscillator.connect(gain);
  gain.connect(audioCtx.destination);

  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  oscillator.stop(audioCtx.currentTime + duration);
}

function initStars() {
  stars = [];
  for (let i = 0; i < 70; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 2.2 + 0.8,
      speed: Math.random() * 45 + 20,
    });
  }
}

function resetGame() {
  score = 0;
  bullets = [];
  enemies = [];
  particles = [];
  powerUps = [];
  boss = null;
  spawnTimer = 0.8;
  shootCooldown = 0;
  powerTimer = 0;
  fireRateBoost = 0;
  shieldTime = 0;
  lastEnemySpawn = 0;

  player = {
    x: W / 2,
    y: H - 70,
    w: 42,
    h: 24,
    speed: 250,
    health: 100,
    maxHealth: 100,
    invuln: 0,
  };

  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(Math.max(0, score));
  healthEl.textContent = String(Math.max(0, player.health));
  bestEl.textContent = String(best);
}

function startGame() {
  resetGame();
  state = "playing";
  overlay.classList.remove("visible");
  lastTime = 0;
  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(gameLoop);
  playTone(300, 0.08, "triangle", 0.04);
}

function showOverlay(text, buttonText = "Jogar") {
  overlayText.textContent = text;
  startBtn.textContent = buttonText;
  overlay.classList.add("visible");
}

function endGame() {
  state = "menu";
  best = Math.max(best, score);
  localStorage.setItem("galacticSiegeBest", String(best));
  updateHud();
  showOverlay("Base destruída! Tente outra vez.", "Jogar de Novo");
  playTone(140, 0.3, "sawtooth", 0.06);
}

function fireBullet() {
  if (shootCooldown > 0 || state !== "playing") return;

  const rate = fireRateBoost > 0 ? 0.08 : 0.16;
  bullets.push({
    x: player.x,
    y: player.y - 18,
    w: 6,
    h: 18,
    speed: 430,
    color: fireRateBoost > 0 ? "#7af7bc" : "#ffd166",
  });

  shootCooldown = rate;
  playTone(520, 0.06, "square", 0.025);
}

function spawnEnemy() {
  const size = 22 + Math.random() * 18;
  enemies.push({
    x: Math.random() * (W - size * 2) + size,
    y: -30,
    size,
    speed: 100 + Math.random() * 70 + score * 0.45,
    hp: 1,
    type: "drone",
  });
}

function spawnBoss() {
  if (boss) return;
  boss = {
    x: W / 2,
    y: 90,
    w: 150,
    h: 80,
    hp: 16,
    maxHp: 16,
    speed: 110,
    dir: 1,
    shootTimer: 0,
  };
  playTone(180, 0.18, "sawtooth", 0.05);
}

function spawnPowerUp(type) {
  powerUps.push({
    x: Math.random() * (W - 30) + 15,
    y: -20,
    r: 12,
    speed: 110,
    type,
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

function applyPowerUp(type) {
  if (type === "rapid") {
    fireRateBoost = 6;
  } else if (type === "shield") {
    shieldTime = 7;
  } else if (type === "heal") {
    player.health = Math.min(player.maxHealth, player.health + 35);
  }
  playTone(700, 0.12, "triangle", 0.04);
}

function onPlayerHit(damage) {
  if (shieldTime > 0) {
    damage *= 0.2;
  }

  if (player.invuln > 0) return;

  player.health -= damage;
  player.invuln = 0.7;
  addParticles(player.x, player.y, "#ff5d73", 18);
  playTone(180, 0.09, "sawtooth", 0.03);

  if (player.health <= 0) {
    player.health = 0;
    updateHud();
    endGame();
  }
}

function hitEnemy(enemyIndex, bulletIndex = null) {
  const enemy = enemies[enemyIndex];
  if (!enemy) return;

  enemy.hp -= 1;
  if (bulletIndex !== null) bullets.splice(bulletIndex, 1);

  if (enemy.hp <= 0) {
    score += 10;
    addParticles(enemy.x, enemy.y, "#7af7bc", 18);
    if (Math.random() < 0.18) {
      const types = ["rapid", "shield", "heal"];
      spawnPowerUp(types[Math.floor(Math.random() * types.length)]);
    }
    enemies.splice(enemyIndex, 1);
    playTone(450, 0.08, "triangle", 0.03);
  }

  updateHud();
}

function bossHit(bulletIndex) {
  if (!boss) return;
  boss.hp -= 1;
  bullets.splice(bulletIndex, 1);
  addParticles(player.x, boss.y + 10, "#ffd166", 8);
  playTone(350, 0.08, "square", 0.03);

  if (boss.hp <= 0) {
    score += 100;
    addParticles(boss.x, boss.y, "#9a7bff", 40);
    boss = null;
    playTone(560, 0.2, "triangle", 0.05);
  }
}

function ifBossEnemyCollision() {
  if (!boss) return;
  const bossRect = { x: boss.x - boss.w / 2, y: boss.y - boss.h / 2, w: boss.w, h: boss.h };
  const playerRect = { x: player.x - player.w / 2, y: player.y - player.h / 2, w: player.w, h: player.h };

  if (rectsOverlap(bossRect, playerRect)) {
    onPlayerHit(20);
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    const bulletRect = { x: bullet.x - bullet.w / 2, y: bullet.y - bullet.h / 2, w: bullet.w, h: bullet.h };
    if (rectsOverlap(bossRect, bulletRect)) {
      bossHit(i);
      break;
    }
  }
}

function update(dt) {
  if (state !== "playing") return;

  player.invuln = Math.max(0, player.invuln - dt);
  fireRateBoost = Math.max(0, fireRateBoost - dt);
  shieldTime = Math.max(0, shieldTime - dt);

  if (controls.left) player.x -= player.speed * dt;
  if (controls.right) player.x += player.speed * dt;
  player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));

  shootCooldown -= dt;
  if (shootCooldown < 0) shootCooldown = 0;

  if (controls.shoot) fireBullet();

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.y -= bullet.speed * dt;
    if (bullet.y < -30) bullets.splice(i, 1);
  }

  if (score >= 130 && !boss) {
    spawnBoss();
  }

  if (!boss) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnEnemy();
      spawnTimer = Math.max(0.42, 1.2 - score * 0.008);
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    enemy.y += enemy.speed * dt;

    if (enemy.y > H + 60) {
      enemies.splice(i, 1);
      onPlayerHit(12);
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
      onPlayerHit(20);
      enemies.splice(i, 1);
      addParticles(enemy.x, enemy.y, "#ff5d73", 25);
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

  if (boss) {
    boss.x += boss.speed * boss.dir * dt;
    if (boss.x > W - boss.w / 2 || boss.x < boss.w / 2) {
      boss.dir *= -1;
    }

    boss.shootTimer -= dt;
    if (boss.shootTimer <= 0) {
      const shotAmount = 4;
      for (let i = 0; i < shotAmount; i++) {
        enemies.push({
          x: boss.x + (i - 1.5) * 18,
          y: boss.y + 35,
          size: 14,
          speed: 200,
          hp: 1,
          type: "boss-shot",
          angle: (i - 1.5) * 0.28,
        });
      }
      boss.shootTimer = 1.4;
      playTone(220, 0.09, "sawtooth", 0.03);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.type === "boss-shot") {
        e.x += Math.cos(e.angle) * 180 * dt;
        e.y += 180 * dt;
        if (e.y > H + 20) {
          enemies.splice(i, 1);
        }
      }
    }

    ifBossEnemyCollision();
  }

  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    p.y += p.speed * dt;
    const pRect = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 };
    const playerRect = {
      x: player.x - player.w / 2,
      y: player.y - player.h / 2,
      w: player.w,
      h: player.h,
    };

    if (rectsOverlap(pRect, playerRect)) {
      applyPowerUp(p.type);
      powerUps.splice(i, 1);
      continue;
    }

    if (p.y > H + 30) powerUps.splice(i, 1);
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

  if (shieldTime > 0) {
    addParticles(player.x, player.y + 16, "#58d3ff", 1);
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
  gradient.addColorStop(1, "#020a10");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  for (const star of stars) {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  if (shieldTime > 0) {
    ctx.fillStyle = "rgba(88, 211, 255, 0.22)";
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#58d3ff";
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(18, 18);
  ctx.lineTo(0, 10);
  ctx.lineTo(-18, 18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#7af7bc";
  ctx.fillRect(-8, 18, 16, 10);

  if (player.invuln > 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(-18, -14, 36, 28);
  }

  ctx.restore();
}

function drawBullet(bullet) {
  ctx.fillStyle = bullet.color;
  ctx.fillRect(bullet.x - bullet.w / 2, bullet.y - bullet.h / 2, bullet.w, bullet.h);
}

function drawEnemy(enemy) {
  ctx.fillStyle = enemy.type === "boss-shot" ? "#ff9d6d" : "#ff5d73";
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, enemy.size / 2, 0, Math.PI * 2);
  ctx.fill();

  if (enemy.type !== "boss-shot") {
    ctx.fillStyle = "#ffd1d8";
    ctx.fillRect(enemy.x - 5, enemy.y - 8, 10, 6);
  }
}

function drawBoss() {
  if (!boss) return;
  const x = boss.x;
  const y = boss.y;

  ctx.fillStyle = "#9a7bff";
  ctx.fillRect(x - boss.w / 2, y - boss.h / 2, boss.w, boss.h);

  ctx.fillStyle = "#ffd166";
  ctx.fillRect(x - 45, y - 12, 90, 18);

  ctx.fillStyle = "#ff5d73";
  ctx.fillRect(x - boss.w / 2 + 12, y + 18, boss.w - 24, 15);

  const hpBarWidth = 110;
  const hpRatio = boss.hp / boss.maxHp;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(x - hpBarWidth / 2, y - boss.h / 2 - 18, hpBarWidth, 8);
  ctx.fillStyle = "#7af7bc";
  ctx.fillRect(x - hpBarWidth / 2, y - boss.h / 2 - 18, hpBarWidth * hpRatio, 8);
}

function drawPowerUp(powerUp) {
  const colors = {
    rapid: "#7af7bc",
    shield: "#58d3ff",
    heal: "#ffd166",
  };

  ctx.fillStyle = colors[powerUp.type];
  ctx.beginPath();
  ctx.arc(powerUp.x, powerUp.y, powerUp.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#071722";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  const label = powerUp.type === "rapid" ? "R" : powerUp.type === "shield" ? "S" : "H";
  ctx.fillText(label, powerUp.x, powerUp.y + 4);
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
  drawBoss();
  powerUps.forEach(drawPowerUp);
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
  const key = e.key.toLowerCase();
  if (e.key === "ArrowLeft" || key === "a") controls.left = true;
  if (e.key === "ArrowRight" || key === "d") controls.right = true;
  if (e.key === " " || key === "w" || key === "s") controls.shoot = true;
  if (e.key === "Enter" && state !== "playing") startGame();
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (e.key === "ArrowLeft" || key === "a") controls.left = false;
  if (e.key === "ArrowRight" || key === "d") controls.right = false;
  if (e.key === " " || key === "w" || key === "s") controls.shoot = false;
});

window.addEventListener("pointerdown", () => {
  if (audioCtx.state === "suspended") audioCtx.resume();
});

initStars();
resetGame();
showOverlay("Proteja a base e destrua os invasores.", "Jogar");
updateHud();
draw();
