// ══════════════════════════════════════════════
// 손님들의 무한 편의점 - 쿠루미의 미션 대모험
// ══════════════════════════════════════════════

// ── 상수 ──
const TIMER_MAX = 18;          // 타이머 바 최대치(초) - 이 이상은 쌓이지 않음
const TIMER_START = 12;        // 시작 시간(초)
const GAUGE_DECAY_PER_SEC = 7; // 미션 게이지 초당 감소량 (탭 안 하면 서서히 줄어듦)
const MISSION_COOLDOWN = 9;    // 같은 미션이 다시 나오기까지 최소 대기(초)
const WARN_TIME = 6;           // 경고색 전환 시점(초)
const DANGER_TIME = 3;         // 위험색 전환 시점(초)

const MISSIONS = {
  water: {
    key: 'water',
    name: '물 마시기 미션 💧',
    icon: 'assets/img/item_water.png',
    tapsNeeded: 6,
    tapGain: 100 / 6,
    reward: 8,
    timeBonus: 5,
    label: '벌컥벌컥!'
  },
  ramen: {
    key: 'ramen',
    name: '라면 먹기 미션 🍜',
    icon: 'assets/img/item_ramen.png',
    tapsNeeded: 10,
    tapGain: 100 / 10,
    reward: 15,
    timeBonus: 9,
    label: '후루룩!'
  },
  cola: {
    key: 'cola',
    name: '콜라 마시기 미션 🥤',
    icon: 'assets/img/item_cola.png',
    tapsNeeded: 8,
    tapGain: 100 / 8,
    reward: 12,
    timeBonus: 7,
    label: '꿀꺽꿀꺽!'
  }
};
const MISSION_KEYS = Object.keys(MISSIONS);

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
  screen: 'start',      // start | game | shop | over
  running: false,
  timeLeft: TIMER_START,
  coins: 0,
  missionsCompleted: 0,
  cooldowns: { water: 0, ramen: 0, cola: 0 },
  currentMission: null,
  gauge: 0,
  tapsDone: 0,
  muted: false,
  inventory: {},   // key -> 개수
  pileLog: [],     // 구매한 아이템 순서 기록 (쿠루미 옆 쌓기용)
  lastTs: 0,
  missionTransitioning: false,
};
SHOP_ITEMS.forEach(it => { state.inventory[it.key] = 0; });

// ── DOM ──
const el = (id) => document.getElementById(id);
const screens = {
  start: el('screenStart'),
  game: el('screenGame'),
  shop: el('screenShop'),
  over: el('screenOver'),
};

const timerBar = el('timerBar');
const timerText = el('timerText');
const coinText = el('coinText');
const shopCoinText = el('shopCoinText');
const comboToast = el('comboToast');
const kurumiImg = el('kurumiImg');
const itemPile = el('itemPile');
const missionIcon = el('missionIcon');
const missionName = el('missionName');
const missionGauge = el('missionGauge');
const btnTap = el('btnTap');
const btnTapLabel = el('btnTapLabel');
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
    // 상점은 게임 화면 위에 오버레이로 뜸
    screens.game.classList.add('active');
    screens.shop.classList.add('active');
  } else {
    screens[name].classList.add('active');
  }
  state.screen = name;
}

// ── 미션 선택 로직 ──
function pickNextMission() {
  // 쿨다운 아닌 것들 중 랜덤 선택
  const available = MISSION_KEYS.filter(k => state.cooldowns[k] <= 0);
  let pool = available.length > 0 ? available : MISSION_KEYS;
  // 직전 미션과 같은 것은 가능하면 피함
  if (pool.length > 1 && state.currentMission) {
    const filtered = pool.filter(k => k !== state.currentMission.key);
    if (filtered.length > 0) pool = filtered;
  }
  const key = pool[Math.floor(Math.random() * pool.length)];
  return MISSIONS[key];
}

function startMission(mission) {
  state.currentMission = mission;
  state.gauge = 0;
  state.tapsDone = 0;
  missionIcon.src = mission.icon;
  missionName.textContent = mission.name;
  btnTapLabel.textContent = mission.label;
  missionGauge.style.width = '0%';
  kurumiImg.className = 'kurumi-char';
}

function completeMission() {
  const m = state.currentMission;
  state.missionsCompleted++;
  state.coins += m.reward;
  state.timeLeft = Math.min(TIMER_MAX, state.timeLeft + m.timeBonus);
  state.cooldowns[m.key] = MISSION_COOLDOWN;

  updateCoinsUI();
  playSound('success');
  setTimeout(() => playSound('coin'), 180);

  showComboToast(`✨ 미션 성공! +${m.timeBonus}초 · +${m.reward}코인`);

  kurumiImg.src = 'assets/img/kurumi_happy.png';
  kurumiImg.className = 'kurumi-char pop';

  state.missionTransitioning = true;
  btnTap.disabled = true;
  setTimeout(() => {
    kurumiImg.src = 'assets/img/kurumi_idle.png';
    startMission(pickNextMission());
    btnTap.disabled = false;
    state.missionTransitioning = false;
  }, 850);
}

