# Papa Rentals — Implementation Handoff

Written 2026-07-28. Audience: a coding model (Qwen 3 Coder or similar) picking up
the 250-item improvement backlog, with a planning model supervising.

**Read this whole file before writing code.** The traps in §3 are not stylistic
preferences — each one has already caused a real bug in this codebase.

---

## 1. What this project is

React 18 + TypeScript + Vite. A film-gear rental marketplace demo set in
Pakistan (currency displayed as `Rs`). **There is no backend.** All state lives
in a `useReducer` + Context store persisted to `localStorage`. Nothing is
fetched; nothing is authenticated for real.

| | |
|---|---|
| Git root | `/home/shaharyar/Scrrenplay-papa` (a monorepo) |
| This project | `papa-rentals/` subdirectory |
| Remote | `https://github.com/swagofthenerd-gif/Scrrenplay-papa.git` |
| Working branch | `claude/papa-vendor-home` |
| Backlog | `papa-rentals/.planning/IMPROVEMENTS-250.md` |
| Project skill | `papa-rentals/.claude/skills/papa-rentals/SKILL.md` |

### Layout

```
src/
  nav.tsx           hash router: View union, viewToHash/parseHash, go()
  store.tsx         useReducer + Context, persisted to localStorage
  utils.ts          money, daysBetween, toISO, buzz, dealActive, ...
  recs.ts           forYou / similarItems recommendation helpers
  types.ts          Item, Profile, AppState, SavedCard, ...
  styles.css        single stylesheet, CSS custom properties for tokens
  data/catalog.ts   ITEMS, KITS, CATEGORIES, getItem, getOwner
  views/            one file per screen (Home, Browse, CartView, ...)
  components/       shared UI (primitives, ui, DeptRow, Deferred, icons, ...)
```

---

## 2. Progress

**92 of 250 done.** Every completed item was typechecked, built, and driven in a
real headless browser against the production bundle before being committed.

| Section | Done | Open |
|---|---|---|
| HOME | 45 | 5 |
| BROWSE | 8 | 42 |
| CART | 21 | 29 |
| ORDERS | 14 | 36 |
| PROFILE | 4 | 46 |

The backlog file is the source of truth for state — `[x]` means done and
verified, `[ ]` means open. Tick items there as you finish them, using a
section-scoped regex so you don't hit a same-numbered item in another section:

```python
import re
p = '.planning/IMPROVEMENTS-250.md'
s = open(p).read()
a = s.index('## HOME'); b = s.index('## BROWSE')   # bound to ONE section
sec = s[a:b]
sec = re.sub(r'^(36)\. \[ \]', r'\1. [x]', sec, flags=re.M)
open(p, 'w').write(s[:a] + sec + s[b:])
```

---

## 3. Traps — read these before touching anything

Each of these looks correct and is wrong. They have all bitten already.

**The Browse query param is `cat`, not `category`.**
The URL is `#/browse?cat=studios`. Parsed in `src/nav.tsx` via `p.get('cat')`.
Writing `?category=studios` silently produces an unfiltered Browse page. Other
params: `q`, `deals=1`, `wish=1`, `sort`, `ver=1`, `inst=1`.

**The host dashboard route is `#/dashboard`, not `#/host`.**
The `View` name is `'dashboard'`.

**`daysBetween(start, end)` returns BILLING days, not a day count.**
It is `Math.max(1, diff + 1)` — inclusive of both ends and floored at 1. It is
correct for pricing and wrong for shifting a date range or measuring a duration.
Never use it as a generic diff.

**`toISO(d)` builds from LOCAL date parts, not `toISOString()`.**
Reimplementing it as `d.toISOString().slice(0, 10)` is off by one day in PKT
(UTC+5) for anything before 05:00 local. Use the existing `toISO`.

**A JSX `{/* comment */}` cannot go inside a `{cond && ( ... )}` expression.**
It must sit above the conditional. Otherwise: TS1005 / TS1382 / TS17002.

