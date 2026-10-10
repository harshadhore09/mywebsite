#!/usr/bin/env python3
"""Inject the shared slide rail into the three case-study pages."""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
RAIL_JS = io.open(os.path.join(HERE, 'slide-rail.js'), encoding='utf-8').read()

MBG_CSS = """
/* ===== slide rail: keep the active pill scrolled into view ===== */
.toc .wrap{scrollbar-width:none;-ms-overflow-style:none;scroll-behavior:smooth;overscroll-behavior-x:contain}
.toc .wrap::-webkit-scrollbar{display:none}
.toc a{flex:none}
.toc a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.slide-sec{scroll-margin-top:calc(var(--nav-h) + 46px + 14px)}
@media (max-width:760px){.toc .wrap{padding:0 12px;gap:5px}.toc a{padding:6px 10px;font-size:11.5px}}
@media print{.toc{display:none}}
"""

MED_CSS = """
  /* header CTA stays on one line */
  .pnav-links > a.pnav-cta { white-space:nowrap; flex:none; }
  /* ================= SLIDE RAIL (scroll-driven slide strip) ================= */
  :root { --sld-rail-h:46px; }
  .sld-rail {
    position:sticky; top:var(--pnav-h); z-index:29; height:var(--sld-rail-h);
    display:flex; align-items:center;
    background:rgba(239,255,221,.93);
    backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
    border-bottom:1px solid var(--pn-line);
  }
  .sld-rail-in {
    display:flex; align-items:center; gap:6px; width:100%; height:100%;
    padding:0 clamp(14px, 3vw, 40px);
    overflow-x:auto; overflow-y:hidden;
    scrollbar-width:none; -ms-overflow-style:none;
    overscroll-behavior-x:contain; scroll-behavior:smooth;
  }
  .sld-rail-in::-webkit-scrollbar { display:none; }
  .sld-rail a {
    flex:none; display:inline-flex; align-items:center; gap:6px;
    padding:7px 13px; border:1px solid var(--pn-line); border-radius:999px;
    background:#fff; color:rgba(27,57,20,.62); text-decoration:none; white-space:nowrap;
    font:600 12px/1 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    transition:background .2s ease, color .2s ease, border-color .2s ease;
  }
  .sld-rail a b { font-weight:800; color:var(--pn-ink); }
  .sld-rail a:hover, .sld-rail a:focus-visible { color:var(--pn-ink); border-color:var(--pn-ink); }
  .sld-rail a.is-active, .sld-rail a.active { background:var(--pn-ink); border-color:var(--pn-ink); color:rgba(239,255,221,.85); }
  .sld-rail a.is-active b, .sld-rail a.active b { color:var(--pn-lime); }
  .sld-rail a:focus-visible { outline:2px solid var(--pn-green); outline-offset:2px; }
  .slide { scroll-margin-top:calc(var(--pnav-h) + var(--sld-rail-h) + 8px); }
  @media (max-width:1024px) {
    /* the rail shares the screen with the full-height deck viewer */
    .deck { height:calc(100vh - var(--pnav-h) - var(--sld-rail-h)); height:calc(100svh - var(--pnav-h) - var(--sld-rail-h)); }
    .slide { height:calc(100vh - var(--pnav-h) - var(--sld-rail-h)); height:calc(100svh - var(--pnav-h) - var(--sld-rail-h));
             contain-intrinsic-size:auto calc(100vh - var(--pnav-h) - var(--sld-rail-h)); scroll-margin-top:0; }
  }
  @media (max-width:760px) {
    .sld-rail-in { padding:0 12px; gap:5px; }
    .sld-rail a { padding:6px 10px; font-size:11.5px; }
  }
  @media print { .sld-rail { display:none; } }
"""

SUX_CSS = """
    /* header CTA stays on one line */
    .pnav-links > a.pnav-cta { white-space: nowrap; flex: none; }
    /* ===== slide rail (scroll-driven slide strip) ===== */
    :root { --sld-rail-h: 46px; }
    .sld-rail {
      position: sticky; top: 75px; z-index: 13; height: var(--sld-rail-h);
      display: flex; align-items: center;
      background: rgba(244, 240, 233, .94);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--line);
    }
    .sld-rail-in {
      display: flex; align-items: center; gap: 6px; width: 100%; height: 100%;
      padding: 0 clamp(12px, 3.5vw, 54px);
      overflow-x: auto; overflow-y: hidden;
      scrollbar-width: none; -ms-overflow-style: none;
      overscroll-behavior-x: contain; scroll-behavior: smooth;
    }
    .sld-rail-in::-webkit-scrollbar { display: none; }
    .sld-rail a {
      flex: none; display: inline-flex; align-items: center; gap: 6px;
      min-height: 0; padding: 7px 13px;
      border: 1px solid var(--line); border-radius: 999px;
      background: var(--paper-strong); color: var(--muted); text-decoration: none;
      font-size: .75rem; font-weight: 700; white-space: nowrap;
      transition: color .2s ease, background .2s ease, border-color .2s ease;
    }
    .sld-rail a b { font-weight: 800; color: var(--ink); }
    .sld-rail a:hover, .sld-rail a:focus-visible { color: var(--ink); border-color: var(--accent); }
    .sld-rail a.is-active, .sld-rail a.active { background: var(--accent); border-color: var(--accent); color: rgba(248, 246, 241, .9); }
    .sld-rail a.is-active b, .sld-rail a.active b { color: #fff; }
    .slide { scroll-margin-top: calc(72px + var(--sld-rail-h) + 14px); }
    @media (max-width: 680px) {
      .sld-rail { top: 69px; }   /* header is 69px tall on phones */
      .sld-rail-in { padding: 0 14px; gap: 5px; }
      .sld-rail a span { display: none; }
      .slide { scroll-margin-top: calc(62px + var(--sld-rail-h) + 12px); }
    }
    @media print { .sld-rail { display: none; } }
"""

