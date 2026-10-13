/* Run immediately after <body> so the opening curtain precedes first paint. */
(() => {
  'use strict';
  const projects = {
    'MBG_index.html': { number: '01', title: 'Pragati — Mahila Bachat Gat', category: 'Behavioural Design', accent: '#c17a5f' },
    'StrategicUX_index.html': { number: '02', title: 'Food Delivery: Waiting Anxiety', category: 'Strategic UX', accent: '#2b7a66' },
    'MedicalAdher_index.html': { number: '03', title: 'Medical Adherence', category: 'Design Probe', accent: '#8972a5' },
  };
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  let curtain = null;
  let navigating = false;
  let timers = [];
  const later = (callback, delay) => { timers.push(window.setTimeout(callback, delay)); };

  function reset() {
    timers.forEach(window.clearTimeout);
    timers = [];
    if (curtain) curtain.remove();
    curtain = null;
    navigating = false;
    root.classList.remove('project-transition-active');
  }

  function create(project, entering) {
    if (curtain) curtain.remove();
    curtain = document.createElement('div');
    curtain.className = 'project-transition' + (entering ? ' is-visible is-entering' : '');
    curtain.style.setProperty('--transition-accent', project.accent);
    curtain.setAttribute('role', 'status');
    curtain.setAttribute('aria-live', 'polite');
    const content = document.createElement('div');
    content.className = 'project-transition__content';
    const parts = [
      ['p', 'eyebrow', `Case study / ${project.number}`],
      ['h2', 'title', project.title],
      ['p', 'subtitle', project.category],
      ['div', 'line', ''],
    ];
    parts.forEach(([tag, name, text]) => {
      const element = document.createElement(tag);
      element.className = `project-transition__${name}`;
      element.textContent = text;
      content.appendChild(element);
    });
    curtain.appendChild(content);
    document.body.appendChild(curtain);
    root.classList.add('project-transition-active');
  }

  const current = projects[window.location.pathname.split('/').pop()];
  if (current && !motion.matches) {
    const started = performance.now();
    create(current, true);
    function reveal() {
      // A short title beat, then uncover the parsed project screen.
      later(() => {
        if (!curtain) return;
        curtain.classList.remove('is-entering');
        curtain.classList.add('is-revealing');
        later(reset, 700);
      }, Math.max(0, 700 - (performance.now() - started)));
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', reveal, { once: true });
    } else reveal();
    // Never leave the reader behind a curtain if a resource stalls.
    later(reset, 2400);
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || motion.matches) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const destination = new URL(link.href, window.location.href);
    const project = projects[destination.pathname.split('/').pop()];
    if (!project || destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
    event.preventDefault();
    if (navigating) return;
    reset();
    navigating = true;
    create(project, false);
    // Commit the initial offscreen style before raising the curtain.
    void curtain.offsetHeight;
    curtain.classList.add('is-visible');
    later(() => window.location.assign(destination.href), 460);
  });

  // Back/forward cache can restore the outgoing curtain; clear it immediately.
  window.addEventListener('pageshow', (event) => { if (event.persisted) reset(); });
  if (motion.addEventListener) motion.addEventListener('change', () => { if (motion.matches && !navigating) reset(); });
})();
