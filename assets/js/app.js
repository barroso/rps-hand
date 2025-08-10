// ====== Elementos ======
const video = document.getElementById('video');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');
const stateEl = document.getElementById('state');
const startBtn = document.getElementById('startBtn');
const retryBtn = document.getElementById('retryBtn');
const stopBtn = document.getElementById('stopBtn');
const helpBox = document.getElementById('helpBox');
const debugEl = document.getElementById('debug');
const fileInput = document.getElementById('fileInput');
const overlay = document.getElementById('overlay');
const playerEmojiEl = document.getElementById('playerEmoji');
const playerChoiceEl = document.getElementById('playerChoice');
const computerEmojiEl = document.getElementById('computerEmoji');
const computerChoiceEl = document.getElementById('computerChoice');
const playerCardEl = document.getElementById('playerCard');
const computerCardEl = document.getElementById('computerCard');
const winnerBannerEl = document.getElementById('winnerBanner');

// ====== Variáveis ======
let camera = null; // MediaPipe Camera util
let handsDetector = null;
// Estado do jogo
let gameState = 'idle'; // 'idle' | 'countdown' | 'reveal'
let countdownDeadlineMs = 0;
let countdownTimerId = null;
let computerChoice = null; // 'pedra' | 'papel' | 'tesoura'
const CHOICES = ['pedra', 'papel', 'tesoura'];
// Buffers para suavização de detecção
const thumbsUpBuffer = []; // boolean[]
const rpsBuffer = []; // ('pedra'|'papel'|'tesoura'|null)[]
const rpsTimed = []; // {t:number,v:string}[]

// usado quando o vídeo vem de arquivo (não de getUserMedia)
let rafId = null;

// ====== Inicialização segura após carregamento dos scripts ======
window.addEventListener('load', init);

async function init() {
  writeDebug('Inicializando...');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showHelp('Seu navegador não suporta navigator.mediaDevices.getUserMedia. Use um navegador recente (Chrome, Edge, Firefox, Safari) e rode em HTTPS.', 'danger');
  }

  try {
    handsDetector = new Hands({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    handsDetector.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.65
    });
    handsDetector.onResults(onResults);
  } catch (e) {
    writeDebug('Erro ao inicializar MediaPipe Hands: ' + e.message);
    showHelp('Falha ao carregar o modelo de detecção. Verifique sua conexão de rede ou use um navegador diferente.', 'danger');
  }

  startBtn.addEventListener('click', startCamera);
  retryBtn.addEventListener('click', retryCamera);
  stopBtn.addEventListener('click', stopCamera);
  fileInput.addEventListener('change', handleFileUpload);

  if (!window.isSecureContext) {
    showHelp('Atenção: este contexto NÃO é seguro (HTTP ou file://). Alguns navegadores impedem o acesso à câmera em contextos não seguros. Execute um servidor local (ex: `python -m http.server`) ou rode via HTTPS.', 'danger');
  } else {
    showHelp('Contexto seguro detectado. Você pode iniciar a câmera clicando em "Iniciar câmera".', 'ok');
  }

  updatePermissionStatus();
}

// ====== Utilitários de UI ======
function showHelp(message, type) {
  helpBox.innerHTML = message;
  if (type === 'danger') helpBox.style.color = '#b00020';
  else if (type === 'ok') helpBox.style.color = 'green';
  else helpBox.style.color = '#333';
}

function writeDebug(msg) {
  const t = new Date().toLocaleTimeString();
  debugEl.textContent = `[${t}] ` + msg + "\n" + debugEl.textContent;
  console.log(msg);
}

async function updatePermissionStatus() {
  if (!navigator.permissions) return;
  try {
    const p = await navigator.permissions.query({ name: 'camera' }).catch(() => null);
    if (p) {
      writeDebug('Permission camera state: ' + p.state);
      p.onchange = () => writeDebug('Permission change -> ' + p.state);
    } else {
      writeDebug('API Permissions disponível mas permission "camera" não suportada neste navegador.');
    }
  } catch (e) {
    writeDebug('Não foi possível consultar permissions API: ' + e.message);
  }
}