# ---- old active-slide observers, replaced by the shared rail -------------
MBG_OLD = """const secs=[...document.querySelectorAll('.slide-sec')];const links=[...document.querySelectorAll('.toc a')];
const tio=new IntersectionObserver(es=>{es.forEach(en=>{if(en.isIntersecting){const id=en.target.id;links.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+id))}})},{threshold:.5});
secs.forEach(s=>tio.observe(s));"""
MBG_NEW = "/* active-slide tracking now lives in the shared slide rail script below */"

# ---- header "current page" pill + its script: superseded by the rail ----
# Medical Adherence and Food Delivery had a single pill that showed the
# current page name; the rail lists every page by name instead, as MBG does.
INDICATOR_EL = re.compile(r'<div class="(?:pnav-screen|screen-indicator)" data-current-screen[^>]*>.*?</div>', re.S)
INDICATOR_JS = re.compile(r'<script>\s*/\* Update the compact page indicator.*?</script>\n?', re.S)

JOBS = [
    ('MBG_index.html',         MBG_CSS, MBG_OLD, MBG_NEW),
    ('MedicalAdher_index.html', MED_CSS, None, None),
    ('StrategicUX_index.html',  SUX_CSS, None, None),
]

# `--sync`: replace the rail script already inlined in each page with the
# current slide-rail.js (after editing the canonical file)
if '--sync' in sys.argv:
    OPEN, CLOSE = '<script>\n', '\n</script>\n</body>'
    for fname, _css, _old, _new in JOBS:
        path = os.path.join(ROOT, fname)
        with io.open(path, encoding='utf-8') as fh:
            doc = fh.read()
        end = doc.find(CLOSE)
        start = doc.rfind(OPEN, 0, end)
        if end < 0 or start < 0 or 'Slide rail' not in doc[start:end]:
            sys.exit('%s: no inlined slide rail found to sync' % fname)
        doc = doc[:start] + OPEN + RAIL_JS + CLOSE + doc[end + len(CLOSE):]
        with io.open(path, 'w', encoding='utf-8') as fh:
            fh.write(doc)
        print('%-26s synced' % fname)
    sys.exit(0)

for fname, css, old, new in JOBS:
    path = os.path.join(ROOT, fname)
    with io.open(path, encoding='utf-8') as fh:
        doc = fh.read()

    if 'slide-rail:change' in doc:
        print('%-26s SKIP (already injected)' % fname)
        continue
    before = len(doc)

    # 1. the old observer (MBG) is replaced by the rail's event
    if old is not None:
        if doc.count(old) != 1:
            sys.exit('%s: expected exactly 1 occurrence of the old observer, found %d' % (fname, doc.count(old)))
        doc = doc.replace(old, new)

    # 2. retire the header's single "current page" pill and its script
    if old is None:
        doc, n_el = INDICATOR_EL.subn('', doc, count=1)
        doc, n_js = INDICATOR_JS.subn('', doc, count=1)
        if n_el != 1 or n_js != 1:
            sys.exit('%s: indicator not found as expected (element %d, script %d)' % (fname, n_el, n_js))

    # 3. CSS at the end of the existing stylesheet so it wins the cascade
    if doc.count('</style>') != 1:
        sys.exit('%s: expected exactly 1 </style>, found %d' % (fname, doc.count('</style>')))
    doc = doc.replace('</style>', css + '</style>')

    # 4. the rail script, last so every page's own listeners are wired first
    if doc.count('</body>') != 1:
        sys.exit('%s: expected exactly 1 </body>, found %d' % (fname, doc.count('</body>')))
    block = '<script>\n' + RAIL_JS + '\n</script>\n</body>'
    doc = doc.replace('</body>', block)

    with io.open(path, 'w', encoding='utf-8') as fh:
        fh.write(doc)
    print('%-26s injected  (%+d bytes)' % (fname, len(doc) - before))
