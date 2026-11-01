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
  cream: token('cream'), oatmeal: token('oatmeal'), blue: token('blue-fantastic'),
  flame: token('burning-flame'), truffle: token('truffle'), abyssal: token('abyssal'),
  accentInk: token('accent-ink'), categoryBlue: token('category-blue'),
  categoryOlive: token('category-olive'), categoryStone: token('category-stone'),
  categoryBrown: token('category-brown'), categoryCream: token('category-cream'),
};
assert.deepEqual(colours, {
  cream: '#EEE9DF', oatmeal: '#C9C1B1', blue: '#2C3B4D', flame: '#FFB162',
  truffle: '#A35139', abyssal: '#1B2632', accentInk: '#81412F',
  categoryBlue: '#94A5B3', categoryOlive: '#71713B', categoryStone: '#E2DCD0',
  categoryBrown: '#3C1E06', categoryCream: '#F5EEDD',
});
for (const [foreground, background] of [
  [colours.abyssal, colours.cream], [colours.abyssal, colours.flame],
  [colours.blue, colours.oatmeal], ['#FFFFFF', colours.truffle],
  [colours.accentInk, colours.cream], ['#FFFFFF', colours.categoryOlive],
  [colours.categoryBrown, colours.categoryBlue],
  [colours.categoryBrown, colours.categoryStone],
  [colours.categoryCream, colours.categoryBrown],
]) assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background} meets 4.5:1`);

// jsdom cannot resolve CSS custom properties, so check the relevant selector
// wiring here and exercise the actual toolkit state changes independently.
assert.match(css, /\.tk-chip\[data-cat="behaviour"\]\.pinned\.weak-hit\s*\{\s*color:\s*var\(--category-brown\)/);
assert.match(css, /\.tk-cat\[data-cat="behaviour"\]\s*\{\s*background:\s*var\(--b\);\s*color:\s*var\(--category-brown\)/);
assert.match(css, /\.tk-chip\.pinned mark\s*\{\s*background:\s*var\(--category-stone\);\s*color:\s*var\(--category-brown\)/);
assert.match(css, /\.hero-tags \.chip:nth-child\(1\)\s*\{\s*background:\s*var\(--category-blue\)/);
assert.match(css, /\.work-card:nth-child\(2\) \.work-badge\s*\{\s*background:\s*var\(--category-olive\)/);
assert.match(css, /\.tk\s*\{\s*--b:var\(--category-blue\);\s*--c:var\(--category-brown\);\s*--t:var\(--category-olive\)/);
assert.match(css, /\.skill-grid \.skill\.active\s*\{\s*background:\s*var\(--category-brown\);\s*color:\s*var\(--category-cream\)/);
const illustration = html.slice(html.indexOf('<!-- Left: Illustration'), html.indexOf('<!-- Right: Text content'));
for (const colour of ['#77B247', '#5A833B', '#BEC8FF', '#231F20', '#F5C69E']) {
  assert.ok(illustration.includes(`fill="${colour}"`), `original character colour ${colour} remains`);
}

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