// ====== Fluxo de câmera ======
async function startCamera() {
  if (camera) {
    writeDebug('Câmera já iniciada.');
    return;
  }
  if (!window.isSecureContext) {
    showHelp('Impossível acessar a câmera porque o contexto não é seguro (HTTP ou file://). Rode em HTTPS ou localhost.', 'danger');
    return;
  }
  try {
    stateEl.textContent = 'Solicitando permissão de câmera...';
    writeDebug('Solicitando getUserMedia...');
    const constraints = { video: { width: 640, height: 480, facingMode: 'user' }, audio: false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    await video.play();
    camera = new Camera(video, {
      onFrame: async () => {
        try { await handsDetector.send({ image: video }); }
        catch (e) { writeDebug('Erro ao enviar frame para o detector: ' + e.message); }
      },
      width: 640,
      height: 480
    });
    camera.start();
    stateEl.textContent = 'Câmera iniciada — procurando mão...';
    writeDebug('Câmera iniciada com sucesso.');
  } catch (err) {
    writeDebug('Erro ao acessar a câmera: ' + (err && err.name ? err.name + ' — ' : '') + (err && err.message ? err.message : String(err)));
    if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
      stateEl.textContent = 'Permissão negada para acessar a câmera.';
      let msg = `Permissão negada. Verifique as configurações do navegador e permita o uso da câmera para este site.`;
      if (!window.isSecureContext) { msg += ` Além disso, o site precisa ser servido em HTTPS ou em localhost.`; }
      msg += "<br><br>Passos rápidos:<ul style='margin:6px 0;padding-left:18px'><li>Recarregue a página e permita a câmera quando o navegador solicitar.</li><li>Se você negou anteriormente, abra as configurações do site no navegador e habilite câmera para este domínio.</li><li>Se estiver em arquivo local, rode um servidor local (ex: `python -m http.server`).</li></ul>";
      showHelp(msg, 'danger');
    } else if (err && err.name === 'NotFoundError') {
      stateEl.textContent = 'Nenhuma câmera encontrada no dispositivo.';
      showHelp('Nenhuma câmera detectada. Conecte uma câmera externa ou verifique permissões do sistema.', 'danger');
    } else {
      stateEl.textContent = 'Erro ao acessar a câmera: ' + (err && err.message ? err.message : String(err));
      showHelp('Erro desconhecido ao acessar a câmera. Veja o console para detalhes.', 'danger');
    }
  }
}

function retryCamera() {
  writeDebug('Retrying camera...');
  stopCamera();
  setTimeout(() => startCamera(), 250);
}

function stopCamera() {
  writeDebug('Parando câmera...');
  if (camera && camera.stop) { try { camera.stop(); } catch (e) { writeDebug('Erro ao stop camera util: ' + e.message); } }
  camera = null;
  const stream = video.srcObject;
  if (stream && stream.getTracks) { stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); }
  video.srcObject = null;
  video.pause();
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  stateEl.textContent = 'Parado';
  resetGame(true);
  clearCanvas();
}

// ====== Suporte para vídeo carregado (teste) ======
function handleFileUpload(evt) {
  const file = evt.target.files && evt.target.files[0];
  if (!file) return;
  writeDebug('Arquivo de vídeo carregado: ' + file.name);
  stopCamera();
  video.srcObject = null;
  video.src = URL.createObjectURL(file);
  video.play();
  startManualLoop();
  stateEl.textContent = 'Executando vídeo de teste — detectando...';
  showHelp('Usando vídeo carregado para testar detecção.', 'ok');
}

function startManualLoop() {
  if (rafId) return;
  const loop = async () => {
    if (video.readyState >= 2) {
      try { await handsDetector.send({ image: video }); } catch (e) { writeDebug('Erro ao enviar frame do vídeo: ' + e.message); }
    }
    rafId = requestAnimationFrame(loop);
  };
  loop();
}

