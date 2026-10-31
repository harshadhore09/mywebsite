/* ==========================================================================
   LIVING TOPOGRAPHY — Mapping Human Behaviour
   Hero background for Harsha's portfolio.

   A single, dense ribbon of hairline curves — hundreds of nested streamlines
   that share one meandering spine, bunching and fanning like a current, the way
   a behaviour runs through a system. Two quieter strands sit behind it, and a
   handful of behavioural "nodes" drift past, occasionally connecting.

   Design notes
   - Every motion is a sine of elapsed time, so the loop has no seam, reset or
     beat: the drawing keeps flowing without ever repeating a frame.
   - Canvas is transparent; the warm ivory page shows through (no repaint of the
     background, so text contrast stays exactly as designed).
   - Renders on a 30fps budget, parks when the tab is hidden or the hero is
     off-screen, and never animates under prefers-reduced-motion (still frame).
   - Pointer influence is eased and local: the ribbon gathers towards the cursor
     while the whole field leans a pixel or two. Nothing snaps.
   ========================================================================== */
(function () {
  'use strict';

  var canvas = document.querySelector('[data-topography]');
  if (!canvas) return;

  var ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)');
  var SMALL = window.matchMedia('(max-width: 767px)');
  var TAU = Math.PI * 2;

  var INK = '47, 42, 40';            // charcoal
  var WARM = '168, 127, 92';         // muted antique gold / sand
  var ACCENT = '186, 114, 88';       // muted terracotta
  var FRAME_MS = 1000 / 30;          // slow motion reads fine at 30fps

  var state = {
    w: 0,
    h: 0,
    dpr: 1,
    bundles: [],
    particles: [],
    vscale: 0,
    time: 0,
    lastPaint: 0,
    raf: 0,
    running: false,
    ready: false,
    // pointer is normalised (0..1) inside the hero, eased towards the target
    pointer: { tx: 0.5, ty: 0.42, x: 0.5, y: 0.42, active: false }
  };

  /* ---------------------------------------------------------------- helpers */

  // Stable composition: the same field is regenerated on every load.
  function seeded(seed) {
    var s = seed >>> 0;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function rgba(rgb, alpha) {
    return 'rgba(' + rgb + ',' + alpha.toFixed(3) + ')';
  }

  /* ------------------------------------------------------------- field build */

  // Three ribbons: the main current across the middle of the hero, a softer
  // return flow above it, and a thin spill below. Negative space is the point —
  // these cover roughly a third of the frame and let the type breathe.
  var BUNDLES = [
    {
      cy: 0.6, lines: 52, spread: 0.107, alpha: 0.18, ink: WARM,
      steps: 106, width: 0.7, drift: 1
    },
    {
      cy: 0.235, lines: 27, spread: 0.052, alpha: 0.125, ink: WARM,
      steps: 92, width: 0.65, drift: 0.85
    },
    {
      // a thin return flow that crosses the main current: the braid is what
      // reads as behaviour running into behaviour
      cy: 0.735, lines: 22, spread: 0.052, alpha: 0.095, ink: WARM,
      steps: 96, width: 0.62, drift: 0.9, cross: true
    },
    {
      cy: 0.9, lines: 14, spread: 0.034, alpha: 0.075, ink: INK,
      steps: 84, width: 0.6, drift: 0.7, until: 0.52
    }
  ];

  function buildField() {
    var w = state.w;
    var h = state.h;
    if (!w || !h) return;

    var rand = seeded(20260214);
    var compact = w < 680;
    // Vertical room the ribbon may use: on a tall phone the drawing keeps its
    // composure instead of stretching to the full height of the hero.
    state.vscale = Math.min(h, w * 1.2);

    state.bundles = BUNDLES.map(function (spec, index) {
      // Ribbons are built from three harmonics; the main one carries the long
      // meander, the other two give the fold and shoulder you see mid-frame.
      // Four harmonics: a long meander, a shoulder, a fold and a ripple.
      // Wavelengths stay long relative to the ribbon's width — a bundle can only
      // be as thick as its spine bends gently, or the offset lines fold through
      // themselves and you get cusps instead of cloth.
      var main = index === 0;
      var cross = !!spec.cross;
      var waves = [
        { freq: main ? 0.85 : 0.7 + rand() * 0.2, amp: main ? 0.155 : 0.085 + rand() * 0.03, speed: 0.032, phase: rand() * TAU },
        { freq: main ? 1.15 : 1.1 + rand() * 0.4, amp: main ? 0.082 : 0.042 + rand() * 0.018, speed: -0.052, phase: rand() * TAU },
        { freq: main ? 1.85 : 1.9 + rand() * 0.7, amp: main ? 0.03 : 0.017 + rand() * 0.011, speed: 0.09, phase: rand() * TAU },
        { freq: main ? 2.9 : 3.0 + rand() * 1.1, amp: main ? 0.009 : 0.006 + rand() * 0.005, speed: -0.132, phase: rand() * TAU }
      ];

      // The crossing ribbon runs on a different beat so the two never lock.
      if (cross) {
        waves[0].freq = 1.05;
        waves[0].amp = 0.072;
        waves[0].speed = -0.028;
        waves[1].freq = 1.4;
        waves[1].amp = 0.03;
      }

      // A phone hero is narrow: keep the same composition, drawn more quietly,
      // so it never turns into a tangle in a small frame.
      var ampScale = clamp(w / 1180, 0.62, 1);
      for (var wi = 0; wi < waves.length; wi++) waves[wi].amp *= ampScale;

      var count = compact ? Math.max(8, Math.round(spec.lines * 0.55)) : spec.lines;
      var lines = [];
      for (var i = 0; i < count; i++) {
        var k = count > 1 ? i / (count - 1) : 0.5;
        // Signed position across the ribbon, bunched towards the centre at the
        // sides: the denser core and looser edges of a bundle of streamlines.
        var centred = k * 2 - 1;
        var off = Math.sign(centred) * Math.pow(Math.abs(centred), 1.25);

        var trimmed = rand();
        lines.push({
          off: off,
          phase: rand() * TAU,
          // every line drifts a little out of step, so the bundle never
          // moves as a single sheet
          lag: (rand() - 0.5) * 0.5,
          follow: 0.45 + rand() * 0.55,
          // each line fans by a different amount: the bundle opens, crosses
          // itself and closes again, which is what gives the depth
          fan: 0.55 + rand() * 1.15,
          // cycles across the whole span, chosen from a wavelength in pixels so
          // the wobble stays calm on a phone instead of crinkling
          fanFreq: (1.26 * w) / (240 + rand() * 300),
          start: trimmed < 0.22 ? rand() * 0.22 : 0,
          // the short charcoal strand tapers: its lines stop at staggered
          // points, so it never looks cut off with a straight edge
          end: (1 - (trimmed > 0.78 ? rand() * 0.22 : 0)) *
               (spec.until ? spec.until * (0.82 + rand() * 0.36) : 1),
          // a few index lines carry more weight, as in a drawn map
          alpha: spec.alpha * (0.55 + rand() * 0.55) * (i % 7 === 3 ? 1.45 : 1),
          width: i % 7 === 3 ? spec.width + 0.18 : spec.width,
          ink: (index === 2 || i % 11 === 5) ? INK : spec.ink
        });
      }

      // Sampling follows pixels, not the size class: ~6.5px per station keeps
      // every bend smooth on phones as well as desktops.
      var steps = clamp(Math.round((1.26 * w) / 6.5), 84, 150);

      return {
        cy: spec.cy + (rand() - 0.5) * 0.03,
        spread: spec.spread * (0.9 + rand() * 0.22),
        waves: waves,
        lines: lines,
        steps: steps,
        drift: spec.drift,
        // pinch points where the ribbon gathers to a neck
        pinchAt: 0.32 + rand() * 0.42,
        pinch: 0.3 + rand() * 0.28,
        pinchWidth: 0.07 + rand() * 0.06,
        rippleFreq: clamp((1.26 * w) / 420, 1.4, 3.6),
        phase: rand() * TAU,
        // scratch buffers: the spine is shared by every line in the bundle
        sx: new Float32Array(steps + 2),
        sy: new Float32Array(steps + 2),
        nx: new Float32Array(steps + 2),
        ny: new Float32Array(steps + 2),
        sp: new Float32Array(steps + 2),
        ang: new Float32Array(steps + 2),
        curv: new Float32Array(steps + 2)
      };
    });

    buildParticles(rand, w, h);
  }

  function buildParticles(rand, w, h) {
    // Stratified across the hero so nodes read as a survey, not a cluster.
    var portrait = h > w * 1.15;
    var cols = w < 560 ? 3 : portrait ? 3 : 4;
    var rows = w < 560 ? 4 : portrait ? 4 : 3;
    var count = Math.min(cols * rows, w < 560 ? 7 : 10);
    var cells = [];
    var c, r;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) cells.push([c, r]);
    }
    for (var k = cells.length - 1; k > 0; k--) {
      var j = Math.floor(rand() * (k + 1));
      var tmp = cells[k]; cells[k] = cells[j]; cells[j] = tmp;
    }

    var particles = [];
    for (var i = 0; i < count; i++) {
      var cell = cells[i % cells.length];
      var nx = (cell[0] + 0.22 + rand() * 0.56) / cols;
      var ny = (cell[1] + 0.22 + rand() * 0.56) / rows;
      nx = 0.5 + (nx - 0.5) * 1.16;
      ny = 0.5 + (ny - 0.5) * 1.16;
      particles.push({
        x: clamp(nx, 0.04, 0.96),
        y: clamp(ny, 0.04, 0.96),
        vx: (rand() - 0.5) * 0.009,
        vy: (rand() - 0.5) * 0.008,
        r: 0.9 + rand() * 1.3,
        phase: rand() * TAU,
        wobble: 0.55 + rand() * 0.9,
        accent: rand() > 0.35,          // terracotta, with a few charcoal nodes
        alpha: 0.46 + rand() * 0.3
      });
    }
    state.particles = particles;
  }

  /* ------------------------------------------------------------------- sizing */

  var resizeQueued = false;

  function measure() {
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(240, Math.round(rect.width));
    var h = Math.max(240, Math.round(rect.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (w === state.w && h === state.h && dpr === state.dpr) return;

    state.w = w;
    state.h = h;
    state.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    buildField();

    if (REDUCE.matches || !state.running) paintOnce();
  }

  function queueMeasure() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(function () {
      resizeQueued = false;
      measure();
    });
  }

  /* ------------------------------------------------------------------ drawing */

  // Spine of a ribbon at u in [0,1]. The x axis is a straight sweep, so the
  // normal only ever tilts — cheap, and it keeps the flow horizontal.
  function spineInto(bundle, u, time, out) {
    var w = state.w;
    var h = state.h;
    var v = state.vscale || h;
    var y = h * bundle.cy;
    var dy = 0;
    for (var k = 0; k < bundle.waves.length; k++) {
      var wv = bundle.waves[k];
      var angle = u * wv.freq * TAU + wv.phase + time * wv.speed * bundle.drift;
      y += v * wv.amp * Math.sin(angle);
      dy += v * wv.amp * wv.freq * TAU * Math.cos(angle);
    }
    var span = 1.26 * w;
    var dx = span;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    out.x = -0.13 * w + u * span;
    out.y = y;
    out.nx = -dy / len;
    out.ny = dx / len;
    return out;
  }

  var spine = { x: 0, y: 0, nx: 0, ny: 0 };

  function drawBundles(parX, parY) {
    var w = state.w;
    var h = state.h;
    var time = state.time;
    var p = state.pointer;
    var px = p.x * w;
    var py = p.y * h;
    var following = p.active ? 1 : 0;
    var sigma = w * 0.17;
    var gatherLimit = (state.vscale || h) * 0.075;

    for (var b = 0; b < state.bundles.length; b++) {
      var bundle = state.bundles[b];
      var steps = bundle.steps;

      // ---- 1. sample the shared spine once per bundle, not once per line ----
      var span = 1.26 * w;
      var ds = span / steps;

      for (var s = 0; s <= steps; s++) {
        var u = s / steps;
        spineInto(bundle, u, time, spine);
        bundle.sx[s] = spine.x;
        bundle.sy[s] = spine.y;
        bundle.nx[s] = spine.nx;
        bundle.ny[s] = spine.ny;
        bundle.ang[s] = Math.atan2(-spine.ny, spine.nx) + Math.PI / 2;
      }

      // ---- 1b. how wide the ribbon is at each station ----------------------
      // Three things shape it: a slow swell, a pinch where the lines gather
      // into a neck, and curvature — a bundle is thick where the current bends
      // and thin along a straight run, which is what makes it read as fabric.
      for (s = 0; s <= steps; s++) {
        u = s / steps;

        var prev = bundle.ang[Math.max(0, s - 1)];
        var next = bundle.ang[Math.min(steps, s + 1)];
        var dAng = next - prev;
        while (dAng > Math.PI) dAng -= TAU;
        while (dAng < -Math.PI) dAng += TAU;
        var curv = s === 0 || s === steps ? 0 : dAng / (2 * ds);
        bundle.curv[s] = curv;

        var bend = 1 + Math.min(0.62, Math.abs(curv) * 120);
        var swell = 0.58 + 0.46 * Math.sin(u * 1.35 * TAU + bundle.phase + time * 0.03 * bundle.drift);
        var ripple = 1 + 0.15 * Math.sin(u * bundle.rippleFreq * TAU - bundle.phase * 1.7 + time * 0.045 * bundle.drift);
        var neck = 1 - bundle.pinch * Math.exp(-Math.pow((u - bundle.pinchAt) / bundle.pinchWidth, 2));
        var fade = 0.84 + 0.26 * Math.abs(u - 0.5) * 2;

        bundle.sp[s] = bundle.spread * (state.vscale || h) * 0.5 * swell * ripple * neck * fade * bend;

        // An offset curve can only be pushed so far before it folds through
        // itself: cap the ribbon's half-width at a fraction of the local radius
        // of curvature. This is what keeps the tight bends clean instead of
        // producing little cusps and loops.
        var slack = Math.abs(curv) > 1e-5 ? 0.42 / Math.abs(curv) : 1e9;
        bundle.curv[s] = slack;
      }

      // ---- 2. every line rides the same spine at its own offset -----------
      for (var i = 0; i < bundle.lines.length; i++) {
        var line = bundle.lines[i];
        var startStep = Math.round(line.start * steps);
        var endStep = Math.round(line.end * steps);
        var first = true;

        ctx.beginPath();
        for (s = startStep; s <= endStep; s++) {
          u = s / steps;
          var baseX = bundle.sx[s];
          var baseY = bundle.sy[s];
          var nxv = bundle.nx[s];
          var nyv = bundle.ny[s];

          // Offset across the ribbon. A curvature term pulls the station along
          // the spine (nested offsets bunch on an inside bend), then each line
          // adds its own slow wobble so neighbours cross instead of running
          // dead parallel.
          var half = Math.min(bundle.sp[s], bundle.curv[s]);
          var grip = line.off * half;
          var d = grip;
          d += Math.min((state.vscale || h) * 0.02, half * 0.35) * line.fan *
               Math.sin(u * line.fanFreq * TAU + line.phase + time * (0.16 + line.lag * 0.34)) *
               (0.3 + 0.7 * Math.abs(line.off));

          if (following) {
            var pointY = baseY + nyv * d;
            var dxc = px - baseX;
            var influence = Math.exp(-(dxc * dxc) / (2 * sigma * sigma));
            d += clamp(py - pointY, -gatherLimit, gatherLimit) * 0.55 * influence * line.follow;
          }

          var X = baseX + nxv * d + parX;
          var Y = baseY + nyv * d + parY;

          if (first) {
            ctx.moveTo(X, Y);
            first = false;
          } else {
            ctx.lineTo(X, Y);
          }
        }
        ctx.strokeStyle = rgba(line.ink, Math.min(0.46, line.alpha));
        ctx.lineWidth = line.width;
        ctx.stroke();
      }
    }
  }

  function drawParticles(dt) {
    var w = state.w;
    var h = state.h;
    var time = state.time;
    var particles = state.particles;
    var p = state.pointer;
    var pointerPx = p.x * w;
    var pointerPy = p.y * h;
    var pointerOn = p.active && !SMALL.matches;
    var linkLimit = Math.min(Math.max(w, h) * 0.19, 190);
    var mouseLimit = 150;
    var i, j, a, b, dx, dy, d, alpha;

    for (i = 0; i < particles.length; i++) {
      a = particles[i];
      a.x += (a.vx + Math.sin(time * 0.17 + a.phase) * 0.0032 * a.wobble) * dt;
      a.y += (a.vy + Math.cos(time * 0.13 + a.phase * 1.4) * 0.0028 * a.wobble) * dt;
      // wrap with a generous margin; edges fade so nothing pops
      if (a.x < -0.12) a.x += 1.24;
      if (a.x > 1.12) a.x -= 1.24;
      if (a.y < -0.12) a.y += 1.24;
      if (a.y > 1.12) a.y -= 1.24;
    }

    // Connections first, so the nodes sit on top of their threads.
    ctx.lineWidth = 0.6;
    for (i = 0; i < particles.length; i++) {
      a = particles[i];
      var ax = a.x * w;
      var ay = a.y * h;

      for (j = i + 1; j < particles.length; j++) {
        b = particles[j];
        dx = b.x * w - ax;
        dy = b.y * h - ay;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d > linkLimit || d < 1) continue;
        alpha = (1 - d / linkLimit) * 0.15;
        ctx.strokeStyle = rgba(INK, alpha);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + dx, ay + dy);
        ctx.stroke();
      }

      if (pointerOn) {
        dx = pointerPx - ax;
        dy = pointerPy - ay;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d < mouseLimit) {
          alpha = (1 - d / mouseLimit) * 0.2;
          ctx.strokeStyle = rgba(ACCENT, alpha);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(pointerPx, pointerPy);
          ctx.stroke();
        }
      }
    }

    // Nodes
    for (i = 0; i < particles.length; i++) {
      a = particles[i];
      var x = a.x * w;
      var y = a.y * h;
      // Fade out towards the hero edges so wrapped nodes never flash in.
      var edge = Math.min(a.x, 1 - a.x, a.y, 1 - a.y);
      var presence = clamp(edge / 0.1, 0, 1);
      var glow = 0.85 + Math.sin(time * 0.4 + a.phase) * 0.15;
      var nodeAlpha = a.alpha * presence * glow;

      if (nodeAlpha <= 0.01) continue;

      ctx.fillStyle = rgba(a.accent ? ACCENT : INK, nodeAlpha);
      ctx.beginPath();
      ctx.arc(x, y, a.r, 0, TAU);
      ctx.fill();

      // Faint halo reads as a measured data point rather than a dot.
      ctx.strokeStyle = rgba(a.accent ? ACCENT : INK, nodeAlpha * 0.2);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(x, y, a.r + 3.4, 0, TAU);
      ctx.stroke();
    }

    // A soft reticle at the cursor: the map noticing you.
    if (pointerOn) {
      ctx.strokeStyle = rgba(ACCENT, 0.22);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(pointerPx, pointerPy, 5.5, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = rgba(ACCENT, 0.5);
      ctx.beginPath();
      ctx.arc(pointerPx, pointerPy, 1.2, 0, TAU);
      ctx.fill();
    }
  }

  function draw(dt) {
    if (!state.w || !state.h) return;
    ctx.clearRect(0, 0, state.w, state.h);

    // 30fps easing is frame-rate independent enough for a 1-2px pointer drift.
    var ease = dt > 0 ? 1 - Math.pow(1 - 0.055, dt * 30) : 0;
    var p = state.pointer;
    p.x += (p.tx - p.x) * ease;
    p.y += (p.ty - p.y) * ease;

    // Whole-field lean: a pixel or two towards the cursor.
    var parX = (p.x - 0.5) * 14;
    var parY = (p.y - 0.5) * 10;

    drawBundles(parX, parY);
    drawParticles(dt);
  }

  function paintOnce() {
    if (!state.w || !state.h) return;
    draw(0);
    reveal();
  }

  function reveal() {
    if (state.ready) return;
    state.ready = true;
    canvas.classList.add('is-ready');
  }

  /* -------------------------------------------------------------- animation */

  function frame(now) {
    state.raf = 0;
    if (!state.running) return;
    state.raf = requestAnimationFrame(frame);

    if (now - state.lastPaint < FRAME_MS) return;

    var dt = state.lastPaint ? (now - state.lastPaint) / 1000 : 0.033;
    dt = Math.min(dt, 0.05);          // clamp: nothing lurches after a stall
    state.lastPaint = now;
    state.time += dt;

    applyPointer();
    draw(dt);
    reveal();
  }

  function start() {
    if (state.running) return;
    if (REDUCE.matches) {
      state.time = 18;                // a settled, composed still frame
      paintOnce();
      return;
    }
    if (!state.w) measure();
    state.running = true;
    state.lastPaint = 0;
    state.raf = requestAnimationFrame(frame);
  }

  function stop() {
    state.running = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  function sync() {
    var asleep = document.hidden || !inView;
    if (asleep) stop();
    else start();
  }

  /* -------------------------------------------------------------- interaction */

  var pendingPointer = null;

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    pendingPointer = { x: e.clientX, y: e.clientY };
  }, { passive: true });

  window.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') return;
    pendingPointer = { x: e.clientX, y: e.clientY };
  }, { passive: true });

  // Pointer position is converted to hero-local coordinates once per frame.
  function applyPointer() {
    if (!pendingPointer) return;
    var event = pendingPointer;
    pendingPointer = null;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    state.pointer.tx = clamp((event.x - rect.left) / rect.width, 0, 1);
    state.pointer.ty = clamp((event.y - rect.top) / rect.height, 0, 1);
    state.pointer.active = true;
  }

  window.addEventListener('beforeunload', stop);

  // Leaving the window relaxes the pointer back to the composition's centre.
  document.addEventListener('pointerleave', function () {
    state.pointer.tx = 0.5;
    state.pointer.ty = 0.42;
  });

  /* ------------------------------------------------------------ lifecycle */

  var inView = true;

  document.addEventListener('visibilitychange', sync);

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        inView = entry.isIntersecting;
      });
      sync();
    }, { rootMargin: '120px' });
    io.observe(canvas);
  }

  if (window.ResizeObserver) {
    var ro = new ResizeObserver(queueMeasure);
    ro.observe(canvas);
  } else {
    window.addEventListener('resize', queueMeasure);
  }

  function onMotionPreferenceChange() {
    if (REDUCE.matches) {
      stop();
      state.time = 18;
      paintOnce();
    } else {
      sync();
    }
  }

  if (REDUCE.addEventListener) REDUCE.addEventListener('change', onMotionPreferenceChange);
  else if (REDUCE.addListener) REDUCE.addListener(onMotionPreferenceChange);

  /* --------------------------------------------------------------- start-up */

  measure();
  if (REDUCE.matches) {
    state.time = 18;
    paintOnce();
  } else {
    paintOnce();
    sync();
  }
  applyPointer();
})();
