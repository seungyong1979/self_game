/* ============================================
   99일의 생존 - 펭귄의 얼음 모험
   Main Game Logic (Canvas-based)
   ============================================ */

'use strict';

// ============================================
// CONSTANTS & CONFIG
// ============================================
const CONFIG = {
    GRID_COLS: 9,
    GRID_ROWS: 7,
    TOTAL_DAYS: 99,
    DAY_DURATION_MS: 3000,        // 3초 = 1일
    ICE_CRACK_BASE_MS: 3000,      // 기본 얼음 깨짐 시간
    ICE_CRACK_MIN_MS: 600,        // 최소 얼음 깨짐 시간 (후반)
    ICE_REGEN_TIME_MS: 10000,     // 10초 후 얼음 재생
    COIN_COUNT: 5,                // 동시에 존재하는 동전 수
    COIN_SCORE: 10,               // 동전당 점수
    MOVE_COOLDOWN_MS: 200,        // 이동 쿨다운 (ms)
    SEAL_CATCH_DIST: 0,            // 바다표범 잡기 거리: 0 = 완전히 같은 칸일 때만
    SEAL_MOVE_INTERVAL_BASE: 2200,// 바다표범 이동 간격 기본값 (ms)
};

// 날짜에 따른 얼음 깨짐 시간 계산
function getIceCrackTime() {
    const day = State.day;
    // 1일~99일: 3000ms → 600ms 선형 감소
    const t = (day - 1) / (CONFIG.TOTAL_DAYS - 1);
    return Math.max(CONFIG.ICE_CRACK_MIN_MS,
        CONFIG.ICE_CRACK_BASE_MS - t * (CONFIG.ICE_CRACK_BASE_MS - CONFIG.ICE_CRACK_MIN_MS)
    );
}

// ============================================
// GAME STATE
// ============================================
const State = {
    running: false,
    day: 1,
    score: 0,
    lastTime: 0,
    dayTimer: 0,
    moveTimer: 0,
    gameOver: false,
    win: false,

    // Penguin
    penguin: {
        col: 4,
        row: 3,
        pixelX: 0,    // smooth animation
        pixelY: 0,
        targetX: 0,
        targetY: 0,
        moving: false,
        moveProgress: 0,
        direction: 'down',  // for sprite
        standTimer: 0,      // how long on same tile
        isAngel: false,
        angelY: 0,
        fallProgress: 0,    // for falling animation
        falling: false,
        fallY: 0,
        sealBite: false,
        startX: 0,
        startY: 0,
    },

    // Ice tiles [row][col]
    iceGrid: [],

    // Coins
    coins: [],

    // Particles
    particles: [],

    // Input
    inputQueue: [],
    keysDown: {},

    // Seal (death trigger only)
    seal: {
        active: false,
        x: 0,
        y: 0,
        progress: 0,
        visible: false,
    },

    // Hunting seals (on ice)
    huntingSeals: [],
    sealSpawnDays: [20, 40, 60, 80],  // 이 날에 바다표범 추가 등장
    lastSealCheckDay: 0,

    // Camera/viewport
    canvas: null,
    ctx: null,
    tileW: 64,
    tileH: 32,
    tileDepth: 18,
    gridOffsetX: 0,
    gridOffsetY: 0,
};

// ICE tile states
const ICE = {
    SOLID: 0,
    CRACKING_1: 1,
    CRACKING_2: 2,
    CRACKING_3: 3,
    BROKEN: 4,
    REGENERATING: 5,
};

// ============================================
// INIT & RESIZE
// ============================================
function initGame() {
    State.canvas = document.getElementById('gameCanvas');
    State.ctx = State.canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    setupInput();
    setupMobileControls();
    createSnowflakes();
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    const wrapper = document.getElementById('game-wrapper');
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;

    // Calculate tile size based on available space
    const isoWidth = CONFIG.GRID_COLS * 64;
    const isoHeight = CONFIG.GRID_ROWS * 32 + 32 + 60;
    const scaleX = w / (isoWidth + 80);
    const scaleY = h / (isoHeight + 80);
    const scale = Math.min(scaleX, scaleY, 1.5);

    State.tileW = Math.floor(64 * scale);
    State.tileH = Math.floor(32 * scale);
    State.tileDepth = Math.floor(20 * scale);

    State.canvas.width = w;
    State.canvas.height = h;

    // Center the isometric grid
    const totalGridW = CONFIG.GRID_COLS * State.tileW;
    const totalGridH = (CONFIG.GRID_ROWS + CONFIG.GRID_COLS) * (State.tileH / 2);
    State.gridOffsetX = w / 2;
    State.gridOffsetY = h / 2 - totalGridH / 2 + State.tileH * 1.5;

    // Update penguin pixel positions
    const p = State.penguin;
    const pos = isoProject(p.col, p.row);
    p.pixelX = pos.x;
    p.pixelY = pos.y;
    p.targetX = pos.x;
    p.targetY = pos.y;
}

// ============================================
// ISOMETRIC PROJECTION
// ============================================
function isoProject(col, row) {
    return {
        x: State.gridOffsetX + (col - row) * (State.tileW / 2),
        y: State.gridOffsetY + (col + row) * (State.tileH / 2)
    };
}

// ============================================
// GRID INIT
// ============================================
function initGrid() {
    State.iceGrid = [];
    for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
        State.iceGrid[r] = [];
        for (let c = 0; c < CONFIG.GRID_COLS; c++) {
            State.iceGrid[r][c] = {
                state: ICE.SOLID,
                crackTimer: 0,
                regenTimer: 0,
                crackLevel: 0,
            };
        }
    }
}

function initCoins() {
    State.coins = [];
    for (let i = 0; i < CONFIG.COIN_COUNT; i++) {
        spawnCoin();
    }
}

function spawnCoin() {
    // Find empty tile (not where penguin is)
    let attempts = 0;
    while (attempts < 50) {
        const col = Math.floor(Math.random() * CONFIG.GRID_COLS);
        const row = Math.floor(Math.random() * CONFIG.GRID_ROWS);
        const p = State.penguin;
        if ((col !== p.col || row !== p.row) &&
            State.iceGrid[row][col].state === ICE.SOLID &&
            !State.coins.find(c => c.col === col && c.row === row)) {
            const pos = isoProject(col, row);
            State.coins.push({
                col, row,
                x: pos.x,
                y: pos.y,
                bobOffset: Math.random() * Math.PI * 2,
                collected: false,
                scale: 1,
            });
            return;
        }
        attempts++;
    }
}

// ============================================
// START / RESTART
// ============================================
function startGame() {
    document.getElementById('start-screen').style.display = 'none';

    // Init sound
    SoundManager.init();
    SoundManager.resume();
    SoundManager.startBGMusic();
    SoundManager.startWind();

    resetGame();
    State.running = true;
}

function resetGame() {
    State.day = 1;
    State.score = 0;
    State.gameOver = false;
    State.win = false;
    State.dayTimer = 0;
    State.lastTime = 0;
    State.particles = [];
    State.inputQueue = [];
    State.keysDown = {};

    // Reset penguin
    const p = State.penguin;
    p.col = Math.floor(CONFIG.GRID_COLS / 2);
    p.row = Math.floor(CONFIG.GRID_ROWS / 2);
    p.direction = 'down';
    p.standTimer = 0;
    p.isAngel = false;
    p.angelY = 0;
    p.moving = false;
    p.moveProgress = 0;
    p.falling = false;
    p.fallY = 0;
    p.sealBite = false;

    const startPos = isoProject(p.col, p.row);
    p.pixelX = startPos.x;
    p.pixelY = startPos.y;
    p.targetX = startPos.x;
    p.targetY = startPos.y;
    p.startX = startPos.x;
    p.startY = startPos.y;

    // Reset seal
    State.seal.active = false;
    State.seal.visible = false;
    State.huntingSeals = [];
    State.lastSealCheckDay = 0;

    initGrid();
    initCoins();
    updateHUD();
}