// ====== Processamento de resultados ======
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function onResults(results) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (results && results.image) ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results && results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    try {
      if (typeof drawConnectors !== 'undefined') drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FFAA', lineWidth: 2 });
      if (typeof drawLandmarks !== 'undefined') drawLandmarks(ctx, landmarks, { color: '#FF0066', lineWidth: 1 });
    } catch (e) { writeDebug('Erro ao desenhar landmarks: ' + e.message); }

    const isThumbsUp = detectThumbsUp(landmarks);
    pushAndTrim(thumbsUpBuffer, isThumbsUp, 12);

    const rpsGuess = classifyRPS(landmarks);
    pushAndTrim(rpsBuffer, rpsGuess, 20);
    if (rpsGuess) {
      rpsTimed.push({ t: performance.now(), v: rpsGuess });
      const cutoff = performance.now() - 3000;
      while (rpsTimed.length && rpsTimed[0].t < cutoff) rpsTimed.shift();
    }

    if (gameState === 'idle') {
      const thumbsCount = thumbsUpBuffer.filter(Boolean).length;
      if (thumbsCount >= 7) {
        startCountdown();
      } else {
        stateEl.textContent = 'Mostre um joinha 👍 para começar';
      }
    } else if (gameState === 'countdown') {
      const remaining = countdownDeadlineMs - performance.now();
      drawCountdown(Math.max(1, Math.ceil(remaining / 1000)));
      stateEl.textContent = `Jogo começa em ${Math.max(1, Math.ceil(remaining / 1000))}...`;
    } else if (gameState === 'reveal') {
      drawResultOverlay();
      const thumbsCount = thumbsUpBuffer.filter(Boolean).length;
      if (thumbsCount >= 7) {
        resetGame();
        startCountdown();
      } else {
        stateEl.textContent = 'Resultado mostrado. Faça joinha 👍 para jogar novamente.';
      }
    }
  } else {
    if (gameState === 'idle') stateEl.textContent = 'Nenhuma mão detectada';
  }

  ctx.restore();
}

// ====== Lógica do jogo (classificação e overlays) ======
function startCountdown() {
  gameState = 'countdown';
  countdownDeadlineMs = performance.now() + 3000;
  if (countdownTimerId) { clearTimeout(countdownTimerId); countdownTimerId = null; }
  countdownTimerId = setTimeout(() => {
    if (gameState === 'countdown') finalizeGame();
  }, 3000);
  overlay.classList.add('hidden');
  computerChoice = CHOICES[Math.floor(Math.random() * CHOICES.length)];
  writeDebug('Iniciando contagem. Computador escolheu (oculto): ' + computerChoice);
  flashBorder('rgba(0, 105, 255, 0.35)');
  rpsTimed.length = 0;
  rpsBuffer.length = 0;
}

function finalizeGame() {
  const now = performance.now();
  const windowChoices = rpsTimed.filter(e => now - e.t <= 900).map(e => e.v);
  const playerChoice = majority(windowChoices) || majority(rpsBuffer) || null;
  let resultText = '';
  if (!playerChoice) { resultText = 'Não consegui entender sua jogada. Tente novamente.'; }

  let outcome = 'indefinido';
  if (playerChoice) outcome = decideWinner(playerChoice, computerChoice);

  gameResult.cached = { player: playerChoice || 'indefinido', computer: computerChoice, outcome };

  if (playerChoice) {
    if (outcome === 'empate') resultText = `Você: ${playerChoice} | Computador: ${computerChoice} → Empate`;
    else if (outcome === 'vitoria') resultText = `Você: ${playerChoice} | Computador: ${computerChoice} → Você venceu!`;
    else resultText = `Você: ${playerChoice} | Computador: ${computerChoice} → Você perdeu.`;
  }

  stateEl.textContent = resultText;
  gameState = 'reveal';
  flashBorder(outcome === 'vitoria' ? 'rgba(0,180,0,0.35)' : outcome === 'derrota' ? 'rgba(220,0,0,0.35)' : 'rgba(160,160,0,0.35)');

  const toEmoji = c => c === 'pedra' ? '✊' : c === 'papel' ? '✋' : c === 'tesoura' ? '✌️' : '❔';
  playerEmojiEl.textContent = toEmoji(gameResult.cached.player);
  playerChoiceEl.textContent = gameResult.cached.player;
  computerEmojiEl.textContent = toEmoji(gameResult.cached.computer);
  computerChoiceEl.textContent = gameResult.cached.computer;

  playerCardEl.classList.remove('glow-win', 'glow-lose', 'glow-draw');
  computerCardEl.classList.remove('glow-win', 'glow-lose', 'glow-draw');

  if (outcome === 'empate') {
    playerCardEl.classList.add('glow-draw');
    computerCardEl.classList.add('glow-draw');
    winnerBannerEl.textContent = 'Empate';
  } else if (outcome === 'vitoria') {
    playerCardEl.classList.add('glow-win');
    computerCardEl.classList.add('glow-lose');
    winnerBannerEl.textContent = 'Você venceu!';
  } else if (outcome === 'derrota') {
    playerCardEl.classList.add('glow-lose');
    computerCardEl.classList.add('glow-win');
    winnerBannerEl.textContent = 'Você perdeu.';
  } else {
    playerCardEl.classList.add('glow-draw');
    computerCardEl.classList.add('glow-draw');
    winnerBannerEl.textContent = 'Indefinido';
  }

  overlay.classList.remove('hidden');
}

