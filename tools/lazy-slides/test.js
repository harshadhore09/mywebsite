const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(process.env.JSDOM_PATH || '/tmp/node_modules/jsdom');

const ROOT = path.join(__dirname, '..', '..');
const loader = fs.readFileSync(path.join(ROOT, 'scripts/lazy-slides.js'), 'utf8');
const svgResponse = () => ({
  ok: true,
  status: 200,
  text: async () => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
});

function harness(count, withObserver = true, hash = '') {
  const mounts = Array.from({ length: count }, (_, i) =>
    `<div id="slide-${i + 1}" class="slide-art" data-slide-src="slides/${i + 1}.html"></div>`).join('');
  const dom = new JSDOM(`<!doctype html><body>${mounts}</body>`, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: `http://localhost/MBG_index.html${hash}`,
  });
  const { window } = dom;
  const observers = [];
  const requests = [];
  let printCount = 0;

  if (withObserver) {
    window.IntersectionObserver = class {
      constructor(callback, options) {
        this.callback = callback;
        this.options = options;
        observers.push(this);
      }
      observe() {}
      unobserve() {}
    };
  }

  window.fetch = (url, options) => new Promise((resolve, reject) => {
    const request = { url, signal: options.signal, resolve };
    requests.push(request);
    options.signal.addEventListener('abort', () => {
      reject(new window.DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
  window.print = () => { printCount += 1; };
  window.eval(loader);

  return {
    dom,
    window,
    mounts: Array.from(window.document.querySelectorAll('.slide-art')),
    observers,
    requests,
    printCount: () => printCount,
    resolve(request) { request.resolve(svgResponse()); },
    intersect(observerIndex, target, isIntersecting) {
      observers[observerIndex].callback([{ target, isIntersecting }]);
    },
  };
}

async function waitFor(condition, description) {
  for (let i = 0; i < 100; i += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function testAbortReloadAndRelease() {
  const h = harness(1);
  const frame = h.mounts[0];
  assert.strictEqual(h.observers.length, 2, 'creates separate load and release observers');
  assert.strictEqual(h.observers[0].options.rootMargin, '2400px 0px');
  assert.strictEqual(h.observers[1].options.rootMargin, '4800px 0px');

  h.intersect(0, frame, true);
  await waitFor(() => h.requests.length === 1, 'first slide request');
  h.intersect(1, frame, false);
  assert.strictEqual(h.requests[0].signal.aborted, true, 'aborts a request once the slide is far away');

  // Re-entering immediately after an abort must start a fresh request rather
  // than reusing the promise for the already-aborted fetch.
  h.intersect(0, frame, true);
  await waitFor(() => h.requests.length === 2, 'replacement slide request');
  h.resolve(h.requests[1]);
  await waitFor(() => frame.dataset.loaded === 'true', 'slide injection');
  assert.ok(frame.querySelector('svg'), 'injects SVG markup into the reserved mount');
  assert.strictEqual(frame.querySelector('svg').namespaceURI, 'http://www.w3.org/2000/svg');
  assert.strictEqual(frame.hasAttribute('aria-busy'), false, 'clears the loading state');

  h.intersect(1, frame, false);
  assert.strictEqual(frame.querySelector('svg'), null, 'releases artwork outside the retention range');
  assert.strictEqual(frame.dataset.loaded, undefined);
  h.dom.window.close();
}

async function testPrintWaitsForEverySlide() {
  const h = harness(2);
  const printing = h.window.print();
  await waitFor(() => h.requests.length === 2, 'all print slide requests');
  assert.strictEqual(h.printCount(), 0, 'does not open print before the artwork is ready');

  h.resolve(h.requests[0]);
  await waitFor(() => h.mounts[0].dataset.loaded === 'true', 'first print slide');
  assert.strictEqual(h.printCount(), 0, 'waits for the remaining slide');

  h.resolve(h.requests[1]);
  await printing;
  assert.strictEqual(h.printCount(), 1, 'opens print after all slides are injected');
  assert.ok(h.mounts.every((frame) => frame.querySelector('svg')), 'keeps every slide in the DOM for printing');
  h.dom.window.close();
}

async function testLoadsHashTargetImmediately() {
  const h = harness(2, true, '#slide-2');
  await waitFor(() => h.requests.length === 1, 'initial hash-target request');
  assert.strictEqual(h.requests[0].url, 'slides/2.html', 'requests only the slide named by the URL hash');
  h.resolve(h.requests[0]);
  await waitFor(() => h.mounts[1].dataset.loaded === 'true', 'hash-target injection');
  assert.strictEqual(h.mounts[0].dataset.loaded, undefined, 'leaves unrelated slide artwork unloaded');
  h.dom.window.close();
}

async function testLoadsAllWithoutIntersectionObserver() {
  const h = harness(2, false);
  await waitFor(() => h.requests.length === 2, 'fallback slide requests');
  h.requests.forEach(h.resolve);
  await waitFor(() => h.mounts.every((frame) => frame.dataset.loaded === 'true'), 'fallback slide injection');
  assert.ok(h.mounts.every((frame) => frame.querySelector('svg')), 'loads all artwork in browsers without IntersectionObserver');
  h.dom.window.close();
}

(async () => {
  await testAbortReloadAndRelease();
  await testPrintWaitsForEverySlide();
  await testLoadsHashTargetImmediately();
  await testLoadsAllWithoutIntersectionObserver();
  console.log('4 lazy-slide loader tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