function restartGame() {
    document.getElementById('gameover-screen').style.display = 'none';
    document.getElementById('win-screen').style.display = 'none';

    SoundManager.resume();
    SoundManager.startBGMusic();
    SoundManager.startWind();

    resetGame();
    State.running = true;
    State.lastTime = 0;
}

// ============================================
// INPUT HANDLING
// ============================================
function setupInput() {
    document.addEventListener('keydown', (e) => {
        if (!State.running) return;
        SoundManager.resume();

        const key = e.key;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(key)) {
            e.preventDefault();
            if (!State.keysDown[key]) {
                State.keysDown[key] = true;
                const dir = keyToDir(key);
                if (dir) queueMove(dir);
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        State.keysDown[e.key] = false;
    });
}

function keyToDir(key) {
    const map = {
        'ArrowUp': 'up', 'w': 'up', 'W': 'up',
        'ArrowDown': 'down', 's': 'down', 'S': 'down',
        'ArrowLeft': 'left', 'a': 'left', 'A': 'left',
        'ArrowRight': 'right', 'd': 'right', 'D': 'right',
    };
    return map[key] || null;
}

function queueMove(dir) {
    if (State.inputQueue.length < 3) {
        State.inputQueue.push(dir);
    }
}

function setupMobileControls() {
    const btns = document.querySelectorAll('.dpad-btn');
    btns.forEach(btn => {
        const dir = btn.dataset.dir;

        const onPress = (e) => {
            e.preventDefault();
            SoundManager.resume();
            if (!State.running) return;
            btn.classList.add('pressed');
            queueMove(dir);
        };

        const onRelease = (e) => {
            e.preventDefault();
            btn.classList.remove('pressed');
        };

        btn.addEventListener('touchstart', onPress, { passive: false });
        btn.addEventListener('touchend', onRelease, { passive: false });
        btn.addEventListener('mousedown', onPress);
        btn.addEventListener('mouseup', onRelease);
        btn.addEventListener('mouseleave', onRelease);
    });
}

// ============================================
// GAME LOGIC UPDATE
// ============================================
function update(dt) {
    if (!State.running || State.gameOver || State.win) return;

    const p = State.penguin;

    // Update day timer
    State.dayTimer += dt;
    if (State.dayTimer >= CONFIG.DAY_DURATION_MS) {
        State.dayTimer -= CONFIG.DAY_DURATION_MS;
        State.day++;
        SoundManager.playDayChange();

        if (State.day > CONFIG.TOTAL_DAYS) {
            triggerVictory();
            return;
        }
        updateHUD();
    }

    // Update penguin movement animation
    if (p.moving) {
        p.moveProgress = Math.min(1, p.moveProgress + dt / 160);
        const ease = 1 - Math.pow(1 - p.moveProgress, 3);
        p.pixelX = p.startX + (p.targetX - p.startX) * ease;
        p.pixelY = p.startY + (p.targetY - p.startY) * ease;
        if (p.moveProgress >= 1) {
            p.moving = false;
            p.pixelX = p.targetX;
            p.pixelY = p.targetY;
        }
    }

    // Process input queue
    if (!p.moving && !p.falling && State.inputQueue.length > 0) {
        const dir = State.inputQueue.shift();
        tryMove(dir);
    }

    // Falling animation
    if (p.falling) {
        p.fallY += dt * 0.4;
        if (p.fallY > State.canvas.height * 0.35) {
            triggerSealAttack();
        }
        return;
    }

    // Standing timer - check if penguin is staying too long
    if (!p.moving) {
        const tile = State.iceGrid[p.row][p.col];
        if (tile.state !== ICE.BROKEN) {
            p.standTimer += dt;
            tile.crackTimer += dt;

            // 날짜에 따라 얼음 깨짐 시간 동적 계산
            const iceTime = getIceCrackTime();
            const crackProgress = tile.crackTimer / iceTime;
            if (crackProgress < 0.33) {
                tile.state = ICE.SOLID;
                tile.crackLevel = 0;
            } else if (crackProgress < 0.66) {
                if (tile.state < ICE.CRACKING_1) {
                    tile.state = ICE.CRACKING_1;
                    tile.crackLevel = 1;
                    SoundManager.playIceCrack();
                }
            } else if (crackProgress < 1.0) {
                if (tile.state < ICE.CRACKING_2) {
                    tile.state = ICE.CRACKING_2;
                    tile.crackLevel = 2;
                    SoundManager.playIceCrack();
                }
            } else {
                // ICE BREAKS!
                tile.state = ICE.BROKEN;
                tile.crackLevel = 3;
                tile.regenTimer = CONFIG.ICE_REGEN_TIME_MS;
                SoundManager.playIceBreak();
                spawnIceBreakParticles(p.col, p.row);
                // Start falling
                p.falling = true;
                p.fallY = 0;
                return;
            }
        }
    } else {
        // Reset stand timer when moving
        p.standTimer = 0;
    }

    // Update ice tiles (regeneration & reset crack for tiles not stood on)
    updateIceTiles(dt, p.col, p.row);

    // Check hunting seal spawn / update
    checkSealSpawn();
    updateHuntingSeals(dt);

    // Check coin collection
    checkCoinCollection();

    // Update coins
    updateCoins(dt);

    // Update particles
    updateParticles(dt);

    // Update HUD timer bar
    updateTimerBar();
}

function tryMove(dir) {
    const p = State.penguin;
    let newCol = p.col;
    let newRow = p.row;

    switch(dir) {
        case 'up':    newRow -= 1; p.direction = 'up'; break;
        case 'down':  newRow += 1; p.direction = 'down'; break;
        case 'left':  newCol -= 1; p.direction = 'left'; break;
        case 'right': newCol += 1; p.direction = 'right'; break;
    }

    // Boundary check
    if (newCol < 0 || newCol >= CONFIG.GRID_COLS ||
        newRow < 0 || newRow >= CONFIG.GRID_ROWS) {
        return;
    }

    // Can't move to broken tile
    if (State.iceGrid[newRow][newCol].state === ICE.BROKEN) {
        return;
    }

    // Reset crack timer on previous tile (if leaving)
    const prevTile = State.iceGrid[p.row][p.col];
    if (prevTile.state !== ICE.BROKEN && prevTile.crackLevel > 0) {
        prevTile.crackTimer = 0;
        prevTile.crackLevel = 0;
        prevTile.state = ICE.SOLID;
    }
    // Reset stand timer
    p.standTimer = 0;

    // Move
    p.col = newCol;
    p.row = newRow;
    const newPos = isoProject(newCol, newRow);
    p.startX = p.pixelX;
    p.startY = p.pixelY;
    p.targetX = newPos.x;
    p.targetY = newPos.y;
    p.moving = true;
    p.moveProgress = 0;

    SoundManager.playStep();

    // 펭귄이 바다표범 위로 이동했는지 확인
    const steppedOnSeal = State.huntingSeals.find(
        s => !s.appearing && s.col === newCol && s.row === newRow
    );
    if (steppedOnSeal && !State.gameOver) {
        setTimeout(() => triggerSealCatch(steppedOnSeal), 200);
    }
}

function updateIceTiles(dt, penCol, penRow) {
    for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
        for (let c = 0; c < CONFIG.GRID_COLS; c++) {
            const tile = State.iceGrid[r][c];

            if (tile.state === ICE.BROKEN) {
                tile.regenTimer -= dt;
                if (tile.regenTimer <= 0) {
                    // Regenerate
                    tile.state = ICE.SOLID;
                    tile.crackLevel = 0;
                    tile.crackTimer = 0;
                    tile.regenTimer = 0;
                    SoundManager.playIceRegen();
                    spawnRegenParticles(c, r);
                }
            } else if (c !== penCol || r !== penRow) {
                // Slowly heal cracks when not standing on tile
                if (tile.crackTimer > 0) {
                    const iceTime = getIceCrackTime();
                    tile.crackTimer = Math.max(0, tile.crackTimer - dt * 0.5);
                    const progress = tile.crackTimer / iceTime;
                    if (progress < 0.33) {
                        tile.state = ICE.SOLID;
                        tile.crackLevel = 0;
                    } else if (progress < 0.66) {
                        tile.state = ICE.CRACKING_1;
                        tile.crackLevel = 1;
                    } else {
                        tile.state = ICE.CRACKING_2;
                        tile.crackLevel = 2;
                    }
                }
            }
        }
    }
}

