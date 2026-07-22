/* =========================================================
   코끼리를 피해라! - Game Logic
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 기본 설정 ---------- */
  const MAX_LIVES = 5;
  const MAX_STAGE = 100;           // 100 = 보스 스테이지
  const NORMAL_STAGE_TIME = 8.2;   // 일반 스테이지 생존 시간(초)
  const BOSS_STAGE_TIME = 16;      // 보스 스테이지 생존 시간(초)
  const INVULN_TIME = 1.1;         // 피격 후 무적 시간(초)
  const STORAGE_BEST = 'elephantDodge_best';
  const STORAGE_MUTE = 'elephantDodge_muted';

  /* ---------- 캔버스 ---------- */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- 에셋 로딩 ---------- */
  const IMG_PATH = 'assets/img/';
  const SND_PATH = 'assets/sound/';

  const images = {};
  function loadImage(key, file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve(); // 실패해도 진행
      img.src = IMG_PATH + file;
      images[key] = img;
    });
  }

  const sounds = {};
  function makeAudio(key, file, { loop = false, volume = 1 } = {}) {
    const a = new Audio(SND_PATH + file);
    a.loop = loop;
    a.volume = volume;
    a.preload = 'auto';
    sounds[key] = a;
  }

  makeAudio('bgm', 'bgm.mp3', { loop: true, volume: 0.42 });
  makeAudio('roar', 'elephant_roar.mp3', { volume: 0.55 });
  makeAudio('hit', 'caught_hit.mp3', { volume: 0.8 });
  makeAudio('clear', 'stage_clear.mp3', { volume: 0.7 });
  makeAudio('victory', 'victory_fanfare.mp3', { volume: 0.85 });
  makeAudio('click', 'button_click.mp3', { volume: 0.6 });
  makeAudio('over', 'game_over.mp3', { volume: 0.7 });

  let muted = localStorage.getItem(STORAGE_MUTE) === '1';

  function playSfx(key) {
    if (muted) return;
    const base = sounds[key];
    if (!base) return;
    try {
      const node = base.cloneNode();
      node.volume = base.volume;
      node.play().catch(() => {});
    } catch (e) {}
  }

  function updateMuteUI() {
    muteBtn.textContent = muted ? '🔇' : '🔊';
    sounds.bgm.muted = muted;
  }

  function playBgm() {
    if (muted) return;
    sounds.bgm.play().catch(() => {});
  }
  function stopBgm() {
    sounds.bgm.pause();
  }

  /* ---------- DOM ---------- */
  const hud = document.getElementById('hud');
  const stageNumEl = document.getElementById('stageNum');
  const livesBox = document.getElementById('livesBox');
  const timerFill = document.getElementById('timerFill');
  const muteBtn = document.getElementById('muteBtn');
  const stageToast = document.getElementById('stageToast');

  const screenStart = document.getElementById('screenStart');
  const screenPause = document.getElementById('screenPause');
  const screenOver = document.getElementById('screenOver');
  const screenVictory = document.getElementById('screenVictory');

  const startBtn = document.getElementById('startBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const pauseRestartBtn = document.getElementById('pauseRestartBtn');
  const retryBtn = document.getElementById('retryBtn');
  const victoryRestartBtn = document.getElementById('victoryRestartBtn');
  const overStageEl = document.getElementById('overStage');
  const bestRecordText = document.getElementById('bestRecordText');
  const victoryChars = document.getElementById('victoryChars');

  function showScreen(el) {
    [screenStart, screenPause, screenOver, screenVictory].forEach(s => s.classList.add('hidden'));
    if (el) el.classList.remove('hidden');
  }

  /* ---------- 초기 라이프 아이콘 렌더 ---------- */
  function renderLives() {
    livesBox.innerHTML = '';
    for (let i = 0; i < MAX_LIVES; i++) {
      const span = document.createElement('span');
      span.className = 'life-icon' + (i < lives ? '' : ' lost');
      span.textContent = '🍉';
      livesBox.appendChild(span);
    }
  }

  /* ---------- 유틸 ---------- */
  function rand(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  /* ---------- 플레이어(수박) ---------- */
  const player = {
    x: 0, y: 0,
    vx: 0, vy: 0,
    r: 30,
    angle: 0,
    speed: 320,        // px/s (키보드 최대속도)
    invuln: 0,
  };

  function resetPlayer() {
    player.x = W / 2;
    player.y = H * 0.72;
    player.vx = 0;
    player.vy = 0;
    player.angle = 0;
    player.invuln = 0;
  }

  /* ---------- 입력 ---------- */
  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault();
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') togglePause();
  }, { passive: false });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  let pointerActive = false;
  let pointerX = 0, pointerY = 0;

  function getRelPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'playing') return;
    pointerActive = true;
    const p = getRelPos(e);
    pointerX = p.x; pointerY = p.y;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointerActive) return;
    const p = getRelPos(e);
    pointerX = p.x; pointerY = p.y;
  });
  window.addEventListener('pointerup', () => { pointerActive = false; });
  window.addEventListener('pointercancel', () => { pointerActive = false; });

  /* ---------- 코끼리(적) ---------- */
  let elephants = [];

  function stageConfig(stage) {
    if (stage >= MAX_STAGE) {
      return { boss: true, count: 1, speed: 150, size: 150, homing: 0.045 };
    }
    const count = Math.min(1 + Math.floor((stage - 1) / 7), 9);
    const speed = 70 + Math.min(stage, 80) * 1.55;
    const homing = clamp(0.018 + stage * 0.0009, 0.018, 0.075);
    const size = 78 + Math.min(stage, 40) * 0.35;
    return { boss: false, count, speed, size, homing };
  }

  function spawnElephants(stage) {
    elephants = [];
    const cfg = stageConfig(stage);
    for (let i = 0; i < cfg.count; i++) {
      const edge = Math.floor(rand(0, 4));
      let x, y;
      if (edge === 0) { x = rand(0, W); y = -60; }
      else if (edge === 1) { x = rand(0, W); y = H + 60; }
      else if (edge === 2) { x = -60; y = rand(0, H * 0.6); }
      else { x = W + 60; y = rand(0, H * 0.6); }
      elephants.push({
        x, y,
        vx: 0, vy: 0,
        r: cfg.size / 2,
        size: cfg.size,
        speed: cfg.speed * rand(0.85, 1.15),
        homing: cfg.homing,
        boss: cfg.boss,
        facing: 1,
        chargeTimer: rand(2.5, 4.5),
        charging: false,
        chargeT: 0,
        bob: rand(0, Math.PI * 2),
      });
    }
    return cfg;
  }

  /* ---------- 게임 상태 ---------- */
  let state = 'start'; // start | playing | paused | over | victory
  let stage = 1;
  let lives = MAX_LIVES;
  let stageTimeLeft = NORMAL_STAGE_TIME;
  let stageTotalTime = NORMAL_STAGE_TIME;
  let lastTs = 0;
  let bgDim = 0; // 배경 어두워지는 정도(위험도)

  function bestStage() {
    return parseInt(localStorage.getItem(STORAGE_BEST) || '1', 10);
  }
  function saveBest(s) {
    if (s > bestStage()) localStorage.setItem(STORAGE_BEST, String(s));
  }

  function toast(msg) {
    stageToast.textContent = msg;
    stageToast.classList.remove('hidden');
    requestAnimationFrame(() => stageToast.classList.add('show'));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      stageToast.classList.remove('show');
      setTimeout(() => stageToast.classList.add('hidden'), 250);
    }, 900);
  }

  function startGame() {
    stage = 1;
    lives = MAX_LIVES;
    resetPlayer();
    const cfg = spawnElephants(stage);
    stageTotalTime = cfg.boss ? BOSS_STAGE_TIME : NORMAL_STAGE_TIME;
    stageTimeLeft = stageTotalTime;
    bgDim = 0;
    renderLives();
    stageNumEl.textContent = stage;
    state = 'playing';
    hud.classList.remove('hidden');
    showScreen(null);
    playBgm();
    lastTs = performance.now();
    requestAnimationFrame(loop);
  }

  function nextStage() {
    playSfx('clear');
    stage++;
    if (stage > MAX_STAGE) {
      winGame();
      return;
    }
    toast(stage === MAX_STAGE ? '👑 마지막 보스 등장!' : `STAGE ${stage} ▶`);
    const cfg = spawnElephants(stage);
    stageTotalTime = cfg.boss ? BOSS_STAGE_TIME : NORMAL_STAGE_TIME;
    stageTimeLeft = stageTotalTime;
    stageNumEl.textContent = stage;
    bgDim = clamp(stage / MAX_STAGE, 0, 0.55);
    if (stage % 10 === 0 || cfg.boss) playSfx('roar');
  }

  function loseLife() {
    if (player.invuln > 0) return;
    lives--;
    player.invuln = INVULN_TIME;
    renderLives();
    playSfx('hit');
    // 살짝 화면 흔들림 느낌: 플레이어 튕겨내기
    const dx = player.x - W / 2, dy = player.y - H / 2;
    const len = Math.hypot(dx, dy) || 1;
    player.vx += (dx / len) * 200;
    player.vy += (dy / len) * 200;

    if (lives <= 0) {
      gameOver();
    }
  }

  function gameOver() {
    state = 'over';
    saveBest(stage);
    hud.classList.add('hidden');
    overStageEl.textContent = stage;
    stopBgm();
    playSfx('over');
    showScreen(screenOver);
  }

  function winGame() {
    state = 'victory';
    saveBest(MAX_STAGE);
    hud.classList.add('hidden');
    stopBgm();
    playSfx('victory');
    buildVictoryChars();
    showScreen(screenVictory);
  }

  function buildVictoryChars() {
    victoryChars.innerHTML = '';
    const order = ['happy_elephant.png', 'watermelon.png', 'happy_elephant.png'];
    order.forEach((file, i) => {
      const img = document.createElement('img');
      img.src = IMG_PATH + file;
      img.style.animationDelay = (i * 0.15) + 's';
      victoryChars.appendChild(img);
    });
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      showScreen(screenPause);
      sounds.bgm.pause();
    } else if (state === 'paused') {
      state = 'playing';
      showScreen(null);
      playBgm();
      lastTs = performance.now();
      requestAnimationFrame(loop);
    }
  }

  /* ---------- 업데이트 ---------- */
  function updatePlayer(dt) {
    if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);

    if (pointerActive) {
      const dx = pointerX - player.x;
      const dy = pointerY - player.y;
      const d = Math.hypot(dx, dy);
      const follow = 9; // 따라오는 정도
      if (d > 1) {
        player.vx = dx * follow * dt * 6;
        player.vy = dy * follow * dt * 6;
        const maxV = 480;
        const vlen = Math.hypot(player.vx, player.vy);
        if (vlen > maxV) {
          player.vx = player.vx / vlen * maxV;
          player.vy = player.vy / vlen * maxV;
        }
      } else {
        player.vx *= 0.8; player.vy *= 0.8;
      }
    } else {
      let ax = 0, ay = 0;
      if (keys['arrowleft'] || keys['a']) ax -= 1;
      if (keys['arrowright'] || keys['d']) ax += 1;
      if (keys['arrowup'] || keys['w']) ay -= 1;
      if (keys['arrowdown'] || keys['s']) ay += 1;
      if (ax || ay) {
        const len = Math.hypot(ax, ay) || 1;
        player.vx += (ax / len) * player.speed * dt * 5;
        player.vy += (ay / len) * player.speed * dt * 5;
        const vlen = Math.hypot(player.vx, player.vy);
        if (vlen > player.speed) {
          player.vx = player.vx / vlen * player.speed;
          player.vy = player.vy / vlen * player.speed;
        }
      } else {
        player.vx *= 0.86;
        player.vy *= 0.86;
      }
    }

    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = clamp(player.x, player.r, W - player.r);
    player.y = clamp(player.y, player.r, H - player.r);

    const speedForSpin = Math.hypot(player.vx, player.vy);
    player.angle += (speedForSpin * 0.012) * dt * 10 * (player.vx < 0 ? -1 : 1) * 0.6 + (speedForSpin * 0.01) * dt;
  }

  function updateElephants(dt) {
    for (const e of elephants) {
      e.bob += dt * 4;
      if (e.boss) {
        e.chargeTimer -= dt;
        if (!e.charging && e.chargeTimer <= 0) {
          e.charging = true;
          e.chargeT = 0.9;
          playSfx('roar');
        }
        if (e.charging) {
          e.chargeT -= dt;
          const spd = e.speed * 2.1;
          const dx = player.x - e.x, dy = player.y - e.y;
          const len = Math.hypot(dx, dy) || 1;
          e.vx = (dx / len) * spd;
          e.vy = (dy / len) * spd;
          if (e.chargeT <= 0) {
            e.charging = false;
            e.chargeTimer = rand(2.2, 3.6);
          }
        } else {
          const dx = player.x - e.x, dy = player.y - e.y;
          const len = Math.hypot(dx, dy) || 1;
          const targetVx = (dx / len) * e.speed;
          const targetVy = (dy / len) * e.speed;
          e.vx += (targetVx - e.vx) * e.homing;
          e.vy += (targetVy - e.vy) * e.homing;
        }
      } else {
        const dx = player.x - e.x, dy = player.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        const targetVx = (dx / len) * e.speed;
        const targetVy = (dy / len) * e.speed;
        e.vx += (targetVx - e.vx) * e.homing;
        e.vy += (targetVy - e.vy) * e.homing;
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.facing = e.vx < -5 ? -1 : (e.vx > 5 ? 1 : e.facing);

      // 화면 경계 살짝 넘어가도 허용(자연스러운 등장/퇴장)
      e.x = clamp(e.x, -e.r, W + e.r);
      e.y = clamp(e.y, -e.r, H + e.r);

      // 충돌 체크
      const d = dist(player.x, player.y, e.x, e.y);
      const hitDist = player.r * 0.72 + e.r * 0.62;
      if (d < hitDist) {
        loseLife();
      }
    }
  }

  function update(dt) {
    updatePlayer(dt);
    updateElephants(dt);

    stageTimeLeft -= dt;
    timerFill.style.width = clamp(stageTimeLeft / stageTotalTime, 0, 1) * 100 + '%';
    if (stageTimeLeft <= 0) {
      nextStage();
    }
  }

  /* ---------- 렌더 ---------- */
  function drawBackground() {
    const img = images.zoo;
    if (img && img.complete && img.naturalWidth) {
      // cover fit
      const ir = img.naturalWidth / img.naturalHeight;
      const cr = W / H;
      let dw, dh, dx, dy;
      if (cr > ir) { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
      else { dh = H; dw = H * ir; dy = 0; dx = (W - dw) / 2; }
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(0, 0, W, H);
    }
    if (bgDim > 0) {
      ctx.fillStyle = `rgba(20,0,10,${bgDim})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    if (player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }
    const img = images.watermelon;
    const size = player.r * 2.25;
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = '#3fae4e';
      ctx.beginPath();
      ctx.arc(0, 0, player.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawElephants() {
    for (const e of elephants) {
      const img = e.boss ? images.mega : images.elephant;
      const bobY = e.boss ? 0 : Math.sin(e.bob) * 3;
      ctx.save();
      ctx.translate(e.x, e.y + bobY);
      ctx.scale(e.facing, 1);
      if (e.charging) {
        ctx.save();
        ctx.translate(rand(-3, 3), rand(-3, 3));
      }
      const size = e.size * (e.boss ? 1.5 : 1);
      if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
      } else {
        ctx.fillStyle = '#8a8a99';
        ctx.beginPath();
        ctx.arc(0, 0, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (e.charging) ctx.restore();
      ctx.restore();

      if (e.boss && e.chargeT > 0 && e.charging) {
        ctx.save();
        ctx.fillStyle = 'rgba(245,87,108,0.9)';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('돌진!! 💨', e.x, e.y - e.size * 0.55);
        ctx.restore();
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawElephants();
    drawPlayer();
  }

  /* ---------- 루프 ---------- */
  function loop(ts) {
    if (state !== 'playing') return;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.05) dt = 0.05; // 탭 전환 등으로 튀는 값 방지
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  /* ---------- 이벤트 바인딩 ---------- */
  startBtn.addEventListener('click', () => { playSfx('click'); startGame(); });
  retryBtn.addEventListener('click', () => { playSfx('click'); startGame(); });
  victoryRestartBtn.addEventListener('click', () => { playSfx('click'); startGame(); });
  resumeBtn.addEventListener('click', () => { playSfx('click'); togglePause(); });
  pauseRestartBtn.addEventListener('click', () => { playSfx('click'); startGame(); });

  muteBtn.addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem(STORAGE_MUTE, muted ? '1' : '0');
    updateMuteUI();
    if (!muted && state === 'playing') playBgm();
    else stopBgm();
  });

  document.getElementById('pauseFloatBtn');
  // 일시정지: HUD 영역 더블탭/버튼 없으므로 별도 버튼 삽입
  (function addPauseButton() {
    const btn = document.createElement('button');
    btn.id = 'pauseFloatBtn';
    btn.className = 'icon-btn';
    btn.textContent = '⏸️';
    btn.title = '일시정지';
    btn.addEventListener('click', () => { playSfx('click'); togglePause(); });
    document.body.appendChild(btn);
    window.addEventListener('visibilitychange', () => {
      if (document.hidden && state === 'playing') togglePause();
    });
  })();

  /* ---------- 초기화 ---------- */
  function updateBestText() {
    const b = bestStage();
    bestRecordText.textContent = b > 1 ? `🏆 최고 기록: 스테이지 ${b}` : '';
  }

  Promise.all([
    loadImage('elephant', 'elephant.png'),
    loadImage('watermelon', 'watermelon.png'),
    loadImage('mega', 'mega_elephant.png'),
    loadImage('happy', 'happy_elephant.png'),
    loadImage('zoo', 'zoo_bg.png'),
    loadImage('banana', 'banana_bg.png'),
  ]).then(() => {
    startBtn.disabled = false;
  });

  updateMuteUI();
  updateBestText();
  resetPlayer();
  render();
})();
