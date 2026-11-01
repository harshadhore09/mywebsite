const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require(process.env.JSDOM_PATH || '/tmp/node_modules/jsdom');

const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const token = (name) => {
  const value = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  assert.ok(value, `missing ${name} colour token`);
  return value[1].toUpperCase();
};

// WCAG contrast for the small-text combinations used by buttons and chips.
function contrast(a, b) {
  const luminance = (hex) => {
    const rgb = hex.match(/[\da-f]{2}/gi).map((x) => parseInt(x, 16) / 255)
      .map((x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const [dark, light] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (light + 0.05) / (dark + 0.05);
}

const colours = {
  cream: token('cream'), blue: token('earth-blue'), olive: token('earth-olive'),
  stone: token('earth-stone'), taupe: token('earth-taupe'),
  brown: token('earth-brown'), oliveInk: token('olive-ink'),
};
assert.deepEqual(colours, {
  cream: '#F5EEDD', blue: '#94A5B3', olive: '#71713B', stone: '#E2DCD0',
  taupe: '#8F7D6B', brown: '#3C1E06', oliveInk: '#5F5F30',
});
for (const [foreground, background] of [
  ['#FFFFFF', colours.olive], [colours.brown, colours.blue],
  [colours.brown, colours.stone], [colours.oliveInk, colours.cream],
]) assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background} meets 4.5:1`);
assert.ok(contrast(colours.taupe, colours.cream) >= 3, 'large taupe heading meets 3:1');

// jsdom cannot resolve CSS custom properties, so check the relevant selector
// wiring here and exercise the actual toolkit state changes independently.
assert.match(css, /\.tk-chip\[data-cat="behaviour"\]\.pinned\.weak-hit\s*\{\s*color:\s*var\(--earth-brown\)/);
assert.match(css, /\.tk-cat\[data-cat="behaviour"\]\s*\{\s*background:\s*var\(--b\);\s*color:\s*var\(--earth-brown\)/);
assert.match(css, /\.tk-chip\.pinned mark\s*\{\s*background:\s*var\(--earth-stone\);\s*color:\s*var\(--earth-brown\)/);

const dom = new JSDOM(html, {
  url: 'https://portfolio.example/', runScripts: 'outside-only', pretendToBeVisual: true,
});
const w = dom.window;
w.matchMedia = () => ({ matches: true }); // reduced motion skips decorative bursts
w.IntersectionObserver = class { observe() {} disconnect() {} };
const start = html.indexOf('    function initToolkit() {');
const end = html.indexOf('    // Start as soon as the markup is ready', start);
assert.ok(start !== -1 && end !== -1, 'toolkit initializer exists');
w.eval(html.slice(start, end) + '\ninitToolkit();');

const doc = w.document;
const cat = doc.getElementById('tkCat');
const chips = [...doc.querySelectorAll('.tk-chip')];
for (const category of ['behaviour', 'craft', 'tools']) {
  const chip = chips.find((item) => item.dataset.cat === category);
  chip.click();
  assert.equal(cat.dataset.cat, category, `${category} sets the detail badge category`);
  assert.ok(chip.classList.contains('pinned'), `${category} chip is pinned`);
  assert.equal(doc.getElementById('tkName').textContent, chip.dataset.label);
}
const behaviour = chips.find((item) => item.dataset.label === 'ACTT');
behaviour.click();
const search = doc.getElementById('tkSearch');
function searchNow(text) {
  search.value = text;
  search.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}
searchNow('ACTT');
assert.ok(behaviour.classList.contains('pinned') && behaviour.querySelector('mark'), 'pinned name match remains highlighted');
searchNow('structured');
assert.ok(behaviour.classList.contains('pinned') && behaviour.classList.contains('weak-hit'), 'pinned description-only result stays selected');
searchNow('');
doc.querySelector('.tk-filter[data-cat="craft"]').click();
assert.equal(behaviour.getAttribute('aria-hidden'), 'true', 'category filter hides other categories');
assert.equal(chips.find((item) => item.dataset.cat === 'craft').getAttribute('aria-hidden'), 'false');
w.close();
console.log('Homepage palette tests passed (reference colours, contrast, toolkit pinning, highlights and filtering).');
