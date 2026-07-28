---
name: papa-rentals
description: "Papa Rentals codebase conventions, traps, verification and deploy. Use when working anywhere in ~/Scrrenplay-papa/papa-rentals — editing views, fixing backlog items, verifying UI, or deploying to gh-pages."
allowed_tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

# Papa Rentals

React 18 + TypeScript + Vite film-gear rental marketplace demo (Pakistan, currency `Rs`).
No backend — everything is `useReducer` + Context persisted to localStorage.

## Start here

**The backlog is `.planning/IMPROVEMENTS-250.md`** — 250 items across Home / Browse /
Cart / Orders / Profile. Read it before proposing work. Do not re-derive it from
memory or from an audit; it was lost to compaction once already and re-auditing
produced duplicate effort.

Status in that file is deliberately conservative. Only re-verify-then-tick; never
assume an item is done because it "looks like something that got fixed."

## Architecture

| Concern | Where |
|---|---|
| Routing | `src/nav.tsx` — hash-based, `View` discriminated union, `viewToHash`/`parseHash`, `go(view)` |
| State | `src/store.tsx` — `useReducer` + Context → `localStorage['papa-rentals-v2']`, `TICK` heartbeat |
| Helpers | `src/utils.ts` |
| Catalog | `src/data/catalog.ts` — `getItem`, `getOwner` |
| Views | `src/views/*.tsx` |
| Shared UI | `src/components/ui.tsx`, `src/components/icons.tsx` |

## Traps that have already cost time

- **`daysBetween(start, end)` returns BILLING days** — `Math.max(1, diff + 1)`,
  inclusive and floored at 1. Never use it to shift or offset a date range; it will
  silently be one day long and never zero.
- **`toISO(d)` builds from LOCAL date parts, not `toISOString()`.** Reimplementing it
  with `toISOString().slice(0,10)` is off by one in PKT (UTC+5). Always import the
  real one.
- **The host dashboard route is `#/dashboard`, not `#/host`.** There is no `host`
  route. A verification script pointed at `#/host` silently tests nothing, which is
  how an accessibility sweep once "passed" a screen it never visited.

## Conventions

- Comments explain **why**, naming the concrete failure they prevent — not what the
  code does. Match the existing density; most code carries none.
- Clickable rows are real `<button>`s, not click-`<div>`s. When converting, zero out
  the borders you don't want (`borderLeft:0` etc.) rather than dropping the class.
- Icon-only controls need `aria-label`; toggles need `aria-pressed` **and** a label
  that states direction ("Add to wishlist" / "Remove from wishlist" — not "Toggle").
- Commit subjects are imperative and user-facing ("Let a host open the listing a
  request is about"), body explains the failure the change removes.

## Verify before claiming

Always verify against the **built** bundle, not the dev server:

```bash
npm run build            # tsc + vite build; must be clean
npx vite preview         # port 4173
```

Drive it with playwright-core headless (`channel: 'chrome'`), scripts in `/tmp/shots`.
To skip onboarding, seed localStorage then **reload**:

```js
raw.profile = Object.assign({}, raw.profile, { name:'Test', city:'Lahore', onboarded:true })
await p.reload()
```

Assert on real navigation (`request card -> #/item/i1`), not on "the element exists".

`pkill -f "vite preview"` exits 144 — run it as its own Bash call, never chained.

## Deploy

gh-pages is a **separate orphan-ish branch holding built output only**. Procedure:

```bash
npm run build
git worktree prune && rm -rf /tmp/ghp
git worktree add /tmp/ghp gh-pages
cd /tmp/ghp && find . -mindepth 1 -not -path './.git*' -not -name '.nojekyll' -delete
cp -r <repo>/dist/. /tmp/ghp/ && touch /tmp/ghp/.nojekyll
git add -A && git commit -m "deploy: ..." && git push origin gh-pages
```

`vite.config.ts` sets `base: './'` — keep it, the site is served from a subpath.
Push the source branch too; deploying without pushing source strands the work.

## Gotchas

- **`.nojekyll` is not produced by the build.** It only lives on gh-pages. Delete it
  during a deploy and GitHub Pages starts ignoring `assets/` (leading-underscore and
  Jekyll processing rules), serving a blank page. The `-not -name '.nojekyll'` guard
  above is load-bearing.
- **`git ls-tree` output can appear empty in a chained command** and make gh-pages
  look like it has no files. Verify with `git show --stat` before concluding the
  branch is empty — do not "fix" a deploy branch that isn't broken.
- **`useMemo([state])` on the whole store object** is used in several views. It
  recomputes on every unrelated change (wallet top-up, a notification arriving).
  When touching those memos, narrow the deps — several backlog items are exactly this.
- **The app ships inside a low-end Android WebView.** `navigator.clipboard` and blob
  downloads both commonly fail there. Anything using them needs a share-sheet or
  visible-text fallback, and heavy scroll animation needs a `prefers-reduced-motion`
  bail-out.
- **Deferred by the user until the backlog is done:** the warm non-pure-white
  background palette and the "more welcoming vibe" work. Do not start it early.
