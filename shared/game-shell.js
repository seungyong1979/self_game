(() => {
  'use strict';

  function improveSemantics(root = document) {
    if (root.matches?.('button:not([type])')) root.type = 'button';
    root.querySelectorAll('button:not([type])').forEach((button) => {
      button.type = 'button';
    });

    if (root.matches?.('canvas:not([aria-label])')) {
      root.setAttribute('aria-label', `${document.title} 게임 화면`);
    }
    root.querySelectorAll('canvas:not([aria-label])').forEach((canvas) => {
      canvas.setAttribute('aria-label', `${document.title} 게임 화면`);
    });

    const controls = [
      ...(root.matches?.('div.btn, div.controlBtn, div[onclick], [data-game-button]') ? [root] : []),
      ...root.querySelectorAll('div.btn, div.controlBtn, div[onclick], [data-game-button]'),
    ];
    controls.forEach((control) => {
      if (!control.hasAttribute('role')) control.setAttribute('role', 'button');
      if (!control.hasAttribute('tabindex')) control.setAttribute('tabindex', '0');
      if (control.dataset.keyboardReady) return;
      control.dataset.keyboardReady = 'true';
      control.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        control.click();
      });
    });
  }

  function addHomeLink() {
    if (document.querySelector('.game-home-link')) return;
    const link = document.createElement('a');
    link.className = 'game-home-link';
    link.href = document.body.dataset.homeHref || 'index.html';
    link.setAttribute('aria-label', '게임 목록으로 돌아가기');
    link.innerHTML = '<span aria-hidden="true">🏠</span><span class="game-home-label">게임 목록으로</span>';
    document.body.append(link);
  }

  function addAudioToggle() {
    if (!document.body.hasAttribute('data-audio-toggle')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-sound-toggle';

    const applyState = (muted) => {
      document.documentElement.dataset.soundMuted = String(muted);
      button.textContent = muted ? '🔇' : '🔊';
      button.setAttribute('aria-pressed', String(muted));
      button.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
      document.querySelectorAll('audio, video').forEach((media) => {
        media.muted = muted;
      });
      window.dispatchEvent(new CustomEvent('game-audiochange', { detail: { muted } }));
    };

    let muted = localStorage.getItem('kids-game-muted') === 'true';
    applyState(muted);
    button.addEventListener('click', () => {
      muted = !muted;
      localStorage.setItem('kids-game-muted', String(muted));
      applyState(muted);
    });
    document.body.append(button);
  }

  function dispatchKey(type, key) {
    const code = key === ' ' ? 'Space' : key;
    window.dispatchEvent(new KeyboardEvent(type, {
      key,
      code,
      bubbles: true,
      cancelable: true,
    }));
  }

  function addMobileControls() {
    const mode = document.body.dataset.mobileControls;
    if (!mode) return;

    const controls = document.createElement('div');
    controls.className = 'mobile-game-controls';
    controls.setAttribute('aria-label', '모바일 게임 조작');

    const definitions = [
      ['ArrowUp', '▲', '위로 이동'],
      ['ArrowLeft', '◀', '왼쪽으로 이동'],
      ['ArrowDown', '▼', '아래로 이동'],
      ['ArrowRight', '▶', '오른쪽으로 이동'],
    ];
    if (mode.includes('action')) definitions.push([' ', '동작', '공격 또는 낚싯줄 던지기']);

    definitions.forEach(([key, text, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mobile-game-control';
      button.dataset.key = key;
      button.textContent = text;
      button.setAttribute('aria-label', label);

      const release = () => {
        if (!button.classList.contains('is-pressed')) return;
        button.classList.remove('is-pressed');
        dispatchKey('keyup', key);
      };

      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        button.classList.add('is-pressed');
        dispatchKey('keydown', key);
      });
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      controls.append(button);
    });

    document.body.append(controls);
  }

  document.addEventListener('DOMContentLoaded', () => {
    improveSemantics();
    addHomeLink();
    addAudioToggle();
    addMobileControls();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) improveSemantics(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