// ============================================
// HUNTING SEALS AI
// ============================================

// \ub0a0\uc9dc\uc5d0 \ub530\ub77c \ubc14\ub2e4\ud45c\ubc94 \ub4f1\uc7a5 \uccb4\ud06c
function checkSealSpawn() {
    const day = State.day;
    // 20\uc77c, 40\uc77c, 60\uc77c, 80\uc77c\uc5d0 \uac01 \ud55c \ub9c8\ub9ac\uc529 \ub4f1\uc7a5
    const spawnDays = [20, 40, 60, 80];
    for (const sd of spawnDays) {
        if (day >= sd) {
            // \ud574\ub2f9 \ub9c8\ub9ac\uac00 \uc774\ubbf8 \uc2a4\ud3f0\ub428\uc5ec\uc788\ub294\uc9c0 \ud655\uc778
            const alreadySpawned = State.huntingSeals.some(s => s.spawnDay === sd);
            if (!alreadySpawned) {
                spawnHuntingSeal(sd);
            }
        }
    }
}

function spawnHuntingSeal(spawnDay) {
    // \ud3ad\uadc4\uc5d0\uc11c \uac00\uc7a5 \uba9c \ubaa8\uc11c\ub9ac\uc5d0 \uc2a4\ud3f0
    const corners = [
        { col: 0, row: 0 },
        { col: CONFIG.GRID_COLS - 1, row: 0 },
        { col: 0, row: CONFIG.GRID_ROWS - 1 },
        { col: CONFIG.GRID_COLS - 1, row: CONFIG.GRID_ROWS - 1 },
    ];
    const p = State.penguin;
    // \ud3ad\uadc4\uc640 \uac00\uc7a5 \uba3c \ubaa8\uc11c\ub9ac \uc120\ud0dd
    let bestCorner = corners[0];
    let maxDist = -1;
    for (const c of corners) {
        const d = Math.abs(c.col - p.col) + Math.abs(c.row - p.row);
        if (d > maxDist) {
            maxDist = d;
            bestCorner = c;
        }
    }

    const pos = isoProject(bestCorner.col, bestCorner.row);
    const seal = {
        spawnDay,
        col: bestCorner.col,
        row: bestCorner.row,
        pixelX: pos.x,
        pixelY: pos.y,
        startX: pos.x,
        startY: pos.y,
        targetX: pos.x,
        targetY: pos.y,
        moveProgress: 1,
        moving: false,
        moveTimer: 0,
        // \ub9c8\ub9ac\ub9c8\ub2e4 \uc774\ub3d9 \uc18d\ub3c4 \uc57d\uac04 \ub2e4\ub974\uac8c
        moveInterval: CONFIG.SEAL_MOVE_INTERVAL_BASE + (spawnDay === 20 ? 0 : spawnDay === 40 ? -200 : spawnDay === 60 ? -400 : -600),
        bobOffset: Math.random() * Math.PI * 2,
        // \ub4f1\uc7a5 \uc560\ub2c8\uba54\uc774\uc158
        appearing: true,
        appearTimer: 0,
        appearDuration: 1200,
    };
    State.huntingSeals.push(seal);

    // \ubc14\ub2e4\ud45c\ubc94 \ub4f1\uc7a5 \uc54c\ub9bc \uc0ac\uc6b4\ub4dc
    SoundManager.playSealAppear();

    // \ud654\uba74\uc5d0 \uc54c\ub9bc \uba54\uc2dc\uc9c0 \ud45c\uc2dc
    showSealWarning(spawnDay);
}

function showSealWarning(spawnDay) {
    const sealCount = State.huntingSeals.length;
    const msg = document.createElement('div');
    msg.className = 'seal-warning';
    msg.innerHTML = `🦭 \ubc14\ub2e4\ud45c\ubc94 ${sealCount}\ub9c8\ub9ac\uac00 \ub098\ud0c0\ub0ac\ub2e4! (${spawnDay}\uc77c\uc9f8)`;
    document.body.appendChild(msg);
    setTimeout(() => {
        msg.classList.add('fade-out');
        setTimeout(() => msg.remove(), 600);
    }, 2200);
}

function updateHuntingSeals(dt) {
    const p = State.penguin;

    State.huntingSeals.forEach(seal => {
        // \ub4f1\uc7a5 \uc560\ub2c8\uba54\uc774\uc158
        if (seal.appearing) {
            seal.appearTimer += dt;
            if (seal.appearTimer >= seal.appearDuration) {
                seal.appearing = false;
            }
            return;
        }

        // \uc774\ub3d9 \uc560\ub2c8\uba54\uc774\uc158 \uc5c5\ub370\uc774\ud2b8
        if (seal.moving) {
            seal.moveProgress = Math.min(1, seal.moveProgress + dt / 280);
            const ease = 1 - Math.pow(1 - seal.moveProgress, 3);
            seal.pixelX = seal.startX + (seal.targetX - seal.startX) * ease;
            seal.pixelY = seal.startY + (seal.targetY - seal.startY) * ease;
            if (seal.moveProgress >= 1) {
                seal.moving = false;
                seal.pixelX = seal.targetX;
                seal.pixelY = seal.targetY;
                // 이동 완료 시 같은 칸이면 즉시 잡기
                const arriveP = State.penguin;
                if (seal.col === arriveP.col && seal.row === arriveP.row
                    && !arriveP.falling && !arriveP.isAngel && !State.gameOver) {
                    triggerSealCatch(seal);
                }
            }
        }

        // \uc774\ub3d9 \ud0c0\uc774\uba38 (A* \ube44\uc2b7\ud55c BFS \ucd94\uc801)
        if (!seal.moving) {
            seal.moveTimer += dt;
            // \ub0a0\uc9dc \uc9c4\ud589\uc5d0 \ub530\ub77c \uc774\ub3d9 \uc18d\ub3c4 \uc6d0\ub798\ubcf4\ub2e4 \ube68\ub77c\uc9d0
            const dayFactor = Math.max(0.4, 1 - (State.day - seal.spawnDay) / 80);
            const interval = seal.moveInterval * dayFactor;

            if (seal.moveTimer >= interval) {
                seal.moveTimer = 0;
                moveSealTowardPenguin(seal);
            }
        }

        // \ud3ad\uadc4 \ucda9\ub3cc \uccb4\ud06c
        // 충돌 체크는 이동 완료 시(위 코드)에서만 처리 - 매 프레임 중복 체크 불필요
    });
}

