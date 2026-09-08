/* ══════════════════════════════════════
   우리 가족 할리갈리 - 게임 로직
   ══════════════════════════════════════ */
(function () {
  'use strict';

  // ---------- 데이터 ----------
  const FACES = [
    { id: 'bada', name: '아빠(바다)', img: 'assets/img/face_bada.jpg', circle: 'assets/img/circle_bada.png' },
    { id: 'mom',  name: '엄마',       img: 'assets/img/face_mom.jpg',  circle: 'assets/img/circle_mom.png' },
    { id: 'yuha', name: '유화',       img: 'assets/img/face_yuha.jpg', circle: 'assets/img/circle_yuha.png' },
    { id: 'riha', name: '리하',       img: 'assets/img/face_riha.jpg', circle: 'assets/img/circle_riha.png' },
  ];
  const FACE_MAP = {};
  FACES.forEach((f) => (FACE_MAP[f.id] = f));

  // 얼굴 1명당 14장: 1개x5, 2개x4, 3개x3, 4개x1, 5개x1 = 원작 할리갈리 구성
  const COUNT_DIST = [1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 5];

  let state = null; // 진행중인 게임 상태
  let soundOn = true;
  let flashCorrectEl, flashWrongEl;

  // ---------- DOM ----------
  const setupScreen = document.getElementById('setupScreen');
  const gameScreen = document.getElementById('gameScreen');
  const resultScreen = document.getElementById('resultScreen');
  const playerSelect = document.getElementById('playerSelect');
  const setupHint = document.getElementById('setupHint');
  const startBtn = document.getElementById('startBtn');
  const playerGrid = document.getElementById('playerGrid');
  const turnAvatar = document.getElementById('turnAvatar');
  const turnText = document.getElementById('turnText');
  const messageLog = document.getElementById('messageLog');
  const deckRemain = document.getElementById('deckRemain');
  const restartBtn = document.getElementById('restartBtn');
  const winnerTitle = document.getElementById('winnerTitle');
  const resultList = document.getElementById('resultList');
  const playAgainBtn = document.getElementById('playAgainBtn');
  const rulesBtn = document.getElementById('rulesBtn');
  const rulesModal = document.getElementById('rulesModal');
  const rulesCloseBtn = document.getElementById('rulesCloseBtn');
  const rulesOkBtn = document.getElementById('rulesOkBtn');
  const soundBtn = document.getElementById('soundBtn');
  const sfxFlip = document.getElementById('sfxFlip');
  const sfxBell = document.getElementById('sfxBell');
  const sfxBuzz = document.getElementById('sfxBuzz');
  const sfxWin = document.getElementById('sfxWin');

  function ensureFlashOverlays() {
    flashCorrectEl = document.createElement('div');
    flashCorrectEl.className = 'flash-correct';
    flashWrongEl = document.createElement('div');
    flashWrongEl.className = 'flash-wrong';
    document.body.appendChild(flashCorrectEl);
    document.body.appendChild(flashWrongEl);
  }

  function flash(type) {
    const el = type === 'correct' ? flashCorrectEl : flashWrongEl;
    el.classList.remove('show');
    void el.offsetWidth; // 애니메이션 재시작 트릭
    el.classList.add('show');
  }

  function playSfx(el) {
    if (!soundOn || !el) return;
    try {
      el.currentTime = 0;
      el.play().catch(() => {});
    } catch (e) {
      /* ignore */
    }
  }

  function logMessage(msg) {
    messageLog.textContent = msg;
  }

  // ---------- 셋업: 플레이어 선택 ----------
  let selected = [];

  playerSelect.querySelectorAll('.player-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.id;
      const idx = selected.indexOf(id);
      if (idx >= 0) {
        selected.splice(idx, 1);
        chip.classList.remove('selected');
      } else {
        if (selected.length >= 4) return;
        selected.push(id);
        chip.classList.add('selected');
      }
      updateSetupHint();
    });
  });

  function updateSetupHint() {
    if (selected.length < 2) {
      setupHint.textContent = `최소 2명을 선택해주세요 (현재 ${selected.length}명 선택됨)`;
      startBtn.disabled = true;
    } else {
      setupHint.textContent = `${selected.length}명이 함께 플레이해요! 🎉`;
      startBtn.disabled = false;
    }
  }

  startBtn.addEventListener('click', () => {
    if (selected.length < 2) return;
    startGame(selected.slice());
  });

  // ---------- 덱 만들기 ----------
  function buildDeck() {
    const deck = [];
    FACES.forEach((f) => {
      COUNT_DIST.forEach((n) => {
        deck.push({ face: f.id, count: n });
      });
    });
    // Fisher-Yates 셔플
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }
    return deck;
  }

  // ---------- 게임 시작 ----------
  function startGame(playerIds) {
    const fullDeck = buildDeck();
    const players = playerIds.map((id) => ({
      id,
      info: FACE_MAP[id],
      deck: [], // 뒤집기 전 카드 (face-down)
      pile: [], // 뒤집어서 공개된 카드들 (맨 마지막이 위 = 보이는 카드)
      score: 0, // 종치기로 획득해서 영구히 모은 카드 수
      out: false,
    }));

    // 골고루 라운드로빈으로 분배
    let pi = 0;
    fullDeck.forEach((card) => {
      players[pi % players.length].deck.push(card);
      pi++;
    });

    state = {
      players,
      turnIdx: 0,
      ended: false,
    };

    setupScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    renderPlayerGrid();
    advanceTurn(true);
    logMessage('게임 시작! 순서대로 카드를 뒤집어요 🔔');
    renderAll();
  }

  // ---------- 화면 렌더링 ----------
  function renderPlayerGrid() {
    playerGrid.className = 'player-grid n' + state.players.length;
    playerGrid.innerHTML = '';
    state.players.forEach((p, idx) => {
      const panel = document.createElement('div');
      panel.className = 'player-panel';
      panel.dataset.idx = idx;
      panel.innerHTML = `
        <div class="player-header">
          <div class="player-name">
            <img src="${p.info.circle}" alt="${p.info.name}">
            <span>${p.info.name}</span>
          </div>
        </div>
        <div class="player-stats">
          <span>덱 <b class="stat-deck">${p.deck.length}</b>장</span>
          <span>모은 카드 <b class="stat-score">${p.score}</b>장</span>
        </div>
        <div class="card-area">
          <div class="deck-pile" data-idx="${idx}" title="내 차례에 눌러서 카드 뒤집기">
            <div class="deck-pile-face"><span>🂠</span></div>
            <div class="deck-count-badge">${p.deck.length}</div>
          </div>
          <div class="revealed-slot"></div>
        </div>
        <button class="bell-btn" data-idx="${idx}">🔔 종치기!</button>
      `;
      playerGrid.appendChild(panel);
    });

    playerGrid.querySelectorAll('.deck-pile').forEach((el) => {
      el.addEventListener('click', () => onDeckClick(parseInt(el.dataset.idx, 10)));
    });
    playerGrid.querySelectorAll('.bell-btn').forEach((el) => {
      el.addEventListener('click', () => onBellClick(parseInt(el.dataset.idx, 10)));
    });
  }

  function renderAll() {
    if (!state) return;
    state.players.forEach((p, idx) => {
      const panel = playerGrid.children[idx];
      if (!panel) return;
      panel.classList.toggle('active-turn', idx === state.turnIdx && !p.out && !state.ended);
      panel.classList.toggle('out', p.out);

      panel.querySelector('.stat-deck').textContent = p.deck.length;
      panel.querySelector('.stat-score').textContent = p.score;

      const deckPile = panel.querySelector('.deck-pile');
      const deckFace = panel.querySelector('.deck-pile-face');
      const badge = panel.querySelector('.deck-count-badge');
      badge.textContent = p.deck.length;
      deckFace.classList.toggle('empty', p.deck.length === 0);
      deckFace.innerHTML = p.deck.length > 0 ? '<span>🂠</span>' : '';

      const canFlip = idx === state.turnIdx && !p.out && !state.ended && p.deck.length > 0;
      deckPile.classList.toggle('disabled', !canFlip);

      const slot = panel.querySelector('.revealed-slot');
      const top = p.pile.length > 0 ? p.pile[p.pile.length - 1] : null;
      if (top) {
        const faceInfo = FACE_MAP[top.face];
        let imgs = '';
        for (let i = 0; i < top.count; i++) {
          imgs += `<img src="${faceInfo.img}" alt="${faceInfo.name}">`;
        }
        slot.innerHTML = `<div class="revealed-card"><div class="face-count-count cnt-${top.count}">${imgs}</div></div>`;
      } else {
        slot.innerHTML = `<div class="empty-slot">카드 없음</div>`;
      }

      const bellBtn = panel.querySelector('.bell-btn');
      bellBtn.disabled = state.ended;
    });

    const cur = state.players[state.turnIdx];
    turnAvatar.style.backgroundImage = `url(${cur.info.circle})`;
    turnText.textContent = state.ended ? '게임 종료!' : `${cur.info.name}의 차례예요! 카드를 뒤집어보세요`;

    const totalRemain = state.players.reduce((s, p) => s + p.deck.length + p.pile.length, 0);
    deckRemain.textContent = `남은 카드: ${totalRemain}장`;
  }

  // ---------- 플레이 로직 ----------
  function activePlayers() {
    return state.players.filter((p) => !p.out);
  }

  function recomputeOutStatus() {
    state.players.forEach((p) => {
      p.out = p.deck.length === 0 && p.pile.length === 0;
    });
  }

  // 아무도 더 이상 카드를 뒤집을 수 없으면(모두 덱이 0장) 게임이 자연스럽게 끝나야 함.
  // (그렇지 않으면 아무도 정확히 5를 만들지 못할 경우 게임이 영원히 멈춰버림)
  function noOneCanFlip() {
    return state.players.every((p) => p.out || p.deck.length === 0);
  }

  // isFirst = true : 게임 시작 시 첫 턴 찾기 (인덱스 0부터)
  // isFirst = false: 현재 턴에서 다음 턴으로 넘기기
  function advanceTurn(isFirst) {
    const n = state.players.length;
    let idx = isFirst ? 0 : (state.turnIdx + 1) % n;
    let tries = 0;
    while (tries < n) {
      const p = state.players[idx];
      if (!p.out && p.deck.length > 0) {
        state.turnIdx = idx;
        return;
      }
      idx = (idx + 1) % n;
      tries++;
    }
    // 아무도 뒤집을 카드가 없음 (모두 pile만 갖고 있거나 게임 종료 임박)
    state.turnIdx = idx;
  }

  // 종을 잘못 눌렀을 때/치명적 상태변화 후, 현재 턴이 더 이상 유효하지 않으면 보정
  function ensureValidTurn() {
    const n = state.players.length;
    let idx = state.turnIdx;
    let tries = 0;
    while (tries < n) {
      const p = state.players[idx];
      if (!p.out && p.deck.length > 0) {
        state.turnIdx = idx;
        return;
      }
      idx = (idx + 1) % n;
      tries++;
    }
    state.turnIdx = idx;
  }

  function onDeckClick(idx) {
    if (!state || state.ended) return;
    if (idx !== state.turnIdx) return;
    const p = state.players[idx];
    if (p.out || p.deck.length === 0) return;

    const card = p.deck.shift();
    p.pile.push(card);
    playSfx(sfxFlip);
    logMessage(`${p.info.name}가 카드를 뒤집었어요!`);

    recomputeOutStatus();

    if (activePlayers().length <= 1 || noOneCanFlip()) {
      endGame();
      return;
    }

    advanceTurn(false);
    renderAll();
  }

  function onBellClick(idx) {
    if (!state || state.ended) return;
    const ringer = state.players[idx];
    if (ringer.out) return;

    // 현재 공개되어 있는 "맨 위" 카드들의 얼굴별 합계 계산
    const sums = {};
    FACES.forEach((f) => (sums[f.id] = 0));
    state.players.forEach((p) => {
      if (p.pile.length > 0) {
        const top = p.pile[p.pile.length - 1];
        sums[top.face] += top.count;
      }
    });
    const matched = Object.keys(sums).some((f) => sums[f] === 5);

    if (matched) {
      let taken = 0;
      state.players.forEach((p) => {
        taken += p.pile.length;
        p.pile = [];
      });
      ringer.score += taken;
      playSfx(sfxBell);
      flash('correct');
      logMessage(`🔔 ${ringer.info.name} 정답! 카드 ${taken}장을 모았어요!`);
    } else {
      playSfx(sfxBuzz);
      flash('wrong');
      const others = state.players.filter((p, i) => i !== idx && !p.out);
      let given = 0;
      others.forEach((p) => {
        if (ringer.deck.length > 0) {
          const c = ringer.deck.shift();
          p.deck.push(c);
          given++;
        }
      });
      logMessage(`❌ ${ringer.info.name} 오답! 벌칙 카드를 ${given}장 나눠줬어요.`);
    }

    recomputeOutStatus();

    if (activePlayers().length <= 1 || noOneCanFlip()) {
      endGame();
      return;
    }

    ensureValidTurn();
    renderAll();
  }

  // ---------- 게임 종료 ----------
  function endGame() {
    state.ended = true;
    state.players.forEach((p) => {
      // 최종 점수 = 종치기로 모은 카드 + 아직 갖고 있던 덱/공개 카드
      p.finalScore = p.score + p.deck.length + p.pile.length;
    });
    playSfx(sfxWin);
    renderAll();
    showResult();
  }

  function showResult() {
    gameScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');

    const sorted = state.players.slice().sort((a, b) => b.finalScore - a.finalScore);
    const topScore = sorted[0].finalScore;
    const winners = sorted.filter((p) => p.finalScore === topScore);

    winnerTitle.textContent =
      winners.length > 1 ? '무승부! 모두 승자예요 🎉' : `${winners[0].info.name} 승리! 🏆`;

    resultList.innerHTML = '';
    const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣'];
    sorted.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'result-row' + (p.finalScore === topScore ? ' winner' : '');
      row.innerHTML = `
        <span class="rrank">${rankEmojis[i] || i + 1}</span>
        <img src="${p.info.circle}" alt="${p.info.name}">
        <span class="rname">${p.info.name}</span>
        <span class="rscore">${p.finalScore}장</span>
      `;
      resultList.appendChild(row);
    });
  }

  // ---------- 다시 시작 ----------
  function backToSetup() {
    state = null;
    gameScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
    selected = [];
    playerSelect.querySelectorAll('.player-chip').forEach((c) => c.classList.remove('selected'));
    updateSetupHint();
  }

  restartBtn.addEventListener('click', () => {
    if (!state || state.ended || confirm('정말 다시 시작할까요? 지금까지 진행한 게임이 사라져요.')) {
      backToSetup();
    }
  });
  playAgainBtn.addEventListener('click', backToSetup);

  // ---------- 규칙 모달 ----------
  rulesBtn.addEventListener('click', () => rulesModal.classList.remove('hidden'));
  rulesCloseBtn.addEventListener('click', () => rulesModal.classList.add('hidden'));
  rulesOkBtn.addEventListener('click', () => rulesModal.classList.add('hidden'));
  rulesModal.addEventListener('click', (e) => {
    if (e.target === rulesModal) rulesModal.classList.add('hidden');
  });

  // ---------- 사운드 토글 ----------
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? '🔊' : '🔇';
  });

  // ---------- 초기화 ----------
  ensureFlashOverlays();
  updateSetupHint();
})();
