/* =====================================================================
   Slide rail — scroll-driven slide indicator
   Shared by MBG / Medical Adherence / Food Delivery case studies.

   Why this exists: the old version asked an IntersectionObserver for
   "the slide that is >= 50% visible". A slide that is taller than twice
   the viewport can never reach that, and a fast trackpad flick carries a
   slide straight past the threshold between two callbacks — so the
   indicator skipped slides, fired out of order, and then froze.

   This version computes the current slide from geometry on every scroll
   frame: the slide that owns a reference line just under the sticky bar.
   It is height-agnostic and speed-agnostic, so it cannot get stuck.
   It also keeps the active pill scrolled into view inside the strip.
   ===================================================================== */
(() => {
  'use strict';

  /* ---- 1. find the slides ------------------------------------------ */
  const candidates = ['.slide-sec', '.deck > .slide', 'figure.slide[data-slide]', '.slide[data-slide]'];
  let slides = [];
  for (const sel of candidates) {
    const found = Array.prototype.slice.call(document.querySelectorAll(sel));
    if (found.length > 1) { slides = found; break; }
  }
  if (slides.length < 2) return;

  const pad2 = (n) => String(n).padStart(2, '0');
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = reduced ? 'auto' : 'smooth';

  /* ---- 2. the strip: reuse an authored one, else build it ---------- */
  const info = (el, i) => {
    // Medical Adherence and Food Delivery author the name on the slide itself
    // numbered by position, so a newly inserted slide needs no code change
    if (el.dataset.screenTitle) {
      return { num: pad2(i + 1), name: el.dataset.screenTitle.trim() };
    }
    // MBG stamps "01 — Cover" on the artwork
    const chip = el.querySelector('.slide-num');
    if (chip) {
      const bits = chip.textContent.split('\u2014');
      return { num: (bits[0] || pad2(i + 1)).trim(), name: (bits[1] || '').trim() };
    }
    // Food Delivery labels the frame: "Cover: Food Delivery — Waiting Anxiety"
    const frame = el.querySelector('[aria-label]');
    const raw = frame ? (frame.getAttribute('aria-label') || '') : '';
    const name = raw.indexOf(':') > 0 && raw.indexOf(':') < 26 ? raw.slice(raw.indexOf(':') + 1).trim() : '';
    const n = Number(el.dataset.slide);
    return { num: pad2(Number.isFinite(n) && n > 0 ? n : i + 1), name };
  };

  let strip = document.querySelector('.toc .wrap');
  let links;

  if (strip && strip.querySelectorAll('a').length === slides.length) {
    links = Array.prototype.slice.call(strip.querySelectorAll('a'));
  } else {
    const rail = document.createElement('nav');
    rail.className = 'sld-rail';
    rail.setAttribute('aria-label', 'Slide navigation');
    strip = document.createElement('div');
    strip.className = 'sld-rail-in';
    rail.appendChild(strip);

    slides.forEach((el, i) => {
      const meta = info(el, i);
      const a = document.createElement('a');
      a.href = '#' + el.id;
      a.dataset.target = el.id;
      const b = document.createElement('b');
      b.textContent = meta.num;
      a.appendChild(b);
      if (meta.name) {
        const span = document.createElement('span');
        span.textContent = meta.name;
        a.appendChild(span);
        a.title = meta.num + ' \u2014 ' + meta.name;
        a.setAttribute('aria-label', 'Go to slide ' + meta.num + ': ' + meta.name);
      } else {
        a.setAttribute('aria-label', 'Go to slide ' + meta.num);
      }
      strip.appendChild(a);
    });

    links = Array.prototype.slice.call(strip.children);
    const anchorEl = document.querySelector('.progress-wrap') || document.querySelector('[data-pnav]');
    if (anchorEl && anchorEl.parentNode) anchorEl.insertAdjacentElement('afterend', rail);
    else document.body.insertBefore(rail, document.body.firstChild);
  }

  /* ---- 3. keep the active pill visible inside the strip ------------ */
  function reveal(link) {
    if (!link) return;
    const sr = strip.getBoundingClientRect();
    const lr = link.getBoundingClientRect();
    const pad = 14;
    let dx = 0;
    if (lr.left < sr.left + pad) dx = lr.left - sr.left - pad;
    else if (lr.right > sr.right - pad) dx = lr.right - sr.right + pad;
    if (Math.abs(dx) < 1) return;
    if (typeof strip.scrollBy === 'function') strip.scrollBy({ left: dx, behavior: motion });
    else strip.scrollLeft += dx;
  }

  /* ---- 4. which slide owns the reference line right now? ----------- */
  function currentIndex() {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const sr = strip.getBoundingClientRect();
    if (!sr.height) return 0;                      // layout not ready yet
    // at the very end the last slide can be too short to own the reference
    // line, so once its foot is on screen the last slide is the current one
    if (slides[slides.length - 1].getBoundingClientRect().bottom <= vh + 1) return slides.length - 1;
    const top = Math.min(Math.max(sr.bottom, 0), vh);
    const line = top + (vh - top) * 0.34;          // a third of the way down
    for (let i = 0; i < slides.length; i++) {
      if (slides[i].getBoundingClientRect().bottom > line) return i;
    }
    return slides.length - 1;                      // scrolled past everything
  }

  /* ---- 5. publish the change --------------------------------------- */
  let current = -1;
  function setActive(i, force) {
    if (i < 0) i = 0;
    if (i > slides.length - 1) i = slides.length - 1;
    if (i === current) { if (force) reveal(links[i]); return; }
    current = i;
    const el = slides[i];
    links.forEach((a, k) => {
      const on = k === i;
      a.classList.toggle('is-active', on);
      a.classList.toggle('active', on);        // MBG styles `.toc a.active`
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    reveal(links[i]);
    window.dispatchEvent(new CustomEvent('slide-rail:change', { detail: { index: i, id: el.id, slide: el } }));
  }

  let queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => { queued = false; setActive(currentIndex(), true); });
  }

  // capture: true also catches scrolls from an inner container
  // (the Medical deck becomes its own scroller on phones)
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  /* ---- 6. jumping --------------------------------------------------- */
  strip.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    const i = links.indexOf(a);
    if (i < 0) return;
    e.preventDefault();
    const el = slides[i];
    el.scrollIntoView({ behavior: motion, block: 'start' });
    setActive(i, true);
    if (history.replaceState) history.replaceState(null, '', '#' + el.id);
  });

  strip.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = links.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const n = e.key === 'ArrowRight' ? Math.min(links.length - 1, i + 1) : Math.max(0, i - 1);
    links[n].focus();
    reveal(links[n]);
  });

  /* ---- 7. first paint ---------------------------------------------- */
  function firstPaint() {
    const hashIdx = slides.findIndex((s) => '#' + s.id === window.location.hash);
    setActive(hashIdx >= 0 ? hashIdx : currentIndex(), true);
  }
  // a frame out, so the browser has laid the slides out before we measure
  window.requestAnimationFrame(firstPaint);
  // ...and again once webfonts land, since they can shift the strip
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(firstPaint).catch(() => {});
  window.setTimeout(firstPaint, 400);
})();
