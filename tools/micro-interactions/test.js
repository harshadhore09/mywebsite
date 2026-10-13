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
  for (const project of Object.values(pages)) {
    assert.ok(css.includes(`html[data-project="${project}"]`), `css tokens for ${project}`);
  }
  assert.match(css, /prefers-reduced-motion: reduce/, 'css respects reduced motion');
  assert.match(css, /@media print/, 'css respects print');

  /* ---- 2. the cursor exists per project -------------------------------- */
  for (const [page] of Object.entries(pages)) {
    const { dom, w, pointer } = harness(page);
    const layer = w.document.querySelector('.mi-layer');
    assert.ok(layer, `${page}: cursor layer`);
    assert.ok(layer.querySelector('.mi-ring'), `${page}: ring`);
    assert.ok(layer.querySelector('.mi-dot'), `${page}: dot`);
    assert.ok(layer.querySelector('.mi-glyph'), `${page}: glyph`);
    assert.ok(w.document.documentElement.classList.contains('mi-cursor-on'), `${page}: native cursor retired`);
    assert.equal(layer.getAttribute('aria-hidden'), 'true', `${page}: decorative`);

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

  /* ---- 4. themed click bursts ------------------------------------------ */
  {
    const { dom, w, pointer } = harness('MBG_index.html');
    pointer('pointerdown', 100, 100);
    const layer = w.document.querySelector('.mi-layer');
    assert.equal(layer.querySelectorAll('.mi-fx--coin').length, 5, 'savings theme drops coins');
    assert.equal(layer.querySelectorAll('.mi-fx--sparkle').length, 1, 'savings theme sparkle');
    dom.window.close();
  }
  {
    const { dom, w, pointer } = harness('StrategicUX_index.html');
    pointer('pointerdown', 100, 100);
    const layer = w.document.querySelector('.mi-layer');
    assert.ok(layer.querySelectorAll('.mi-fx--ping').length >= 1, 'delivery theme pings');
    assert.match(layer.querySelector('.mi-glyph').innerHTML, /<svg/, 'delivery glyph is artwork');
    dom.window.close();
  }
  {
    const { dom, w, pointer } = harness('MedicalAdher_index.html');
    pointer('pointerdown', 100, 100);
    const layer = w.document.querySelector('.mi-layer');
    assert.ok(layer.querySelectorAll('.mi-fx--beat').length >= 1, 'medical theme heartbeats');
    assert.match(layer.querySelector('.mi-glyph').innerHTML, /<svg/, 'medical glyph is artwork');
    dom.window.close();
  }

  /* ---- 5. themed pointer trails ---------------------------------------- */
  {
    // MBG already sprinkles golden glitter, so its cursor leaves no trail
    const { dom, w, pointer } = harness('MBG_index.html');
    pointer('pointermove', 40, 40);
    await sleep(80);
    pointer('pointermove', 400, 400);
    await sleep(80);
    assert.equal(w.document.querySelectorAll('.mi-fx').length, 0, 'no second trail on top of the glitter');
    dom.window.close();
  }
  {
    const { dom, w, pointer } = harness('StrategicUX_index.html');
    pointer('pointermove', 40, 40);
    await sleep(80);
    pointer('pointermove', 400, 400);
    await sleep(80);
    assert.ok(w.document.querySelectorAll('.mi-fx--steam').length >= 1, 'delivery trail rises as steam');
    dom.window.close();
  }
  {
    const { dom, w, pointer } = harness('MedicalAdher_index.html');
    pointer('pointermove', 40, 40);
    await sleep(80);
    pointer('pointermove', 400, 400);
    await sleep(80);
    assert.ok(w.document.querySelectorAll('.mi-fx--dose').length >= 1, 'medical trail tumbles dose capsules');
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
    dom.window.close();
  }

  /* ---- 7. opt-outs ----------------------------------------------------- */
  {
    const { dom, w } = harness('MBG_index.html', { reduced: true });
    assert.equal(w.document.querySelector('.mi-layer'), null, 'reduced motion: no cursor');
    assert.ok(!w.document.documentElement.classList.contains('mi-cursor-on'), 'reduced motion: native cursor kept');
    dom.window.close();
  }
  {
    const { dom, w } = harness('MBG_index.html', { fine: false });
    assert.equal(w.document.querySelector('.mi-layer'), null, 'coarse pointer: no cursor');
    dom.window.close();
  }
  {
    const { dom, w } = harness('index.html', { html: '<html lang="en"><body><a href="MBG_index.html">x</a></body></html>' });
    assert.equal(w.document.querySelector('.mi-layer'), null, 'non-project page: nothing to do');
    dom.window.close();
  }

  /* ---- 8. a motion preference turned on later retires the flourish ------ */
  {
    const { dom, w, media } = harness('MBG_index.html');
    assert.ok(w.document.querySelector('.mi-layer'), 'cursor active before the change');
    const change = media.find((m) => m.type === 'change');
    assert.ok(change, 'listens for motion changes');
    change.callback({ matches: true });
    assert.equal(w.document.querySelector('.mi-layer'), null, 'cursor removed when motion is reduced');
    assert.ok(!w.document.documentElement.classList.contains('mi-cursor-on'), 'native cursor restored');
    dom.window.close();
  }
}

main().then(() => {
  console.log('Micro-interaction tests passed (wiring, three themes, hover/press, bursts, trails, cleanup, opt-outs, live reduced-motion).');
}, (error) => {
  console.error(error);
  process.exit(1);
});
