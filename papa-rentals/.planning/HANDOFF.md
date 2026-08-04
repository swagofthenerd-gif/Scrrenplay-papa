# Papa Rentals — Implementation Handoff

Rewritten 2026-08-04. Supersedes the 2026-07-28 version, which was stale in
every fact that mattered: progress, branch, and absolute paths.

**Read §3 before writing code.** Those traps have each cost real time already.

---

## 1. What this project is

React 18 + TypeScript + Vite. A film-gear rental marketplace demo set in
Pakistan (currency displayed as `Rs`). **There is no backend.** All state lives
in a `useReducer` + Context store persisted to `localStorage['papa-rentals-v2']`.
A 1s `TICK` heartbeat drives simulated order progress, offer replies and claim
resolution — most "live" behaviour is a clock, not a server.

| | |
|---|---|
| Git root | repo root (a monorepo) |
| This project | `papa-rentals/` subdirectory |
| Remote | `https://github.com/swagofthenerd-gif/Scrrenplay-papa.git` |
| Working branch | `claude/browse-final` |
| Backlog | `papa-rentals/.planning/IMPROVEMENTS-250.md` (canonical) |
| Project skill | `papa-rentals/.claude/skills/papa-rentals/SKILL.md` |
| Live | https://swagofthenerd-gif.github.io/Scrrenplay-papa/ |

The vault at `~/PapaRentals-Vault` is referenced by `CLAUDE.md` but **is not
present in the cloud container**. Don't burn a turn looking for it; if it's
absent, this file and the backlog are the whole record.

### Layout

```
src/
  nav.tsx              hash router: View union, viewToHash/parseHash, go()
  store.tsx            useReducer + Context, persisted; the TICK heartbeat
  utils.ts             money, daysBetween, toISO, buzz, dealActive, ...
  types.ts             Item, Profile, AppState, LedgerEntry, SavedCard, ...
  styles.css           design system; paper/pencil tokens
  styles.vintage.css   the filmic grade (imported from main.tsx)
  data/catalog.ts      ITEMS, KITS, CATEGORIES, getItem, getOwner
  views/               one file per screen
  components/          shared UI; icons.tsx is a hand-drawn duotone set
```

---

## 2. Progress

**216 of 250 done, 37 open** (the counts don't sum to 250 — a few legend and
header lines carry checkbox syntax). Per section:

| Section | Open | What's left, in one line |
|---|---|---|
| HOME | 0 | done |
| BROWSE | 0 | done |
| CART | 1 | split payment |
| ORDERS | 13 | real transit map, driver chat, per-item review notes, statements |
| PROFILE | 21 | referral tracking, bank withdrawal, report evidence, privacy |

Every completed item was typechecked, built, and driven in a real headless
browser against the **production bundle** before being committed.

Tick items with a section-scoped regex, so you don't hit a same-numbered item
in another section:

```python
import re
p = '.planning/IMPROVEMENTS-250.md'
s = open(p).read()
a = s.index('## ORDERS'); b = s.index('## PROFILE')   # bound to ONE section
sec = re.sub(r'^(20)\. \[ \]', r'\1. [x]', s[a:b], flags=re.M)
open(p, 'w').write(s[:a] + sec + s[b:])
```

**The backlog is repeatedly stale in the other direction too.** CART had 12
items already implemented, ORDERS 10, PROFILE several. Read the code before you
trust a `[ ]`. Auditing first has been worth more than building fast.

---

## 3. Traps — read these before touching anything

Each looks correct and is wrong.

**Seeding localStorage after the store mounts does nothing.** Mutate it in
`ctx.addInitScript`, *before* the page loads. Edit it afterwards and the store
persists its own older copy back over you on the next tick, and the reload reads
that. This produced a completely false test failure once already.

**The Browse query param is `cat`, not `category`.** `#/browse?cat=studios`,
parsed in `nav.tsx` via `p.get('cat')`. `?category=` silently renders unfiltered.
Others: `q`, `deals=1`, `wish=1`, `sort`, `ver=1`, `inst=1`.

**The host dashboard route is `#/dashboard`, not `#/host`.**

**`daysBetween(start, end)` returns BILLING days.** It is `Math.max(1, diff + 1)`
— inclusive of both ends, floored at 1. Correct for pricing, wrong for shifting a
range or measuring a duration. Never use it as a generic diff.

**`toISO(d)` builds from LOCAL date parts.** Reimplementing it as
`d.toISOString().slice(0,10)` is off by one day in PKT (UTC+5) before 05:00.

**A `text-shadow` blur radius is radial.** Offsetting a blurred copy sideways
gives a drop shadow, not a directional smear. The anamorphic trail in
`styles.vintage.css` is built from several **zero-blur** replicas stepped along
x, weighted toward the right. Don't "simplify" it back into a blur.

**A JSX `{/* comment */}` cannot go inside a `{cond && ( ... )}` expression.**
It must sit above the conditional. Otherwise TS1005 / TS1382 / TS17002.

**`color-mix()` computes to `color(srgb 0.65 0.54 0.98 / 0.45)` — 0-to-1 floats**,
while `rgb()` is 0-to-255. Any contrast script must branch on
`s.startsWith('color(')` and scale, or it reports fiction. It already did once.