function moveSealTowardPenguin(seal) {
    const p = State.penguin;
    // \ud3ad\uadc4 \ubc29\ud5a5\uc73c\ub85c \ud55c \uce78\uc529 \uc774\ub3d9 (\uc218\uc9c1/\uc218\ud3c9 \uc911 \ub354 \uc9e7\uc740 \uc270)
    const dCol = p.col - seal.col;
    const dRow = p.row - seal.row;

    let moves = [];
    // \uc218\ud3c9/\uc218\uc9c1 \uce74\ub514\ub110 \uc774\ub3d9
    if (Math.abs(dCol) >= Math.abs(dRow)) {
        if (dCol !== 0) moves.push({ col: seal.col + Math.sign(dCol), row: seal.row });
        if (dRow !== 0) moves.push({ col: seal.col, row: seal.row + Math.sign(dRow) });
    } else {
        if (dRow !== 0) moves.push({ col: seal.col, row: seal.row + Math.sign(dRow) });
        if (dCol !== 0) moves.push({ col: seal.col + Math.sign(dCol), row: seal.row });
    }
    // \ub300\uc548 \ubc29\ud5a5 (\ub9b9\ud601\ub808 \uac00\uc9c0 \uc5c6\uc73c\uba74)
    moves.push({ col: seal.col + (dCol > 0 ? 1 : -1), row: seal.row + (dRow > 0 ? 1 : -1) });

    for (const m of moves) {
        if (m.col < 0 || m.col >= CONFIG.GRID_COLS ||
            m.row < 0 || m.row >= CONFIG.GRID_ROWS) continue;
        // \uae68\uc9c4 \uc5bc\uc74c\uc73c\ub85c\ub294 \uc774\ub3d9 \uac00\ub2a5 (\ud45c\ubc94\uc740 \ubb3c \uc19c\ud615\uc774\ubbc0\ub85c)
        // \ub2e4\ub978 \ud45c\ubc94\uac00 \uac19\uc740 \uce78\uc5d0 \uc788\ub294\uc9c0 \ud655\uc778
        const occupied = State.huntingSeals.some(s => s !== seal && s.col === m.col && s.row === m.row);
        if (occupied) continue;

        // 이동 완료 직후 같은 칸 잡기는 이동 애니메이션 완료 후 처리
        seal.startX = seal.pixelX;
        seal.startY = seal.pixelY;
        seal.col = m.col;
        seal.row = m.row;
        const newPos = isoProject(m.col, m.row);
        seal.targetX = newPos.x;
        seal.targetY = newPos.y;
        seal.moving = true;
        seal.moveProgress = 0;
        break;
    }
}

// \ub3d9\uc791 \uc911 \ud3ad\uadc4\ub97c \uc7a1\uc558\uc744 \ub54c \ubc14\ub2e4\ud45c\ubc94 \uacf5\uaca9 \uc720\ubc1c
function triggerSealCatch(seal) {
    if (State.gameOver || State.win) return;
    State.running = false;
    State.gameOver = true;

    SoundManager.stopBGMusic();
    SoundManager.stopWind();
    SoundManager.playSealAttack();

    const p = State.penguin;
    p.sealBite = true;

    setTimeout(() => {
        p.isAngel = true;
        p.sealBite = false;
        SoundManager.playAngelFly();
        let angelAnim = setInterval(() => {
            p.angelY -= 2;
            if (p.angelY < -300) clearInterval(angelAnim);
        }, 30);
        setTimeout(() => showGameOver(), 2000);
    }, 1000);
}

function checkCoinCollection() {
    const p = State.penguin;
    State.coins.forEach(coin => {
        if (!coin.collected && coin.col === p.col && coin.row === p.row) {
            coin.collected = true;
            State.score += CONFIG.COIN_SCORE;
            SoundManager.playCoin();
            spawnCoinParticles(coin.x, coin.y);
            updateHUD();

            // Spawn new coin after short delay
            setTimeout(() => {
                State.coins = State.coins.filter(c => c !== coin);
                spawnCoin();
            }, 500);
        }
    });
}

function updateCoins(dt) {
    const time = Date.now() / 1000;
    State.coins.forEach(coin => {
        if (!coin.collected) {
            const pos = isoProject(coin.col, coin.row);
            coin.x = pos.x;
            coin.y = pos.y;
        }
    });
}

// ============================================
// PARTICLES
// ============================================
function updateParticles(dt) {
    State.particles = State.particles.filter(p => p.life > 0);
    State.particles.forEach(p => {
        p.x += p.vx * dt * 0.06;
        p.y += p.vy * dt * 0.06;
        p.vy += 0.15 * dt * 0.06; // gravity
        p.life -= dt;
        p.alpha = p.life / p.maxLife;
        p.rotation += p.rotSpeed * dt * 0.06;
    });
}

function spawnIceBreakParticles(col, row) {
    const pos = isoProject(col, row);
    for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 / 12) * i + Math.random() * 0.5;
        const speed = 2 + Math.random() * 4;
        State.particles.push({
            x: pos.x + (Math.random() - 0.5) * State.tileW,
            y: pos.y - State.tileH / 2 + (Math.random() - 0.5) * State.tileH,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 3,
            life: 600 + Math.random() * 400,
            maxLife: 1000,
            alpha: 1,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.2,
            size: 4 + Math.random() * 6,
            color: `rgba(${180 + Math.floor(Math.random()*60)}, ${220 + Math.floor(Math.random()*35)}, ${240 + Math.floor(Math.random()*15)}`,
            type: 'ice',
        });
    }
}

function spawnRegenParticles(col, row) {
    const pos = isoProject(col, row);
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 / 8) * i;
        State.particles.push({
            x: pos.x,
            y: pos.y - State.tileH / 2,
            vx: Math.cos(angle) * 1.5,
            vy: Math.sin(angle) * 1.5 - 2,
            life: 500,
            maxLife: 500,
            alpha: 1,
            rotation: 0,
            rotSpeed: 0,
            size: 3,
            color: 'rgba(200, 240, 255',
            type: 'sparkle',
        });
    }
}

function spawnCoinParticles(x, y) {
    const emojis = ['✨', '⭐', '💫', '+10'];
    for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
        State.particles.push({
            x: x + (Math.random() - 0.5) * 30,
            y: y - State.tileH,
            vx: (Math.random() - 0.5) * 3,
            vy: -3 - Math.random() * 2,
            life: 700,
            maxLife: 700,
            alpha: 1,
            rotation: 0,
            rotSpeed: 0,
            size: 14,
            color: 'rgba(255, 220, 50',
            type: 'text',
            text: i === 0 ? '+10' : ['✨','⭐','💫'][Math.floor(Math.random()*3)],
        });
    }
}

