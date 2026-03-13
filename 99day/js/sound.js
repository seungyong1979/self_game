/* ============================================
   Sound Manager - Web Audio API
   99일의 생존 - 펭귄의 얼음 모험
   ============================================ */

const SoundManager = (function() {
    let audioCtx = null;
    let masterGain = null;
    let isMuted = false;
    let bgMusicNodes = [];
    let bgInterval = null;

    function init() {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.setValueAtTime(0.6, audioCtx.currentTime);
            masterGain.connect(audioCtx.destination);
        } catch(e) {
            console.warn('Web Audio API not supported');
        }
    }

    function resume() {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    // ---- Basic oscillator helper ----
    function playTone(freq, type, duration, gainVal, startDelay = 0, fadeOut = true) {
        if (!audioCtx || isMuted) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(masterGain);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startDelay);
        gain.gain.setValueAtTime(gainVal, audioCtx.currentTime + startDelay);
        if (fadeOut) {
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + startDelay + duration);
        }
        osc.start(audioCtx.currentTime + startDelay);
        osc.stop(audioCtx.currentTime + startDelay + duration);
        return { osc, gain };
    }

    // ---- Noise generator ----
    function createNoise(duration, gainVal) {
        if (!audioCtx || isMuted) return;
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        source.start();
        return source;
    }

    // ---- Sound Effects ----

    // Penguin step / walk
    function playStep() {
        if (!audioCtx || isMuted) return;
        // Crunchy ice step
        const freqs = [200, 250, 180];
        freqs.forEach((f, i) => {
            playTone(f, 'sine', 0.08, 0.15, i * 0.02);
        });
        createNoise(0.05, 0.05);
    }

    // Ice cracking
    function playIceCrack() {
        if (!audioCtx || isMuted) return;
        // Descending crack sound
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(masterGain);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.3);
        createNoise(0.2, 0.12);
        // Additional crack tones
        [600, 350, 200].forEach((f, i) => {
            playTone(f, 'square', 0.15, 0.08, i * 0.05);
        });
    }

    // Ice breaking / falling
    function playIceBreak() {
        if (!audioCtx || isMuted) return;
        // Big crash
        createNoise(0.4, 0.25);
        [300, 200, 150, 100].forEach((f, i) => {
            playTone(f, 'sawtooth', 0.3, 0.12, i * 0.05);
        });
        playTone(50, 'sine', 0.5, 0.3, 0, true);
    }

    // Coin collect
    function playCoin() {
        if (!audioCtx || isMuted) return;
        // Cheerful ascending tones
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => {
            playTone(f, 'sine', 0.15, 0.2, i * 0.06);
        });
        playTone(1047, 'triangle', 0.3, 0.15, 0.18);
    }

    // Penguin fall into water
    function playFallInWater() {
        if (!audioCtx || isMuted) return;
        // Splash sound
        createNoise(0.5, 0.3);
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(masterGain);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }

    // Seal appear on ice (threatening sound)
    function playSealAppear() {
        if (!audioCtx || isMuted) return;
        // 긴장감 있는 저음 등장음
        [60, 80, 55, 75].forEach((f, i) => {
            playTone(f, 'sawtooth', 0.5, 0.2, i * 0.1);
        });
        // 날카로운 경고음
        playTone(440, 'square', 0.08, 0.15, 0.0);
        playTone(330, 'square', 0.08, 0.12, 0.1);
        createNoise(0.3, 0.1);
    }

    // Seal attack / death
    function playSealAttack() {
        if (!audioCtx || isMuted) return;
        // Low growl
        [80, 100, 70, 90].forEach((f, i) => {
            playTone(f, 'sawtooth', 0.4, 0.25, i * 0.08);
        });
        createNoise(0.6, 0.15);
        // Scary stab
        playTone(200, 'square', 0.1, 0.3, 0);
        playTone(150, 'square', 0.15, 0.25, 0.1);
    }

    // Angel floating up
    function playAngelFly() {
        if (!audioCtx || isMuted) return;
        // Heavenly chime
        const notes = [523, 659, 784, 880, 1047, 1175];
        notes.forEach((f, i) => {
            playTone(f, 'sine', 0.6, 0.15, i * 0.12);
            playTone(f * 2, 'sine', 0.4, 0.06, i * 0.12 + 0.05);
        });
    }

    // Day change notification
    function playDayChange() {
        if (!audioCtx || isMuted) return;
        // Short bell
        [880, 1108, 1320].forEach((f, i) => {
            playTone(f, 'sine', 0.4, 0.12, i * 0.1);
        });
    }

    // Victory fanfare
    function playVictory() {
        if (!audioCtx || isMuted) return;
        const melody = [
            [523, 0], [659, 0.12], [784, 0.24], [1047, 0.36],
            [784, 0.52], [880, 0.6], [1047, 0.72],
            [523, 0.9], [523, 1.0], [523, 1.1], [659, 1.25]
        ];
        melody.forEach(([f, t]) => {
            playTone(f, 'sine', 0.25, 0.2, t);
        });
    }

    // Ice regenerate (gentle tinkle)
    function playIceRegen() {
        if (!audioCtx || isMuted) return;
        [1200, 1500, 1800].forEach((f, i) => {
            playTone(f, 'sine', 0.2, 0.08, i * 0.05);
        });
    }

    // ---- Background Music ----
    // Simple atmospheric loop using pentatonic scale
    let bgPlaying = false;
    const pentatonic = [196, 220, 261, 294, 330, 392, 440, 523];

    function startBGMusic() {
        if (!audioCtx || isMuted || bgPlaying) return;
        bgPlaying = true;
        scheduleBGNote(0);
    }

    let bgNoteTimeout = null;

    function scheduleBGNote(delay) {
        if (!bgPlaying || isMuted) return;
        bgNoteTimeout = setTimeout(() => {
            if (!bgPlaying || isMuted) return;
            // Pick random pentatonic note
            const baseNote = pentatonic[Math.floor(Math.random() * pentatonic.length)];
            const octave = Math.random() > 0.6 ? 2 : 1;
            const freq = baseNote * octave;
            const duration = 0.8 + Math.random() * 1.2;
            const gainVal = 0.03 + Math.random() * 0.05;

            if (audioCtx && !isMuted) {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                const reverb = audioCtx.createBiquadFilter();
                reverb.type = 'lowpass';
                reverb.frequency.value = 2000;
                osc.connect(reverb);
                reverb.connect(gain);
                gain.connect(masterGain);
                osc.type = Math.random() > 0.5 ? 'sine' : 'triangle';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, audioCtx.currentTime);
                gain.gain.linearRampToValueAtTime(gainVal, audioCtx.currentTime + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
                osc.start();
                osc.stop(audioCtx.currentTime + duration + 0.1);
            }

            // Also play occasional low drone
            if (Math.random() > 0.85 && audioCtx && !isMuted) {
                playTone(55 + Math.random() * 20, 'sine', 2, 0.04, 0);
            }

            const nextDelay = 300 + Math.random() * 800;
            scheduleBGNote(nextDelay);
        }, delay);
    }

    function stopBGMusic() {
        bgPlaying = false;
        if (bgNoteTimeout) {
            clearTimeout(bgNoteTimeout);
            bgNoteTimeout = null;
        }
    }

    // Wind ambient sound
    let windNode = null;
    let windGain = null;

    function startWind() {
        if (!audioCtx || isMuted) return;
        const bufferSize = audioCtx.sampleRate * 3;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        windNode = audioCtx.createBufferSource();
        windNode.buffer = buffer;
        windNode.loop = true;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 300;
        filter.Q.value = 0.5;

        windGain = audioCtx.createGain();
        windGain.gain.value = 0.04;

        windNode.connect(filter);
        filter.connect(windGain);
        windGain.connect(masterGain);
        windNode.start();
    }

    function stopWind() {
        if (windNode) {
            try { windNode.stop(); } catch(e) {}
            windNode = null;
        }
    }

    function setMute(muted) {
        isMuted = muted;
        if (masterGain) {
            masterGain.gain.setValueAtTime(muted ? 0 : 0.6, audioCtx.currentTime);
        }
        if (muted) {
            stopBGMusic();
            stopWind();
        } else {
            startBGMusic();
            startWind();
        }
    }

    function getMuted() {
        return isMuted;
    }

    return {
        init,
        resume,
        playStep,
        playIceCrack,
        playIceBreak,
        playCoin,
        playFallInWater,
        playSealAppear,
        playSealAttack,
        playAngelFly,
        playDayChange,
        playVictory,
        playIceRegen,
        startBGMusic,
        stopBGMusic,
        startWind,
        stopWind,
        setMute,
        getMuted
    };
})();

// Toggle sound (called from HTML)
function toggleSound() {
    const btn = document.getElementById('sound-btn');
    const muted = !SoundManager.getMuted();
    SoundManager.setMute(muted);
    btn.textContent = muted ? '🔇' : '🔊';
}
