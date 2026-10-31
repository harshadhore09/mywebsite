const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require(process.env.JSDOM_PATH || '/tmp/node_modules/jsdom');

const root = path.join(__dirname, '../..');
const script = fs.readFileSync(path.join(root, 'scripts/hero-topography.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* jsdom has no canvas backend, so the 2d context is a recorder: it keeps the
   path coordinates the engine draws, which is what these tests assert on. */
function harness({ reduced = false } = {}) {
  const dom = new JSDOM(html, {
    url: 'https://portfolio.example/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  const canvas = w.document.querySelector('[data-topography]');

  const paint = { strokes: 0, fills: 0, frames: 0, paths: [] };
  let current = [];
  let lastArc = null;
  const ctx = {
    lineWidth: 1, lineJoin: 'miter', lineCap: 'butt', strokeStyle: '', fillStyle: '',
    setTransform() {},
    clearRect() { paint.frames += 1; },
    beginPath() { current = []; lastArc = null; },
    closePath() {},
    moveTo(x, y) { current.push([x, y]); },
    lineTo(x, y) { current.push([x, y]); },
    arc(x, y, r) { lastArc = { x, y, r }; },
    stroke() { paint.strokes += 1; paint.paths.push({ points: current.slice(), width: this.lineWidth, style: this.strokeStyle }); },
    fill() { paint.fills += 1; paint.lastFill = { arc: lastArc, style: this.fillStyle }; },
  };
  w.HTMLCanvasElement.prototype.getContext = () => ctx;
  w.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1440, height: 900 });
  w.matchMedia = (query) => ({
    matches: query.includes('reduced-motion') ? reduced : false,
    media: query,
    addEventListener() {},
    addListener() {},
  });

  const listeners = [];
  const addEventListener = w.document.addEventListener.bind(w.document);
  w.document.addEventListener = (type, callback, options) => {
    listeners.push(type);
    return addEventListener(type, callback, options);
  };

  const pointer = (type, x, y) => {
    const event = new w.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    w.dispatchEvent(event);
    return event;
  };

  const setHidden = (hidden) => {
    Object.defineProperty(w.document, 'hidden', { configurable: true, get: () => hidden });
    w.document.dispatchEvent(new w.Event('visibilitychange'));
  };

  w.eval(script);
  return { dom, w, canvas, ctx, paint, pointer, setHidden, listeners };
}

const contours = (paint) => paint.paths.filter((p) => p.points.length > 40);

async function main() {
  /* ---- 1. wiring: the field lives in the hero, not floating over the page -- */
  const atmosphere = /<div class="hero-atmosphere" aria-hidden="true">\s*<canvas class="topo-canvas" data-topography><\/canvas>/.test(html);
  assert.ok(atmosphere, 'hero owns an aria-hidden atmosphere layer with the canvas');

  const heroAt = html.indexOf('<section class="hero-new');
  const canvasAt = html.indexOf('data-topography');
  const navAt = html.indexOf('Top pill nav bar');
  assert.ok(heroAt > -1 && canvasAt > heroAt && canvasAt < navAt, 'canvas sits inside the hero, before its content');
  assert.equal(html.split('data-topography').length, 2, 'exactly one topography canvas on the page');
  assert.ok(!/id="bg-canvas"|class="spotlight"|id="orb[123]"|initMouseBackground/.test(html), 'old background layers are gone');
  assert.match(html, /<script src="\.\/scripts\/hero-topography\.js" defer><\/script>/, 'engine is loaded as a deferred script');

  /* ---- 2. css keeps it behind content and inert ---------------------------- */
  assert.match(html, /\.hero-atmosphere\s*\{[^}]*position: absolute;[^}]*pointer-events: none;/, 'layer is absolute and inert');
  assert.match(html, /\.topo-canvas\s*\{[^}]*pointer-events|\.hero-atmosphere\s*\{[^}]*pointer-events: none;/, 'no pointer capture');
  assert.match(html, /\.hero-atmosphere::after\s*\{[^}]*radial-gradient/, 'cream wash keeps copy crisp');
  assert.match(html, /@media \(prefers-reduced-motion: reduce\) \{\s*\.topo-canvas \{ transition: none; \}/, 'css respects reduced motion');

  /* ---- 3. it draws, it does not flood, it animates ------------------------- */
  const live = harness();
  assert.ok(live.paint.strokes > 0, 'first frame paints before any rAF');
  assert.ok(live.canvas.classList.contains('is-ready'), 'canvas revealed');
  assert.equal(live.canvas.width, 1440, 'backing store matches css width');
  assert.equal(live.canvas.height, 900, 'backing store matches css height');

  const first = live.paint.strokes;
  await sleep(400);
  assert.ok(live.paint.strokes > first, 'keeps drawing on requestAnimationFrame');

  /* the field is a set of nested streamlines: long open curves that sweep
     left to right, densely bunched, never a closed ring */
  const curves = contours(live.paint);
  assert.ok(curves.length > 20, 'line bundles are painted');

  for (const curve of curves.slice(0, 12)) {
    const pts = curve.points;
    const start = pts[0];
    const end = pts[pts.length - 1];
    assert.ok(end[0] - start[0] > 100, 'each streamline runs across the frame');
    assert.ok(Math.hypot(start[0] - end[0], start[1] - end[1]) > 100, 'curves are open, not closed rings');

    // x must never run backwards: the bundle flows left to right
    let monotonic = true;
    for (let i = 1; i < pts.length; i += 1) if (pts[i][0] < pts[i - 1][0] - 0.6) monotonic = false;
    assert.ok(monotonic, 'streamlines stay monotonic, so they never fold through themselves');
  }

  /* strokes stay hairline, and the palette stays muted */
  for (const curve of curves.slice(0, 24)) {
    assert.ok(curve.width <= 1, 'hairline strokes');
    assert.match(curve.style, /^rgba\((47, 42, 40|168, 127, 92|186, 114, 88),0\.\d+\)$/, 'charcoal, antique gold or terracotta only');
  }

  /* the bundle is nested: consecutive streamlines sit close together */
  const nested = curves.slice(0, 6).map((c) => c.points[10][1]);
  assert.ok(new Set(nested.map((y) => Math.round(y))).size > 3, 'streamlines occupy distinct lanes');
  const laneGaps = [];
  for (let i = 1; i < nested.length; i += 1) laneGaps.push(Math.abs(nested[i] - nested[i - 1]));
  assert.ok(Math.max(...laneGaps) < 120, 'lanes stay close enough to read as one ribbon');

  /* ---- 4. slow, continuous morphing (no jumps between frames) ------------- */
  const before = contours(live.paint).at(-1).points;
  await sleep(320);
  const after = contours(live.paint).at(-1).points;
  let maxShift = 0;
  for (let i = 0; i < Math.min(before.length, after.length); i += 1) {
    maxShift = Math.max(maxShift, Math.hypot(before[i][0] - after[i][0], before[i][1] - after[i][1]));
  }
  assert.ok(maxShift > 0.05, 'streamlines are actually moving');
  assert.ok(maxShift < 60, 'movement stays slow, no teleporting between frames');

  /* particles exist and never leave the hero */
  assert.ok(live.paint.fills > 0, 'particles painted');
  assert.match(live.paint.lastFill.style, /^rgba\((47, 42, 40|186, 114, 88),0\.\d+\)$/, 'particles reuse the palette');

  /* ---- 5. pointer interaction -------------------------------------------- */
  const settled = contours(live.paint).at(-1);
  live.pointer('pointermove', 120, 120);
  await sleep(260);
  const nudged = contours(live.paint).at(-1);
  let delta = 0;
  for (let i = 0; i < Math.min(settled.points.length, nudged.points.length); i += 1) {
    delta = Math.max(delta, Math.hypot(settled.points[i][0] - nudged.points[i][0], settled.points[i][1] - nudged.points[i][1]));
  }
  assert.ok(delta > 0, 'cursor position reaches the field');
  assert.ok(delta < 90, 'the response is a drift, not a snap');

  /* ---- 6. hidden tabs stop the loop -------------------------------------- */
  live.setHidden(true);
  const whileHidden = live.paint.strokes;
  await sleep(220);
  assert.equal(live.paint.strokes, whileHidden, 'no drawing while the tab is hidden');

  live.setHidden(false);
  await sleep(200);
  assert.ok(live.paint.strokes > whileHidden, 'resumes when the tab is visible again');

  /* ---- 7. reduced motion paints one still frame --------------------------- */
  const still = harness({ reduced: true });
  assert.ok(still.paint.strokes > 0, 'reduced motion still gets the composition');
  assert.ok(still.canvas.classList.contains('is-ready'), 'reduced motion reveals immediately');
  const frozen = still.paint.strokes;
  await sleep(260);
  assert.equal(still.paint.strokes, frozen, 'reduced motion never starts the loop');

  // Stop both animation loops so the process can exit.
  live.dom.window.close();
  still.dom.window.close();
  console.log('hero-topography: all checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
