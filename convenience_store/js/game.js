// ══════════════════════════════════════════════
// 손님들의 무한 편의점 - 쿠루미의 알바 대모험
// (편의점을 돌아다니며 알바 & 쇼핑을 스스로 선택하는 시뮬레이션)
// ══════════════════════════════════════════════

// ── 상수 ──
const TIME_MAX = 90;           // 타이머 바 최대치(초) - 이 이상은 쌓이지 않음
const TIME_START = 60;         // 시작 시간(초)
const GAUGE_DECAY_PER_SEC = 9; // 알바 게이지 초당 감소량 (탭 안 하면 서서히 줄어듦)
const WARN_TIME = 15;          // 경고색 전환 시점(초)
const DANGER_TIME = 8;         // 위험색 전환 시점(초)
const WALK_DURATION = 560;     // 쿠루미 이동 애니메이션 시간(ms) - CSS transition과 일치

// 알바(미니게임) 종류 - 각각 다른 위치에서 다른 돈을 벌 수 있어요
const JOBS = {
  stock: {
    key: 'stock',
    name: '상품 진열하기 📦',
    icon: 'assets/img/job_stock.png',
    tapsNeeded: 8,
    tapGain: 100 / 8,
    reward: 25,
    timeBonus: 4,
    cooldown: 10,
    label: '차곡차곡!'
  },
  cola: {
    key: 'cola',
    name: '콜라 마시기 🥤',
    icon: 'assets/img/item_cola.png',
    tapsNeeded: 6,
    tapGain: 100 / 6,
    reward: 10,
    timeBonus: 3,
    cooldown: 7,
    label: '꿀꺽꿀꺽!'
  },
  ramen: {
    key: 'ramen',
    name: '라면 먹기 🍜',
    icon: 'assets/img/item_ramen.png',
    tapsNeeded: 9,
    tapGain: 100 / 9,
    reward: 15,
    timeBonus: 4,
    cooldown: 8,
    label: '후루룩!'
  },
  clean: {
    key: 'clean',
    name: '청소하기 🧹',
    icon: 'assets/img/job_clean.png',
    tapsNeeded: 7,
    tapGain: 100 / 7,
    reward: 20,
    timeBonus: 4,
    cooldown: 9,
    label: '싹싹!'
  }
};
const JOB_KEYS = Object.keys(JOBS);

// 상점 아이템 12종 (아이들이 좋아하는 간식/장난감 구성)
const SHOP_ITEMS = [
  { key: 'snack',    name: '맛있는 과자',   icon: 'assets/img/shop_snack.png',    price: 20 },
  { key: 'drink',    name: '달콤한 음료',   icon: 'assets/img/shop_drink.png',    price: 15 },
  { key: 'toy',      name: '귀여운 장난감', icon: 'assets/img/shop_toy.png',      price: 50 },
  { key: 'icecream', name: '아이스크림',   icon: 'assets/img/shop_icecream.png', price: 25 },
  { key: 'lollipop', name: '막대사탕',     icon: 'assets/img/shop_lollipop.png', price: 10 },
  { key: 'chocolate',name: '초콜릿바',     icon: 'assets/img/shop_chocolate.png',price: 18 },
  { key: 'donut',    name: '도넛',         icon: 'assets/img/shop_donut.png',    price: 22 },
  { key: 'jelly',    name: '젤리 곰돌이',   icon: 'assets/img/shop_jelly.png',    price: 12 },
  { key: 'balloon',  name: '풍선',         icon: 'assets/img/shop_balloon.png',  price: 14 },
  { key: 'robot',    name: '로봇 장난감',   icon: 'assets/img/shop_robot.png',    price: 55 },
  { key: 'cupcake',  name: '컵케이크',     icon: 'assets/img/shop_cupcake.png',  price: 28 },
  { key: 'cookie',   name: '쿠키',         icon: 'assets/img/shop_cookie.png',   price: 16 },
];
const SHOP_ITEM_MAP = {};
SHOP_ITEMS.forEach(it => { SHOP_ITEM_MAP[it.key] = it; });
const SHOP_MIN_PRICE = Math.min(...SHOP_ITEMS.map(it => it.price));

