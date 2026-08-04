---
title: Build and Deploy
tags: [operations]
area: operations
---

# Build and Deploy

## Local

```bash
cd papa-rentals
npm install
npm run dev        # dev server
npm run build      # tsc + vite build — must be clean
npx vite preview   # serves the BUILT bundle on :4173
```

> [!important] Verify against the built bundle, not the dev server
> `npm run build` runs `tsc` first, so type errors surface there and nowhere
> else. Several behaviours — `import.meta.env.DEV` gating in particular — differ
> between dev and production. See [[Verification]].

> [!warning] `pkill -f "vite preview"` exits 144
> Run it as its own command, never chained, or the non-zero exit takes down the
> rest of the chain.

## Deploy to GitHub Pages

`gh-pages` is a separate branch holding **built output only**.

```bash
npm run build
git worktree prune && rm -rf /tmp/ghp
git worktree add /tmp/ghp gh-pages
cd /tmp/ghp && find . -mindepth 1 -not -path './.git*' -not -name '.nojekyll' -delete
cp -r <repo>/papa-rentals/dist/. /tmp/ghp/ && touch /tmp/ghp/.nojekyll
git add -A && git commit -m "deploy: ..." && git push origin gh-pages
```

> [!warning] The `.nojekyll` guard is load-bearing
> It is **not** produced by the build — it exists only on `gh-pages`. Delete it
> and GitHub Pages starts applying Jekyll rules, ignores `assets/`, and serves a
> blank page.

> [!important] `vite.config.ts` sets `base: './'`
> Keep it. The site is served from a subpath and absolute asset paths 404.

Push the source branch too. Deploying without pushing source strands the work.

## Android

A Capacitor wrapper lives in `android/`, configured by `capacitor.config.json`.
The WebView is the real target — see [[Performance-Notes]] and [[Traps]].

## CI

`.github/workflows/` holds `build.yml` (ScrivenLight, a different project in this
monorepo) and `deploy-pages.yml`.

> [!note] Neither workflow runs on pull requests
> Both trigger on push-to-`main` or `workflow_dispatch` only. A PR showing zero
> check runs is expected, not a failure. Local build + [[Verification]] is the
> real gate.

## Related

- [[Verification]]
- [[Traps]]
