/* ============================================
   draw_characters.js
   바다표범 & 펭귄 전신 캔버스 드로우 함수
   (game.js의 drawPenguin / drawHuntingSeals / drawSeal 을 덮어씌움)
   ============================================ */

// roundRect 폴리필 (구형 브라우저 대응)
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        this.beginPath();
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.arcTo(x + w, y, x + w, y + r, r);
        this.lineTo(x + w, y + h - r);
        this.arcTo(x + w, y + h, x + w - r, y + h, r);
        this.lineTo(x + r, y + h);
        this.arcTo(x, y + h, x, y + h - r, r);
        this.lineTo(x, y + r);
        this.arcTo(x, y, x + r, y, r);
        this.closePath();
        return this;
    };
}

// 바다표범 전신 직접 그리기
function drawSealBody(ctx, x, y, s, facingRight, t, wobble) {
    ctx.save();
    ctx.translate(x, y);
    if (facingRight) ctx.scale(-1, 1);

    const bw = wobble * 0.1;

    // 그림자
    ctx.beginPath();
    ctx.ellipse(0, s * 0.58, s * 0.68, s * 0.16, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();

    // 뒷 지느러미
    ctx.save();
    ctx.translate(s * 0.18, s * 0.48);
    ctx.rotate(0.22 + bw * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(s * 0.26, -s * 0.1, s * 0.4, s * 0.1, s * 0.3, s * 0.2);
    ctx.bezierCurveTo(s * 0.1, s * 0.26, -s * 0.06, s * 0.08, 0, 0);
    ctx.fillStyle = '#3a2e4a';
    ctx.fill();
    ctx.restore();

    // 몸통 유선형
    ctx.save();
    ctx.rotate(bw * 0.1);
    // 몸통 주색
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, -s * 0.18);
    ctx.bezierCurveTo(s * 0.54, -s * 0.24, s * 0.6, s * 0.26, s * 0.16, s * 0.56);
    ctx.bezierCurveTo(-s * 0.1, s * 0.62, -s * 0.46, s * 0.3, -s * 0.12, -s * 0.18);
    ctx.fillStyle = '#5c5068';
    ctx.fill();
    // 배 밝은 부분
    ctx.beginPath();
    ctx.moveTo(-s * 0.02, -s * 0.12);
    ctx.bezierCurveTo(s * 0.36, -s * 0.12, s * 0.4, s * 0.2, s * 0.08, s * 0.48);
    ctx.bezierCurveTo(-s * 0.04, s * 0.54, -s * 0.22, s * 0.28, -s * 0.02, -s * 0.12);
    ctx.fillStyle = '#ccc0d8';
    ctx.fill();
    ctx.restore();

    // 앞 지느러미 (왼쪽)
    ctx.save();
    ctx.translate(-s * 0.06, s * 0.06);
    ctx.rotate(-0.28 + bw * 0.8);
    ctx.beginPath();
    ctx.ellipse(-s * 0.27, 0, s * 0.3, s * 0.085, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#3a2e4a';
    ctx.fill();
    ctx.restore();

    // 앞 지느러미 (오른쪽)
    ctx.save();
    ctx.translate(s * 0.06, s * 0.06);
    ctx.rotate(0.26 - bw * 0.8);
    ctx.beginPath();
    ctx.ellipse(s * 0.27, 0, s * 0.3, s * 0.085, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#3a2e4a';
    ctx.fill();
    ctx.restore();

    // 머리
    ctx.beginPath();
    ctx.ellipse(-s * 0.3, -s * 0.22 + bw * s, s * 0.29, s * 0.25, -0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#5c5068';
    ctx.fill();

    // 머리 아랫면 연핑크
    ctx.beginPath();
    ctx.ellipse(-s * 0.26, -s * 0.11 + bw * s, s * 0.17, s * 0.15, -0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#e0c0c8';
    ctx.fill();

    // 눈 흰자
    ctx.beginPath();
    ctx.arc(-s * 0.38, -s * 0.32 + bw * s, s * 0.088, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    // 눈동자
    ctx.beginPath();
    ctx.arc(-s * 0.36, -s * 0.31 + bw * s, s * 0.054, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0816';
    ctx.fill();
    // 눈 반짝임
    ctx.beginPath();
    ctx.arc(-s * 0.344, -s * 0.324 + bw * s, s * 0.019, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // 코
    ctx.beginPath();
    ctx.arc(-s * 0.53, -s * 0.23 + bw * s, s * 0.075, 0, Math.PI * 2);
    ctx.fillStyle = '#6a5070';
    ctx.fill();

    // 콧수염 3개
    [[-0.04, -0.04], [0.0, -0.01], [-0.04, 0.03]].forEach(function(pair) {
        var dy = pair[0], dx = pair[1];
        ctx.beginPath();
        ctx.moveTo(-s * 0.53, (-s * 0.23 + bw * s) + dy * s);
        ctx.lineTo(-s * (0.53 + 0.23), (-s * (0.23 - 0.13) + bw * s) + (dy + dx) * s);
        ctx.strokeStyle = '#3a2840';
        ctx.lineWidth = s * 0.022;
        ctx.stroke();
    });

    ctx.restore();
}

// 얼음 위 사냥 바다표범들 그리기 (기존 함수 덮어씌움)
function drawHuntingSeals(ctx) {
    var t = Date.now() / 1000;
    var scale = State.tileW / 64;
    var p = State.penguin;

    State.huntingSeals.forEach(function(seal) {
        var wobble = Math.sin(t * 2.2 + seal.bobOffset);
        var drawX = seal.pixelX;
        var drawY = seal.pixelY - State.tileH * 0.28;

        // 위험 거리 빨간 글로우
        var dist = Math.abs(seal.col - p.col) + Math.abs(seal.row - p.row);
        if (dist <= 2) {
            var flash = 0.26 + 0.2 * Math.sin(t * 9);
            var grd = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, State.tileW * 0.7);
            grd.addColorStop(0, 'rgba(255,30,30,' + flash + ')');
            grd.addColorStop(1, 'rgba(255,30,30,0)');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(drawX, drawY, State.tileW * 0.7, 0, Math.PI * 2);
            ctx.fill();
        }

        var sealSz = seal.spawnDay === 20 ? 20
                   : seal.spawnDay === 40 ? 22
                   : seal.spawnDay === 60 ? 24 : 26;

        if (seal.appearing) {
            var progress = seal.appearTimer / seal.appearDuration;
            ctx.save();
            ctx.globalAlpha = Math.min(1.0, progress * 1.8);
            drawSealBody(ctx, drawX, drawY + (1 - progress) * 30 * scale,
                sealSz * scale, seal.col <= p.col, t, wobble);
            ctx.globalAlpha = 1.0;
            ctx.restore();
        } else {
            ctx.save();
            ctx.globalAlpha = 1.0;
            drawSealBody(ctx, drawX, drawY, sealSz * scale, seal.col <= p.col, t, wobble);
            ctx.restore();
        }

        // 등장일 배지 (완전 불투명)
        var badgeX = seal.pixelX + State.tileW * 0.3;
        var badgeY = seal.pixelY - State.tileH * 0.82;
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = 'rgba(18,10,40,0.9)';
        ctx.strokeStyle = 'rgba(255,100,100,0.95)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(badgeX - 18 * scale, badgeY - 8 * scale, 36 * scale, 16 * scale, 4 * scale);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffbbbb';
        ctx.font = 'bold ' + (9 * scale) + 'px Jua, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('D' + seal.spawnDay, badgeX, badgeY);
        ctx.restore();
    });
}

// 물 속 바다표범(게임오버 연출용) 그리기 (기존 함수 덮어씌움)
function drawSeal(ctx) {
    var p = State.penguin;
    var t = Date.now() / 1000;
    var scale = State.tileW / 64;

    var pos = isoProject(p.col, p.row);
    var gridBottom = State.gridOffsetY + (CONFIG.GRID_COLS + CONFIG.GRID_ROWS) * (State.tileH / 2) + State.tileDepth;
    var sealY = gridBottom + 28 + Math.sin(t * 3) * 4;
    var sealX = pos.x;

    // 물보라 이펙트
    ctx.save();
    ctx.globalAlpha = 0.65 + 0.3 * Math.sin(t * 4);
    ctx.font = (18 * scale) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uD83D\uDCA6', sealX - 14 * scale, sealY - 10 * scale);
    ctx.fillText('\uD83D\uDCA6', sealX + 14 * scale, sealY - 10 * scale);
    ctx.globalAlpha = 1.0;
    ctx.restore();

    // 바다표범 전신 완전 불투명
    ctx.save();
    ctx.globalAlpha = 1.0;
    drawSealBody(ctx, sealX, sealY, 24 * scale, false, t, Math.sin(t * 3));
    ctx.restore();
}

// 펭귄 전신 직접 그리기
function drawPenguinBody(ctx, x, y, s, dir, isWalking, t) {
    var facingLeft = (dir === 'left');

    ctx.save();
    ctx.translate(x, y);
    if (facingLeft) ctx.scale(-1, 1);

    // 그림자
    ctx.beginPath();
    ctx.ellipse(0, s * 1.05, s * 0.55, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();

    var legSwing = isWalking ? Math.sin(t * 14) * 0.28 : 0;

    // 왼쪽 발
    ctx.save();
    ctx.translate(-s * 0.22, s * 0.82);
    ctx.rotate(legSwing);
    ctx.beginPath();
    ctx.roundRect(-s * 0.1, 0, s * 0.2, s * 0.28, s * 0.05);
    ctx.fillStyle = '#E8A020';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-s * 0.04, s * 0.3, s * 0.17, s * 0.09, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#E8A020';
    ctx.fill();
    ctx.restore();

    // 오른쪽 발
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

    // 몸통 (검정)
    ctx.beginPath();
    ctx.ellipse(0, s * 0.28, s * 0.46, s * 0.62, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // 배 (흰색)
    ctx.beginPath();
    ctx.ellipse(s * 0.04, s * 0.35, s * 0.28, s * 0.44, 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f4ff';
    ctx.fill();

    // 파란 가슴 포인트
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(s * 0.04, s * 0.22, s * 0.16, s * 0.22, 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#4a90d9';
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.restore();

    // 왼쪽 날개
    var wingFlap = isWalking ? Math.sin(t * 14) * 0.35 : 0.12;
    ctx.save();
    ctx.translate(-s * 0.4, s * 0.18);
    ctx.rotate(-0.25 - wingFlap);
    ctx.beginPath();
    ctx.ellipse(0, s * 0.28, s * 0.13, s * 0.38, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s * 0.02, s * 0.28, s * 0.06, s * 0.24, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#2d2d4e';
    ctx.fill();
    ctx.restore();

    // 오른쪽 날개
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

    // 머리 (검정 원)
    ctx.beginPath();
    ctx.arc(0, -s * 0.3, s * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // 얼굴 흰 부분
    ctx.beginPath();
    ctx.ellipse(s * 0.04, -s * 0.25, s * 0.2, s * 0.24, 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f4ff';
    ctx.fill();

    // 눈
    var blinkNow = (Math.floor(t * 0.7) % 5 === 0) && (t % 0.7 < 0.1);
    if (!blinkNow) {
        ctx.beginPath();
        ctx.arc(-s * 0.08, -s * 0.35, s * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-s * 0.05, -s * 0.34, s * 0.055, 0, Math.PI * 2);
        ctx.fillStyle = '#111';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-s * 0.035, -s * 0.36, s * 0.022, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
    } else {
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

    // 부리
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

    // 볼 터치 (귀여움 포인트)
    ctx.beginPath();
    ctx.arc(s * 0.15, -s * 0.22, s * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,150,150,0.45)';
    ctx.fill();

    // 머리 위 파란 포인트
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.6, s * 0.14, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#4a90d9';
    ctx.fill();

    ctx.restore();
}

// 펭귄 그리기 (기존 함수 덮어씌움)
function drawPenguin(ctx) {
    var p = State.penguin;
    var t = Date.now() / 1000;

    var drawX = p.pixelX;
    var drawY = p.pixelY;

    if (p.falling) drawY += p.fallY;
    if (p.isAngel) drawY += p.angelY;

    var scale = State.tileW / 64;
    var s = 22 * scale;

    var bobY = p.moving ? Math.sin(t * 12) * 2 * scale : 0;
    var tiltAng = p.moving
        ? (p.direction === 'right' ? 0.10 : p.direction === 'left' ? -0.10 : 0)
        : 0;

    if (p.isAngel) {
        ctx.save();
        ctx.translate(drawX, drawY - s * 0.5 + bobY);
        ctx.globalAlpha = 1.0;
        drawPenguinBody(ctx, 0, 0, s, p.direction, false, t);

        // 후광 (halo)
        var haloAlpha = 0.55 + 0.25 * Math.sin(t * 4);
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.72, s * 0.38, s * 0.1, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,240,100,' + haloAlpha + ')';
        ctx.lineWidth = s * 0.1;
        ctx.stroke();

        // 빛 방사
        for (var i = 0; i < 8; i++) {
            var angle = (Math.PI * 2 / 8) * i + t * 1.2;
            var r1 = s * 0.5, r2 = s * 0.9;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * r1, -s * 0.3 + Math.sin(angle) * r1 * 0.3);
            ctx.lineTo(Math.cos(angle) * r2, -s * 0.3 + Math.sin(angle) * r2 * 0.3);
            ctx.strokeStyle = 'rgba(255,240,150,' + (0.15 + 0.1 * Math.sin(t * 3 + i)) + ')';
            ctx.lineWidth = s * 0.04;
            ctx.stroke();
        }
        ctx.restore();
        return;
    }

    if (p.falling) {
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