// ── 상태 ──
const state = {
  screen: 'start',      // start | rules | game | shop | over
  gameStarted: false,
  rulesFromHelp: false,
  running: false,
  moving: false,
  timeLeft: TIME_START,
  coins: 0,
  jobsCompleted: 0,
  cooldowns: { stock: 0, cola: 0, ramen: 0, clean: 0 },
  currentJob: null,
  gauge: 0,
  tapsDone: 0,
  muted: false,
  inventory: {},   // key -> 개수
  pileLog: [],     // 구매한 아이템 순서 기록 (쿠루미 옆 쌓기용)
  lastTs: 0,
};
SHOP_ITEMS.forEach(it => { state.inventory[it.key] = 0; });

// ── DOM ──
const el = (id) => document.getElementById(id);
const screens = {
  start: el('screenStart'),
  rules: el('screenRules'),
  game: el('screenGame'),
  shop: el('screenShop'),
  over: el('screenOver'),
};

const timerBar = el('timerBar');
const timerText = el('timerText');
const shopTimerText = el('shopTimerText');
const coinText = el('coinText');
const shopCoinText = el('shopCoinText');
const comboToast = el('comboToast');
const mapArea = el('mapArea');
const kurumiWrap = el('kurumiWrap');
const kurumiImg = el('kurumiImg');
const itemPile = el('itemPile');
const jobPanel = el('jobPanel');
const jobIcon = el('jobIcon');
const jobName = el('jobName');
const jobGauge = el('jobGauge');
const btnJobTap = el('btnJobTap');
const btnJobTapLabel = el('btnJobTapLabel');
const finalCoins = el('finalCoins');
const finalMissions = el('finalMissions');
const btnMute = el('btnMute');

// 사운드
const sounds = {
  bgm: el('sndBgm'),
  tap: el('sndTap'),
  success: el('sndSuccess'),
  coin: el('sndCoin'),
  gameOver: el('sndGameOver'),
  button: el('sndButton'),
  purchase: el('sndPurchase'),
  timerWarning: el('sndTimerWarning'),
};
Object.values(sounds).forEach(a => { a.volume = 0.8; });
sounds.bgm.volume = 0.35;

function playSound(name, { restart = true } = {}) {
  if (state.muted) return;
  const a = sounds[name];
  if (!a) return;
  try {
    if (restart) a.currentTime = 0;
    a.play().catch(() => {});
  } catch (e) {}
}

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  if (name === 'shop') {
    // 상점은 게임 화면 위에 오버레이로 뜸 (시간은 계속 흐름!)
    screens.game.classList.add('active');
    screens.shop.classList.add('active');
  } else if (name === 'rules' && state.rulesFromHelp) {
    // 게임 중 도움말 보기도 오버레이로 표시
    screens.game.classList.add('active');
    screens.rules.classList.add('active');
  } else {
    screens[name].classList.add('active');
  }
  state.screen = name;
}

// ── 쿠루미 이동 ──
function moveKurumiTo(zoneEl, onArrive) {
  state.moving = true;
  kurumiImg.classList.add('walking');
  updateZonesUI();

  const mapRect = mapArea.getBoundingClientRect();
  const zoneRect = zoneEl.getBoundingClientRect();
  const left = zoneRect.left - mapRect.left + zoneRect.width / 2;
  const top = zoneRect.top - mapRect.top + zoneRect.height + 22;
  kurumiWrap.style.left = left + 'px';
  kurumiWrap.style.top = top + 'px';

  setTimeout(() => {
    state.moving = false;
    kurumiImg.classList.remove('walking');
    updateZonesUI();
    if (onArrive) onArrive();
  }, WALK_DURATION);
}

function centerKurumi() {
  const mapRect = mapArea.getBoundingClientRect();
  kurumiWrap.style.left = (mapRect.width / 2) + 'px';
  kurumiWrap.style.top = (mapRect.height / 2) + 'px';
}

// ── 알바(미니게임) ──
function startJob(job) {
  state.currentJob = job;
  state.gauge = 0;
  state.tapsDone = 0;
  jobIcon.src = job.icon;
  jobName.textContent = job.name;
  btnJobTapLabel.textContent = job.label;
  jobGauge.style.width = '0%';
  jobPanel.classList.remove('hidden');
}