**`color-mix()` computes to `color(srgb 0.65 0.54 0.98 / 0.45)` — 0-to-1 floats.**
`rgb()`/`rgba()` are 0-to-255. Any script measuring contrast must branch on
`s.startsWith('color(')` and scale by 255, or it silently reports garbage. This
produced a completely fictional "failure" once already.

**`Icon`'s `name` prop is typed `IconName | string`** so stale persisted data
can't crash it. That means a typo'd icon name in fresh source code will *not*
fail the build — it silently renders the fallback box. Type your own props as
`IconName`, not as `ComponentProps<typeof Icon>['name']`.

**`npx tsc --noEmit` does not catch unused imports** (`noUnusedLocals` is off).
After a refactor, grep-count each import symbol in the file; a count of 1 means
it appears only in the import line and is dead.

**`pkill -f "vite preview"` exits 144.** Harmless, but it must be its own shell
command — never chained with `&&`, which will abort the chain.

**`vite preview` must be started from the repo root** or every route 404s.

---

## 4. The verification loop — this is not optional

Writing the change is the easy half. Most of the value in this session came from
the loop below, and twice the *measurement* turned out to be wrong rather than
the code. Do not report an item done without running it.

```bash
npx tsc --noEmit          # 1. typecheck
npm run build             # 2. real production build
npx vite preview --port 4173 &   # 3. serve the built bundle, from repo root
node /tmp/shots/whatever.cjs     # 4. drive it headless, assert on behavior
pkill -f "vite preview"          # (own command; exits 144)
```

**Assert on behavior, not on presence.** "The button exists" proves nothing.
"The route actually changed to `#/browse?ver=1`", "the height actually grew
sub-linearly", "the contrast ratio actually computes to 3.97" — those are
assertions. Element-presence checks pass on broken features.

Playwright driver boilerplate — note that **playwright-core is not in this
repo's `node_modules`**:

```js
const { chromium } = require('/home/shaharyar/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome' })
  const ctx = await b.newContext()
  // Seed past the onboarding gate, or every test lands on the welcome screen.
  await ctx.addInitScript(() => {
    const raw = JSON.parse(localStorage.getItem('papa-rentals-v2') || '{}')
    raw.profile = { name: 'Test', city: 'Lahore', onboarded: true }
    localStorage.setItem('papa-rentals-v2', JSON.stringify(raw))
  })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(String(e)))
  await p.goto('http://localhost:4173/#/', { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  // ... assertions ...
  console.log('errors:', errs)   // always report this
  await b.close()
})()
```

Two gotchas that have already wasted time:

- **Scope your selectors.** `getByRole('button', { name: 'Browse all' })` matched
  a StudioHero CTA, not the Departments link, and then timed out on an
  intercepted click. Find the containing `.section-head` first, then the button
  inside it.
- **Snapshot state after each step, not once at the end.** A test that pulled
  three times and then read the label reported a false failure. The app was fine.

For touch gestures, the context needs `hasTouch: true, isMobile: true`, and you
dispatch synthetic `Touch` + `TouchEvent` objects on the target's parent.

---

## 5. House rules

- **Comments explain WHY, naming the concrete failure they prevent.** Not
  "sets the height" — "a transition here would chase each frame and lag the
  thumb". A comment that restates the code is noise.
- **Commit subjects are imperative and user-facing.** "Give badges a visible
  edge, not just coloured text", not "fix badge CSS".
- **Design tokens in `styles.css` are binding.** No raw Tailwind-style defaults,
  no invented hex values, no arbitrary spacing.
- **Accessibility bar:** 4.5:1 contrast for normal text, **3:1 for non-text UI
  boundaries** (borders, outlines, focus rings). 44×44px touch targets.
- **This app ships inside a low-end (~24MB) Android WebView.** Heavy motion needs
  a `prefers-reduced-motion` bail-out. Never `preventDefault()` on `touchmove` —
  blocking it makes the page feel stuck.
