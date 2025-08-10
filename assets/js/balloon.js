// Balloon Shooter — usando ponta do dedo indicador como mira

// ====== Elementos ======
const video = document.getElementById('video');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const retryBtn = document.getElementById('retryBtn');
const stopBtn = document.getElementById('stopBtn');
const helpBox = document.getElementById('helpBox');
const debugEl = document.getElementById('debug');
const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const levelEl = document.getElementById('level');
const modal = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const playAgainBtn = document.getElementById('playAgainBtn');

// ====== Estado ======
let camera = null;
let hands = null;
let handsReady = false;
let processingFrame = false;
let score = 0;
let remaining = 60; // segundos
let level = 1;
let gameInterval = null; // timer do jogo
let spawnAccumulator = 0; // ms acumulados para spawn
let rafId = null;
const balloons = []; // {x,y,r,color,kind:'green'|'red',vx,vy,alive}
let lastTs = 0;
let pointer = { x: canvas.width / 2, y: canvas.height / 2, visible: false };
// reinit agressivo removido para evitar conflitos do módulo WASM

// ====== UI ======
function writeDebug(msg) {
  const t = new Date().toLocaleTimeString();
  debugEl.textContent = `[${t}] ` + msg + "\n" + debugEl.textContent;
}
function showHelp(message, type) {
  helpBox.innerHTML = message;
  if (type === 'danger') helpBox.style.color = '#b00020';
  else if (type === 'ok') helpBox.style.color = 'green';
  else helpBox.style.color = '#333';
}

// ====== Game helpers ======
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max)); }
const BALLOON_GREEN = '#34d399';
const BALLOON_RED = '#ef4444';

function spawnBalloon() {
  const r = rand(18, 34) * (1 + (level - 1) * 0.05);
  const x = rand(r + 10, canvas.width - r - 10);
  const y = canvas.height + r + 10;
  const speed = rand(40, 90) * (1 + (level - 1) * 0.12);
  const isGreen = Math.random() < 0.5; // 50/50
  const color = isGreen ? BALLOON_GREEN : BALLOON_RED;
  const kind = isGreen ? 'green' : 'red';
  balloons.push({ x, y, r, color, kind, vx: rand(-20, 20), vy: -speed, alive: true });
}

function updateBalloons(dtMs) {
  for (const b of balloons) {
    if (!b.alive) continue;
    b.x += (b.vx * dtMs) / 1000;
    b.y += (b.vy * dtMs) / 1000;
    // bounce lateral suave
    if (b.x < b.r) { b.x = b.r; b.vx *= -1; }
    if (b.x > canvas.width - b.r) { b.x = canvas.width - b.r; b.vx *= -1; }
    // remove quando sai por cima
    if (b.y + b.r < -40) b.alive = false;
  }
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // fundo gradiente
  const g = ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,'#0ea5e9'); g.addColorStop(1,'#1e293b');
  ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);

  // balões
  for (const b of balloons) {
    if (!b.alive) continue;
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = b.color;
    ctx.shadowColor = '#0008'; ctx.shadowBlur = 8;
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    // cordinha
    ctx.strokeStyle = '#ffffffaa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.r - 4);
    ctx.quadraticCurveTo(b.x - 6, b.y + b.r + 10, b.x + 6, b.y + b.r + 24);
    ctx.stroke();
    ctx.restore();
  }

  // mira (ponta do indicador)
  if (pointer.visible) {
    ctx.save();
    ctx.translate(pointer.x, pointer.y);
    ctx.fillStyle = '#22d3ee';
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

function checkCollisions() {
  if (!pointer.visible) return;
  for (const b of balloons) {
    if (!b.alive) continue;
    const dx = pointer.x - b.x; const dy = pointer.y - b.y;
    if ((dx * dx + dy * dy) <= (b.r * b.r * 0.9)) {
      b.alive = false;
      if (b.kind === 'green') score += 1; else score -= 1;
      scoreEl.textContent = String(score);
      // pequena explosão
      ctx.save();
      ctx.fillStyle = b.kind === 'green' ? '#34d39988' : '#ef444488';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}

function gcBalloons() {
  for (let i = balloons.length - 1; i >= 0; i--) if (!balloons[i].alive) balloons.splice(i, 1);
}

function gameLoop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = ts - lastTs; lastTs = ts;

  // aumenta dificuldade gradualmente
  spawnAccumulator += dt;
  const spawnEvery = Math.max(220 - level * 10, 90); // ms
  while (spawnAccumulator >= spawnEvery) {
    spawnAccumulator -= spawnEvery;
    spawnBalloon();
  }

  updateBalloons(dt);
  checkCollisions();
  drawScene();
  gcBalloons();

  rafId = requestAnimationFrame(gameLoop);
}

function startTimer() {
  clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    remaining -= 1; if (remaining < 0) remaining = 0;
    timerEl.textContent = String(remaining);
    if (remaining % 15 === 0 && level < 10) { level += 1; levelEl.textContent = String(level); }
    if (remaining === 0) {
      clearInterval(gameInterval);
      cancelAnimationFrame(rafId); rafId = null;
      // exibe popup
      finalScoreEl.textContent = String(score);
      modal.classList.add('show');
      statusEl.textContent = 'Fim de jogo!';
      statusEl.style.background = '#16a34a';
    }
  }, 1000);
}

