#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

# Keep the portfolio's Tailwind utility CSS local and precompiled rather than
# asking the browser to download and run Tailwind's CDN compiler at page load.
npm exec --yes --package=tailwindcss@3.4.17 -- tailwindcss \
  --input tools/tailwind.input.css \
  --output assets/tailwind.css \
  --content index.html \
  --minify
