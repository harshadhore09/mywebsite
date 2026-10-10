/* Verification harness.
 *
 * Runs each case-study page's OWN inline <script> in jsdom and drives it
 * through a synthetic scroll. jsdom has no layout engine, so slide geometry
 * is supplied from the real SVG viewBox aspect ratios read out of each file
 * (see /tmp/heights.json). Everything under test -- slide discovery, rail
 * construction, active-slide maths, pill reveal, cross-control sync -- is the
 * shipped code, not a reimplementation.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');           // the site checkout
const JSDOM = process.env.JSDOM_PATH || '/tmp/node_modules/jsdom';
const { JSDOM: JSDOMCtor, VirtualConsole } = require(JSDOM);

const PAGES = {
  'MBG_index.html': {
    vw: 1440, vh: 900, artWidth: 1920,     // .slide-wrap { max-width:1920px }
    headerH: 66, railH: 59, stripW: 1120 - 56,
    slideSel: '.slide-sec', pillSel: '.toc a', railIn: '.toc .wrap',
  },
  'MedicalAdher_index.html': {
    vw: 1440, vh: 900, artWidth: 1920,
    headerH: 64, railH: 46, stripW: 1440 - 80,
    slideSel: '.deck > .slide', pillSel: '.sld-rail a', railIn: '.sld-rail-in',
  },
  'StrategicUX_index.html': {
    vw: 1440, vh: 900, artWidth: 1920,
    headerH: 75, railH: 46, stripW: 1440 - 108,
    slideSel: 'figure.slide[data-slide]', pillSel: '.sld-rail a', railIn: '.sld-rail-in',
  },
};

/* jsdom ships no IntersectionObserver. 'noop' stands in for the decorative
 * reveal animation; 'faithful' implements enough of the spec (root margins,
 * threshold crossings, intersectionRatio relative to the TARGET's area) to
 * run a page's real observer callback -- used for the before/after test. */
function makeIO(window, mode, observers) {
  if (mode !== 'faithful') {
    window.IntersectionObserver = class {
      constructor() { this.observe = () => {}; this.unobserve = () => {}; this.disconnect = () => {}; }
    };
    return;
  }
  // rootMargin percentages resolve against the root's own box, and a positive
  // margin grows the root outwards -- so '-50% 0px -50% 0px' collapses the
  // viewport to a zero-height line down the middle.
  const margins = (s, vh, vw) => {
    const p = String(s || '0px').trim().split(/\s+/);
    const val = (v, vertical) => {
      const n = parseFloat(v) || 0;
      return /%$/.test(v) ? (n * (vertical ? vh : vw)) / 100 : n;
    };
    const [t = '0px', r = t, b = t, l = r] = p;
    return { top: val(t, true), right: val(r, false), bottom: val(b, true), left: val(l, false) };
  };
  window.IntersectionObserver = class {
    constructor(cb, opts) {
      this.cb = cb; this.opts = opts || {}; this.targets = new Set(); this.state = new Map();
      observers.push(this);
    }
    observe(t) { this.targets.add(t); }
    unobserve(t) { this.targets.delete(t); }
    disconnect() { this.targets.clear(); }
    check() {
      const vh = window.innerHeight, vw = window.innerWidth || 1440;
      const m = margins(this.opts.rootMargin, vh, vw);
      const rootTop = 0 - m.top;
      const rootBottom = vh + m.bottom;
      const th = this.opts.threshold == null ? [0]
        : (Array.isArray(this.opts.threshold) ? this.opts.threshold : [this.opts.threshold]);
      const entries = [];
      for (const t of this.targets) {
        const r = t.getBoundingClientRect();
        const overlap = Math.min(r.bottom, rootBottom) - Math.max(r.top, rootTop);
        // a zero-area root (the middle-line technique) still counts as
        // intersecting when the target touches it
        const isIntersecting = r.height > 0 && overlap >= 0;
        const ratio = r.height > 0 ? Math.max(0, overlap) / r.height : 0;
        const prev = this.state.get(t);
        const crossed = prev !== undefined && th.some((x) => (prev.ratio < x) !== (ratio < x));
        const flipped = prev === undefined || prev.isIntersecting !== isIntersecting;
        if (crossed || flipped) {
          entries.push({ target: t, isIntersecting, intersectionRatio: ratio, boundingClientRect: r });
        }
        this.state.set(t, { ratio, isIntersecting });
      }
      if (entries.length) this.cb(entries, this);
    }
  };
}