- **Prefer extracting a shared component over editing two copies.** Several items
  in this backlog exist *because* two copies of the same markup drifted apart.
  When you unify, keep genuinely-different behaviour as props rather than
  flattening it into one behaviour that suits neither caller.
- **When a measurement looks wrong, suspect the measurement first.** And if a
  suspected defect turns out not to exist, say so plainly instead of "fixing" a
  non-problem. One backlog item was re-scoped this way; another was found to be
  already handled by existing CSS.

---

## 6. Work in flight

`src/components/Deferred.tsx` is committed but **not yet wired in**. It is an
IntersectionObserver wrapper that mounts its children only when they're about to
scroll into view, holding the space with a reserved-height placeholder.

To finish **HOME-36**, wrap the below-the-fold rails in `Home.tsx` with it. Two
constraints the component already handles but the integration must respect:

- The placeholder must carry the section `id`, because `JumpBar` scrolls to
  `#spaces` and `#trending` by `getElementById` — both below the fold.
- It never unmounts once mounted. A rail that re-mounted would lose its
  horizontal scroll position and re-fire its impression counter.

Verify by asserting that the initial DOM contains *fewer* `.rail-track` elements
than after scrolling to the bottom, that the jump bar still reaches `#spaces` and
`#trending`, and that total page height doesn't jump when a section mounts.

---

## 7. Everything still to do

158 open items, verbatim from the backlog. IDs are `SECTION-n`, matching the
numbering inside each section of `IMPROVEMENTS-250.md`.

### HOME (`Home.tsx` + `StudioHero`, `ServicesBand`)

5 open

- [ ] **HOME-3** — No "Continue where you left off" rail — surface last item viewed with its half-filled date picker.
- [ ] **HOME-9** — Kits are hardcoded bundles — add "Build your own kit" that seeds cart and applies a dynamic bundle discount.
- [ ] **HOME-10** — No seasonal/contextual merchandising (wedding season, Ramadan, ad-shoot week). Add a data-driven promo slot at top.
- [ ] **HOME-19** — Icons carry meaning (bolt, backpack, flame) with no legend — consider text labels on first run.
- [ ] **HOME-36** — All rails render every card eagerly — no virtualization/lazy images. Lazy-render below-the-fold rails.

### BROWSE (`Browse.tsx` + `ItemDetail.tsx`)

42 open