// ============================================
// GAME OVER / WIN
// ============================================
function triggerSealAttack() {
    const p = State.penguin;
    if (State.gameOver || State.win) return;
    State.running = false;
    State.gameOver = true;

    SoundManager.stopBGMusic();
    SoundManager.stopWind();
    SoundManager.playFallInWater();

    // 게임오버 일때 바다 상태의 표범 표시
    State.seal.active = true;
    State.seal.visible = true;

    setTimeout(() => {
        SoundManager.playSealAttack();
    }, 300);

    setTimeout(() => {
        p.isAngel = true;
        p.falling = false;
        SoundManager.playAngelFly();
        let angelAnim = setInterval(() => {
            p.angelY -= 2;
            if (p.angelY < -300) clearInterval(angelAnim);
        }, 30);
        setTimeout(() => showGameOver(), 2000);
    }, 1500);
}

function showGameOver() {
    document.getElementById('final-days').textContent = State.day;
    document.getElementById('final-score').textContent = State.score;
    document.getElementById('gameover-screen').style.display = 'flex';
}

function triggerVictory() {
    State.running = false;
    State.win = true;
    SoundManager.stopBGMusic();
    SoundManager.stopWind();
    SoundManager.playVictory();

    setTimeout(() => {
        document.getElementById('win-score').textContent = State.score;
        document.getElementById('win-screen').style.display = 'flex';
        spawnConfetti();
    }, 500);
}

function spawnConfetti() {
    const container = document.getElementById('confetti-container');
    container.innerHTML = '';
    const emojis = ['🎉', '⭐', '🌟', '✨', '🎊', '🐧'];
    for (let i = 0; i < 20; i++) {
        const el = document.createElement('div');
        el.className = 'confetti';
        el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        el.style.left = Math.random() * 100 + '%';
        el.style.animationDelay = Math.random() * 1.5 + 's';
        el.style.animationDuration = 1 + Math.random() * 0.5 + 's';
        container.appendChild(el);
    }
}

// ============================================
// HUD UPDATE
// ============================================
function updateHUD() {
    document.getElementById('day-count').textContent = State.day;
    document.getElementById('score-count').textContent = State.score;
    updateIceSpeedUI();
}

function updateIceSpeedUI() {
    // 얼음 위험도 바 업데이트 (0%=안전, 100%=최대위험)
    const iceTime = getIceCrackTime();
    const dangerPct = Math.round((1 - (iceTime - CONFIG.ICE_CRACK_MIN_MS) /
        (CONFIG.ICE_CRACK_BASE_MS - CONFIG.ICE_CRACK_MIN_MS)) * 100);
    const bar = document.getElementById('ice-speed-bar');
    const countEl = document.getElementById('seal-count');
    if (bar) {
        bar.style.width = dangerPct + '%';
        // 색상: 안전=파랑, 위험=빨강
        if (dangerPct < 40) {
            bar.style.background = 'linear-gradient(90deg, #00e5ff, #69f0ae)';
        } else if (dangerPct < 70) {
            bar.style.background = 'linear-gradient(90deg, #ffd700, #ff9800)';
        } else {
            bar.style.background = 'linear-gradient(90deg, #ff4444, #ff0000)';
        }
    }
    if (countEl) {
        countEl.textContent = State.huntingSeals ? State.huntingSeals.length : 0;
    }
}

function updateTimerBar() {
    const progress = 1 - (State.dayTimer / CONFIG.DAY_DURATION_MS);
    const bar = document.getElementById('timer-bar');
    bar.style.width = (progress * 100) + '%';

    if (progress < 0.3) {
        bar.classList.add('warning');
    } else {
        bar.classList.remove('warning');
    }
    updateIceSpeedUI();
}

// ============================================
// SNOWFLAKES (background decoration)
// ============================================
function createSnowflakes() {
    const container = document.getElementById('snowfall-container');
    const flakes = ['❄', '❅', '❆', '·', '•', '*'];
    for (let i = 0; i < 25; i++) {
        const flake = document.createElement('div');
        flake.className = 'snowflake';
        flake.textContent = flakes[Math.floor(Math.random() * flakes.length)];
        flake.style.left = Math.random() * 100 + '%';
        flake.style.fontSize = (8 + Math.random() * 12) + 'px';
        flake.style.opacity = 0.3 + Math.random() * 0.5;
        flake.style.animationDuration = (5 + Math.random() * 10) + 's';
        flake.style.animationDelay = (-Math.random() * 15) + 's';
        container.appendChild(flake);
    }
}

// ============================================
// RENDERING
// ============================================
function render() {
    const ctx = State.ctx;
    const canvas = State.canvas;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // If iceGrid not initialized yet, skip
    if (!State.iceGrid || State.iceGrid.length === 0) return;

    // Draw water/sea (below the ice)
    drawSea(ctx, canvas);

    // Draw ice grid (isometric)
    drawIceGrid(ctx);

    // Draw coins
    drawCoins(ctx);

    // Draw hunting seals on ice
    drawHuntingSeals(ctx);

    // Draw penguin (or angel/falling)
    drawPenguin(ctx);

    // Draw seal (death trigger - in water)
    if (State.seal.visible) {
        drawSeal(ctx);
    }

    // Draw particles
    drawParticles(ctx);

    // Draw day progress overlay (subtle vignette based on day)
    drawDayProgress(ctx, canvas);
}

function drawSea(ctx, canvas) {
    // Animated water below the grid
    const gridBottom = State.gridOffsetY + (CONFIG.GRID_COLS + CONFIG.GRID_ROWS) * (State.tileH / 2) + State.tileDepth + 20;
    const t = Date.now() / 1000;

    // Water gradient
    const grad = ctx.createLinearGradient(0, gridBottom, 0, canvas.height);
    grad.addColorStop(0, 'rgba(15, 80, 140, 0.9)');
    grad.addColorStop(0.3, 'rgba(10, 60, 120, 0.95)');
    grad.addColorStop(1, 'rgba(5, 30, 80, 1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, gridBottom - 20, canvas.width, canvas.height);

    // Water ripples
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
        const y = gridBottom + i * 18 + Math.sin(t * 1.5 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= canvas.width; x += 20) {
            ctx.lineTo(x, y + Math.sin(x / 60 + t + i) * 3);
        }
        ctx.stroke();
    }
}

function drawIceGrid(ctx) {
    const t = Date.now() / 1000;

    // Draw in correct order (back to front for isometric)
    for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
        for (let c = 0; c < CONFIG.GRID_COLS; c++) {
            const tile = State.iceGrid[r][c];
            const pos = isoProject(c, r);
            drawIceTile(ctx, pos.x, pos.y, tile, c, r, t);
        }
    }
}

