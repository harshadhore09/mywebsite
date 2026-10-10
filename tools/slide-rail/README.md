# Slide rail — verification tooling

The three case studies (`MBG_index.html`, `MedicalAdher_index.html`,
`StrategicUX_index.html`) each carry a copy of the same scroll-driven slide
indicator. These files keep the three copies in step and prove they behave.

| file | what it is |
| --- | --- |
| `slide-rail.js` | the canonical snippet. It is inlined into each HTML file — edit here, then re-run `inject.py`. |
| `inject.py` | appends the CSS + script to the three pages (idempotent). `--sync` re-copies the current `slide-rail.js` into pages that already have it. |
| `harness.js` | loads a page's **own** inline script in jsdom and drives it through a synthetic scroll. |
| `test.js` | the assertions. `node tools/slide-rail/test.js` |
| `before-after.js` | runs the pre-change script (from git) against the new one. `node tools/slide-rail/before-after.js MBG_index.html` |

```
npm i --prefix /tmp jsdom            # only dependency
node tools/slide-rail/test.js        # 68 assertions
JSDOM_PATH=./node_modules/jsdom node tools/slide-rail/test.js   # if jsdom is elsewhere
```

The rail assertions pass for MBG and Medical Adherence. The suite then checks a
`.pnav-count` control that the current Medical Adherence header no longer has
(its page indicator was replaced by this rail), so it stops there with a
TypeError. That check is stale, not a rail failure.

## What the harness does and does not simulate

jsdom has no layout engine, so slide geometry is supplied instead. Heights are
read from each slide's own `<svg viewBox>` in the parsed DOM and scaled to the
modelled viewport — there is no fixture file to go stale. Pill widths use an
approximate 0.55em-per-glyph metric.

Everything under test is the shipped code: slide discovery, rail construction,
the active-slide calculation, the pill-reveal arithmetic, and the
`slide-rail:change` sync into each page's own controls. Two browser APIs jsdom
lacks are shimmed in `harness.js`: `IntersectionObserver` (a no-op for the
decorative reveal animation, plus a spec-faithful version — percentage
`rootMargin` resolution and zero-area-root intersection — used to drive the
*old* observers in `before-after.js`) and `matchMedia`.

So: treat the geometry-dependent numbers as model results, not browser
measurements. Confirm the feel in a real browser before shipping.
