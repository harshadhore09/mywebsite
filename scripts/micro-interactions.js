/* =====================================================================
   Micro-interactions + custom cursor
   One common package for the three case studies, copied from Pragati
   (Mahila Bachat Gat) and kept the same on Food Delivery and Medical
   Adherence. Each page opts in with <html data-project="mbg|food|medical">.

   Why a script and not pure CSS: the follower has to track the pointer
   every frame, and the flourish (coin drops, the golden glitter trail)
   must never run for touch readers or when the reader asked for reduced
   motion. Everything it creates is aria-hidden and pointer-events:none,
   so the case studies stay fully usable without it — and the native
   cursor simply stays if this file never loads.
   ===================================================================== */

/* ---- the one personality (Pragati / Mahila Bachat Gat's) ------------
   The cursor is a coin-stamp: a ₹ glyph shows over links, clicks drop
   small change (coins and a sparkle), and the golden glitter trail that
   used to live inline on the Pragati page is ported here so all three
   case studies carry the identical trail. */
const GLYPH = '<span class="mi-glyph-tx">&#8377;</span>';

/* The glitter palette and motion are Pragati's, copied verbatim so the
   trail looks and falls exactly the same on every case study. */
const GLITTER_COL = ['#ff4d17', '#ffb02e', '#ffd966', '#f2879a', '#fff4d6', '#e8447a'];
const GLITTER_MAX = 80;
function glitterShape(c, s) {
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c.7 6.4 4.9 10.6 12 12-7.1 1.4-11.3 5.6-12 12-.7-6.4-4.9-10.6-12-12C7.1 10.6 11.3 6.4 12 0z" fill="' + c + '"/></svg>';
}

const PROJECTS = {
  'MBG_index.html': 1,
  'StrategicUX_index.html': 1,
  'MedicalAdher_index.html': 1,
  mbg: 1,
  food: 1,
  medical: 1,
};

(() => {
  'use strict';

  const root = document.documentElement;
  const file = window.location.pathname.split('/').pop();
  const project = root.dataset.project || (PROJECTS[file] ? file : '');
  if (!PROJECTS[project]) return;

  const mq = (query) => (window.matchMedia ? window.matchMedia(query) : { matches: false, addEventListener() {} });
  const motion = mq('(prefers-reduced-motion: reduce)');
  const fine = mq('(hover: hover) and (pointer: fine)');
  if (motion.matches || !fine.matches) return;
  if (!document.body) return;

  const R = (a, b) => a + Math.random() * (b - a);
  const HOVER = 'a, button, [role="button"], summary';

  /* ---- build the cursor --------------------------------------------- */
  const layer = document.createElement('div');
  layer.className = 'mi-layer';
  layer.setAttribute('aria-hidden', 'true');
  const ring = document.createElement('div');
  ring.className = 'mi-ring';
  const glyph = document.createElement('div');
  glyph.className = 'mi-glyph';
  glyph.innerHTML = GLYPH;
  ring.appendChild(glyph);
  const dot = document.createElement('div');
  dot.className = 'mi-dot';
  layer.append(dot, ring);
  document.body.appendChild(layer);

  /* ---- and the glitter trail layer, under the cursor like Pragati's -- */
  const glitterLayer = document.createElement('div');
  glitterLayer.className = 'mi-glitter';
  glitterLayer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(glitterLayer);
  root.classList.add('mi-cursor-on');

  /* ---- state --------------------------------------------------------- */
  let px = window.innerWidth / 2;
  let py = window.innerHeight / 2;
  let rx = px;
  let ry = py;
  let scale = 1;
  let targetScale = 1;
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
    ring.style.transform = 'translate3d(' + rx.toFixed(2) + 'px,' + ry.toFixed(2) + 'px,0) scale(' + scale.toFixed(3) + ')';
    dot.style.transform = 'translate3d(' + px.toFixed(2) + 'px,' + py.toFixed(2) + 'px,0)';
    if (visible) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }

  /* ---- click particles ----------------------------------------------- */
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

  /* clicks drop small change — coins kicked out from under the pointer
     and one bright sparkle, exactly like Pragati's */
  function burst(x, y) {
    if (!on) return;
    for (let i = 0; i < 5; i++) {
      fx('coin', x, y, {
        dx: R(-48, 48).toFixed(1) + 'px',
        dy: R(-58, -8).toFixed(1) + 'px',
        r: R(-200, 200).toFixed(0) + 'deg',
        s: R(.7, 1.2).toFixed(2),
      }, R(620, 880));
    }
    fx('sparkle', x, y, { dx: R(-26, 26).toFixed(1) + 'px', dy: R(-44, -10).toFixed(1) + 'px' }, 620);
  }

  /* ---- the golden glitter trail (Pragati's, shared by all three) ----- */
  let glitterAlive = 0;
  let gLast = 0;
  let gX = 0;
  let gY = 0;
  function spawnGlitter(x, y) {
    if (!on || glitterAlive >= GLITTER_MAX) return;
    const p = document.createElement('div');
    p.className = 'gp';
    const c = GLITTER_COL[(Math.random() * GLITTER_COL.length) | 0];
    const life = R(800, 1400);
    p.innerHTML = glitterShape(c, R(7, 14));
    p.style.left = (x + R(-6, 6)) + 'px';
    p.style.top = (y + R(-6, 6)) + 'px';
    p.style.setProperty('--dx', R(-40, 40) + 'px');
    p.style.setProperty('--dy', R(-35, 10) + 'px');
    p.style.setProperty('--grav', R(30, 65) + 'px');
    p.style.setProperty('--life', life + 'ms');
    glitterLayer.appendChild(p);
    glitterAlive++;
    let dead = false;
    const kill = () => {
      if (dead) return;
      dead = true;
      if (p.isConnected) p.remove();
      glitterAlive--;
    };
    p.addEventListener('animationend', kill, { once: true });
    window.setTimeout(kill, life + 260);
  }

  /* same cadence as the Pragati page: a sparkle every ~28ms once the
     pointer has travelled 16px */
  function trail(x, y) {
    const d = Math.hypot(x - gX, y - gY);
    const now = performance.now();
    if (d > 16 && now - gLast > 28) {
      spawnGlitter(x, y);
      gLast = now;
      gX = x;
      gY = y;
    }
  }

  /* ---- pointer ------------------------------------------------------- */
  window.addEventListener('pointermove', (e) => {
    if (!on || (e.pointerType && e.pointerType !== 'mouse')) return;
    px = e.clientX;
    py = e.clientY;
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
    glitterLayer.remove();
    root.classList.remove('mi-cursor-on');
  }
  if (motion.addEventListener) motion.addEventListener('change', (e) => { if (e.matches) teardown(); });
})();
