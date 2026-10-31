/* ==========================================================================
   LIVING TOPOGRAPHY — Mapping Human Behaviour
   Hero background for harsha's portfolio.

   A generative cartographic field: slow, nested contour lines that breathe and
   flow, plus a handful of behavioural "nodes" that occasionally connect.
   Everything is driven by continuous sine fields, so the loop never resets.

   Design notes
   - Canvas is transparent; the warm ivory page shows through (no repaint of the
     background, so contrast stays exactly as designed).
   - Renders on a 30fps budget, pauses when the tab is hidden or the hero is
     off-screen, and never runs under prefers-reduced-motion (static frame).
   - Pointer influence is smoothed and local: a soft dimple that follows the
     cursor + a 1-2px parallax drift. Nothing snaps.
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

  var INK = '47, 42, 40';          // charcoal, a touch warmer than pure grey
  var ACCENT = '186, 114, 88';     // muted terracotta
  var FRAME_MS = 1000 / 30;        // visual budget: slow motion reads fine at 30fps

  var state = {
    w: 0,
    h: 0,
    dpr: 1,
    rings: [],
    lines: [],
    particles: [],
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

  // Harmonics shared by every contour. Rings take a small phase lag so the
  // lines braid together like real elevation data instead of wobbling randomly.
  var HARMONICS = [
    { freq: 2, amp: 0.062, speed: 0.112, lag: 0.20 },
    { freq: 3, amp: 0.038, speed: -0.087, lag: -0.30 },
    { freq: 5, amp: 0.019, speed: 0.142, lag: 0.45 },
    { freq: 7, amp: 0.008, speed: -0.180, lag: -0.62 }
  ];

  /* ------------------------------------------------------------- field build */

  // Contour families: one broad field that spans the hero, plus two small
  // "islands" tucked into opposite corners. Reads like a map, not a target.
  var GROUPS = [
    { cx: 0.52, cy: 0.47, tilt: -0.19, r0: 0.14, r1: 1.12, count: 9, alpha: 0.15 },
    { cx: 0.11, cy: 0.88, tilt: 0.42, r0: 0.05, r1: 0.30, count: 5, alpha: 0.13 },
    { cx: 0.93, cy: 0.09, tilt: -0.55, r0: 0.045, r1: 0.23, count: 4, alpha: 0.125 }
  ];

  function buildField() {
    var w = state.w;
    var h = state.h;
    if (!w || !h) return;

    var rand = seeded(20260214);
    var diagonal = Math.sqrt(w * w + h * h);
    var scale = diagonal * 0.5;
    var portrait = clamp(h / w, 0.45, 2.4);
    var ryFactor = 0.56 + 0.32 * Math.min(1.15, portrait);

    var segments = w < 640 ? 84 : 132;
    var compact = w < 640;

    // A shared set of phases keeps neighbouring contours flowing together.
    var basePhases = HARMONICS.map(function () { return rand() * TAU; });

    var rings = [];

    GROUPS.forEach(function (group, g) {
      var count = compact ? Math.max(3, group.count - (g === 0 ? 2 : 1)) : group.count;
      var gcx = w * (group.cx + (rand() - 0.5) * 0.05);
      var gcy = h * (group.cy + (rand() - 0.5) * 0.05);
      var tilt = group.tilt;

      for (var i = 0; i < count; i++) {
        var t = count > 1 ? i / (count - 1) : 0;

        var harmonics = HARMONICS.map(function (hm, k) {
          return {
            freq: hm.freq,
            amp: hm.amp * (0.5 + rand() * 1.15),
            speed: hm.speed * (0.8 + rand() * 0.5),
            // slow swell so lobes grow and recede instead of breathing as a whole
            swell: 0.3 + rand() * 0.55,
            swellSpeed: 0.05 + rand() * 0.075,
            // lag keeps the family braided; jitter stops it reading as rings
            phase: basePhases[k] + i * hm.lag + (rand() - 0.5) * 0.7
          };
        });

        var radius = scale * (group.r0 + t * (group.r1 - group.r0)) * (0.95 + rand() * 0.1);
        // Contours slide off-centre as they widen: this is a slope, not a target.
        var centreJitter = radius * 0.14;
        var aspect = ryFactor * (0.84 + rand() * 0.36);

        rings.push({
          segments: segments,
          rx: radius,
          ry: radius * aspect,
          cx: gcx + (rand() - 0.5) * centreJitter,
          cy: gcy + (rand() - 0.5) * centreJitter,
          seed: rand() * TAU,
          tilt: tilt + (rand() - 0.5) * 0.06,
          harmonics: harmonics,
          reach: g === 0 ? 0.55 + t * 0.75 : 1.15,
          driftAmp: (4 + t * 12) * (g === 0 ? 1 : 0.4),
          driftSpeed: 0.045 + rand() * 0.04,
          breathSpeed: 0.06 + rand() * 0.05,
          alpha: group.alpha * (1 - 0.38 * t),
          emphasis: g === 0 && i % 4 === 0,   // index contours, as on real maps
          pts: new Float32Array((segments + 1) * 2)
        });
      }
    });

    state.rings = rings;

    // A few open transect lines drift across the frame, the way a slope runs off
    // the edge of a survey sheet. They keep the field from closing in on itself.
    var lineSpecs = [
      { base: 0.115, amp: 0.045, freq: 1.1, speed: 0.021, slope: 0.05, alpha: 0.115 },
      { base: 0.885, amp: 0.052, freq: 0.85, speed: -0.017, slope: -0.07, alpha: 0.11 }
    ];
    if (w >= 900) lineSpecs.push({ base: 0.665, amp: 0.03, freq: 1.55, speed: 0.013, slope: 0.11, alpha: 0.075 });

    state.lines = lineSpecs.map(function (spec) {
      return {
        base: spec.base + (rand() - 0.5) * 0.02,
        amp: spec.amp * (0.85 + rand() * 0.3),
        freq: spec.freq,
        speed: spec.speed,
        slope: spec.slope,
        alpha: spec.alpha,
        phase: rand() * TAU,
        phase2: rand() * TAU,
        weight: 0.62,
        pts: new Float32Array(0)
      };
    });

    buildParticles(rand, w, h);
  }

  function buildParticles(rand, w, h) {
    // Stratified across the hero so nodes read as a survey, not a cluster.
    var portrait = h > w * 1.15;
    var cols = w < 560 ? 3 : portrait ? 3 : 4;
    var rows = w < 560 ? 4 : portrait ? 4 : 3;
    var count = Math.min(cols * rows, w < 560 ? 8 : 12);
    var cells = [];
    var c, r;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) cells.push([c, r]);
    }
    // shuffle deterministically
    for (var k = cells.length - 1; k > 0; k--) {
      var j = Math.floor(rand() * (k + 1));
      var tmp = cells[k]; cells[k] = cells[j]; cells[j] = tmp;
    }

    var particles = [];
    for (var i = 0; i < count; i++) {
      var cell = cells[i % cells.length];
      var nx = (cell[0] + 0.22 + rand() * 0.56) / cols;
      var ny = (cell[1] + 0.22 + rand() * 0.56) / rows;
      // push outwards from the optical centre: keeps the copy area calmer
      nx = 0.5 + (nx - 0.5) * 1.16;
      ny = 0.5 + (ny - 0.5) * 1.16;
      particles.push({
        x: clamp(nx, 0.04, 0.96),
        y: clamp(ny, 0.04, 0.96),
        vx: (rand() - 0.5) * 0.011,
        vy: (rand() - 0.5) * 0.010,
        r: 0.9 + rand() * 1.35,
        phase: rand() * TAU,
        wobble: 0.55 + rand() * 0.9,
        accent: rand() > 0.32,          // terracotta, with a few charcoal nodes
        alpha: 0.42 + rand() * 0.32
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

  function drawContours() {
    var w = state.w;
    var h = state.h;
    var time = state.time;
    var p = state.pointer;
    var px = p.x * w;
    var py = p.y * h;
    var reach = Math.sqrt(w * w + h * h) * 0.62;
    // Global parallax: the whole map leans a couple of pixels towards the cursor.
    var parX = (p.x - 0.5) * 16;
    var parY = (p.y - 0.5) * 12;

    for (var i = 0; i < state.rings.length; i++) {
      var ring = state.rings[i];
      var n = ring.segments;
      var pts = ring.pts;

      var cx = ring.cx + Math.cos(time * ring.driftSpeed + ring.seed) * ring.driftAmp + parX;
      var cy = ring.cy + Math.sin(time * ring.driftSpeed * 0.83 + ring.seed) * ring.driftAmp * 0.72 + parY;
      var breathe = 1 + Math.sin(time * ring.breathSpeed + ring.seed) * 0.012;

      // Cursor proximity drives a local dimple on the nearest arc of the ring.
      var dx = px - cx;
      var dy = py - cy;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var proximity = Math.max(0, 1 - dist / reach);
      var pointerAngle = Math.atan2(dy, dx);
      var bulge = proximity * proximity * 0.062 * ring.reach;

      var rx = ring.rx * breathe;
      var ry = ring.ry * breathe;
      var cosT = Math.cos(ring.tilt);
      var sinT = Math.sin(ring.tilt);

      for (var j = 0; j <= n; j++) {
        var theta = (j / n) * TAU;
        var radial = 0;

        for (var k = 0; k < ring.harmonics.length; k++) {
          var hm = ring.harmonics[k];
          var swell = 1 + hm.swell * Math.sin(time * hm.swellSpeed + hm.phase * 1.7);
          radial += hm.amp * swell * Math.sin(hm.freq * theta + hm.phase + time * hm.speed);
        }

        var delta = theta - pointerAngle;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        var local = Math.exp(-(delta * delta) / 0.24) * bulge;

        var f = 1 + radial + local;
        var ox = Math.cos(theta) * rx * f;
        var oy = Math.sin(theta) * ry * f;
        // Slight tilt per ring: families read as landscapes, not targets.
        pts[j * 2] = cx + ox * cosT - oy * sinT;
        pts[j * 2 + 1] = cy + ox * sinT + oy * cosT;
      }

      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (var q = 2; q < pts.length; q += 2) {
        ctx.lineTo(pts[q], pts[q + 1]);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(' + INK + ',' + ring.alpha.toFixed(3) + ')';
      ctx.lineWidth = ring.emphasis ? 0.95 : 0.7;
      ctx.stroke();
    }

    drawTransects(parX, parY);
  }

  function drawTransects(parX, parY) {
    var w = state.w;
    var h = state.h;
    var time = state.time;
    var steps = w < 640 ? 46 : 76;

    for (var i = 0; i < state.lines.length; i++) {
      var line = state.lines[i];
      ctx.beginPath();
      for (var j = 0; j <= steps; j++) {
        var u = j / steps;
        var x = -24 + u * (w + 48);
        var y = h * line.base
          + Math.sin(u * line.freq * TAU + line.phase + time * line.speed) * h * line.amp
          + Math.sin(u * line.freq * 2.7 + line.phase2 - time * line.speed * 1.6) * h * line.amp * 0.32
          + (u - 0.5) * h * line.slope
          + parY * 0.5;
        if (j === 0) ctx.moveTo(x + parX * 0.6, y);
        else ctx.lineTo(x + parX * 0.6, y);
      }
      ctx.strokeStyle = 'rgba(' + INK + ',' + line.alpha.toFixed(3) + ')';
      ctx.lineWidth = line.weight;
      ctx.stroke();
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
        alpha = (1 - d / linkLimit) * 0.16;
        ctx.strokeStyle = 'rgba(' + INK + ',' + alpha.toFixed(3) + ')';
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
          alpha = (1 - d / mouseLimit) * 0.22;
          ctx.strokeStyle = 'rgba(' + ACCENT + ',' + alpha.toFixed(3) + ')';
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

      ctx.fillStyle = 'rgba(' + (a.accent ? ACCENT : INK) + ',' + nodeAlpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x, y, a.r, 0, TAU);
      ctx.fill();

      // Faint halo reads as a measured data point rather than a dot.
      ctx.strokeStyle = 'rgba(' + (a.accent ? ACCENT : INK) + ',' + (nodeAlpha * 0.22).toFixed(3) + ')';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(x, y, a.r + 3.4, 0, TAU);
      ctx.stroke();
    }

    // A soft reticle at the cursor: the map noticing you.
    if (pointerOn) {
      ctx.strokeStyle = 'rgba(' + ACCENT + ',0.22)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(pointerPx, pointerPy, 5.5, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(' + ACCENT + ',0.5)';
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

    drawContours();
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
    state.time = 18;      // a settled, composed still frame
    paintOnce();
  } else {
    // Paint straight away, then hand over to the loop (which stays parked while
    // the tab is hidden or the hero is scrolled out of view).
    paintOnce();
    sync();
  }
  applyPointer();
})();