- [ ] **BROWSE-3** — No price range — only a "max price" `<select>` with 3 fixed buckets. Add a dual-handle slider.
- [ ] **BROWSE-4** — `maxPrice` buckets (10k/25k/50k) are camera-centric — make buckets category-aware.
- [ ] **BROWSE-6** — No "distance" input despite a `nearest` sort — surface actual km and let users cap radius.
- [ ] **BROWSE-9** — Availability filter missing — can't filter to "available on my shoot dates" though conflict data exists in `ItemDetail`.
- [ ] **BROWSE-10** — No "verified + instant + offers" one-tap "Safe bets" preset.
- [ ] **BROWSE-11** — Compare state resets on navigation and isn't persisted.
- [ ] **BROWSE-12** — Compare capped at 3 silently — tapping a 4th does nothing with no feedback. Toast "Compare holds 3".
- [ ] **BROWSE-13** — `cmp-btn` overlays every card corner and can fight the wishlist heart — verify no overlap on small screens.
- [ ] **BROWSE-14** — Compare table shows `specs[0]` as "Top spec" only — expand to a few key specs per category.
- [ ] **BROWSE-15** — Compare has no "add to cart" from the table — only "View".
- [ ] **BROWSE-16** — `fuzzyMatch` runs over concatenated `name+tags+description+category` per item per render — memoize the searchable blob per item.
- [ ] **BROWSE-17** — No search-within-results or refinement chips ("did you mean", related tags).
- [ ] **BROWSE-18** — Results grid isn't result-count-aware — 1 vs 100 results render identically; consider a compact list toggle.
- [ ] **BROWSE-19** — No pagination or infinite scroll — everything renders at once. Add windowing.
- [ ] **BROWSE-21** — No recent/trending searches in Browse (may live in `SearchOverlay` — unify).
- [ ] **BROWSE-22** — Category chips duplicated from Home; no explicit "All" chip to clear category.
- [ ] **BROWSE-23** — Date pickers default to `todayISO(2)/(3)` — no visual calendar showing unavailable ranges though `unavailableRanges`/`findConflict` exist.
- [ ] **BROWSE-24** — Conflict handling shows a toast on add — better to disable the button and show conflict inline first.
- [ ] **BROWSE-25** — `invalidRange` (end < start) only caught on add — validate live, show error under the field.
- [ ] **BROWSE-26** — Insurance auto-toggles for `deposit >= 100000` — explain why it's forced, don't just pre-check.
- [ ] **BROWSE-27** — Operator/transport/insurance fees stack into `sub` with no running breakdown near the CTA — show a live mini price summary.
- [ ] **BROWSE-28** — Offer/negotiation flow (`OFFER_TTL_MS`, countdown) is undiscoverable — add a "Make an offer" affordance with a hint on typical accepted discounts.
- [ ] **BROWSE-29** — No "similar but cheaper" nudge on expensive items though `similarItems` is computed.
- [ ] **BROWSE-31** — No delivery-time estimate ("van reaches DHA in ~40 min") to match the "delivered like a food order" promise.
- [ ] **BROWSE-32** — Quantity stepper allows qty without checking stock — vendor with 2 units should block qty 5.
- [ ] **BROWSE-33** — `ItemCard` is reused everywhere but compare overlay is bolted on only in Browse — fold compare into the card component.
- [ ] **BROWSE-34** — No "just booked" / low-availability social proof ("rented 3× this week").
- [ ] **BROWSE-35** — Wishlist heart toggles with no animation/haptic on Browse cards.
- [ ] **BROWSE-36** — Cards don't show distance even when sorted by `nearest` — surface the sort dimension.
- [ ] **BROWSE-37** — No "instant book" vs "needs approval" badge on the Browse card — users learn this only in cart/detail.
- [ ] **BROWSE-38** — Big `useMemo` has ~12 deps incl. `state.wishlist` — wishlist toggles re-run the whole filter+sort pipeline. Split wishlist highlighting out.
- [ ] **BROWSE-39** — `getOwner()` called repeatedly inside sort comparators (`nearest`, `verifiedOnly`) — precompute an owner map.
- [ ] **BROWSE-40** — Compare modal calls `getItem(id)` ~8× per column per render — resolve items once.
- [ ] **BROWSE-41** — `<select>` filters styled as chips lose native affordance on some Android WebViews — verify tappable and legible.
- [ ] **BROWSE-42** — Filter chips toggle on click but have no `aria-pressed`.
- [ ] **BROWSE-44** — Compare tray is fixed at bottom and can cover the last row — add bottom padding when tray is up.
- [ ] **BROWSE-45** — No loading state between filter changes — add optimistic skeletons for future server-backed data.
- [ ] **BROWSE-46** — Persist last-used filters per category.
- [ ] **BROWSE-47** — "Notify me when available / price drops" on out-of-range results.
- [ ] **BROWSE-48** — Map view for spaces (studios) — location is a primary decision factor.
- [ ] **BROWSE-49** — Log which filters produce zero results — a supply-gap signal.
- [ ] **BROWSE-50** — Single "clear all + reset sort" action.

### CART (`CartView.tsx`)

29 open

