/* Test suite for the shared slide rail. Run: node _test.js */
const { loadPage, PAGES } = require('./harness.js');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('   \u2713 ' + msg); } else { fail++; console.log('   \u2717 FAIL: ' + msg); } };
const section = (s) => console.log('\n' + s);

for (const file of Object.keys(PAGES)) {
  const cfg = PAGES[file];
  let h;
  try { h = loadPage(file, cfg); } catch (e) { fail++; console.log('\n' + file + ' \u2717 load failed: ' + e.message); continue; }

  console.log('\n================ ' + file + ' ================');
  const n = h.slides.length;
  console.log('  ' + n + ' slides, strip ' + cfg.stripW + 'px wide, rail content ' + h.contentW + 'px');

  section('  rail construction');
  ok(h.pills.length === n, n + ' pills, one per slide (found ' + h.pills.length + ')');
  const hrefs = h.pills.map((a) => a.getAttribute('href'));
  const want = h.slides.map((s) => '#' + s.id);
  ok(hrefs.join(',') === want.join(','), 'every pill href matches its slide id in order');
  ok(h.pills.every((a) => ((a.getAttribute('aria-label') || a.textContent || '').trim().length > 1)),
     'every pill has an accessible name');
  ok(h.errors.length === 0, 'no script errors on load' + (h.errors.length ? ' -> ' + h.errors[0] : ''));
  if (file === 'MBG_index.html') {
    ok(!h.doc.querySelector('.sld-rail'), 'reuses the authored .toc strip instead of building a new one');
  } else {
    const rail = h.doc.querySelector('.sld-rail');
    ok(!!rail, 'builds a .sld-rail strip');
    ok(rail && rail.getAttribute('aria-label') === 'Slide navigation', 'rail is labelled for screen readers');
    const hdr = h.doc.querySelector('[data-pnav]');
    const FOLLOWING = 4; // Node.DOCUMENT_POSITION_FOLLOWING
    ok(rail && hdr && (hdr.compareDocumentPosition(rail) & FOLLOWING) === FOLLOWING,
       'rail is inserted in the DOM after the header');
    ok(rail && h.strip.parentNode === rail, 'rail contains the scrollable strip');
  }

  section('  active slide follows the scroll (sweep 0 -> bottom)');
  h.scrollTo(0);
  let prev = -1, monotonic = true, badAt = null, invisibleAt = null, alwaysOne = true;
  const seen = new Set();
  const step = Math.max(1, Math.floor(h.window.__test.maxScroll / 4000));
  for (let y = 0; y <= h.window.__test.maxScroll; y += step) {
    h.scrollTo(y);
    const a = h.activeIndex();
    if (h.activeCount() !== 1) { alwaysOne = false; }
    if (a < prev) { monotonic = false; if (badAt === null) badAt = y; }
    prev = a;
    seen.add(a);
    if (!h.pillVisible(a) && invisibleAt === null) invisibleAt = y;
  }
  h.scrollTo(h.window.__test.maxScroll);
  ok(alwaysOne, 'exactly one pill is active at every scroll position');
  ok(monotonic, 'active index never moves backwards while scrolling down');
  ok(h.activeIndex() === n - 1, 'reaches the last slide (' + n + ') at the bottom -- got ' + (h.activeIndex() + 1));
  ok(seen.size === n, 'every one of the ' + n + ' slides becomes active during the sweep (hit ' + seen.size + ')');
  ok(invisibleAt === null, 'active pill is inside the visible strip at every position' + (invisibleAt !== null ? ' (hidden at y=' + invisibleAt + ')' : ''));
  ok(h.strip.scrollLeft > 0, 'strip scrolls horizontally to follow the pill (scrollLeft=' + Math.round(h.strip.scrollLeft) + ')');

  section('  landing on each slide selects that slide');
  let mismatches = [];
  for (let i = 0; i < n; i++) {
    h.scrollTo(h.window.__test.offsets[i] - cfg.headerH - cfg.railH);
    if (h.activeIndex() !== i) mismatches.push((i + 1) + '->' + (h.activeIndex() + 1));
  }
  ok(mismatches.length === 0, 'all ' + n + ' slides report themselves when scrolled to the top' + (mismatches.length ? ' mismatches: ' + mismatches.join(' ') : ''));

  section('  tall slides (the ones that broke the 50% threshold rule)');
  const hs = h.window.__test.heights;
  const tallest = hs.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 3);
  for (const [ht, i] of tallest) {
    h.scrollTo(h.window.__test.offsets[i] - cfg.headerH - cfg.railH);
    ok(h.activeIndex() === i, 'slide ' + (i + 1) + ' (' + ht + 'px tall, ' + (ht / cfg.vh).toFixed(1) + 'x the ' + cfg.vh + 'px viewport) still registers');
  }

  section('  jumping via the rail');
  h.scrollTo(0);
  const target = h.pills[Math.min(n - 1, 11)];
  const ev = new h.window.MouseEvent('click', { bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  ok(h.activeIndex() === h.pills.indexOf(target), 'clicking a pill activates it immediately');
  ok(h.window.__test.scrollY > 0, 'clicking a pill scrolls the page (scrollY=' + Math.round(h.window.__test.scrollY) + ')');
  ok(h.window.location.hash === '#' + h.slides[h.pills.indexOf(target)].id, 'URL hash updates to ' + h.window.location.hash);

  section('  page-specific controls stay in sync');
  if (file === 'MedicalAdher_index.html') {
    h.scrollTo(h.window.__test.offsets[6] - cfg.headerH - cfg.railH);
    ok(h.pills[6].getAttribute('aria-current') === 'true', 'the shared rail marks slide 07 as current');
    ok(h.doc.querySelectorAll('.pnav-dd-menu .pnav-proj').length === 3, 'project menu keeps all three case-study links');
  }
  if (file === 'StrategicUX_index.html') {
    section('  food-delivery labels match the testing and high-fidelity artwork');
    const sections = [
      [13, 'UX Guidelines', '13.html', 'six principles'],
      [14, 'ROI Calculation', '14.html', 'ROI calculation'],
      [15, 'Ideation', '15.html', 'Ideation sketches'],
      [24, 'Prototype testing insights: Participant 1', '24.html', 'participant one'],
      [25, 'Testing: Participant 2', '25.html', 'participant two'],
      [26, 'Testing: Participant 3', '26.html', 'participant three'],
      [27, 'Testing: Participant 4', '27.html', 'participant four'],
      [28, 'Hi-Fidelity: On-time order', '28.html', 'when order is on time'],
      [31, 'Hi-Fidelity: Delayed order', '31.html', 'when order gets delayed'],
    ];
    for (const [number, title, source, description] of sections) {
      const i = number - 1;
      const pill = h.pills[i];
      const slide = h.slides[i];
      ok(pill.querySelector('b').textContent === String(number) &&
         pill.querySelector('span').textContent === title,
         'rail section ' + number + ' is labelled "' + title + '"');
      ok(slide.querySelector('[data-slide-src]').dataset.slideSrc === 'slides/strategic-ux/' + source &&
         slide.querySelector('[aria-label]').getAttribute('aria-label').includes(description),
         'section ' + number + ' describes the correct artwork');
      pill.dispatchEvent(new h.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      ok(h.activeIndex() === i && h.window.location.hash === '#' + slide.id,
         'clicking section ' + number + ' selects its matching slide');
    }
    h.scrollTo(h.window.__test.offsets[12] - cfg.headerH - cfg.railH);
    ok(h.pills[12].getAttribute('aria-current') === 'true', 'the shared rail marks slide 13 as current');
    ok(h.pills[13].getAttribute('aria-label') === 'Go to slide 14: ROI Calculation',
       'the ROI slide sits directly before Ideation and is individually labelled');
    ok(h.doc.querySelectorAll('.pnav-dd-menu .pnav-proj').length === 3, 'project menu keeps all three case-study links');
  }

  h.window.close();
}

console.log('\n================ RESULT ================');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