function resetGame(soft = false) {
  gameState = 'idle';
  countdownDeadlineMs = 0;
  if (countdownTimerId) { clearTimeout(countdownTimerId); countdownTimerId = null; }
  computerChoice = null;
  if (!soft) {
    thumbsUpBuffer.length = 0;
    rpsBuffer.length = 0;
    rpsTimed.length = 0;
  }
  overlay.classList.add('hidden');
}

function drawCountdown(secondsLeft) {
  const text = String(secondsLeft);
  ctx.save();
  const grad = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    10,
    canvas.width / 2,
    canvas.height / 2,
    160
  );
  grad.addColorStop(0, 'rgba(0,0,0,0.32)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#0b1220cc';
  roundRect(ctx, canvas.width / 2 - 62, canvas.height / 2 - 62, 124, 124, 16, true, false);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 72px system-ui, Segoe UI, Roboto';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

const gameResult = { cached: null };
function drawResultOverlay() {
  if (!gameResult.cached) return;
  const { player, computer, outcome } = gameResult.cached;
  const color = outcome === 'vitoria' ? '#16a34a' : outcome === 'derrota' ? '#dc2626' : '#eab308';
  const human = outcome === 'vitoria' ? 'Você venceu!' : outcome === 'derrota' ? 'Você perdeu.' : 'Empate';
  const label = `Você: ${player}  |  PC: ${computer}  →  ${human}`;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = '#0b1220cc';
  const w = Math.min(canvas.width - 40, 640);
  roundRect(ctx, 20, 20, w, 56, 12, true, false);
  ctx.fillStyle = color;
  ctx.font = '700 18px system-ui, Segoe UI, Roboto';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 34, 46);
  ctx.restore();
}

function detectThumbsUp(l) {
  const m = 0.02; // margem para estabilidade
  const indexFolded = l[8].y > l[6].y - m;
  const middleFolded = l[12].y > l[10].y - m;
  const ringFolded = l[16].y > l[14].y - m;
  const pinkyFolded = l[20].y > l[18].y - m;
  const thumbUp = (l[4].y < l[3].y - m) && (Math.abs(l[4].x - l[3].x) < 0.08);
  return thumbUp && indexFolded && middleFolded && ringFolded && pinkyFolded;
}

// ====== Utilidades geométricas para detecção de dedos ======
function vectorFromTo(a, b) {
  // Cálculo 2D: z do MediaPipe tem escala diferente, ignoramos para robustez
  return { x: a.x - b.x, y: a.y - b.y };
}

function magnitude(v) {
  return Math.hypot(v.x, v.y);
}

function cosineBetweenVectors(u, v) {
  const denom = magnitude(u) * magnitude(v);
  if (!denom) return 1; // evita divisão por zero
  return (u.x * v.x + u.y * v.y) / denom;
}

function euclideanDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isFingerExtended(l, tipIdx, dipIdx, pipIdx, mcpIdx) {
  const wrist = l[0];
  const tip = l[tipIdx];
  const pip = l[pipIdx];
  const mcp = l[mcpIdx];

  // 1) Checa curvatura pelo ângulo no PIP (vetores: tip->pip e mcp->pip)
  const v1 = vectorFromTo(tip, pip);
  const v2 = vectorFromTo(mcp, pip);
  const cos = cosineBetweenVectors(v1, v2);
  const ANGLE_EXT_COS = -0.3; // menos estrito para considerar extensão
  const angleSuggestsExtended = cos < ANGLE_EXT_COS;

  // 2) Checa se a ponta está significativamente mais longe do punho que o MCP
  const DIST_MARGIN = 0.02; // normalizado (0..1)
  const distTip = euclideanDistance(wrist, tip);
  const distMcp = euclideanDistance(wrist, mcp);
  const distanceSuggestsExtended = distTip > distMcp + DIST_MARGIN;

  return angleSuggestsExtended || distanceSuggestsExtended;
}