- [ ] **CART-22** — No stock/availability re-check at checkout — an item could be booked between add and place.
- [ ] **CART-23** — Empty cart doesn't surface wishlist or last-viewed as a fast path back in.
- [ ] **CART-24** — No handling for a line whose item became unavailable/paused after add — it'll still try to book.
- [ ] **CART-25** — Cross-sell ("Complete your setup") only keys off the last cart line — blend signals across all lines.
- [ ] **CART-26** — `detail-grid` puts summary in a second column — confirm the CTA isn't below the fold on narrow phones.
- [ ] **CART-27** — Pay CTA is inside the summary panel — make it a sticky bottom bar with the live total.
- [ ] **CART-28** — Long item names in `cart-line-info` — verify truncation.
- [ ] **CART-29** — Promo input and toggles are visually similar rows — group under a "Discounts" subheader.
- [ ] **CART-30** — Applying a promo toasts but the summary doesn't animate the discount line in.
- [ ] **CART-31** — Toggling wallet/points recomputes silently — flash the affected summary line.
- [ ] **CART-32** — No haptic on remove (you `buzz()` on place order only).
- [ ] **CART-33** — "Transport (per owner)" is jargon — "Delivery (charged once per vendor)".
- [ ] **CART-34** — "Damage protection" vs "Papa Protection" vs "insurance" — three names for one thing. Pick one.
- [ ] **CART-35** — "You'll earn +N PapaPoints" — add "→ Rs N off next time" to make value concrete.
- [ ] **CART-36** — `cartTotals` called twice in `applyPromo` and again on render — memoize.
- [ ] **CART-37** — `similarItems(...).filter(...).slice(6)` runs every render — memoize on cart contents.
- [ ] **CART-38** — `PAYMENT_METHODS.find(...)` / `TRANSPORT_OPTIONS.find(...)` run per line/render — precompute maps.
- [ ] **CART-39** — `address` falls back to `addresses[0]` but `placeOrder` can still send "Self pickup" — make delivery-vs-pickup explicit.
- [ ] **CART-40** — Toggle rows use real checkboxes (good), but pay-method and address rows are click-divs — unify to real inputs.
- [ ] **CART-41** — Disabled pay button (on `promoError`) gives no explanation next to it.
- [ ] **CART-42** — Number/points values aren't announced on change — add `aria-live` on the total.
- [ ] **CART-43** — Split-payment / pay-deposit-now-rest-later.
- [ ] **CART-44** — Group cart by shoot date for multi-day productions.
- [ ] **CART-45** — "Request quote" path for very large carts routing to a human.
- [ ] **CART-46** — Save cart as a named "kit" — bridges to Home "build your own kit".
- [ ] **CART-47** — Estimated delivery ETA per vendor in cart, not just fees.
- [ ] **CART-48** — Tax/GST line for real invoicing — summary structure is ready.
- [ ] **CART-49** — Abandoned-cart reminder via the existing notification center.
- [ ] **CART-50** — "Someone else is viewing this" / low-stock nudge at checkout.

### ORDERS (`OrdersView.tsx`)

36 open