// ====== MediaPipe Hands ======
async function initHands() {
  if (hands) { handsReady = true; return; }
  hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
  hands.setOptions({ maxNumHands: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6, modelComplexity: 0 });
  hands.onResults(onResults);
  handsReady = true;
}

function onResults(res) {
  statusEl.textContent = 'Detectando…';
  if (res.multiHandLandmarks && res.multiHandLandmarks.length) {
    const l = res.multiHandLandmarks[0];
    // indicador tip = 8
    const tip = l[8];
    // Inverte o eixo X para espelhar em relação ao usuário
    pointer.x = (1 - tip.x) * canvas.width;
    pointer.y = tip.y * canvas.height;
    pointer.visible = true;
  } else {
    pointer.visible = false;
  }
}

// ====== Câmera ======
async function startCamera() {
  if (!window.isSecureContext) {
    showHelp('Rode em HTTPS ou localhost para usar a câmera.', 'danger');
    return;
  }
  try {
    statusEl.textContent = 'Solicitando câmera…';
    await initHands();
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
    video.srcObject = stream; await video.play();
    // util da MediaPipe para puxar frames
    camera = new Camera(video, {
      onFrame: async () => {
        if (!hands || !handsReady) return;
        if (processingFrame) return;
        if (!(video.videoWidth > 0 && video.videoHeight > 0)) return;
        processingFrame = true;
        try {
          await hands.send({ image: video });
        } catch (e) {
          const msg = (e && e.message) ? e.message : String(e);
          writeDebug('send error: ' + msg);
        } finally {
          processingFrame = false;
        }
      },
      width: 640, height: 480
    });
    camera.start();

    statusEl.textContent = 'Valendo!'; statusEl.style.background = '#1f2937';
    score = 0; remaining = 60; level = 1; spawnAccumulator = 0; scoreEl.textContent = '0'; timerEl.textContent = '60'; levelEl.textContent = '1';
    pointer.visible = false; lastTs = 0;
    cancelAnimationFrame(rafId); lastTs = 0; rafId = requestAnimationFrame(gameLoop);
    startTimer();
  } catch (e) {
    showHelp('Falha ao iniciar câmera: ' + e.message, 'danger');
  }
}

function stopCamera() {
  if (camera && camera.stop) camera.stop();
  const s = video.srcObject; if (s && s.getTracks) s.getTracks().forEach(t => { try { t.stop(); } catch(_){} });
  video.srcObject = null; cancelAnimationFrame(rafId); rafId = null; clearInterval(gameInterval);
  statusEl.textContent = 'Parado';
  modal.classList.remove('show');
  // Mantemos a instância de Hands viva para evitar reimportação do módulo WASM
  handsReady = true;
  pointer.visible = false;
}

function retryCamera() { stopCamera(); setTimeout(() => startCamera(), 200); }

// ====== Eventos ======
startBtn.addEventListener('click', startCamera);
retryBtn.addEventListener('click', retryCamera);
stopBtn.addEventListener('click', stopCamera);
playAgainBtn.addEventListener('click', () => { modal.classList.remove('show'); retryCamera(); });