function cancelJob() {
  state.currentJob = null;
  jobPanel.classList.add('hidden');
  updateZonesUI();
}

function completeJob() {
  const j = state.currentJob;
  if (!j) return; // 이미 완료 처리된 알바면 무시 (중복 보상 방지)
  state.currentJob = null; // 즉시 null 처리 → 이후 탭은 새 알바로 취급되지 않음(중복 완료 방지)

  state.jobsCompleted++;
  state.coins += j.reward;
  state.timeLeft = Math.min(TIME_MAX, state.timeLeft + j.timeBonus);
  state.cooldowns[j.key] = j.cooldown;

  updateCoinsUI();
  playSound('success');
  setTimeout(() => playSound('coin'), 180);

  showComboToast(`✨ 알바 성공! +${j.timeBonus}초 · +${j.reward}원`);

  kurumiImg.src = 'assets/img/kurumi_happy.png';
  kurumiImg.classList.add('pop');

  setTimeout(() => {
    jobPanel.classList.add('hidden');
    kurumiImg.src = 'assets/img/kurumi_idle.png';
    kurumiImg.classList.remove('pop');
    updateZonesUI();
  }, 750);
}

let toastTimer = null;
function showComboToast(text) {
  comboToast.textContent = text;
  comboToast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => comboToast.classList.remove('show'), 1400);
}

// ── 탭 처리 (알바 중일 때만) ──
function handleTap(e) {
  if (e) e.preventDefault();
  if (!state.running || !state.currentJob || state.screen !== 'game') return;
  const j = state.currentJob;
  state.tapsDone++;
  state.gauge = Math.min(100, state.gauge + j.tapGain);
  jobGauge.style.width = state.gauge + '%';
  playSound('tap', { restart: true });

  kurumiImg.classList.remove('pop');
  kurumiImg.classList.add('shrink');
  requestAnimationFrame(() => {
    setTimeout(() => kurumiImg.classList.remove('shrink'), 90);
  });

  if (state.gauge >= 100) {
    completeJob();
  }
}

// ── 구역(알바/상점) 클릭 처리 ──
function onZoneClick(zoneEl) {
  if (!state.running || state.moving || state.currentJob) return;
  const jobKey = zoneEl.dataset.job;
  if (jobKey) {
    if (state.cooldowns[jobKey] > 0) {
      showComboToast('아직 조금 쉬어야 해요! ⏳');
      return;
    }
    playSound('button');
    moveKurumiTo(zoneEl, () => startJob(JOBS[jobKey]));
  } else {
    // 상점 구역
    playSound('button');
    moveKurumiTo(zoneEl, () => openShop());
  }
}

// ── 코인/타이머 UI ──
function updateCoinsUI() {
  coinText.textContent = state.coins;
  shopCoinText.textContent = state.coins;
}

function updateTimerUI() {
  const pct = Math.max(0, Math.min(100, (state.timeLeft / TIME_MAX) * 100));
  timerBar.style.width = pct + '%';
  const secs = Math.ceil(state.timeLeft);
  timerText.textContent = secs;
  shopTimerText.textContent = secs;
  timerBar.classList.remove('warn', 'danger');
  if (state.timeLeft <= DANGER_TIME) timerBar.classList.add('danger');
  else if (state.timeLeft <= WARN_TIME) timerBar.classList.add('warn');
}

function updateZonesUI() {
  JOB_KEYS.forEach(key => {
    const zoneEl = document.querySelector(`.zone[data-job="${key}"]`);
    const badge = el('cd-' + key);
    const cd = state.cooldowns[key];
    if (cd > 0) {
      badge.textContent = Math.ceil(cd) + 's';
      badge.classList.add('show');
      zoneEl.classList.add('disabled');
      zoneEl.classList.remove('reachable');
    } else {
      badge.classList.remove('show');
      zoneEl.classList.remove('disabled');
      if (!state.currentJob && !state.moving) zoneEl.classList.add('reachable');
      else zoneEl.classList.remove('reachable');
    }
  });
  const shopZone = el('zoneShop');
  if (!state.currentJob && !state.moving) shopZone.classList.add('reachable');
  else shopZone.classList.remove('reachable');
}