- [ ] **ORDERS-3** — No sort control (newest/oldest/amount).
- [ ] **ORDERS-6** — "Skip ahead" manually advances order status — a demo shortcut in production UI. Gate behind a dev flag.
- [ ] **ORDERS-7** — Same for auto-advance (`autoAdvanceAt`) — make simulated progression invisible to end users.
- [ ] **ORDERS-8** — In-transit map is a decorative SVG path, not a real route — even a static map thumbnail with two pins feels more real.
- [ ] **ORDERS-9** — Driver PIN shown but no "copy PIN" or confirm-handover action.
- [ ] **ORDERS-10** — Driver "Call" is a `tel:` link — add in-app chat with the driver.
- [ ] **ORDERS-12** — Timeline steps don't show timestamps — "Preparing since 2:14pm" builds confidence.
- [ ] **ORDERS-15** — "Report" and "File claim" overlap conceptually — clarify when to use which.
- [ ] **ORDERS-16** — Cancel fee threshold (`startsSoon = startDate <= todayISO(2)`) is a rough proxy for "48h" — make it a real hour-level check.
- [ ] **ORDERS-17** — Extend modal blocks hourly bookings entirely — offer one-tap re-book from there.
- [ ] **ORDERS-19** — `ownerRatingOfMe ?? 5` — a missing owner rating silently shows 5 stars. Misleading.
- [ ] **ORDERS-20** — Rating is per-item but review text "applies to each item" — allow per-item notes.
- [ ] **ORDERS-22** — Completed orders show "+N PapaPoints earned" with no link to where points went.
- [ ] **ORDERS-24** — Cancelled orders show fee/refund inline but no receipt/breakdown link.
- [ ] **ORDERS-25** — No notification tie-in on the card ("we'll notify you when it ships").
- [ ] **ORDERS-26** — `downloadReceipt` — verify it works in Android WebView (blob download from `appassets` can fail silently). Offer share/email fallback.
- [ ] **ORDERS-28** — Receipt is per-order; no monthly statement.
- [ ] **ORDERS-29** — Claim amount defaults to `min(10000, maxAmount)` with no guidance on typical payouts.
- [ ] **ORDERS-30** — Claim offers 4 canned reasons and one amount field — no photo upload, the crux of a real damage claim.
- [ ] **ORDERS-32** — `hasClaim` blocks a second claim on the whole order — a multi-item order might need two.
- [ ] **ORDERS-33** — Every `OrderCard` mounts 5 conditional modals; whole list re-renders on any store change — memoize cards by order id + status.
- [ ] **ORDERS-34** — `getItem`/`getOwner` called repeatedly per line per render.
- [ ] **ORDERS-35** — Timeline + route SVG animate continuously off-screen — pause when not visible.
- [ ] **ORDERS-36** — No virtualization for long order histories.
- [ ] **ORDERS-37** — Timeline steps convey state by color + filled bubble — add `aria-current` and text ("step 3 of 6").
- [ ] **ORDERS-38** — Action buttons wrap with no logical grouping for screen readers.
- [ ] **ORDERS-39** — Animated transit dot has no reduced-motion guard.
- [ ] **ORDERS-40** — PIN is visually prominent but not labeled for screen readers ("handover PIN 4821").
- [ ] **ORDERS-41** — "updates automatically" hints at the simulation — reword to sound like real logistics.
- [ ] **ORDERS-42** — "Owner is inspecting; deposit hold release is queued" is great copy — mirror that specificity in requested/confirmed states.
- [ ] **ORDERS-43** — Clarify deposit hold vs charge consistently with Cart.
- [ ] **ORDERS-44** — Reorder-from-history as a first-class flow.
- [ ] **ORDERS-47** — Per-order chat thread with the vendor, not just the owner globally.
- [ ] **ORDERS-48** — Post-shoot "return checklist" to reduce claims.
- [ ] **ORDERS-49** — Dispute/mediation state distinct from "reported".
- [ ] **ORDERS-50** — Log status-transition timestamps to later show real SLAs ("avg approval: 4 min").

### PROFILE (`ProfileView.tsx`)

46 open

