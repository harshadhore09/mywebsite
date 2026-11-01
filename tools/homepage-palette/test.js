const assert = require('node:assert/strict');
const crypto = require('node:crypto');
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

// WCAG contrast for text on the restored cream and category fills.
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
  cream: token('cream'), grid: token('grid'), text: token('text'), muted: token('muted'),
  pink: token('pink'), warm: token('warm'), accent: token('accent'),
  behaviour: token('b'), craft: token('c'), tools: token('t'), toolkitInk: token('tk-ink'),
};
assert.deepEqual(colours, {
  cream: '#F8F5EF', grid: '#E8E4D9', text: '#2B2228', muted: '#665C5C',
  pink: '#E8A9C3', warm: '#D9B68C', accent: '#C17A5F',
  behaviour: '#9B7CC4', craft: '#C17A5F', tools: '#4C8C6B', toolkitInk: '#231014',
});
for (const [foreground, background] of [
  [colours.text, colours.cream], [colours.muted, colours.cream],
  [colours.toolkitInk, colours.behaviour], [colours.toolkitInk, colours.craft],
  [colours.toolkitInk, colours.tools], [colours.toolkitInk, '#F9E8C3'],
  ['#7A6F6A', '#FFFDF7'],
]) assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background} meets 4.5:1`);

// jsdom cannot resolve CSS custom properties: check the visual wiring here,
// then exercise the real toolkit state changes below.
assert.match(css, /\.top-nav\s*\{\s*background:\s*#F9E8C3;\s*border-color:\s*#F0D9A3/i);
assert.match(css, /\.hero-name\s*\{[^}]*color:\s*#9B2D2D/i);
assert.match(css, /\.hero-tags \.chip\s*\{[^}]*background:\s*#F9E8C3;\s*color:\s*#3F2A1F/i);
assert.match(css, /\.orb-1\s*\{\s*background:\s*#D9B68C/i);
assert.match(css, /\.orb-2\s*\{\s*background:\s*#E8A9C3/i);
assert.match(css, /\.orb-3\s*\{\s*background:\s*#C8B8E0/i);
assert.ok(html.includes("color: ['#D9B68C', '#E8A9C3', '#C8B8E0']"), 'canvas particles use original colours');
assert.match(css, /\.tk-chip\.pinned\s*\{[^}]*color:\s*var\(--tk-ink\)/);
assert.match(css, /\.tk-chip\.pinned\.weak-hit\s*\{\s*color:\s*var\(--tk-ink\)/);
assert.match(css, /\.tk-chip\.pinned mark\s*\{\s*background:\s*#F9E8C3;\s*color:\s*var\(--tk-ink\)/i);
for (const [category, colour] of [['behaviour', 'b'], ['craft', 'c'], ['tools', 't']]) {
  assert.match(css, new RegExp(`\\.tk-cat\\[data-cat="${category}"\\]\\s*\\{\\s*background:\\s*var\\(--${colour}\\)`));
}
for (const oldToken of ['--oatmeal', '--blue-fantastic', '--burning-flame', '--truffle', '--abyssal']) {
  assert.ok(!html.includes(oldToken), `${oldToken} from the superseded palette is gone`);
}
const illustration = html.slice(html.indexOf('<!-- Left: Illustration'), html.indexOf('<!-- Right: Text content'));
assert.equal(crypto.createHash('sha256').update(illustration).digest('hex'),
  '37e95f2a9d96ec2e5326b46263c52c2e8ee03c3eb2ecb6a47c5afba1ed02634b',
  'the original character illustration is unchanged');

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
const badges = [...doc.querySelectorAll('.work-card .absolute span')];
assert.equal(badges.length, 3, 'all three original project badges remain');
for (const badge of badges) {
  assert.ok(badge.classList.contains('bg-white/95') && badge.classList.contains('text-[#2B2228]'),
    'project badges use the original white and dark ink');
}
assert.ok(doc.getElementById('toolkit').classList.contains('bg-[#F4F0E7]'), 'original toolkit background');
const cat = doc.getElementById('tkCat');
const chips = [...doc.querySelectorAll('.tk-chip')];
assert.equal(chips.length, 20, 'all toolkit items remain');
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
console.log('Homepage palette tests passed (original colours, contrast, toolkit pinning, highlights and filtering).');