// ── 게임 루프 ──
let warnedLow = false;
function loop(ts) {
  if (!state.lastTs) state.lastTs = ts;
  const dt = Math.min(0.05, (ts - state.lastTs) / 1000);
  state.lastTs = ts;

  if (state.running && (state.screen === 'game' || state.screen === 'shop')) {
    // 타이머 감소 (알바 중이든, 걷는 중이든, 쇼핑 중이든 항상 흘러감!)
    state.timeLeft -= dt;

    // 쿨다운 감소
    JOB_KEYS.forEach(k => {
      if (state.cooldowns[k] > 0) {
        state.cooldowns[k] = Math.max(0, state.cooldowns[k] - dt);
      }
    });
    if (state.screen === 'game') updateZonesUI();

    // 알바 게이지 서서히 감소 (탭 안 하면 줄어듦)
    if (state.currentJob && state.gauge > 0) {
      state.gauge = Math.max(0, state.gauge - GAUGE_DECAY_PER_SEC * dt);
      jobGauge.style.width = state.gauge + '%';
    }

    updateTimerUI();

    if (state.timeLeft <= WARN_TIME && !warnedLow) {
      warnedLow = true;
      playSound('timerWarning');
    }
    if (state.timeLeft > WARN_TIME) warnedLow = false;

    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      updateTimerUI();
      endGame('timeout');
    }
  }

  requestAnimationFrame(loop);
}

// ── 게임 시작/종료 ──
function startGame() {
  state.gameStarted = true;
  state.running = true;
  state.timeLeft = TIME_START;
  state.coins = 0;
  state.jobsCompleted = 0;
  state.cooldowns = { stock: 0, cola: 0, ramen: 0, clean: 0 };
  state.gauge = 0;
  state.tapsDone = 0;
  state.currentJob = null;
  state.moving = false;
  SHOP_ITEMS.forEach(it => { state.inventory[it.key] = 0; });
  state.pileLog = [];
  warnedLow = false;

  itemPile.innerHTML = '';
  jobPanel.classList.add('hidden');
  kurumiImg.src = 'assets/img/kurumi_idle.png';
  updateCoinsUI();
  updateTimerUI();
  showScreen('game');
  requestAnimationFrame(() => {
    centerKurumi();
    updateZonesUI();
  });

  if (!state.muted) {
    sounds.bgm.currentTime = 0;
    sounds.bgm.play().catch(() => {});
  }
}

function endGame(reason = 'timeout') {
  state.running = false;
  sounds.bgm.pause();
  playSound('gameOver');
  finalCoins.textContent = state.coins;
  finalMissions.textContent = state.jobsCompleted;

  const overScreen = el('screenOver');
  const overKurumi = el('overKurumi');
  const overTitle = el('overTitle');
  const overSub = el('overSub');
  const overTip = el('overTip');

  if (reason === 'moneySpent') {
    overScreen.classList.add('shopping-complete');
    overKurumi.src = 'assets/img/kurumi_happy.png';
    overTitle.textContent = '코인을 다 썼어요!';
    overSub.textContent = '쿠루미가 쇼핑을 완벽하게 끝냈어요 🎉';
    overTip.textContent = '💡 다음엔 알바를 더 많이 해서 시간이 남았을 때 쇼핑해봐요!';
  } else {
    overScreen.classList.remove('shopping-complete');
    overKurumi.src = 'assets/img/kurumi_sad.png';
    overTitle.textContent = '시간이 다 됐어요!';
    overSub.textContent = '오늘 알바는 여기까지예요 😢';
    overTip.textContent = '💡 알바와 쇼핑을 균형있게 하면 더 많은 걸 살 수 있어요!';
  }

  showScreen('over');
}

// ── 상점 ──
function renderShopGrid() {
  const grid = el('shopGrid');
  grid.innerHTML = SHOP_ITEMS.map(it => `
    <div class="shop-item" data-item="${it.key}" data-price="${it.price}">
      <img src="${it.icon}" alt="${it.name}">
      <div class="shop-item-name">${it.name}</div>
      <div class="shop-item-price"><img src="assets/img/coin.png" class="mini-coin">${it.price}</div>
      <button class="btn-buy">구매하기</button>
      <div class="owned-badge" id="owned-${it.key}">0개 보유</div>
    </div>
  `).join('');

  grid.querySelectorAll('.btn-buy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.target.closest('.shop-item').dataset.item;
      buyItem(key);
    });
  });
}