- [ ] **PROFILE-1** — Profile is read-only — name/city set once in onboarding, never editable. Add "Edit profile".
- [ ] **PROFILE-2** — "ID Verified" badge always shown regardless of any verification — misleading.
- [ ] **PROFILE-3** — No avatar upload — everyone gets a generated `Avatar`.
- [ ] **PROFILE-4** — No phone/email fields, yet orders imply contactability and COD implies a card on file.
- [ ] **PROFILE-5** — No logout / account / switch-account concept.
- [ ] **PROFILE-7** — "+ Top up Rs 10,000" adds free money with no payment step — wire to a real flow or at least a confirm.
- [ ] **PROFILE-8** — Only one fixed top-up amount — add custom amounts.
- [ ] **PROFILE-10** — `useCountUp` animates balance but there's no breakdown of credit vs cash.
- [ ] **PROFILE-11** — Refunds land in wallet but there's no way to withdraw to bank.
- [ ] **PROFILE-12** — Tier perks explained in a wall of muted text — make perks a scannable list with checkmarks.
- [ ] **PROFILE-13** — No points history (earned/redeemed).
- [ ] **PROFILE-14** — Gold/Silver thresholds duplicated in two panels (progress + perks) — consolidate.
- [ ] **PROFILE-15** — No "how to earn faster" prompts (refer, complete profile, first review).
- [ ] **PROFILE-16** — Profile is a long stack of `list-row`s mixing navigation, data and forms — group into You / Money / Hosting / Activity / Support.
- [ ] **PROFILE-19** — Apply the Dashboard's "actionable count" treatment to Chats/Offers.
- [ ] **PROFILE-20** — Wishlist appears here and in Browse — ensure one canonical place.
- [ ] **PROFILE-21** — Referral copies to clipboard, but `navigator.clipboard` often fails in Android WebView — add visible code + share-sheet fallback.
- [ ] **PROFILE-22** — Redeem box accepts any `PAPA-` code and instantly credits Rs 500 — no single-use enforcement beyond `referralRedeemed`. Exploitable.
- [ ] **PROFILE-23** — No referral tracking ("3 friends joined, Rs 1,500 earned").
- [ ] **PROFILE-24** — Refer and redeem are separate — unify into one "Referrals" screen.
- [ ] **PROFILE-25** — "Your listings" shows status badges but no inline quick actions (pause/edit/boost).
- [ ] **PROFILE-26** — No earnings snapshot in Profile — surface "Rs X earned this month".
- [ ] **PROFILE-27** — Verifying state has no ETA or "what's next".
- [ ] **PROFILE-28** — No way to un-pause a listing from here.
- [ ] **PROFILE-29** — "Your reports" lists case numbers/status with no way to view details or add evidence.
- [ ] **PROFILE-30** — "Blocked" owners can't be unblocked from this list — display-only.
- [ ] **PROFILE-31** — No privacy/data controls (download my data, delete account).
- [ ] **PROFILE-32** — A new user sees 0/0/0 tiles and lots of "None yet" — design a welcoming empty profile that guides first actions.
- [ ] **PROFILE-33** — `myRating` defaults to 5.0 with zero completed orders — "5.0 · 0 completed" implies a rating that doesn't exist. Show "New renter".
- [ ] **PROFILE-34** — Many `list-row`s look identical whether tappable or not — give tappable rows a consistent chevron.
- [ ] **PROFILE-35** — Wallet card, stat tiles and panels use different visual languages — align to one card system.
- [ ] **PROFILE-36** — Perks paragraph mixes bold inline — convert to a definition list.
- [ ] **PROFILE-37** — Long city names / titles — verify truncation in the owner row.
- [ ] **PROFILE-38** — Click-`div` `list-row`s aren't buttons — no keyboard/focus/role.
- [ ] **PROFILE-39** — Stat tiles convey meaning by icon — ensure number+label association is read correctly.
- [ ] **PROFILE-40** — Referral toast is the only copy feedback — add an inline "Copied ✓" state for screen readers.
- [ ] **PROFILE-41** — Progress bar has no `role="progressbar"` / aria values.
- [ ] **PROFILE-42** — Top-up toast and balance count-up feel disconnected — animate the "+10,000" into the balance.
- [ ] **PROFILE-43** — Tier-up should be celebrated when a purchase crosses a threshold — currently silent.
- [ ] **PROFILE-44** — "renter rating" — move the "this is how owners see you" explanation next to the stars.
- [ ] **PROFILE-45** — "Filmmaker" fallback name is inconsistent with onboarding's "What should we call you?" — reuse the same default.
- [ ] **PROFILE-46** — Perks panel says perks apply "automatically" — make Cart's perk lines link back here so the loop is visible.
- [ ] **PROFILE-47** — Verification center (ID, phone, payment) that actually unlocks the promised "instant-book on premium gear".
- [ ] **PROFILE-48** — Saved crew/collaborators so producers can share a wallet or approve on someone's behalf.
- [ ] **PROFILE-49** — Notification preferences tied to the existing notification center.
- [ ] **PROFILE-50** — Public profile / renter reputation page owners can view — the two-way rating system is begging for it.

---

## 8. Explicitly deferred — do NOT start

The user has deferred these until the entire 250-item list is complete:

- The warm, non-pure-white background palette
- A more welcoming overall vibe

Do not start either early, and do not partially implement them while doing other
items.
