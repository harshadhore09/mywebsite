/* =====================================================================
   Themed micro-interactions + custom cursor
   Shared by the three case studies; each page opts in with
   <html data-project="mbg|food|medical">.

   Why a script and not pure CSS: the follower has to track the pointer
   every frame, and the themed flourish (coin drop, delivery ping,
   heartbeat) must never run for touch readers or when the reader asked
   for reduced motion. Everything it creates is aria-hidden and
   pointer-events:none, so the case studies stay fully usable without it —
   and the native cursor simply stays if this file never loads.
   ===================================================================== */

/* ---- the three personalities ---------------------------------------- */

/* Pragati — Mahila Bachat Gat: a savings collective, so the cursor is a
   coin-stamp and clicks drop small change. The page already sprinkles
   golden glitter behind the pointer, so there is no extra trail here. */
const MBG_THEME = {
  glyph: '<span class="mi-glyph-tx">&#8377;</span>',
  burst: 'coins',
  trail: null,
  tilt: false,
};

/* Food Delivery — Waiting Anxiety: hot food in a box, steam behind the
   pointer, and a tracking ping wherever the reader clicks. */
const FOOD_THEME = {
  glyph: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.6 10.2 5.3 4.4h13.4l1.7 5.8"/><path d="M4.6 10.2h14.8v3.1c0 4-3.3 7.2-7.4 7.2s-7.4-3.2-7.4-7.2v-3.1Z"/><path d="M9.6 3.2c.9.9-.9 1.7 0 2.6M14.4 2.8c.9.9-.9 1.7 0 2.6"/></svg>',
  burst: 'ping',
  trail: 'steam',
  tilt: false,
};

/* Medical Adherence: the follower is a capsule that tilts as it rolls,
   leaving tumbling dose crumbs, and clicks answer with a heartbeat. */
const MEDICAL_THEME = {
  glyph: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12.5h4l2-5.5 3.5 11 3-5.5 2 2h4"/></svg>',
  burst: 'beat',
  trail: 'dose',
  tilt: true,
};

const THEMES = {
  'MBG_index.html': MBG_THEME,
  'StrategicUX_index.html': FOOD_THEME,
  'MedicalAdher_index.html': MEDICAL_THEME,
  mbg: MBG_THEME,
  food: FOOD_THEME,
  medical: MEDICAL_THEME,
};