function drawIceTile(ctx, x, y, tile, col, row, t) {
    const tw = State.tileW;
    const th = State.tileH;
    const td = State.tileDepth;
    const p = State.penguin;

    // Isometric tile points (diamond shape)
    const top =    { x: x,          y: y - th / 2 };
    const right =  { x: x + tw / 2, y: y };
    const bottom = { x: x,          y: y + th / 2 };
    const left =   { x: x - tw / 2, y: y };

    if (tile.state === ICE.BROKEN) {
        // Draw water in hole
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(right.x, right.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.lineTo(left.x, left.y);
        ctx.closePath();
        const waterGrad = ctx.createLinearGradient(x - tw/2, y - th/2, x + tw/2, y + th/2);
        waterGrad.addColorStop(0, 'rgba(20, 80, 160, 0.8)');
        waterGrad.addColorStop(1, 'rgba(10, 50, 120, 0.9)');
        ctx.fillStyle = waterGrad;
        ctx.fill();

        // Water shimmer
        const shimmer = 0.3 + 0.1 * Math.sin(t * 3 + col + row);
        ctx.strokeStyle = `rgba(100, 180, 255, ${shimmer})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Regen timer indicator (small circle)
        const regenPct = 1 - tile.regenTimer / CONFIG.ICE_REGEN_TIME_MS;
        ctx.beginPath();
        ctx.arc(x, y, td * 0.4, 0, Math.PI * 2 * regenPct);
        ctx.strokeStyle = 'rgba(150, 220, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
    }

    // ---- Draw 3D isometric ice cube ----
    // Determine colors based on crack level
    let topColor, rightColor, leftColor, outlineColor;

    const isPlayerTile = (col === p.col && row === p.row && !p.moving);
    const crackIntensity = tile.crackLevel;

    if (crackIntensity === 0) {
        // Pristine ice - blue-white
        topColor = `rgba(${200 + Math.floor(Math.sin(t*0.5 + col*0.3 + row*0.2)*8)}, 235, 255, 0.95)`;
        rightColor = 'rgba(130, 190, 225, 0.9)';
        leftColor = 'rgba(160, 210, 235, 0.85)';
        outlineColor = 'rgba(100, 170, 220, 0.4)';
    } else if (crackIntensity === 1) {
        // Starting to crack - slightly darker
        topColor = 'rgba(180, 215, 240, 0.9)';
        rightColor = 'rgba(110, 165, 205, 0.9)';
        leftColor = 'rgba(140, 185, 215, 0.85)';
        outlineColor = 'rgba(150, 130, 100, 0.5)';
    } else if (crackIntensity === 2) {
        // Heavy cracking - yellowish warning
        topColor = 'rgba(210, 200, 175, 0.9)';
        rightColor = 'rgba(140, 130, 110, 0.9)';
        leftColor = 'rgba(170, 160, 135, 0.85)';
        outlineColor = 'rgba(200, 150, 80, 0.7)';
    } else {
        topColor = 'rgba(150, 140, 120, 0.8)';
        rightColor = 'rgba(100, 90, 75, 0.9)';
        leftColor = 'rgba(120, 110, 90, 0.85)';
        outlineColor = 'rgba(200, 100, 50, 0.8)';
    }

    // --- LEFT face (depth) ---
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(bottom.x, bottom.y + td);
    ctx.lineTo(left.x, left.y + td);
    ctx.closePath();
    ctx.fillStyle = leftColor;
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // --- RIGHT face (depth) ---
    ctx.beginPath();
    ctx.moveTo(bottom.x, bottom.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(right.x, right.y + td);
    ctx.lineTo(bottom.x, bottom.y + td);
    ctx.closePath();
    ctx.fillStyle = rightColor;
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // --- TOP face ---
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(left.x, left.y);
    ctx.closePath();
    ctx.fillStyle = topColor;
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Ice surface highlight
    if (crackIntensity === 0) {
        ctx.beginPath();
        ctx.moveTo(top.x, top.y + th * 0.1);
        ctx.lineTo(top.x + tw * 0.2, top.y + th * 0.3);
        ctx.lineTo(top.x + tw * 0.05, top.y + th * 0.4);
        ctx.lineTo(top.x - tw * 0.15, top.y + th * 0.2);
        ctx.closePath();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.1 * Math.sin(t + col + row)})`;
        ctx.fill();
    }

    // Draw crack lines on top face
    if (crackIntensity >= 1) {
        drawCrackLines(ctx, x, y, tw, th, crackIntensity, col, row);
    }

    // Player tile glow
    if (isPlayerTile && !p.falling) {
        ctx.beginPath();
        ctx.moveTo(top.x, top.y - 2);
        ctx.lineTo(right.x + 2, right.y);
        ctx.lineTo(bottom.x, bottom.y + 2);
        ctx.lineTo(left.x - 2, left.y);
        ctx.closePath();
        ctx.strokeStyle = `rgba(100, 220, 255, ${0.4 + 0.3 * Math.sin(t * 3)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Warning glow for heavy cracking
    if (crackIntensity >= 2) {
        const warningAlpha = 0.2 + 0.2 * Math.sin(t * 5);
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(right.x, right.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.lineTo(left.x, left.y);
        ctx.closePath();
        ctx.fillStyle = `rgba(255, 150, 50, ${warningAlpha})`;
        ctx.fill();
    }
}

function drawCrackLines(ctx, x, y, tw, th, level, col, row) {
    // Seeded random for consistent crack pattern per tile
    const seed = col * 13 + row * 7;
    const r = (n) => ((seed * (n + 1) * 9301 + 49297) % 233280) / 233280;

    ctx.strokeStyle = level >= 2 ? 'rgba(80, 60, 40, 0.7)' : 'rgba(100, 80, 60, 0.4)';
    ctx.lineWidth = level >= 2 ? 1.5 : 0.8;

    // Draw 2-3 crack lines
    const numCracks = level + 1;
    const cx = x;
    const cy = y;

    for (let i = 0; i < numCracks; i++) {
        const startX = cx + (r(i * 3) - 0.5) * tw * 0.5;
        const startY = cy + (r(i * 3 + 1) - 0.5) * th * 0.4;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        for (let j = 0; j < 3; j++) {
            ctx.lineTo(
                startX + (r(i * 3 + j * 2 + 2) - 0.5) * tw * 0.4,
                startY + (r(i * 3 + j * 2 + 3) - 0.5) * th * 0.3
            );
        }
        ctx.stroke();
    }
}

function drawCoins(ctx) {
    const t = Date.now() / 1000;
    State.coins.forEach(coin => {
        if (coin.collected) return;

        const bob = Math.sin(t * 2.5 + coin.bobOffset) * 4;
        const x = coin.x;
        const y = coin.y - State.tileH * 0.6 + bob;
        const r = State.tileW * 0.18;

        // Coin glow
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
        grd.addColorStop(0, 'rgba(255, 220, 0, 0.3)');
        grd.addColorStop(1, 'rgba(255, 180, 0, 0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, r * 2, 0, Math.PI * 2);
        ctx.fill();

        // Coin body
        const coinGrd = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
        coinGrd.addColorStop(0, '#ffe066');
        coinGrd.addColorStop(0.5, '#ffc200');
        coinGrd.addColorStop(1, '#cc8800');
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = coinGrd;
        ctx.fill();
        ctx.strokeStyle = 'rgba(180, 120, 0, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Penguin icon on coin
        ctx.font = `${r * 1.2}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐧', x, y + 1);
    });
}