function loadPage(file, cfg, opts) {
  opts = opts || {};
  const html = fs.readFileSync(opts.src || path.join(ROOT, file), 'utf8');
  const errors = [];
  const observers = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

  const dom = new JSDOMCtor(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    url: 'http://localhost/' + file,
    beforeParse(window) {
      // jsdom has no matchMedia either; MBG's decorative glitter script calls
      // the bare global (it did so before this change too)
      window.matchMedia = (q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      makeIO(window, opts.io || 'noop', observers);
    },
  });
  const { window } = dom;
  const doc = window.document;

  /* ---------------- layout model ---------------- */
  // Geometry comes from the artwork's own viewBox or dimensions kept on its
  // lazy fragment mount -- no separate fixture can drift.
  const slides = Array.prototype.slice.call(doc.querySelectorAll(cfg.slideSel));
  const vbHeight = (el) => {
    const svg = el.querySelector('svg[viewBox]');
    if (svg) {
      const parts = svg.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] && parts[3]) return parts[3] * cfg.artWidth / parts[2];
    }
    const art = el.querySelector('.slide-art[data-slide-src][data-art-width][data-art-height]');
    const width = art ? Number(art.getAttribute('data-art-width')) : 0;
    const height = art ? Number(art.getAttribute('data-art-height')) : 0;
    if (width > 0 && height > 0) return height * cfg.artWidth / width;
    throw new Error(file + ': slide ' + el.id + ' has no usable artwork dimensions');
  };
  const scale = Math.min(cfg.vw, cfg.artWidth) / cfg.artWidth;
  const heights = slides.map((el) => Math.round(vbHeight(el) * scale));
  const offsets = [];
  let acc = cfg.headerH + cfg.railH;          // first slide starts under the sticky bars
  heights.forEach((h) => { offsets.push(acc); acc += h; });
  const docHeight = acc + 400;                 // footer

  let scrollY = 0;
  window.__test = {
    get scrollY() { return scrollY; },
    set scrollY(v) { scrollY = Math.max(0, Math.min(v, docHeight - cfg.vh)); },
    get maxScroll() { return docHeight - cfg.vh; },
    offsets, heights, docHeight, errors, cfg,
  };

  Object.defineProperty(window, 'innerHeight', { value: cfg.vh, configurable: true });
  Object.defineProperty(window, 'innerWidth', { value: cfg.vw, configurable: true });
  Object.defineProperty(window, 'scrollY', { get: () => scrollY, configurable: true });
  Object.defineProperty(doc.documentElement, 'clientHeight', { value: cfg.vh, configurable: true });
  Object.defineProperty(doc.documentElement, 'scrollHeight', { value: docHeight, configurable: true });

  const rect = (top, height, left, width) => ({
    top, bottom: top + height, left, right: left + width,
    width, height, x: left, y: top, toJSON() { return this; },
  });

  slides.forEach((el, i) => {
    el.getBoundingClientRect = () => rect(offsets[i] - scrollY, heights[i], 0, cfg.vw);
  });

  /* sticky bars keep a fixed bottom edge once stuck */
  const header = doc.querySelector('[data-pnav]');
  if (header) header.getBoundingClientRect = () => rect(0, cfg.headerH, 0, cfg.vw);

  const strip = doc.querySelector(cfg.railIn);
  if (!strip) throw new Error(file + ': no strip matching ' + cfg.railIn);

  // pill metrics: 14px side padding, 1px borders, 6px gap, ~0.55em per glyph
  const pillW = (a) => {
    const kids = Array.prototype.filter.call(a.childNodes, (n) => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()));
    const txt = a.textContent;
    return Math.round(28 + 2 + txt.length * 12 * 0.55 + (kids.length > 1 ? 6 : 0));
  };
  const pills = Array.prototype.slice.call(strip.querySelectorAll('a'));
  const widths = pills.map(pillW);
  const pillLeft = [];
  { let x = 0; widths.forEach((w) => { pillLeft.push(x); x += w + 6; }); }
  const contentW = pillLeft.length ? pillLeft[pillLeft.length - 1] + widths[widths.length - 1] : 0;

  strip.scrollLeft = 0;
  Object.defineProperty(strip, 'scrollWidth', { get: () => contentW, configurable: true });
  Object.defineProperty(strip, 'clientWidth', { get: () => cfg.stripW, configurable: true });
  strip.scrollBy = function (o) {
    if (o && typeof o.left === 'number') {
      strip.scrollLeft = Math.max(0, Math.min(strip.scrollLeft + o.left, Math.max(0, contentW - cfg.stripW)));
    }
  };
  strip.getBoundingClientRect = () => rect(cfg.headerH, cfg.railH, 0, cfg.stripW);
  pills.forEach((a, i) => {
    a.getBoundingClientRect = () => rect(cfg.headerH + 7, 30, pillLeft[i] - strip.scrollLeft, widths[i]);
  });

  /* make the async helpers synchronous so the harness can assert immediately */
  window.requestAnimationFrame = (cb) => { cb(0); return 0; };
  window.Element.prototype.scrollIntoView = function () {
    const i = slides.indexOf(this);
    if (i < 0) return;
    window.__test.scrollY = offsets[i] - cfg.headerH - cfg.railH;
  };
  window.scrollTo = function (o) { if (o && typeof o.top === 'number') window.__test.scrollY = o.top; };

  const fire = () => {
    observers.forEach((o) => o.check());            // faithful IO only
    window.dispatchEvent(new window.Event('scroll'));
  };

  return {
    dom, window, doc, strip, pills, slides, cfg,
    errors, observers,
    widths, contentW,
    fire,
    scrollTo(y) { window.__test.scrollY = y; fire(); },
    activeIndex() { return pills.findIndex((a) => a.classList.contains('is-active') || a.classList.contains('active')); },
    activeCount() { return pills.filter((a) => a.classList.contains('is-active') || a.classList.contains('active')).length; },
    pillVisible(i) {
      const l = pillLeft[i] - strip.scrollLeft, r = l + widths[i];
      return l >= -1 && r <= cfg.stripW + 1;
    },
    pillBox(i) { return { left: pillLeft[i] - strip.scrollLeft, right: pillLeft[i] - strip.scrollLeft + widths[i] }; },
  };
}

module.exports = { loadPage, PAGES };