(() => {
  'use strict';

  const root = document.documentElement;
  const file = window.location.pathname.split('/').pop();
  const project = root.dataset.project || THEMES[file] && file || '';
  const theme = THEMES[project];
  if (!theme) return;

  const mq = (query) => (window.matchMedia ? window.matchMedia(query) : { matches: false, addEventListener() {} });
  const motion = mq('(prefers-reduced-motion: reduce)');
  const fine = mq('(hover: hover) and (pointer: fine)');
  if (motion.matches || !fine.matches) return;
  if (!document.body) return;

  const R = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const HOVER = 'a, button, [role="button"], summary';

  /* ---- build the cursor --------------------------------------------- */
  const layer = document.createElement('div');
  layer.className = 'mi-layer';
  layer.setAttribute('aria-hidden', 'true');
  const ring = document.createElement('div');
  ring.className = 'mi-ring';
  const glyph = document.createElement('div');
  glyph.className = 'mi-glyph';
  glyph.innerHTML = theme.glyph;
  ring.appendChild(glyph);
  const dot = document.createElement('div');
  dot.className = 'mi-dot';
  layer.append(dot, ring);
  document.body.appendChild(layer);
  root.classList.add('mi-cursor-on');

  /* ---- state --------------------------------------------------------- */
  let px = window.innerWidth / 2;
  let py = window.innerHeight / 2;
  let rx = px;
  let ry = py;
  let scale = 1;
  let targetScale = 1;
  let tilt = 0;
  let targetTilt = 0;
  let visible = false;
  let raf = 0;
  let on = true;

  function setScale() {
    targetScale = layer.classList.contains('is-press') ? .82
      : layer.classList.contains('is-hover') ? 1.6
      : 1;
  }

  /* ---- one rAF loop drives both cursor elements ---------------------- */
  function frame() {
    raf = 0;
    rx += (px - rx) * .22;
    ry += (py - ry) * .22;
    scale += (targetScale - scale) * .18;
    if (theme.tilt) {
      targetTilt *= .92;
      tilt += (targetTilt - tilt) * .14;
    }
    ring.style.transform = 'translate3d(' + rx.toFixed(2) + 'px,' + ry.toFixed(2) + 'px,0) scale(' + scale.toFixed(3) + ')' +
      (theme.tilt ? ' rotate(' + tilt.toFixed(1) + 'deg)' : '');
    dot.style.transform = 'translate3d(' + px.toFixed(2) + 'px,' + py.toFixed(2) + 'px,0)';
    if (visible) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }

  /* ---- themed particles ---------------------------------------------- */
  const MAX_FX = 90;
  let fxCount = 0;
  function fx(kind, x, y, vars, life) {
    if (!on || fxCount >= MAX_FX) return null;
    const p = document.createElement('div');
    p.className = 'mi-fx mi-fx--' + kind;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    if (vars) for (const key in vars) p.style.setProperty('--' + key, vars[key]);
    p.style.setProperty('--life', life + 'ms');
    layer.appendChild(p);
    fxCount++;
    const kill = () => { if (p.isConnected) { p.remove(); fxCount--; } };
    p.addEventListener('animationend', kill, { once: true });
    window.setTimeout(kill, life + 260);
    return p;
  }

  function burst(x, y) {
    if (!on) return;
    if (theme.burst === 'coins') {
      for (let i = 0; i < 5; i++) {
        fx('coin', x, y, {
          dx: R(-48, 48).toFixed(1) + 'px',
          dy: R(-58, -8).toFixed(1) + 'px',
          r: R(-200, 200).toFixed(0) + 'deg',
          s: R(.7, 1.2).toFixed(2),
        }, R(620, 880));
      }
      fx('sparkle', x, y, { dx: R(-26, 26).toFixed(1) + 'px', dy: R(-44, -10).toFixed(1) + 'px' }, 620);
    } else if (theme.burst === 'ping') {
      fx('ping', x, y, null, 640);
      window.setTimeout(() => fx('ping', x, y, null, 640), 130);
    } else if (theme.burst === 'beat') {
      fx('beat', x, y, null, 720);
      window.setTimeout(() => fx('beat', x, y, null, 720), 150);
    }
  }

  let trailX = 0;
  let trailY = 0;
  let trailAt = 0;
  function trail(x, y) {
    if (!theme.trail) return;
    const now = performance.now();
    if (Math.hypot(x - trailX, y - trailY) < 18 || now - trailAt < 60) return;
    trailAt = now;
    trailX = x;
    trailY = y;
    if (theme.trail === 'steam') {
      fx('steam', x, y, { dx: R(-8, 8).toFixed(1) + 'px' }, 950);
    } else {
      fx('dose', x, y, {
        dx: R(-10, 10).toFixed(1) + 'px',
        dy: R(18, 34).toFixed(1) + 'px',
        r: R(-40, 40).toFixed(0) + 'deg',
      }, 820);
    }
  }

  /* ---- pointer ------------------------------------------------------- */
  window.addEventListener('pointermove', (e) => {
    if (!on || (e.pointerType && e.pointerType !== 'mouse')) return;
    px = e.clientX;
    py = e.clientY;
    if (theme.tilt) targetTilt = clamp((px - rx) * 1.4, -16, 16);
    if (!visible) {
      // snap the follower to the pointer on (re)entry instead of flying in
      visible = true;
      rx = px;
      ry = py;
      layer.classList.remove('is-out');
    }
    kick();
    trail(px, py);
  }, { passive: true });

  window.addEventListener('pointerover', (e) => {
    if (!on) return;
    const target = e.target && e.target.closest ? e.target.closest(HOVER) : null;
    layer.classList.toggle('is-hover', !!target);
    setScale();
  }, { passive: true });

  window.addEventListener('pointerdown', (e) => {
    if (!on || (e.pointerType && e.pointerType !== 'mouse')) return;
    if (e.button !== 0) return;
    // a click can arrive before any movement; place the cursor there
    px = e.clientX;
    py = e.clientY;
    if (!visible) {
      visible = true;
      rx = px;
      ry = py;
      layer.classList.remove('is-out');
    }
    layer.classList.add('is-press');
    setScale();
    kick();
    burst(e.clientX, e.clientY);
  }, { passive: true });

  ['pointerup', 'pointercancel'].forEach((type) => {
    window.addEventListener(type, () => {
      if (!on) return;
      layer.classList.remove('is-press');
      setScale();
    }, { passive: true });
  });

  const hide = () => { visible = false; layer.classList.add('is-out'); };
  document.documentElement.addEventListener('pointerleave', hide);
  window.addEventListener('blur', hide);

  /* ---- a changed motion preference retires the whole flourish -------- */
  function teardown() {
    on = false;
    visible = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    layer.remove();
    root.classList.remove('mi-cursor-on');
  }
  if (motion.addEventListener) motion.addEventListener('change', (e) => { if (e.matches) teardown(); });
})();