function isFingerStronglyFolded(l, tipIdx, dipIdx, pipIdx, mcpIdx) {
  const wrist = l[0];
  const tip = l[tipIdx];
  const pip = l[pipIdx];
  const mcp = l[mcpIdx];

  const v1 = vectorFromTo(tip, pip);
  const v2 = vectorFromTo(mcp, pip);
  const cos = cosineBetweenVectors(v1, v2);

  const distTip = euclideanDistance(wrist, tip);
  const distMcp = euclideanDistance(wrist, mcp);

  const DIST_FOLD_MARGIN = 0.006; // ponta significativamente mais próxima do punho que o MCP
  const distanceSuggestsFolded = (distTip + DIST_FOLD_MARGIN) < distMcp;

  const m = 0.008; // margem vertical pequena
  const ySuggestsFolded = tip.y > (pip.y + (m * 0.5));

  // Para dobrado forte, aceitamos qualquer um dos sinais conservadores
  return (cos > 0.0) || distanceSuggestsFolded || ySuggestsFolded;
}

function palmCenter(l) {
  // Centro simples: média de punho e MCPs dos 4 dedos
  const points = [l[0], l[5], l[9], l[13], l[17]];
  const sx = points.reduce((s, p) => s + p.x, 0);
  const sy = points.reduce((s, p) => s + p.y, 0);
  return { x: sx / points.length, y: sy / points.length };
}

function isFistByCompactness(l) {
  const c = palmCenter(l);
  const tips = [l[8], l[12], l[16], l[20]];
  const mcps = [l[5], l[9], l[13], l[17]];
  const meanTip = tips.reduce((s, p) => s + euclideanDistance(p, c), 0) / tips.length;
  const meanMcp = mcps.reduce((s, p) => s + euclideanDistance(p, c), 0) / mcps.length;
  // Se as pontas estiverem bem próximas do centro da palma em relação aos MCPs, é punho
  const ratio = meanTip / (meanMcp || 1e-6);
  return ratio < 0.88;
}

function classifyRPS(l) {
  // Extensão básica (mais permissiva) — melhor para papel/tesoura
  const indexExt = isFingerExtended(l, 8, 7, 6, 5);
  const middleExt = isFingerExtended(l, 12, 11, 10, 9);
  const ringExt = isFingerExtended(l, 16, 15, 14, 13);
  const pinkyExt = isFingerExtended(l, 20, 19, 18, 17);

  // Dobra forte (mais conservadora) — melhor para pedra
  const indexFold = isFingerStronglyFolded(l, 8, 7, 6, 5);
  const middleFold = isFingerStronglyFolded(l, 12, 11, 10, 9);
  const ringFold = isFingerStronglyFolded(l, 16, 15, 14, 13);
  const pinkyFold = isFingerStronglyFolded(l, 20, 19, 18, 17);

  const allFourExt = indexExt && middleExt && ringExt && pinkyExt;
  const scissors = indexExt && middleExt && !ringExt && !pinkyExt;
  const allFourFoldStrong = indexFold && middleFold && ringFold && pinkyFold;
  const foldCount = [indexFold, middleFold, ringFold, pinkyFold].filter(Boolean).length;

  // Prioriza "pedra" somente pelos 4 dedos não-polegar dobrados, ignorando polegar
  if (allFourFoldStrong) return 'pedra';
  // fallback robusto: 3 de 4 dedos bem dobrados e não é papel/tesoura
  if (!allFourExt && !scissors && foldCount >= 3) return 'pedra';
  if (allFourExt) return 'papel';
  if (scissors) return 'tesoura';
  return null;
}

function decideWinner(player, computer) {
  if (player === computer) return 'empate';
  if (player === 'pedra' && computer === 'tesoura') return 'vitoria';
  if (player === 'papel' && computer === 'pedra') return 'vitoria';
  if (player === 'tesoura' && computer === 'papel') return 'vitoria';
  return 'derrota';
}

function pushAndTrim(arr, val, max) {
  arr.push(val);
  if (arr.length > max) arr.shift();
}

function majority(list) {
  if (!list || !list.length) return null;
  const counts = new Map();
  for (const v of list) {
    if (v == null) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let best = null, bestCount = 0;
  for (const [k, c] of counts.entries()) {
    if (c > bestCount) { best = k; bestCount = c; }
  }
  return best;
}

function flashBorder(color) {
  canvas.style.boxShadow = `0 0 0 8px ${color}`;
  setTimeout(() => canvas.style.boxShadow = '', 180);
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  if (typeof r === 'undefined') r = 5;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// limpeza ao fechar a página
window.addEventListener('beforeunload', () => { stopCamera(); });


