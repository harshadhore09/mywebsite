const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require(process.env.JSDOM_PATH || '/tmp/node_modules/jsdom');
const root = path.join(__dirname, '../..');
const script = fs.readFileSync(path.join(root, 'scripts/micro-interactions.js'), 'utf8');
const pages = { 'MBG_index.html': 'mbg', 'StrategicUX_index.html': 'food', 'MedicalAdher_index.html': 'medical' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* The engine only listens to pointer events, so a MouseEvent with any
   type string is enough; pointerType is left undefined, which the engine
   treats as a mouse (it separately refuses to start without hover:hover). */
function harness(page, { reduced = false, fine = true, html } = {}) {
  const dom = new JSDOM(html || fs.readFileSync(path.join(root, page), 'utf8'), {
    url: `https://portfolio.example/${page}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  const media = [];
  w.matchMedia = (query) => ({
    matches: query.includes('reduced-motion') ? reduced : fine,
    addEventListener(type, callback) { media.push({ type, callback }); },
  });
  w.eval(script);
  const pointer = (type, x, y, target) => {
    const event = new w.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
    (target || w).dispatchEvent(event);
    return event;
  };
  return { dom, w, media, pointer };
}

async function frames() {
  // jsdom fires requestAnimationFrame roughly every 16ms; let a few land
  for (let i = 0; i < 4; i++) await sleep(25);
}

async function main() {
  /* ---- 1. page wiring -------------------------------------------------- */
  for (const [page, project] of Object.entries(pages)) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    assert.match(html, new RegExp(`<html lang="en" data-project="${project}">`), `${page}: project marker`);
    assert.match(html, /assets\/micro-interactions\.css/, `${page}: stylesheet`);
    assert.match(html, /<script src="\.\/scripts\/micro-interactions\.js" defer><\/script>/, `${page}: script`);
  }
  const css = fs.readFileSync(path.join(root, 'assets/micro-interactions.css'), 'utf8');
  assert.ok(css.includes('html[data-project] {'), 'shared css tokens');
  assert.ok(css.includes('--mi-accent'), 'shared accent token');
  assert.ok(!/data-project="(mbg|food|medical)"/.test(css), 'no per-project divergence in the css');
  assert.ok(css.includes('#prog::after') && css.includes('.progress-bar::after'), 'gold coin on either progress bar');
  assert.ok(css.includes('.mi-glitter') && css.includes('@keyframes gfall') && css.includes('.gp '), 'shared glitter styles');
  assert.match(css, /prefers-reduced-motion: reduce/, 'css respects reduced motion');
  assert.match(css, /@media print/, 'css respects print');

  /* ---- 2. the cursor exists per project -------------------------------- */
  for (const [page] of Object.entries(pages)) {
    const { dom, w, pointer } = harness(page);
    const layer = w.document.querySelector('.mi-layer');
    assert.ok(layer, `${page}: cursor layer`);
    assert.ok(layer.querySelector('.mi-ring'), `${page}: ring`);
    assert.ok(layer.querySelector('.mi-dot'), `${page}: dot`);
    assert.equal(layer.querySelector('.mi-glyph'), null, `${page}: cursor has no rupee glyph`);
    assert.ok(w.document.querySelector('.mi-glitter'), `${page}: glitter layer`);
    assert.ok(w.document.documentElement.classList.contains('mi-cursor-on'), `${page}: native cursor retired`);
    assert.equal(layer.getAttribute('aria-hidden'), 'true', `${page}: decorative`);
    assert.equal(w.document.querySelector('.mi-glitter').getAttribute('aria-hidden'), 'true', `${page}: glitter decorative`);

    pointer('pointermove', 120, 240);
    await frames();
    assert.match(layer.querySelector('.mi-ring').style.transform, /translate3d\(/, `${page}: ring follows the pointer`);
    assert.match(layer.querySelector('.mi-dot').style.transform, /translate3d\(120/, `${page}: dot tracks exactly`);
    dom.window.close();
  }

  /* ---- 3. hover + press states ----------------------------------------- */
  {
    const { dom, w, pointer } = harness('MBG_index.html');
    const layer = w.document.querySelector('.mi-layer');
    const link = w.document.querySelector('.pnav-links a');
    assert.ok(link, 'a link to hover');
    pointer('pointerover', 10, 10, link);
    assert.ok(layer.classList.contains('is-hover'), 'hover state on a link');
    pointer('pointerover', 10, 10, w.document.body);
    assert.ok(!layer.classList.contains('is-hover'), 'hover state clears off a link');

    pointer('pointerdown', 60, 80);
    assert.ok(layer.classList.contains('is-press'), 'press state');
    pointer('pointerup', 60, 80);
    assert.ok(!layer.classList.contains('is-press'), 'press state clears');
    dom.window.close();
  }

  /* ---- 4. the same click burst on every page (Pragati's coins) --------- */
  const signatures = [];
  for (const [page] of Object.entries(pages)) {
    const { dom, w, pointer } = harness(page);
    pointer('pointerdown', 100, 100);
    const layer = w.document.querySelector('.mi-layer');
    const coins = layer.querySelectorAll('.mi-fx--coin').length;
    const sparkles = layer.querySelectorAll('.mi-fx--sparkle').length;
    assert.equal(coins, 5, `${page}: drops small change`);
    assert.equal(sparkles, 1, `${page}: one bright sparkle`);
    assert.equal(layer.querySelector('.mi-glyph-tx'), null, `${page}: no rupee glyph on click`);
    signatures.push(`${coins}/${sparkles}`);
    dom.window.close();
  }
  assert.equal(new Set(signatures).size, 1, 'every project shares the identical click burst');

  /* ---- 5. the same golden glitter trail on every page ------------------ */
  for (const [page] of Object.entries(pages)) {
    const { dom, w, pointer } = harness(page);
    pointer('pointermove', 40, 40);
    await sleep(80);
    pointer('pointermove', 400, 400);
    await sleep(80);
    const glitter = w.document.querySelectorAll('.mi-glitter .gp');
    assert.ok(glitter.length >= 1, `${page}: golden glitter follows the pointer`);
    assert.ok(glitter[0].innerHTML.includes('<svg'), `${page}: glitter is Pragati's sparkle star`);
    assert.equal(w.document.querySelectorAll('.mi-fx--steam, .mi-fx--dose').length, 0, `${page}: no second trail`);
    dom.window.close();
  }

  /* ---- 6. particles clean themselves up -------------------------------- */
  {
    const { dom, w, pointer } = harness('MBG_index.html');
    const layer = w.document.querySelector('.mi-layer');
    pointer('pointerdown', 100, 100);
    assert.ok(layer.querySelectorAll('.mi-fx').length > 0, 'particles spawned');
    const fx = layer.querySelector('.mi-fx');
    fx.dispatchEvent(new w.Event('animationend', { bubbles: true }));
    await sleep(20);
    assert.ok(!fx.isConnected, 'particle removed after its animation');

    pointer('pointermove', 40, 40);
    await sleep(80);
    pointer('pointermove', 400, 400);
    await sleep(20);
    const gp = w.document.querySelector('.mi-glitter .gp');
    assert.ok(gp, 'glitter spawned');
    gp.dispatchEvent(new w.Event('animationend', { bubbles: true }));
    await sleep(20);
    assert.ok(!gp.isConnected, 'glitter piece removed after its animation');
    dom.window.close();
  }

  /* ---- 7. the glitter is common code, not copied inline ---------------- */
  {
    const mbgHtml = fs.readFileSync(path.join(root, 'MBG_index.html'), 'utf8');
    assert.ok(!mbgHtml.includes('id="glitter"'), 'Pragati no longer ships its own glitter layer');
    assert.ok(!mbgHtml.includes('gfall'), 'the trail lives in the shared engine now');
    assert.ok(script.includes('GLITTER_COL'), 'the shared engine owns the trail');
  }

  /* ---- 8. opt-outs ----------------------------------------------------- */
  {
    const { dom, w } = harness('MBG_index.html', { reduced: true });
    assert.equal(w.document.querySelector('.mi-layer'), null, 'reduced motion: no cursor');
    assert.equal(w.document.querySelector('.mi-glitter'), null, 'reduced motion: no glitter');
    assert.ok(!w.document.documentElement.classList.contains('mi-cursor-on'), 'reduced motion: native cursor kept');
    dom.window.close();
  }
  {
    const { dom, w } = harness('MBG_index.html', { fine: false });
    assert.equal(w.document.querySelector('.mi-layer'), null, 'coarse pointer: no cursor');
    assert.equal(w.document.querySelector('.mi-glitter'), null, 'coarse pointer: no glitter');
    dom.window.close();
  }
  {
    const { dom, w } = harness('index.html', { html: '<html lang="en"><body><a href="MBG_index.html">x</a></body></html>' });
    assert.equal(w.document.querySelector('.mi-layer'), null, 'non-project page: nothing to do');
    dom.window.close();
  }

  /* ---- 9. a motion preference turned on later retires the flourish ------ */
  {
    const { dom, w, media } = harness('StrategicUX_index.html');
    assert.ok(w.document.querySelector('.mi-layer'), 'cursor active before the change');
    assert.ok(w.document.querySelector('.mi-glitter'), 'glitter active before the change');
    const change = media.find((m) => m.type === 'change');
    assert.ok(change, 'listens for motion changes');
    change.callback({ matches: true });
    assert.equal(w.document.querySelector('.mi-layer'), null, 'cursor removed when motion is reduced');
    assert.equal(w.document.querySelector('.mi-glitter'), null, 'glitter removed with it');
    assert.ok(!w.document.documentElement.classList.contains('mi-cursor-on'), 'native cursor restored');
    dom.window.close();
  }
}

main().then(() => {
  console.log('Micro-interaction tests passed (wiring, one shared personality on all three pages, hover/press, coin bursts, glitter trail, cleanup, opt-outs, live reduced-motion).');
}, (error) => {
  console.error(error);
  process.exit(1);
});
