# Working on Papa Rentals

Everything below assumes you're in `papa-rentals/`.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Other commands:

```bash
npm run build        # strict tsc + vite build — must stay clean
npm run preview      # serve the production build on :4173
npm run smoke        # Playwright suite (needs preview running, see below)
```

## The smoke suite

50 checks at a 390×844 phone viewport. It drives real flows — onboarding,
the studio hero, search, browse, item detail, cart, orders, profile — and
**fails on any JS error or emoji in the DOM**. Run it before pushing UI work.

```bash
npm run build
npm run preview &            # must be on :4173
npm i -D playwright          # first time only
npx playwright install chromium   # first time only
npm run smoke
```

Screenshots land in `test/screenshots/` (gitignored). Set `SHOTS_DIR` to
change that, or `CHROMIUM_PATH` to point at a prebuilt browser.

## How the app is put together

Plain React + Vite. No CSS framework, no state library, no backend — all
state lives in a reducer and persists to `localStorage`.

| Path | What's in it |
|---|---|
| `src/store.tsx` | The whole app state + reducer. `loadState()` migrates old saved data (see below). |
| `src/nav.tsx` | Hand-rolled hash router. `View` union + `parseHash`/`viewToHash`, per-route scroll memory. |
| `src/data/catalog.ts` | Items, owners, kits, transport, payment methods, space types. |
| `src/data/images.ts` | Every Unsplash photo ID, in one place — swap a dead one here. |
| `src/utils.ts` | Pricing/date maths, `fuzzyMatch`, `searchRank`, `weightedRating`. |
| `src/recs.ts` | Item similarity + the personalised "For you" ranking. |
| `src/vendors.ts` | Vendor rollups and ranking for the vendor-first home. |
| `src/components/icons.tsx` | All ~85 icons, `Icon`, monogram `Avatar`, `LogoMark`. |
| `src/components/StudioScene.tsx` | The storyboard panorama art (SVG). |
| `src/components/StudioHero.tsx` | The scroll-driven camera that pans it. |
| `src/styles.css` | Design tokens + every style. One file, on purpose. |

### Conventions worth keeping

- **No emoji anywhere.** Everything is an `<Icon name="…" />`. The smoke
  suite asserts this, and there's a grep gate:
  ```bash
  rg -n "[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}★☆♥♡✓✔✕]" src/ index.html
  ```
  (Hits inside `store.tsx`'s `LEGACY_*` maps are expected — those are
  lookup keys for migrating old saved data, never rendered.)
- **Design tokens only.** Use `var(--r-lg)`, `var(--shadow-md)`,
  `var(--accent)` etc. rather than raw values, so dark mode keeps working.
- **Respect reduced motion.** `styles.css` kills all animation under
  `prefers-reduced-motion`; JS-driven motion checks `matchMedia` (see
  `useCountUp` in `ui.tsx` and the parallax in `StudioHero.tsx`).
- **localStorage compatibility.** State is saved under `papa-rentals-v2`.
  If you rename or retype a persisted field, extend `migrate()` in
  `store.tsx` — users have old data in their browsers.

### The studio hero

`StudioHero.tsx` is the camera; `StudioScene.tsx` is the drawing. The scene
is one wide SVG (3960×420) with stations at fixed x-positions listed in
`STATION_X`. The hero scrolls a snap track and, on each frame, pins the
scene's floor line to a fixed spot in the panel — so if you move a station
in the art, update `STATION_X` to match or the framing drifts.

## Deploying

Pushing to `main` with changes under `papa-rentals/` triggers
`.github/workflows/deploy-pages.yml`, which builds and publishes to GitHub
Pages: <https://swagofthenerd-gif.github.io/Scrrenplay-papa/>

## Known gaps

- No backend. Orders, offers, chat and payouts are simulated in the store
  via timers — convincing, but nothing leaves the browser.
- Photos are hotlinked from Unsplash. If one 404s, `SmartImage` falls back
  to the gradient + icon art; fix the ID in `src/data/images.ts`.
- The `lightplot/` and `scrivenlight/` directories at the repo root are a
  separate PyQt desktop project and unrelated to this app.