function openShop() {
  updateCoinsUI();
  renderShopOwned();
  el('shopMsg').textContent = '';
  showScreen('shop');
}

function closeShop() {
  playSound('button');
  showScreen('game');
  updateZonesUI();
}

function renderShopOwned() {
  SHOP_ITEMS.forEach(it => {
    const badge = el('owned-' + it.key);
    if (badge) badge.textContent = state.inventory[it.key] + '개 보유';
  });
  document.querySelectorAll('.shop-item').forEach(itemEl => {
    const key = itemEl.dataset.item;
    const price = SHOP_ITEM_MAP[key].price;
    const btn = itemEl.querySelector('.btn-buy');
    btn.disabled = state.coins < price;
  });
}

// 쿠루미 옆에 구매한 아이템을 쌓아 보여주기
function addToPile(item) {
  state.pileLog.push(item.key);
  const img = document.createElement('img');
  img.src = item.icon;
  img.alt = item.name;
  img.className = 'pile-icon';
  itemPile.appendChild(img);
}

function buyItem(key) {
  if (!state.running) return;
  const item = SHOP_ITEM_MAP[key];
  if (!item || state.coins < item.price) return;
  state.coins -= item.price;
  state.inventory[key]++;
  updateCoinsUI();
  renderShopOwned();
  addToPile(item);
  playSound('purchase');
  el('shopMsg').textContent = `🎉 ${item.name}을 구매했어요!`;

  // 돈을 다 써서 더 이상 아무것도 살 수 없으면 바로 게임 오버
  if (state.coins < SHOP_MIN_PRICE) {
    setTimeout(() => endGame('moneySpent'), 400);
  }
}

// ── 게임 방법 안내 ──
function openRules(fromHelp) {
  state.rulesFromHelp = !!fromHelp;
  if (fromHelp) {
    state.running = false;
    sounds.bgm.pause();
  }
  el('btnRulesGo').textContent = fromHelp ? '게임으로 돌아가기 🎮' : '알았어요! 시작할게요 🎮';
  showScreen('rules');
}

// ── 이벤트 바인딩 ──
btnJobTap.addEventListener('pointerdown', handleTap, { passive: false });

el('btnStart').addEventListener('click', () => { playSound('button'); openRules(false); });
el('btnRulesGo').addEventListener('click', () => {
  playSound('button');
  if (state.rulesFromHelp && state.gameStarted) {
    showScreen('game');
    state.running = true;
    if (!state.muted) sounds.bgm.play().catch(() => {});
    updateZonesUI();
  } else {
    startGame();
  }
});
el('btnRetry').addEventListener('click', () => { playSound('button'); startGame(); });

document.querySelectorAll('.zone').forEach(zoneEl => {
  zoneEl.addEventListener('click', () => onZoneClick(zoneEl));
});

el('btnHelp').addEventListener('click', () => { playSound('button'); openRules(true); });
el('btnCloseShop').addEventListener('click', closeShop);
el('btnResumeFromShop').addEventListener('click', closeShop);

renderShopGrid();

btnMute.addEventListener('click', () => {
  state.muted = !state.muted;
  btnMute.textContent = state.muted ? '🔇' : '🔊';
  if (state.muted) sounds.bgm.pause();
  else if (state.running) sounds.bgm.play().catch(() => {});
});

// 키보드 지원 (스페이스바로 탭)
window.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    handleTap();
  }
});

// 화면 크기 변경 시 쿠루미 위치 재조정 (알바/쇼핑 중이 아닐 때만)
window.addEventListener('resize', () => {
  if (state.screen === 'game' && !state.currentJob && !state.moving) {
    centerKurumi();
  }
});

// iOS Safari 오디오 unlock
document.addEventListener('pointerdown', function unlock() {
  Object.values(sounds).forEach(a => {
    a.play().then(() => a.pause()).catch(() => {});
  });
  document.removeEventListener('pointerdown', unlock);
}, { once: true });

requestAnimationFrame(loop);
