/* Load case-study artwork only as it approaches the viewport. Keeping each
 * slide in its own fragment prevents the browser from parsing every large SVG
 * before the first screen can paint; distant fragments are released again. */
(() => {
  'use strict';

  const frames = Array.from(document.querySelectorAll('[data-slide-src].slide-art'));
  if (!frames.length) return;

  const requests = new WeakMap();
  let printing = false;

  function loadFrame(frame) {
    if (!frame || frame.dataset.loaded === 'true') return Promise.resolve();
    const activeRequest = requests.get(frame);
    if (activeRequest && !activeRequest.controller.signal.aborted) return activeRequest.promise;
    const source = frame.dataset.slideSrc;
    if (!source) return Promise.resolve();

    const controller = new AbortController();
    const request = { controller, promise: null };
    requests.set(frame, request);
    frame.dataset.loading = 'true';
    frame.setAttribute('aria-busy', 'true');

    request.promise = (async () => {
      try {
        const response = await fetch(source, { signal: controller.signal, credentials: 'same-origin' });
        if (!response.ok) throw new Error(`Slide request failed (${response.status})`);
        const markup = await response.text();
        if (controller.signal.aborted || !frame.isConnected) return;

        const template = document.createElement('template');
        template.innerHTML = markup.trim();
        if (!template.content.querySelector('svg')) throw new Error('Slide fragment has no SVG root');
        frame.replaceChildren(template.content);
        frame.dataset.loaded = 'true';
        delete frame.dataset.loadError;
      } catch (error) {
        if (error.name !== 'AbortError') frame.dataset.loadError = 'true';
      } finally {
        if (requests.get(frame) === request) {
          requests.delete(frame);
          delete frame.dataset.loading;
          frame.removeAttribute('aria-busy');
        }
      }
    })();
    return request.promise;
  }

  function releaseFrame(frame) {
    if (printing || !frame) return;
    const request = requests.get(frame);
    if (request) {
      request.controller.abort();
      requests.delete(frame);
      delete frame.dataset.loading;
      frame.removeAttribute('aria-busy');
    }
    if (frame.dataset.loaded === 'true') {
      frame.replaceChildren();
      delete frame.dataset.loaded;
    }
  }

  function frameForHash(hash) {
    if (!hash) return null;
    let id = hash.replace(/^#/, '');
    try { id = decodeURIComponent(id); } catch (_) { /* keep the raw hash */ }
    const target = document.getElementById(id);
    if (!target) return null;
    return target.matches('[data-slide-src].slide-art')
      ? target
      : target.querySelector('[data-slide-src].slide-art');
  }

  // Start requests before in-page navigation scrolls to a distant slide.
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const link = target?.closest('a[href^="#"]');
    if (link) loadFrame(frameForHash(link.getAttribute('href')));
  }, true);
  window.addEventListener('hashchange', () => loadFrame(frameForHash(window.location.hash)));
  if (window.location.hash) loadFrame(frameForHash(window.location.hash));

  // Wait for all artwork before script- or keyboard-initiated printing. Keep a
  // beforeprint fallback for print commands initiated from the browser chrome.
  const nativePrint = typeof window.print === 'function' ? window.print.bind(window) : null;
  if (nativePrint) {
    const printAfterLoading = async () => {
      printing = true;
      await Promise.all(frames.map(loadFrame));
      nativePrint();
    };
    try {
      window.print = printAfterLoading;
      if (window.print === printAfterLoading) {
        document.addEventListener('keydown', (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
            event.preventDefault();
            window.print();
          }
        });
      }
    } catch (_) { /* retain native behavior if the browser locks window.print */ }
  }

  window.addEventListener('beforeprint', () => {
    printing = true;
    frames.forEach(loadFrame);
  });

  if (!('IntersectionObserver' in window)) {
    frames.forEach(loadFrame);
    return;
  }

  const loadObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) loadFrame(entry.target);
    });
  }, { rootMargin: '2400px 0px' });

  const releaseObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) releaseFrame(entry.target);
    });
  }, { rootMargin: '4800px 0px' });

  frames.forEach((frame) => {
    loadObserver.observe(frame);
    releaseObserver.observe(frame);
  });

  window.addEventListener('afterprint', () => {
    printing = false;
    requestAnimationFrame(() => frames.forEach((frame) => {
      releaseObserver.unobserve(frame);
      releaseObserver.observe(frame);
    }));
  });
})();