let toastTimer = null;
function showComboToast(text) {
  comboToast.textContent = text;
  comboToast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => comboToast.classList.remove('show'), 1400);
}

// ── 탭 처리 ──
function handleTap(e) {
  if (e) e.preventDefault();
  if (!state.running || state.missionTransitioning || state.screen !== 'game') return;
  const m = state.currentMission;
  if (!m) return;
  state.tapsDone++;
  state.gauge = Math.min(100, state.gauge + m.tapGain);
  missionGauge.style.width = state.gauge + '%';
  playSound('tap', { restart: true });

  kurumiImg.classList.remove('pop');
  kurumiImg.classList.add('shrink');
  requestAnimationFrame(() => {
    setTimeout(() => kurumiImg.classList.remove('shrink'), 90);
  });

  if (state.gauge >= 100) {
    completeMission();
  }
}

// ── 코인/타이머 UI ──
function updateCoinsUI() {
  coinText.textContent = state.coins;
  shopCoinText.textContent = state.coins;
}

function updateTimerUI() {
  const pct = Math.max(0, Math.min(100, (state.timeLeft / TIMER_MAX) * 100));
  timerBar.style.width = pct + '%';
  timerText.textContent = Math.ceil(state.timeLeft);
  timerBar.classList.remove('warn', 'danger');
  if (state.timeLeft <= DANGER_TIME) timerBar.classList.add('danger');
  else if (state.timeLeft <= WARN_TIME) timerBar.classList.add('warn');
}

// ── 게임 루프 ──
let warnedLow = false;
function loop(ts) {
  if (!state.lastTs) state.lastTs = ts;
  const dt = Math.min(0.05, (ts - state.lastTs) / 1000);
  state.lastTs = ts;

  if (state.running && state.screen === 'game') {
    // 타이머 감소
    state.timeLeft -= dt;

    // 쿨다운 감소
    MISSION_KEYS.forEach(k => {
      if (state.cooldowns[k] > 0) state.cooldowns[k] = Math.max(0, state.cooldowns[k] - dt);
    });

    // 미션 게이지 서서히 감소 (탭 안 하면 줄어듦)
    if (!state.missionTransitioning && state.gauge > 0) {
      state.gauge = Math.max(0, state.gauge - GAUGE_DECAY_PER_SEC * dt);
      missionGauge.style.width = state.gauge + '%';
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
      endGame();
    }
  }

  requestAnimationFrame(loop);
}

// ── 게임 시작/종료 ──
function startGame() {
  state.running = true;
  state.timeLeft = TIMER_START;
  state.coins = 0;
  state.missionsCompleted = 0;
  state.cooldowns = { water: 0, ramen: 0, cola: 0 };
  state.gauge = 0;
  state.tapsDone = 0;
  state.missionTransitioning = false;
  SHOP_ITEMS.forEach(it => { state.inventory[it.key] = 0; });
  state.pileLog = [];
  warnedLow = false;

  itemPile.innerHTML = '';
  updateCoinsUI();
  updateTimerUI();
  showScreen('game');
  startMission(pickNextMission());
  btnTap.disabled = false;

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
  finalMissions.textContent = state.missionsCompleted;

  const overScreen = el('screenOver');
  const overKurumi = el('overKurumi');
  const overTitle = el('overTitle');
  const overSub = el('overSub');

  if (reason === 'moneySpent') {
    overScreen.classList.add('shopping-complete');
    overKurumi.src = 'assets/img/kurumi_happy.png';
    overTitle.textContent = '코인을 다 썼어요!';
    overSub.textContent = '쿠루미가 쇼핑을 완벽하게 끝냈어요 🎉';
  } else {
    overScreen.classList.remove('shopping-complete');
    overKurumi.src = 'assets/img/kurumi_sad.png';
    overTitle.textContent = '시간이 다 됐어요!';
    overSub.textContent = '쿠루미가 미션을 다 못 끝냈어요 😢';
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
  playSound('button');
  state.running = false; // 타이머 정지
  sounds.bgm.pause();
  updateCoinsUI();
  renderShopOwned();
  el('shopMsg').textContent = '';
  showScreen('shop');
}

function closeShop() {
  playSound('button');
  showScreen('game');
  state.running = true;
  if (!state.muted) sounds.bgm.play().catch(() => {});
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

// ── 이벤트 바인딩 ──
btnTap.addEventListener('pointerdown', handleTap, { passive: false });

el('btnStart').addEventListener('click', () => { playSound('button'); startGame(); });
el('btnRetry').addEventListener('click', () => { playSound('button'); startGame(); });

el('btnShop').addEventListener('click', openShop);
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

// iOS Safari 오디오 unlock
document.addEventListener('pointerdown', function unlock() {
  Object.values(sounds).forEach(a => {
    a.play().then(() => a.pause()).catch(() => {});
  });
  document.removeEventListener('pointerdown', unlock);
}, { once: true });

requestAnimationFrame(loop);
