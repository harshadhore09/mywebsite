const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require(process.env.JSDOM_PATH || '/tmp/node_modules/jsdom');
const root = path.join(__dirname, '../..');
const script = fs.readFileSync(path.join(root, 'scripts/project-transition.js'), 'utf8');
const pages = ['MBG_index.html', 'StrategicUX_index.html', 'MedicalAdher_index.html'];

function harness(page = 'index.html', reduced = false) {
  const dom = new JSDOM(`<body>${pages.map(p => `<a href="${p}">${p}</a>`).join('')}<a href="#top">Same page</a><a href="https://example.com/MBG_index.html">External</a></body>`, {
    url: `https://portfolio.example/subdirectory/${page}`, runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: reduced, addEventListener() {} });
  const tasks = new Map();
  let next = 0;
  w.setTimeout = (callback, delay) => { tasks.set(++next, { callback, delay }); return next; };
  w.clearTimeout = id => tasks.delete(id);
  w.eval(script);
  const click = (selector, options = {}) => {
    const event = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...options });
    w.document.querySelector(selector).dispatchEvent(event);
    return event;
  };
  return { dom, w, tasks, click };
}

for (const page of pages) {
  const { dom, w, tasks } = harness(page);
  assert.ok(w.document.querySelector('.project-transition.is-entering'), `${page}: opening curtain`);
  assert.ok(w.document.querySelector('.project-transition__title').textContent.length > 10);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const reveal = [...tasks.values()].find(t => t.delay <= 700);
  assert.ok(reveal, 'short title beat scheduled');
  reveal.callback();
  assert.ok(w.document.querySelector('.is-revealing'));
  [...tasks.values()].find(t => t.delay === 2400).callback();
  assert.equal(w.document.querySelector('.project-transition'), null);
  assert.ok(!w.document.documentElement.classList.contains('project-transition-active'));
  dom.window.close();
}
for (const page of pages) {
  const { dom, w, tasks, click } = harness();
  assert.equal(w.document.querySelector('.project-transition'), null, 'homepage initially unobstructed');
  assert.ok(click(`a[href="${page}"]`).defaultPrevented);
  assert.ok(w.document.querySelector('.is-visible'));
  assert.equal([...tasks.values()].filter(t => t.delay === 460).length, 1);
  click(`a[href="${page}"]`);
  assert.equal([...tasks.values()].filter(t => t.delay === 460).length, 1, 'no duplicate navigation');
  w.dispatchEvent(new w.PageTransitionEvent('pageshow', { persisted: true }));
  assert.equal(w.document.querySelector('.project-transition'), null, 'back cache cleanup');
  dom.window.close();
}
{
  const { dom, w, click } = harness();
  assert.ok(!click('a', { ctrlKey: true }).defaultPrevented);
  assert.ok(!click('a', { metaKey: true }).defaultPrevented);
  assert.ok(!click('a', { button: 1 }).defaultPrevented);
  assert.ok(!click('a[href="#top"]').defaultPrevented);
  assert.ok(!click('a[href^="https:"]').defaultPrevented);
  w.document.querySelector('a').target = '_blank';
  assert.ok(!click('a').defaultPrevented);
  assert.equal(w.document.querySelector('.project-transition'), null);
  dom.window.close();
}
{
  const { dom, w, click } = harness(pages[0], true);
  assert.equal(w.document.querySelector('.project-transition'), null);
  assert.ok(!click(`a[href="${pages[1]}"]`).defaultPrevented, 'reduced motion keeps native navigation');
  dom.window.close();
}
for (const page of ['index.html', ...pages]) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  assert.match(html, /assets\/project-transition\.css/);
  assert.match(html, /<body[^>]*>\s*<script src="\.\/scripts\/project-transition\.js"><\/script>/);
}
console.log('Project transition tests passed (all three entries and links, reduced motion, modified clicks, back cache, page wiring).');