// ============================================
// 캔버스로 펭귄 전신 직접 그리기
// ============================================
function drawPenguinBody(ctx, x, y, s, dir, isWalking, t) {
    // s = 기본 단위 크기(픽셀)
    // dir: 'left' | 'right' | 'up' | 'down'
    const facingLeft = (dir === 'left');

    ctx.save();
    ctx.translate(x, y);
    if (facingLeft) ctx.scale(-1, 1);

    // --- 그림자 ---
    ctx.beginPath();
    ctx.ellipse(0, s * 1.05, s * 0.55, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();

    // 걸을 때 발 흔들림
    const legSwing = isWalking ? Math.sin(t * 14) * 0.28 : 0;

    // --- 왼쪽 발 ---
    ctx.save();
    ctx.translate(-s * 0.22, s * 0.82);
    ctx.rotate(legSwing);
    // 발목
    ctx.beginPath();
    ctx.roundRect(-s * 0.1, 0, s * 0.2, s * 0.28, s * 0.05);
    ctx.fillStyle = '#E8A020';
    ctx.fill();
    // 발끝
    ctx.beginPath();
    ctx.ellipse(-s * 0.04, s * 0.3, s * 0.17, s * 0.09, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#E8A020';
    ctx.fill();
    ctx.restore();

    // --- 오른쪽 발 ---
    ctx.save();
    ctx.translate(s * 0.22, s * 0.82);
    ctx.rotate(-legSwing);
    ctx.beginPath();
    ctx.roundRect(-s * 0.1, 0, s * 0.2, s * 0.28, s * 0.05);
    ctx.fillStyle = '#E8A020';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s * 0.04, s * 0.3, s * 0.17, s * 0.09, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#E8A020';
    ctx.fill();
    ctx.restore();

    // --- 몸통 (검정) ---
    ctx.beginPath();
    ctx.ellipse(0, s * 0.28, s * 0.46, s * 0.62, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // --- 배 (흰색) ---
    ctx.beginPath();
    ctx.ellipse(s * 0.04, s * 0.35, s * 0.28, s * 0.44, 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f4ff';
    ctx.fill();

    // --- 파란 가슴 포인트 ---
    ctx.beginPath();
    ctx.ellipse(s * 0.04, s * 0.22, s * 0.16, s * 0.22, 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#4a90d9';
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // --- 왼쪽 날개 ---
    const wingFlap = isWalking ? Math.sin(t * 14) * 0.35 : 0.12;
    ctx.save();
    ctx.translate(-s * 0.4, s * 0.18);
    ctx.rotate(-0.25 - wingFlap);
    ctx.beginPath();
    ctx.ellipse(0, s * 0.28, s * 0.13, s * 0.38, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    // 날개 안쪽 하이라이트
    ctx.beginPath();
    ctx.ellipse(s * 0.02, s * 0.28, s * 0.06, s * 0.24, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#2d2d4e';
    ctx.fill();
    ctx.restore();

    // --- 오른쪽 날개 ---
    ctx.save();
    ctx.translate(s * 0.4, s * 0.18);
    ctx.rotate(0.25 + wingFlap);
    ctx.beginPath();
    ctx.ellipse(0, s * 0.28, s * 0.13, s * 0.38, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-s * 0.02, s * 0.28, s * 0.06, s * 0.24, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#2d2d4e';
    ctx.fill();
    ctx.restore();

    // --- 머리 (검정 원) ---
    ctx.beginPath();
    ctx.arc(0, -s * 0.3, s * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // --- 얼굴 흰 부분 ---
    ctx.beginPath();
    ctx.ellipse(s * 0.04, -s * 0.25, s * 0.2, s * 0.24, 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f4ff';
    ctx.fill();

    // --- 눈 ---
    const blinkNow = (Math.floor(t * 0.7) % 5 === 0) && (t % 0.7 < 0.1);
    if (!blinkNow) {
        // 흰자
        ctx.beginPath();
        ctx.arc(-s * 0.08, -s * 0.35, s * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        // 눈동자
        ctx.beginPath();
        ctx.arc(-s * 0.05, -s * 0.34, s * 0.055, 0, Math.PI * 2);
        ctx.fillStyle = '#111';
        ctx.fill();
        // 눈 반짝임
        ctx.beginPath();
        ctx.arc(-s * 0.035, -s * 0.36, s * 0.022, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
    } else {
        // 눈 감기
        ctx.beginPath();
        ctx.arc(-s * 0.08, -s * 0.35, s * 0.1, Math.PI, 0);
        ctx.fillStyle = '#1a1a2e';
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = s * 0.025;
        ctx.beginPath();
        ctx.arc(-s * 0.08, -s * 0.36, s * 0.08, Math.PI, 0);
        ctx.stroke();
    }

    // --- 부리 ---
    ctx.beginPath();
    ctx.moveTo(s * 0.14, -s * 0.32);
    ctx.lineTo(s * 0.32, -s * 0.28);
    ctx.lineTo(s * 0.15, -s * 0.24);
    ctx.closePath();
    ctx.fillStyle = '#F4A020';
    ctx.fill();
    ctx.strokeStyle = '#c07800';
    ctx.lineWidth = s * 0.02;
    ctx.stroke();

    // --- 볼 터치 (귀여움 포인트) ---
    ctx.beginPath();
    ctx.arc(s * 0.15, -s * 0.22, s * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 150, 150, 0.45)';
    ctx.fill();

    // --- 머리 위 파란 포인트 (파란 펭귄 특징) ---
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.6, s * 0.14, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#4a90d9';
    ctx.fill();

    ctx.restore();
}

function drawPenguin(ctx) {
    const p = State.penguin;
    const t = Date.now() / 1000;

    let drawX = p.pixelX;
    let drawY = p.pixelY;

    if (p.falling) drawY += p.fallY;
    if (p.isAngel) drawY += p.angelY;

    const scale = State.tileW / 64;
    const s = 22 * scale;   // 펭귄 기본 단위 크기

    const bobY = p.moving ? Math.sin(t * 12) * 2 * scale : 0;
    const tiltAng = p.moving ? (p.direction === 'right' ? 0.10 : p.direction === 'left' ? -0.10 : 0) : 0;

    if (p.isAngel) {
        // 천사 펭귄: 전신 + 후광
        ctx.save();
        ctx.translate(drawX, drawY - s * 0.5 + bobY);
        ctx.globalAlpha = 1.0;
        drawPenguinBody(ctx, 0, 0, s, p.direction, false, t);

        // 후광 (halo)
        const haloAlpha = 0.55 + 0.25 * Math.sin(t * 4);
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.72, s * 0.38, s * 0.1, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,240,100,${haloAlpha})`;
        ctx.lineWidth = s * 0.1;
        ctx.stroke();

        // 빛 방사
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i + t * 1.2;
            const r1 = s * 0.5, r2 = s * 0.9;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * r1, -s * 0.3 + Math.sin(angle) * r1 * 0.3);
            ctx.lineTo(Math.cos(angle) * r2, -s * 0.3 + Math.sin(angle) * r2 * 0.3);
            ctx.strokeStyle = `rgba(255,240,150,${0.15 + 0.1 * Math.sin(t * 3 + i)})`;
            ctx.lineWidth = s * 0.04;
            ctx.stroke();
        }
        ctx.restore();
        return;
    }

    if (p.falling) {
        // 떨어지는 펭귄: 회전하며 떨어짐
        ctx.save();
        ctx.translate(drawX, drawY - s * 0.5);
        ctx.rotate(Math.sin(t * 8) * 0.4);
        ctx.globalAlpha = 1.0;
        drawPenguinBody(ctx, 0, 0, s, 'right', true, t);
        ctx.restore();
        return;
    }

    // 일반 상태
    ctx.save();
    ctx.translate(drawX, drawY - s * 0.5 + bobY);
    ctx.rotate(tiltAng);
    ctx.globalAlpha = 1.0;
    drawPenguinBody(ctx, 0, 0, s, p.direction, p.moving, t);
    ctx.restore();
}

function drawHuntingSeals(ctx) {
    const t = Date.now() / 1000;
    const scale = State.tileW / 64;

    State.huntingSeals.forEach(seal => {
        const bob = Math.sin(t * 2 + seal.bobOffset) * 3;
        let drawX = seal.pixelX;
        let drawY = seal.pixelY - State.tileH * 0.5 + bob;

        ctx.save();
        ctx.translate(drawX, drawY);

        // \ub4f1\uc7a5 \uc560\ub2c8\uba54\uc774\uc158 (\uc6d0\ud615 \ud3c9\uba74\uc5d0\uc11c \ub9e4\uc6b4\ub4ef \uc62c\ub77c\uc624\ub294 \ud6a8\uacfc)
        if (seal.appearing) {
            const progress = seal.appearTimer / seal.appearDuration;
            ctx.globalAlpha = Math.min(1, progress * 2);
            ctx.scale(progress, progress);
            // \ub4f1\uc7a5 \ud6a8\uacfc: \uc544\ub798\uc5d0\uc11c \uc704\ub85c
            ctx.translate(0, (1 - progress) * 30 * scale);
        }

        // \ubc14\ub2e4\ud45c\ubc94 \uc2e4\ub8e8\uc5d3 \uadf8\ub9bc\uc790
        ctx.beginPath();
        ctx.ellipse(0, State.tileH * 0.3, State.tileW * 0.28, State.tileH * 0.12, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fill();

        // \uc704\ud5d8 \uac70\ub9ac\uc77c \uc2dc \ube68\uac04 \ubc18\uc9dd
        const p = State.penguin;
        const dist = Math.abs(seal.col - p.col) + Math.abs(seal.row - p.row);
        if (dist <= 2) {
            const flash = 0.35 + 0.3 * Math.sin(t * 8);
            const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, State.tileW * 0.5);
            grd.addColorStop(0, `rgba(255,50,50,${flash})`);
            grd.addColorStop(1, 'rgba(255,50,50,0)');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(0, 0, State.tileW * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // \ubc14\ub2e4\ud45c\ubc94 \uc774\ubaa8\uc9c0 (\ud06c\uae30 \ub2e4\ub974\uac8c)
        const sealSize = seal.spawnDay === 20 ? 30 :
                         seal.spawnDay === 40 ? 33 :
                         seal.spawnDay === 60 ? 36 : 38;
        ctx.font = `${sealSize * scale}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // \uc774\ub3d9 \ubc29\ud5a5\uc5d0 \ub530\ub77c \uc88c\uc6b0 \ubc18\uc804
        const facingRight = seal.col > p.col || (!seal.moving && seal.col >= p.col);
        ctx.scale(facingRight ? -1 : 1, 1);
        ctx.fillText('🦭', 0, 0);

        // \ub9e4\uc9c1 \ub208 \uc774\ud399\ud2b8 (\uc885\uc885 \uc74c)
        if (dist <= 3 && Math.random() < 0.01) {
            ctx.font = `${12 * scale}px serif`;
            ctx.scale(facingRight ? -1 : 1, 1);
            ctx.fillText('👀', 0, -sealSize * scale * 0.7);
        }

        ctx.restore();

        // \ubc14\ub2e4\ud45c\ubc94 \ub4f1\uc7a5\uc77c \ud45c\uc2dc \bc30\uc9c0
        if (!seal.appearing) {
            const badgeX = drawX + State.tileW * 0.2;
            const badgeY = drawY - State.tileH * 0.8;
            ctx.save();
            ctx.fillStyle = 'rgba(20,20,60,0.75)';
            ctx.strokeStyle = 'rgba(255,100,100,0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(badgeX - 18 * scale, badgeY - 8 * scale, 36 * scale, 16 * scale, 4 * scale);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ffaaaa';
            ctx.font = `bold ${9 * scale}px Jua, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`D${seal.spawnDay}`, badgeX, badgeY);
            ctx.restore();
        }
    });
}

function drawSeal(ctx) {
    const p = State.penguin;
    const t = Date.now() / 1000;

    // Seal appears below the penguin in the water
    const pos = isoProject(p.col, p.row);
    const gridBottom = State.gridOffsetY + (CONFIG.GRID_COLS + CONFIG.GRID_ROWS) * (State.tileH / 2) + State.tileDepth;
    const sealY = gridBottom + 30 + Math.sin(t * 3) * 5;
    const sealX = pos.x;

    const scale = State.tileW / 64;

    ctx.save();
    ctx.translate(sealX, sealY);

    // Seal splash
    ctx.font = `${20 * scale}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💦', 0, -15 * scale);

    // Seal emoji
    ctx.font = `${36 * scale}px serif`;
    ctx.fillText('🦭', 0, 0);

    ctx.restore();
}

function drawParticles(ctx) {
    State.particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.type === 'text') {
            ctx.font = `bold ${p.size}px Jua, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = `${p.color}, ${p.alpha})`;
            ctx.fillText(p.text, 0, 0);
        } else if (p.type === 'sparkle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `${p.color}, ${p.alpha})`;
            ctx.fill();
        } else {
            // Ice shard
            ctx.beginPath();
            ctx.moveTo(0, -p.size / 2);
            ctx.lineTo(p.size / 3, p.size / 2);
            ctx.lineTo(-p.size / 3, p.size / 2);
            ctx.closePath();
            ctx.fillStyle = `${p.color}, ${p.alpha})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha * 0.5})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }
        ctx.restore();
    });
}

function drawDayProgress(ctx, canvas) {
    // Subtle time-of-day lighting overlay
    const dayProgress = (State.day - 1) / CONFIG.TOTAL_DAYS;
    // After day 50, it starts getting darker
    if (dayProgress > 0.5) {
        const darkness = (dayProgress - 0.5) * 0.3;
        ctx.fillStyle = `rgba(0, 20, 50, ${darkness})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Stand timer warning overlay on current tile
    const p = State.penguin;
    if (!p.moving && !p.falling && !p.isAngel) {
        const tile = State.iceGrid[p.row][p.col];
        const iceTime = getIceCrackTime();
        const crackProgress = tile.crackTimer / iceTime;
        if (crackProgress > 0.55) {
            // Red flash warning (더 빠른 날일수록 더 강렬하게)
            const intensity = 0.55 + (1 - iceTime / CONFIG.ICE_CRACK_BASE_MS) * 0.4;
            const flash = (1 - crackProgress) * 4 * Math.abs(Math.sin(Date.now() / (120 + iceTime * 0.04)));
            const pos = isoProject(p.col, p.row);
            const tw = State.tileW;
            const th = State.tileH;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y - th / 2);
            ctx.lineTo(pos.x + tw / 2, pos.y);
            ctx.lineTo(pos.x, pos.y + th / 2);
            ctx.lineTo(pos.x - tw / 2, pos.y);
            ctx.closePath();
            ctx.fillStyle = `rgba(255, 50, 0, ${flash * intensity * 0.18})`;
            ctx.fill();
            ctx.restore();
        }
    }
}

// ============================================
// MAIN GAME LOOP
// ============================================
function gameLoop(timestamp) {
    if (State.lastTime === 0) State.lastTime = timestamp;
    const dt = Math.min(timestamp - State.lastTime, 100); // cap at 100ms
    State.lastTime = timestamp;

    if (State.running || State.penguin.isAngel || State.penguin.falling) {
        update(dt);
    }
    render();

    requestAnimationFrame(gameLoop);
}

// ============================================
// START WHEN DOM IS READY
// ============================================
window.addEventListener('load', () => {
    initGame();
    setupSwipeControls();
});

// ============================================
// SWIPE GESTURE CONTROLS
// ============================================
function setupSwipeControls() {
    let touchStartX = 0;
    let touchStartY = 0;
    const canvas = document.getElementById('gameCanvas');

    canvas.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        SoundManager.resume();
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
        if (!State.running) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const threshold = 20;

        if (absDx < threshold && absDy < threshold) return;

        if (absDx > absDy) {
            queueMove(dx > 0 ? 'right' : 'left');
        } else {
            queueMove(dy > 0 ? 'down' : 'up');
        }
    }, { passive: true });
}
