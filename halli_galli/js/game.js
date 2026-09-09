/* 우리 가족 할리갈리 - 1인용 게임 로직 */
(function () {
  'use strict';

  const FACES = [
    { id: 'bada', name: '아빠(바다)', circle: 'assets/img/circle_bada.png' },
    { id: 'mom', name: '엄마', circle: 'assets/img/circle_mom.png' },
    { id: 'yuha', name: '유화', circle: 'assets/img/circle_yuha.png' },
    { id: 'riha', name: '리하', circle: 'assets/img/circle_riha.png' },
  ];
  const FACE_MAP = Object.fromEntries(FACES.map((face) => [face.id, face]));
  const COUNT_DIST = [1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 5];
  const COMPUTER_INFO = { id: 'computer', name: '컴퓨터', emoji: '🤖' };

  let state = null;
  let selected = null;
  let soundOn = true;
  let turnTimer = null;
  let aiBellTimer = null;
  let flashCorrectEl;
  let flashWrongEl;

  const setupScreen = document.getElementById('setupScreen');
  const gameScreen = document.getElementById('gameScreen');
  const resultScreen = document.getElementById('resultScreen');
  const playerSelect = document.getElementById('playerSelect');
  const setupHint = document.getElementById('setupHint');
  const startBtn = document.getElementById('startBtn');
  const playerGrid = document.getElementById('playerGrid');
  const playerBellBtn = document.getElementById('playerBellBtn');
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
    document.body.append(flashCorrectEl, flashWrongEl);
  }

  function flash(type) {
    const el = type === 'correct' ? flashCorrectEl : flashWrongEl;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function playSfx(el) {
    if (!soundOn || !el) return;
    try {
      el.currentTime = 0;
      el.play().catch(() => {});
    } catch (error) {
      // 자동 재생이 막혀도 게임은 계속 진행한다.
    }
  }

  function logMessage(message) {
    messageLog.textContent = message;
  }

  function clearTimers() {
    window.clearTimeout(turnTimer);
    window.clearTimeout(aiBellTimer);
    turnTimer = null;
    aiBellTimer = null;
  }

  playerSelect.querySelectorAll('.player-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      selected = chip.dataset.id;
      playerSelect.querySelectorAll('.player-chip').forEach((item) => {
        item.classList.toggle('selected', item === chip);
        item.setAttribute('aria-pressed', String(item === chip));
      });
      updateSetupHint();
    });
  });

  function updateSetupHint() {
    if (!selected) {
      setupHint.textContent = '캐릭터 한 명을 선택해주세요';
      startBtn.disabled = true;
      return;
    }
    setupHint.textContent = `${FACE_MAP[selected].name}(으)로 컴퓨터와 대결해요!`;
    startBtn.disabled = false;
  }

  startBtn.addEventListener('click', () => {
    if (selected) startGame(selected);
  });

  function buildDeck() {
    const deck = [];
    FACES.forEach((face) => {
      COUNT_DIST.forEach((count) => deck.push({ face: face.id, count }));
    });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function startGame(playerId) {
    clearTimers();
    const players = [
      { id: playerId, info: FACE_MAP[playerId], deck: [], pile: [], score: 0, isComputer: false },
      { id: 'computer', info: COMPUTER_INFO, deck: [], pile: [], score: 0, isComputer: true },
    ];
    buildDeck().forEach((card, index) => players[index % 2].deck.push(card));
    state = {
      players,
      turnIdx: Math.random() < 0.5 ? 0 : 1,
      ended: false,
      bellLocked: false,
      turnLocked: false,
    };

    setupScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    renderPlayerGrid();
    logMessage('게임 시작! 합계가 5가 되는 순간 큰 종을 눌러요.');
    scheduleCurrentTurn(900);
  }

  function avatarMarkup(player) {
    if (player.isComputer) return '<span class="player-emoji" aria-hidden="true">🤖</span>';
    return `<img src="${player.info.circle}" alt="${player.info.name}">`;
  }

  function renderPlayerGrid() {
    playerGrid.className = 'player-grid n2 solo-grid';
    playerGrid.innerHTML = '';
    state.players.forEach((player, index) => {
      const panel = document.createElement('div');
      panel.className = `player-panel${player.isComputer ? ' computer-panel' : ''}`;
      panel.dataset.idx = index;
      panel.innerHTML = `
        <div class="player-header">
          <div class="player-name">
            ${avatarMarkup(player)}
            <span>${player.info.name}</span>
            <span class="role-badge">${player.isComputer ? '컴퓨터' : '나'}</span>
          </div>
        </div>
        <div class="player-stats">
          <span>남은 카드 <b class="stat-deck">${player.deck.length}</b>장</span>
          <span>모은 카드 <b class="stat-score">${player.score}</b>장</span>
        </div>
        <div class="card-area">
          <button class="deck-pile" data-idx="${index}" aria-label="${player.isComputer ? '컴퓨터 카드 더미' : '내 카드 뒤집기'}">
            <span class="deck-pile-face"><span>🂠</span></span>
            <span class="deck-count-badge">${player.deck.length}</span>
          </button>
          <div class="revealed-slot"></div>
        </div>`;
      playerGrid.appendChild(panel);
    });

    playerGrid.querySelectorAll('.deck-pile').forEach((deck) => {
      deck.addEventListener('click', () => onDeckClick(Number(deck.dataset.idx)));
    });
  }

  function renderAll() {
    if (!state) return;
    state.players.forEach((player, index) => {
      const panel = playerGrid.children[index];
      panel.classList.toggle('active-turn', index === state.turnIdx && !state.ended);
      panel.querySelector('.stat-deck').textContent = player.deck.length;
      panel.querySelector('.stat-score').textContent = player.score;

      const deck = panel.querySelector('.deck-pile');
      const deckFace = panel.querySelector('.deck-pile-face');
      panel.querySelector('.deck-count-badge').textContent = player.deck.length;
      deckFace.classList.toggle('empty', player.deck.length === 0);
      deckFace.innerHTML = player.deck.length ? '<span>🂠</span>' : '';
      const canFlip = index === 0 && state.turnIdx === 0 && !state.turnLocked && !state.ended && player.deck.length > 0;
      deck.disabled = !canFlip;
      deck.classList.toggle('disabled', !canFlip);

      const top = player.pile[player.pile.length - 1];
      const slot = panel.querySelector('.revealed-slot');
      if (!top) {
        slot.innerHTML = '<div class="empty-slot">공개 카드 없음</div>';
      } else {
        const info = FACE_MAP[top.face];
        const images = Array.from({ length: top.count }, () => `<img src="${info.circle}" alt="">`).join('');
        slot.innerHTML = `
          <div class="revealed-card" aria-label="${info.name} 사진 ${top.count}개">
            <div class="face-count-count cnt-${top.count}" aria-hidden="true">${images}</div>
          </div>`;
      }
    });

    const current = state.players[state.turnIdx];
    if (current.isComputer) {
      turnAvatar.style.backgroundImage = '';
      turnAvatar.textContent = '🤖';
      turnAvatar.classList.add('emoji-avatar');
      turnText.textContent = state.ended ? '게임 종료!' : '컴퓨터가 카드를 고르는 중...';
    } else {
      turnAvatar.textContent = '';
      turnAvatar.style.backgroundImage = `url(${current.info.circle})`;
      turnAvatar.classList.remove('emoji-avatar');
      turnText.textContent = state.ended ? '게임 종료!' : '내 차례! 내 카드 더미를 눌러요';
    }
    playerBellBtn.disabled = state.ended || state.bellLocked;
    const remaining = state.players.reduce((sum, player) => sum + player.deck.length, 0);
    deckRemain.textContent = `뒤집을 카드: ${remaining}장`;
  }

  function noOneCanFlip() {
    return state.players.every((player) => player.deck.length === 0);
  }

  function setNextTurn() {
    const other = state.turnIdx === 0 ? 1 : 0;
    if (state.players[other].deck.length > 0) state.turnIdx = other;
    else if (state.players[state.turnIdx].deck.length === 0) return false;
    return true;
  }

  function scheduleCurrentTurn(delay = 650) {
    if (!state || state.ended) return;
    window.clearTimeout(turnTimer);
    state.bellLocked = false;
    if (noOneCanFlip()) {
      endGame();
      return;
    }
    if (state.players[state.turnIdx].deck.length === 0 && !setNextTurn()) {
      endGame();
      return;
    }

    const computerTurn = state.turnIdx === 1;
    state.turnLocked = computerTurn;
    renderAll();
    if (computerTurn) {
      turnTimer = window.setTimeout(() => flipCard(1), delay + Math.random() * 450);
    }
  }

  function onDeckClick(index) {
    if (!state || state.ended || index !== 0 || state.turnIdx !== 0 || state.turnLocked) return;
    flipCard(0);
  }

  function flipCard(index) {
    if (!state || state.ended || index !== state.turnIdx) return;
    const player = state.players[index];
    if (!player.deck.length) return;
    window.clearTimeout(turnTimer);
    state.turnLocked = true;
    player.pile.push(player.deck.shift());
    playSfx(sfxFlip);
    logMessage(`${player.isComputer ? '컴퓨터가' : '내가'} 카드를 뒤집었어요. 얼굴 수를 세어보세요!`);
    setNextTurn();
    renderAll();
    openBellWindow();
  }

  function faceSums() {
    const sums = Object.fromEntries(FACES.map((face) => [face.id, 0]));
    state.players.forEach((player) => {
      const top = player.pile[player.pile.length - 1];
      if (top) sums[top.face] += top.count;
    });
    return sums;
  }

  function hasMatch() {
    return Object.values(faceSums()).some((sum) => sum === 5);
  }

  // 아이가 빠르게 찾으면 이길 수 있고, 놓치면 컴퓨터가 가져가는 정도로 반응을 조절한다.
  function computerSkill() {
    const scoreGap = state.players[0].score - state.players[1].score;
    const accuracy = Math.max(0.55, Math.min(0.8, 0.68 + scoreGap * 0.01));
    const reaction = Math.max(1350, Math.min(2550, 1900 - scoreGap * 12)) + Math.random() * 850;
    return { accuracy, reaction };
  }

  function openBellWindow() {
    state.bellLocked = false;
    renderAll();
    if (hasMatch()) {
      const skill = computerSkill();
      logMessage('합계 5가 있을지도 몰라요! 컴퓨터보다 먼저 종을 쳐요!');
      if (Math.random() < skill.accuracy) {
        aiBellTimer = window.setTimeout(() => resolveBell(1), skill.reaction);
      } else {
        turnTimer = window.setTimeout(() => finishCardWindow('컴퓨터가 정답을 놓쳤어요. 다음 카드로 넘어가요!'), 3500);
      }
      return;
    }

    if (Math.random() < 0.055) {
      aiBellTimer = window.setTimeout(() => resolveBell(1), 450 + Math.random() * 500);
    }
    turnTimer = window.setTimeout(() => finishCardWindow('정답이 없어요. 다음 차례!'), 1050);
  }

  function finishCardWindow(message) {
    if (!state || state.ended || state.bellLocked) return;
    clearTimers();
    state.turnLocked = false;
    logMessage(message);
    if (noOneCanFlip()) endGame();
    else scheduleCurrentTurn(650);
  }

  function givePenalty(ringerIndex) {
    const ringer = state.players[ringerIndex];
    const opponent = state.players[ringerIndex === 0 ? 1 : 0];
    if (ringer.deck.length > 0) {
      opponent.deck.push(ringer.deck.shift());
      return 1;
    }
    if (ringer.score > 0) {
      ringer.score -= 1;
      opponent.score += 1;
      return 1;
    }
    return 0;
  }

  function resolveBell(ringerIndex) {
    if (!state || state.ended || state.bellLocked) return;
    clearTimers();
    state.bellLocked = true;
    state.turnLocked = true;
    const ringer = state.players[ringerIndex];

    if (hasMatch()) {
      let taken = 0;
      state.players.forEach((player) => {
        taken += player.pile.length;
        player.pile = [];
      });
      ringer.score += taken;
      playSfx(sfxBell);
      flash('correct');
      logMessage(`🔔 ${ringer.isComputer ? '컴퓨터' : '내가'} 정답! 공개 카드 ${taken}장을 가져갔어요.`);
    } else {
      const penalty = givePenalty(ringerIndex);
      playSfx(sfxBuzz);
      flash('wrong');
      logMessage(`❌ ${ringer.isComputer ? '컴퓨터가' : '내가'} 잘못 눌렀어요.${penalty ? ' 카드 1장을 상대에게 줬어요.' : ''}`);
    }

    renderAll();
    turnTimer = window.setTimeout(() => {
      state.turnLocked = false;
      if (noOneCanFlip()) endGame();
      else scheduleCurrentTurn(700);
    }, 1050);
  }

  playerBellBtn.addEventListener('click', () => resolveBell(0));
  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || !state || state.ended || gameScreen.classList.contains('hidden')) return;
    if (!rulesModal.classList.contains('hidden')) return;
    event.preventDefault();
    resolveBell(0);
  });

  function endGame() {
    if (!state || state.ended) return;
    clearTimers();
    state.ended = true;
    state.players.forEach((player) => {
      player.finalScore = player.score + player.deck.length + player.pile.length;
    });
    playSfx(sfxWin);
    renderAll();
    showResult();
  }

  function showResult() {
    gameScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');
    const [human, computer] = state.players;
    if (human.finalScore > computer.finalScore) winnerTitle.textContent = '내가 이겼어요! 🏆';
    else if (human.finalScore < computer.finalScore) winnerTitle.textContent = '컴퓨터가 이겼어요! 다시 도전해요';
    else winnerTitle.textContent = '무승부예요! 정말 팽팽했어요 🎉';

    const sorted = state.players.slice().sort((a, b) => b.finalScore - a.finalScore);
    const topScore = sorted[0].finalScore;
    resultList.innerHTML = '';
    sorted.forEach((player, index) => {
      const row = document.createElement('div');
      row.className = `result-row${player.finalScore === topScore ? ' winner' : ''}`;
      row.innerHTML = `
        <span class="rrank">${index === 0 ? '🥇' : '🥈'}</span>
        ${player.isComputer ? '<span class="result-emoji" aria-hidden="true">🤖</span>' : `<img src="${player.info.circle}" alt="${player.info.name}">`}
        <span class="rname">${player.isComputer ? '컴퓨터' : `${player.info.name} (나)`}</span>
        <span class="rscore">${player.finalScore}장</span>`;
      resultList.appendChild(row);
    });
  }

  function backToSetup() {
    clearTimers();
    state = null;
    selected = null;
    gameScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
    playerSelect.querySelectorAll('.player-chip').forEach((chip) => {
      chip.classList.remove('selected');
      chip.setAttribute('aria-pressed', 'false');
    });
    updateSetupHint();
  }

  restartBtn.addEventListener('click', () => {
    if (!state || state.ended || window.confirm('정말 다시 시작할까요? 지금까지 진행한 게임이 사라져요.')) backToSetup();
  });
  playAgainBtn.addEventListener('click', backToSetup);

  rulesBtn.addEventListener('click', () => rulesModal.classList.remove('hidden'));
  rulesCloseBtn.addEventListener('click', () => rulesModal.classList.add('hidden'));
  rulesOkBtn.addEventListener('click', () => rulesModal.classList.add('hidden'));
  rulesModal.addEventListener('click', (event) => {
    if (event.target === rulesModal) rulesModal.classList.add('hidden');
  });

  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-pressed', String(!soundOn));
    soundBtn.setAttribute('aria-label', soundOn ? '소리 끄기' : '소리 켜기');
  });

  ensureFlashOverlays();
  playerSelect.querySelectorAll('.player-chip').forEach((chip) => chip.setAttribute('aria-pressed', 'false'));
  updateSetupHint();
})();
