# Harsha Dhore portfolio site

## Pages and assets
- `index.html` — portfolio homepage
- `MBG_index.html` — Pragati / Mahila Bachat Gat case study
- `StrategicUX_index.html` — Food Delivery UX case study
- `MedicalAdher_index.html` — Medical Adherence case study
- `slides/` — standalone vector slide fragments, loaded as the reader approaches them
- `assets/` and `images/` — optimized WebP artwork and the precompiled Tailwind stylesheet
- `scripts/lazy-slides.js` — shared progressive artwork loader
- `scripts/project-transition.js` and `assets/project-transition.css` — shared project-opening curtain
- `resume/Harsha_Dhore.pdf` — temporary explanatory PDF, not a real resume

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

## Themed micro-interactions and custom cursors
Each case study gets its own cursor personality, built from one shared pair of files: `scripts/micro-interactions.js` and `assets/micro-interactions.css`. A page opts in with `<html data-project="mbg|food|medical">`; everything decorative is `aria-hidden`, `pointer-events:none`, and hidden in print.

- **Pragati — Mahila Bachat Gat** (savings collective): the follower is a coin-stamp that shows a ₹ glyph over links, clicks drop small change (coins and a sparkle), and a little gold coin rides the scroll-progress bar. The page's existing golden glitter is left as the trail, so the two never double up.
- **Food Delivery: Waiting Anxiety**: the cursor carries a hot takeout box, leaves rising steam wisps, and clicks answer with a tracking ping; the progress bar becomes a live order tracker with a pulsing rider at its head.
- **Medical Adherence** (design probe): the follower is a two-tone capsule that tilts as it rolls and leaves tumbling dose crumbs, clicks answer with a double-beat heartbeat, and the header edge breathes like a monitor trace.

All three also share small chrome-level touches: a light sweeps across the contact button on hover, nav pills and the back-to-top button lift on hover and settle on press, and text selection is tinted per project.

The engine only runs for a fine pointer with motion allowed: touch readers, reduced-motion readers, and anyone whose browser never loads the file keep the native cursor, and switching the OS to reduced motion mid-visit retires the cursor immediately. The click bursts and trails are capped and self-cleaning.

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
- The original portfolio links to `resume/Harsha_Dhore.pdf`, but no real CV was supplied. The current PDF is an explanatory notice; replace it before publishing.
- Preview all four pages after deployment, especially on mobile and when printing a case study.
