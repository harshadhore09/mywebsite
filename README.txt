# Harsha Dhore portfolio site

## Pages and assets
- `index.html`, portfolio homepage
- `MBG_index.html`, Pragati / Mahila Bachat Gat case study
- `StrategicUX_index.html`, Food Delivery UX case study
- `MedicalAdher_index.html`, Medical Adherence case study
- `slides/`, standalone vector slide fragments, loaded as the reader approaches them
- `assets/` and `images/`, optimized WebP artwork and the precompiled Tailwind stylesheet
- `scripts/lazy-slides.js`, shared progressive artwork loader
- `scripts/project-transition.js` and `assets/project-transition.css`, shared project-opening curtain
- `resume/Harsha_Dhore.pdf`, current CV (linked from the homepage)
- `resume/Harsha_Dhore.tex`, editable LaTeX source for the CV

## Performance work
The site is about 86 MB unpacked. Case-study HTML is now approximately 96–190 KB per page instead of 15–31 MB. Each cover remains inline for immediate display; subsequent slides keep their original vector artwork, but load only within about 2,400 px of the viewport. Slides more than about 4,800 px away are released so long case studies do not keep every SVG in the live page at once. Reserved slide ratios prevent layout jumps, and slide navigation starts the target artwork request before scrolling.

Raster source assets were converted to high-quality WebP (JPEGs are capped at 2,560 px on their longest side; PNG artwork keeps its source dimensions). The homepage project-card images load lazily. Tailwind utility CSS is compiled locally, removing the browser-side Tailwind CDN compiler and its startup work.

To regenerate the local Tailwind stylesheet after changing homepage utility classes, run `tools/build-tailwind-css.sh` (requires Node/npm and internet access to the npm registry). The generated file is `assets/tailwind.css`.

## Tests
The jsdom test dependency is only needed for local verification; it is not part of the deployed site.

```sh
npm install --prefix /tmp jsdom
node tools/lazy-slides/test.js
node tools/slide-rail/test.js
node tools/project-transition/test.js
node tools/micro-interactions/test.js
```

## Project opening transition
All three case studies share a warm, full-screen title curtain. Normal project clicks raise it before navigation; the destination briefly shows its title and slides the curtain upward to reveal the screen. It also runs on direct case-study visits. Reduced-motion preferences skip the animation, modified/new-tab clicks retain native behavior, and back/forward restores clear the curtain. No dependencies or build step are required.

## About section
The About panel is an interactive field journal, and all of its copy lives in `index.html`, no build step.

- The headline names three positions, what users *say*, what they *actually do*, and what *business metrics demand*, each with a hover/focus tooltip (the three tags are stored as `data-tag` / `data-note` on the `<span>`s). The green third accent is `.measure-word`.
- The drag-to-compare box starts fully on *stated behaviour*; dragging, tapping or the arrow keys wipe *observed behaviour* across it. The auto-nudge first sweeps it open and closes again so the gesture is obvious.
- The four profile tabs are `<template>` blocks (`#skill-belief`, `#skill-background`, `#skill-process`, `#skill-path`), so a tab can hold paragraphs, a bulleted list or an ordered list. The drawer measures its own content, so longer copy is never clipped. Tabs expose `aria-expanded` and keep focus on the clicked chip.
- The sprout cycles 🌱 → 🌿 → 🪴 → 🌳 → 🌸 and its badge with it (open to roles → product & ux → behaviour design → design research → IIT Delhi M.Des), then loops. The badge starts on *open to roles*.
- Everything above is keyboard reachable, and the stamp, tooltips and drawer respect reduced motion.

To change the wording, edit the markup and the four templates directly; utility classes are only used if they already exist in `assets/tailwind.css`, so new type sizes belong in the inline `<style>` block.

## Micro-interactions and custom cursors
One common package, copied from Pragati / Mahila Bachat Gat and kept identical across all three case studies, lives in a single shared pair of files: `scripts/micro-interactions.js` and `assets/micro-interactions.css`. A page opts in with `<html data-project="mbg|food|medical">`; everything decorative is `aria-hidden`, `pointer-events:none`, and hidden in print.

On every case study the cursor is a simple ring and dot, with no rupee symbol; hovering links softly highlights the ring, and clicks still drop small change (coins and a sparkle). The golden glitter trail that used to live inline on the Pragati page is now part of the shared engine, so Food Delivery and Medical Adherence carry the exact same sparkle star, palette, and fall. Wherever a page has a reading-progress bar (Pragati's `#prog`, Food Delivery's `.progress-bar`), a little gold coin rides its head; Medical Adherence has no progress bar of its own, so it simply gets the rest of the package.

All three also share the same chrome-level touches: a light sweeps across the contact button on hover, nav pills and the back-to-top button lift on hover and settle on press, and text selection is tinted gold.

The engine only runs for a fine pointer with motion allowed: touch readers, reduced-motion readers, and anyone whose browser never loads the file keep the native cursor, and switching the OS to reduced motion mid-visit retires the cursor immediately. The click bursts and glitter are capped and self-cleaning.

## Hosting
GitHub Pages is recommended for this static site. Keep the folder structure unchanged when deploying: the slide loader uses same-origin `fetch()`, so the pages need to be served over HTTP/HTTPS rather than opened directly with `file://`.

For a local preview, run a static server from the repository root, for example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

To publish with GitHub Pages:
1. Create a repository and copy the site contents into its root. Keep `index.html`, the three case-study pages, `assets/`, `images/`, `slides/`, `scripts/`, and `resume/` at the same levels.
2. Push the files to GitHub.
3. In the repository, open **Settings → Pages**.
4. Under Build and deployment, select **Deploy from a branch**, choose the publishing branch and folder `/ (root)`, then save.
5. The homepage is the root URL; the case studies are `MBG_index.html`, `StrategicUX_index.html`, and `MedicalAdher_index.html`.

Official guide: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Important notes
- Google Fonts and Font Awesome are still external dependencies and need internet access.
- Both homepage Download CV links serve `resume/Harsha_Dhore.pdf`. If the CV changes, replace this PDF and update `resume/Harsha_Dhore.tex` as appropriate.
- Preview all four pages after deployment, especially on mobile and when printing a case study.