**`Icon`'s `name` prop is typed `IconName | string`** so stale persisted data
can't crash it — which means a typo'd icon name will *not* fail the build, it
silently renders the fallback box. Type your own props as `IconName`.

**`npx tsc --noEmit` does not catch unused imports** (`noUnusedLocals` is off).
After a refactor, grep-count each import symbol; a count of 1 means it's dead.

**`.list-row` is used on both `div`s and `button`s.** The button reset
(`border: 0; color: inherit; font: inherit; text-align: left`) in `styles.css` is
load-bearing — removing it makes every tappable row render as a native button.

---

## 4. The verification loop — not optional

Writing the change is the easy half. Twice the *measurement* turned out to be
wrong rather than the code. Do not report an item done without running this.

```bash
npx tsc --noEmit                  # 1. typecheck
npm run build                     # 2. real production build
npx vite preview --port 4173 &    # 3. serve the BUILT bundle, from repo root
node /tmp/.../driver.cjs          # 4. drive it headless, assert on behaviour
pkill -f "vite preview"           # own command — exits 144, breaks any && chain
```

**Assert on behaviour, not presence.** "The button exists" proves nothing. "The
route actually changed to `#/browse?ver=1`", "the split renders 0 for an all-cash
wallet", "the contrast computes to 3.97" — those are assertions.

Playwright boilerplate for **this container** (paths differ from the old
handoff — playwright lives only in `papa-rentals/node_modules`, so set
`NODE_PATH`, and chromium must be pointed at explicitly):

```js
const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-proxy-server'],
  })
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript(() => {           // BEFORE load — see §3
    const raw = JSON.parse(localStorage.getItem('papa-rentals-v2') || '{}')
    raw.profile = { name: 'Ali', city: 'Lahore', onboarded: true }
    localStorage.setItem('papa-rentals-v2', JSON.stringify(raw))
  })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto('http://localhost:4173/#/', { waitUntil: 'networkidle' })
  await p.waitForTimeout(900)
  // ... assertions ...
  console.log('errors:', errs)   // always report this
  await b.close()
})()
```

Two more gotchas: **scope your selectors** (a bare `getByRole('button', { name:
'Browse all' })` matched a hero CTA, not the Departments link), and **snapshot
state after each step**, not once at the end. `cwd` resets between Bash calls —
use absolute paths. Touch gestures need `hasTouch: true, isMobile: true`.

---

## 5. House rules

- **Comments explain WHY, naming the concrete failure they prevent.** Not "sets
  the height" — "a transition here would chase each frame and lag the thumb". A
  comment restating the code is noise. Match the density already in the file.
- **Commit subjects are user-facing.** "Not all wallet money is the same money",
  not "fix wallet calc".
- **Design tokens in `styles.css` are binding.** No invented hex, no arbitrary
  spacing.
- **Accessibility:** 4.5:1 for text, **3:1 for non-text boundaries**, 44×44px
  touch targets.
- **Ships inside a low-end (~24MB) Android WebView.** Heavy motion needs a
  `prefers-reduced-motion` bail-out. Never `preventDefault()` on `touchmove`.
- **Prefer extracting a shared component over editing two copies** — several
  backlog items exist *because* two copies drifted.
- **When a measurement looks wrong, suspect the measurement first.** If a
  suspected defect turns out not to exist, say so plainly rather than "fixing" a
  non-problem. That has happened more than once here.

---

## 6. Process and constraints

- Develop on `claude/browse-final`. Never push elsewhere without asking.
- GitHub access is scoped to `swagofthenerd-gif/scrrenplay-papa`.
- After pushing, open a **draft** PR if one isn't already open.
- **PRs legitimately show 0 checks.** Neither `build.yml` nor `deploy-pages.yml`
  triggers on `pull_request`. Don't chase a green tick that can't exist.
- **Pages deploys from `main` only** — the `github-pages` environment rejects
  other branches, and the deploy job fails in ~2s with no steps while build
  passes. Merging is what republishes the live link.
- Never disable TLS verification or unset `HTTPS_PROXY`.

---

## 7. Next up, in priority order

1. **ORDERS-8** — the in-transit map is a decorative SVG path, not a route. Two
   pins on real coordinates would stop it lying.
2. **ORDERS-20** — rating is per-item but review text claims to "apply to each
   item". Allow per-item notes. Self-contained, needs no new data.
3. **ORDERS-24** — cancelled orders show a fee/refund with no breakdown link.
4. **PROFILE-11** — refunds land in the wallet with no way to withdraw. Now that
   PROFILE-10 knows which money is withdrawable, this is unblocked.
5. **PROFILE-20** — wishlist lives in Profile *and* Browse; pick one home.

The remaining 37 are listed verbatim in `.planning/IMPROVEMENTS-250.md` — read
them there rather than trusting a copy in this file, which is how the last
handoff went stale.

---

## 8. Explicitly deferred — do NOT start

Deferred by the user until the whole 250-item list is done:

- The warm, non-pure-white background palette
- A more welcoming overall vibe

Don't start either early, and don't partially implement them while doing other
items.
