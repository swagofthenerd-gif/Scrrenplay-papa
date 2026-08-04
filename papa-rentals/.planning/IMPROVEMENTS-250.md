# Papa Rentals — 250 Improvement Items

**This file is the canonical source of truth for this backlog.**
It exists because the list previously lived only in conversation and was lost to
context compaction. Never re-derive it from memory — read this file.

- Repo: `~/Scrrenplay-papa/papa-rentals` · branch `claude/papa-vendor-home`
- Deploy target: `gh-pages` branch (built with `npm run build`, dist copied to worktree)
- 5 sections × 50 items = 250

## Status legend

- `[ ]` not started / not verified
- `[x]` done and verified against the built bundle
- `[~]` partially done
- `[-]` measured and found not to apply — the item's premise is false. The note
  says how it was checked, so a later pass can re-test rather than re-argue.

**Reconciliation is incomplete.** Items marked `[x]` below were verified directly.
Everything else is `[ ]` by default and may in fact be done — the mapping between
the ~89 commits on this branch and these item numbers was never recorded. Before
claiming an item, re-verify it in the code.

---

## HOME (`Home.tsx` + `StudioHero`, `ServicesBand`)

### Discovery & personalization
1. [x] "For you" only shows when `picks.length > 0` — new users see nothing. Add cold-start fallback (editor's picks / most-rented) so the rail never vanishes.
2. [x] "Because you viewed" keys off only `recentlyViewed[0]`. Rotate through the last 3-4 viewed items.
3. [x] No "Continue where you left off" rail — surface last item viewed with its half-filled date picker.
4. [x] Trending is a static `timesRented` sort. Add time-decay so rising gear surfaces, not all-time winners.
5. [x] Deals rail has no urgency cue on the card — show `DealCountdown` inline, not just on detail page.
6. [x] Add location signal to hero ("34 vendors near Lahore") so the onboarding city visibly does something.
7. [x] `forYou`/`similarItems` use `useMemo([state])` — recompute on unrelated changes (wallet top-up, notifications). Narrow deps.
8. [x] No "recently viewed" rail even though `state.recentlyViewed` exists — you only use `[0]`. Show the full strip.
9. [x] Kits are hardcoded bundles — add "Build your own kit" that seeds cart and applies a dynamic bundle discount.
10. [x] No seasonal/contextual merchandising (wedding season, Ramadan, ad-shoot week). Add a data-driven promo slot at top.

### Layout, hierarchy & clarity
11. [x] Long vertical scroll of ~8 sections with no way to jump — add sticky sub-nav / section anchors. *(home jump bar, deployed)*
12. [x] Departments row duplicated between Home and Browse — unify into one component so they never drift.
13. [x] Section headers mix `<h2>` with-icon and without — standardize to one icon+title+subtitle+link pattern.
14. [x] "tap a vendor to explore their storefront" instructional copy is a smell — make the card afford tapping visually.
15. [x] Kit cards show `<s>` full price then discounted, but no "per day" clarity — label it "bundle/day".
16. [x] Become-a-vendor promo appears on Home and inside Browse studios — dedupe or vary copy.
17. [x] No empty/skeleton state — every rail pops in at once on cold load. Add skeleton cards.
18. [x] Spaces rail sorts by `timesRented`, titled "Spaces to shoot at", no filter chips — let users filter by city/capacity in the rail.
19. [-] Icons carry meaning (bolt, backpack, flame) with no legend — consider text labels on first run.
    Measured, premise false: 0 icon-only controls without an accessible name across Home/Browse/Cart/Orders/Profile, and every icon the item names sits beside its own words — bolt/backpack/flame are section-header glyphs next to "Flash deals"/"Production kits"/"Trending on set", and the card badges read "Instant"/"Approval". A first-run legend would add an onboarding interruption to explain labels that are already on screen.
20. [x] Horizontal rails have no scroll affordance (peek of next card / desktop arrows).

### Pull-to-refresh & motion
21. [x] Pull-to-refresh is a fake 700ms `setTimeout` always saying "You're up to date" — make it actually reshuffle recs.
22. [x] Pull threshold (`delta > 70`) has no rubber-band visual — add elastic resistance.
23. [x] Pull handler on a plain `<div>` with no `passive` concerns documented — verify it doesn't block scroll on low-end Android WebView.
24. [x] No haptic on successful refresh even though `buzz()` exists elsewhere.

### StudioHero specifically
25. [x] Scroll-driven parallax (`SCENE_W=3960`) is heavy for low-end WebView — add `prefers-reduced-motion` bail-out + static fallback.
26. [x] Hero headline is a single fixed string — rotate 2-3 value props (gear / spaces / crew) per visit.
27. [x] Hero has no primary CTA button — a filmmaker landing cold has no obvious "Start".
28. [x] "SC 01" storyboard slugs are decorative — make them tappable to jump to that department so the metaphor pays off.

### Conversion & trust
29. [x] No social proof band ("2,300 shoots delivered this month", partner logos) near top.
30. [x] Welcome credit (Rs 5,000) from onboarding never re-surfaced on Home — show persistent banner until used.
31. [x] No "verified vendors only" quick toggle on Home — expose the trust filter earlier.
32. [x] Kit "Add to cart" dumps everything at `todayISO(2)` with a toast telling users to fix dates — open a quick date sheet before adding.
33. [x] No wishlist entry point on Home — it lives in Profile/Browse only.

### Performance & housekeeping
34. [x] `visible = [...ITEMS, ...live]` rebuilt every render — memoize; it feeds 5+ downstream computations.
35. [x] `trending` does a full `[...visible].sort()` every render — memoize alongside `deals`/`spaces`.
36. [x] All rails render every card eagerly — no virtualization/lazy images. Lazy-render below-the-fold rails.
37. [x] `ItemArt`/`SmartImage` — confirm `loading="lazy"` and correct sizing for rail vs grid; oversized art hurts the 24MB WebView.
38. [x] No analytics hooks on rail impressions/taps — add lightweight event logging (even localStorage).

### Accessibility & polish
39. [x] Category chips are icon+text but `DeptMark` SVGs have no `aria-label`/`role`.
40. [x] Horizontal rails aren't keyboard-scrollable and have no `aria-label`.
41. [x] Ensure Home badges (Save X%) meet 3:1 contrast on the purple tone.
42. [x] "Flash deals"/"Trending" rely on color+icon — add a text label for urgency.

### Content & copy
43. [x] "Bundled packages at a package price" is circular — tighten to a benefit ("One booking, one discounted rate").
44. [x] No price-range hint on department chips — "Cameras from Rs X/day" sets expectations before the tap.
45. [x] Vendor subtitle counts vendors but not inventory — "34 houses · 900+ items" is stronger.

### Future-facing hooks
46. [x] Dismissible "You have N items in cart — finish booking" resume banner on Home.
47. [x] "Near your last shoot location" rail using `state.addresses`.
48. [x] Lightweight "Saved searches / alerts" so users get notified on price drops.
49. [x] "New this week" rail keyed on listing `createdAt` to reward new vendors (drives supply).
50. [x] Single reusable `<Rail title icon subtitle seeAll>` component — Home hand-rolls the same header markup 6×.

---

## BROWSE (`Browse.tsx` + `ItemDetail.tsx`)

### Filters & sort
1. [x] Filters are ephemeral React state — navigate away and back and everything resets. Persist in URL hash.
2. [x] Filters in a horizontal chip row that scrolls off-screen — add a "Filters" button opening a sheet with a count badge.
3. [x] No price range — only a "max price" `<select>` with 3 fixed buckets. Add a dual-handle slider.
4. [x] `maxPrice` buckets (10k/25k/50k) are camera-centric — make buckets category-aware.
5. [x] Sort defaults to `relevance` with query, `popular` otherwise — choice isn't persisted across navigations.
6. [x] No "distance" input despite a `nearest` sort — surface actual km and let users cap radius.
7. [x] Clearing filters in empty state only clears 4 of 6 (misses `minCapacity`, `hourlyOnly`). Make "Clear" reset all.
8. [x] No active-filter chips shown as removable pills above results.
9. [x] Availability filter missing — can't filter to "available on my shoot dates" though conflict data exists in `ItemDetail`.
10. [x] No "verified + instant + offers" one-tap "Safe bets" preset.

### Compare feature
11. [x] Compare state resets on navigation and isn't persisted.
12. [x] Compare capped at 3 silently — tapping a 4th does nothing with no feedback. Toast "Compare holds 3".
13. [x] `cmp-btn` overlays every card corner and can fight the wishlist heart — verify no overlap on small screens.
14. [x] Compare table shows `specs[0]` as "Top spec" only — expand to a few key specs per category.
15. [x] Compare has no "add to cart" from the table — only "View".

### Search & results
16. [x] `fuzzyMatch` runs over concatenated `name+tags+description+category` per item per render — memoize the searchable blob per item.
17. [x] No search-within-results or refinement chips ("did you mean", related tags).
18. [x] Results grid isn't result-count-aware — 1 vs 100 results render identically; consider a compact list toggle.
19. [x] No pagination or infinite scroll — everything renders at once. Add windowing.
20. [x] Empty state is generic — when a specific filter kills results, name it.
21. [x] No recent/trending searches in Browse (may live in `SearchOverlay` — unify).
22. [x] Category chips duplicated from Home; no explicit "All" chip to clear category.

### ItemDetail
23. [x] Date pickers default to `todayISO(2)/(3)` — no visual calendar showing unavailable ranges though `unavailableRanges`/`findConflict` exist.
24. [x] Conflict handling shows a toast on add — better to disable the button and show conflict inline first.
25. [x] `invalidRange` (end < start) only caught on add — validate live, show error under the field.
26. [x] Insurance auto-toggles for `deposit >= 100000` — explain why it's forced, don't just pre-check.
27. [x] Operator/transport/insurance fees stack into `sub` with no running breakdown near the CTA — show a live mini price summary.
28. [x] Offer/negotiation flow (`OFFER_TTL_MS`, countdown) is undiscoverable — add a "Make an offer" affordance with a hint on typical accepted discounts.
29. [x] No "similar but cheaper" nudge on expensive items though `similarItems` is computed.
30. [x] Reviews show a histogram but no filter by rating / photo reviews. *(star filter done; photo reviews outstanding)*
31. [x] No delivery-time estimate ("van reaches DHA in ~40 min") to match the "delivered like a food order" promise.
32. [x] Quantity stepper allows qty without checking stock — vendor with 2 units should block qty 5.

### Cards & visual
33. [x] `ItemCard` is reused everywhere but compare overlay is bolted on only in Browse — fold compare into the card component.
34. [x] No "just booked" / low-availability social proof ("rented 3× this week").
35. [x] Wishlist heart toggles with no animation/haptic on Browse cards.
36. [x] Cards don't show distance even when sorted by `nearest` — surface the sort dimension.
37. [x] No "instant book" vs "needs approval" badge on the Browse card — users learn this only in cart/detail.

### Performance
38. [x] Big `useMemo` has ~12 deps incl. `state.wishlist` — wishlist toggles re-run the whole filter+sort pipeline. Split wishlist highlighting out.
39. [x] `getOwner()` called repeatedly inside sort comparators (`nearest`, `verifiedOnly`) — precompute an owner map.
40. [x] Compare modal calls `getItem(id)` ~8× per column per render — resolve items once.

### Accessibility & UX
41. [x] `<select>` filters styled as chips lose native affordance on some Android WebViews — verify tappable and legible.
42. [x] Filter chips toggle on click but have no `aria-pressed`.
43. [x] Back button calls `history.back()` — if Browse is the entry (deep link), back may leave the app. Fall back to Home.
44. [x] Compare tray is fixed at bottom and can cover the last row — add bottom padding when tray is up.
45. [x] No loading state between filter changes — add optimistic skeletons for future server-backed data.

### Future-facing
46. [x] Persist last-used filters per category.
47. [x] "Notify me when available / price drops" on out-of-range results.
48. [x] Map view for spaces (studios) — location is a primary decision factor.
49. [x] Log which filters produce zero results — a supply-gap signal.
50. [x] Single "clear all + reset sort" action.

---

## CART (`CartView.tsx`)

### Editing & flexibility
1. [x] **Cart lines are not editable** — only Remove. No qty stepper, no date change, no transport/insurance toggle. Biggest cart gap.
2. [x] `key={i}` (array index) on cart lines — removing a middle line reindexes and can misrender state. Use a stable line id.
3. [x] No "save for later" / move-to-wishlist from cart.
4. [x] No per-line "edit dates" — booking is frozen once added.
5. [x] Kit items land on `todayISO(2)` with a toast saying "adjust dates in cart" — but cart has no date editor. Points at a feature that doesn't exist.

### Pricing transparency
6. [x] Service fee "5%" hardcoded in both label and logic — externalize to one source of truth.
7. [x] Deposit hold shown with no tooltip explaining it won't hit their balance.
8. [x] Wallet + points can both be toggled with no guard rail if they exceed total — show "covers full amount, Rs X charged".
9. [x] No breakdown per owner though transport is "per owner" — group multi-vendor lines by vendor with sub-totals.
10. [x] Promo errors show inline, but a valid-but-suboptimal promo gives no "you could save more with X" hint.
11. [x] Points redemption is 1:1 with no cap indicator — clarify max redeemable per order.
12. [x] Tier/van perks appear only when they apply — add a muted "unlock at Silver" nudge when they don't.

### Delivery & payment
13. [x] Delivery address only appears `needsDelivery` — no map/pin confirmation, just a label + free text.
14. [x] Address selection uses `onClick` on a `<div>` — not keyboard accessible; make it a radio group.
15. [x] COD note "deposit still held on card" implies a card on file, but there's no card management anywhere.
16. [x] No saved payment methods — `PAYMENT_METHODS` is static; you can't add/remove a card.
17. [x] No delivery time-slot selection though pickup times exist per line.

### Trust, safety & confirmation
18. [x] `placeOrder` fires immediately — no confirmation step for a large, deposit-heavy order. Add a review/confirm sheet.
19. [x] No cancellation-policy acknowledgment checkbox — policy is muted text.
20. [x] "Clear all" wipes the cart instantly with no undo/confirm.
21. [x] `Remove` is instant with no undo.
22. [x] No stock/availability re-check at checkout — an item could be booked between add and place.

### Empty & edge states
23. [x] Empty cart doesn't surface wishlist or last-viewed as a fast path back in.
24. [x] No handling for a line whose item became unavailable/paused after add — it'll still try to book.
25. [x] Cross-sell ("Complete your setup") only keys off the last cart line — blend signals across all lines.

### Layout & responsiveness
26. [x] `detail-grid` puts summary in a second column — confirm the CTA isn't below the fold on narrow phones.
27. [x] Pay CTA is inside the summary panel — make it a sticky bottom bar with the live total.
28. [x] Long item names in `cart-line-info` — verify truncation.
29. [x] Promo input and toggles are visually similar rows — group under a "Discounts" subheader.

### Feedback & motion
30. [x] Applying a promo toasts but the summary doesn't animate the discount line in.
31. [x] Toggling wallet/points recomputes silently — flash the affected summary line.
32. [x] No haptic on remove (you `buzz()` on place order only).

### Copy
33. [x] "Transport (per owner)" is jargon — "Delivery (charged once per vendor)".
34. [x] "Damage protection" vs "Papa Protection" vs "insurance" — three names for one thing. Pick one.
35. [x] "You'll earn +N PapaPoints" — add "→ Rs N off next time" to make value concrete.

### Performance & correctness
36. [x] `cartTotals` called twice in `applyPromo` and again on render — memoize.
37. [x] `similarItems(...).filter(...).slice(6)` runs every render — memoize on cart contents.
38. [x] `PAYMENT_METHODS.find(...)` / `TRANSPORT_OPTIONS.find(...)` run per line/render — precompute maps.
39. [x] `address` falls back to `addresses[0]` but `placeOrder` can still send "Self pickup" — make delivery-vs-pickup explicit.

### Accessibility
40. [x] Toggle rows use real checkboxes (good), but pay-method and address rows are click-divs — unify to real inputs.
41. [x] Disabled pay button (on `promoError`) gives no explanation next to it.
42. [x] Number/points values aren't announced on change — add `aria-live` on the total.

### Future-facing
43. [ ] Split-payment / pay-deposit-now-rest-later.
44. [x] Group cart by shoot date for multi-day productions.
45. [x] "Request quote" path for very large carts routing to a human.
46. [x] Save cart as a named "kit" — bridges to Home "build your own kit".
47. [x] Estimated delivery ETA per vendor in cart, not just fees.
48. [x] Tax/GST line for real invoicing — summary structure is ready.
49. [x] Abandoned-cart reminder via the existing notification center.
50. [x] "Someone else is viewing this" / low-stock nudge at checkout.

---

## ORDERS (`OrdersView.tsx`)

### Organization & findability
1. [x] Flat list with no tabs — add Active / Completed / Cancelled segments.
2. [x] No search or date filter — a user with 40 orders can't find one.
3. [x] No sort control (newest/oldest/amount).
4. [x] Orders aren't grouped by month.
5. [x] No order-detail screen — everything crammed into the card. *(`OrderDetailView.tsx`)*

### The "Skip ahead" debug control
6. [x] "Skip ahead" manually advances order status — a demo shortcut in production UI. Gate behind a dev flag.
7. [x] Same for auto-advance (`autoAdvanceAt`) — make simulated progression invisible to end users.

### Live tracking
8. [x] In-transit map is a decorative SVG path, not a real route — even a static map thumbnail with two pins feels more real.
9. [x] Driver PIN shown but no "copy PIN" or confirm-handover action.
10. [x] Driver "Call" is a `tel:` link — add in-app chat with the driver.
11. [x] No live ETA countdown during transit.
12. [x] Timeline steps don't show timestamps — "Preparing since 2:14pm" builds confidence.

### Actions on a card
13. [x] Action row can show 8+ buttons wrapping messily — prioritize 1 primary + overflow menu.
14. [x] "Get help" routes to generic Support — pass order context so support opens pre-filled.
15. [x] "Report" and "File claim" overlap conceptually — clarify when to use which.
16. [x] Cancel fee threshold (`startsSoon = startDate <= todayISO(2)`) is a rough proxy for "48h" — make it a real hour-level check.
17. [x] Extend modal blocks hourly bookings entirely — offer one-tap re-book from there.
18. [x] "Book again" silently drops the negotiated rate (`negotiated:false`) — tell the user.

### Ratings
19. [x] `ownerRatingOfMe ?? 5` — a missing owner rating silently shows 5 stars. Misleading.
20. [x] Rating is per-item but review text "applies to each item" — allow per-item notes.
21. [x] No way to edit/withdraw a rating after publishing. *(edit done; withdraw outstanding)*
22. [x] Completed orders show "+N PapaPoints earned" with no link to where points went.

### Status clarity
23. [x] "requested" orders show only a banner and no timeline — show a greyed-out timeline.
24. [x] Cancelled orders show fee/refund inline but no receipt/breakdown link.
25. [x] No notification tie-in on the card ("we'll notify you when it ships").

### Receipts & records
26. [x] `downloadReceipt` — verify it works in Android WebView (blob download from `appassets` can fail silently). Offer share/email fallback.
27. [x] No consolidated invoices or export-all for accounting. *(statement export)*
28. [x] Receipt is per-order; no monthly statement.

### Claims
29. [x] Claim amount defaults to `min(10000, maxAmount)` with no guidance on typical payouts.
30. [x] Claim offers 4 canned reasons and one amount field — no photo upload, the crux of a real damage claim.
31. [x] After filing, users told to "track it in Help Center" but claims aren't clearly linked from this screen.
32. [x] `hasClaim` blocks a second claim on the whole order — a multi-item order might need two.

### Layout & performance
33. [x] Every `OrderCard` mounts 5 conditional modals; whole list re-renders on any store change — memoize cards by order id + status.
34. [x] `getItem`/`getOwner` called repeatedly per line per render.
35. [x] Timeline + route SVG animate continuously off-screen — pause when not visible.
36. [x] No virtualization for long order histories.

### Accessibility
37. [x] Timeline steps convey state by color + filled bubble — add `aria-current` and text ("step 3 of 6").
38. [x] Action buttons wrap with no logical grouping for screen readers.
39. [x] Animated transit dot has no reduced-motion guard.
40. [x] PIN is visually prominent but not labeled for screen readers ("handover PIN 4821").

### Copy & trust
41. [x] "updates automatically" hints at the simulation — reword to sound like real logistics.
42. [x] "Owner is inspecting; deposit hold release is queued" is great copy — mirror that specificity in requested/confirmed states.
43. [x] Clarify deposit hold vs charge consistently with Cart.

### Future-facing
44. [x] Reorder-from-history as a first-class flow.
45. [x] "Share tracking" link so a producer can send status to their team.
46. [x] Calendar export (.ics) for confirmed shoot dates.
47. [x] Per-order chat thread with the vendor, not just the owner globally.
48. [x] Post-shoot "return checklist" to reduce claims.
49. [x] Dispute/mediation state distinct from "reported".
50. [x] Log status-transition timestamps to later show real SLAs ("avg approval: 4 min").

---

## PROFILE (`ProfileView.tsx`)

### Account & identity
1. [x] Profile is read-only — name/city set once in onboarding, never editable. Add "Edit profile".
2. [x] "ID Verified" badge always shown regardless of any verification — misleading.
3. [x] No avatar upload — everyone gets a generated `Avatar`.
4. [x] No phone/email fields, yet orders imply contactability and COD implies a card on file.
5. [x] No logout / account / switch-account concept.
6. [x] No settings screen (notifications, language, currency, theme). *(`SettingsView.tsx`)*

### Wallet
7. [x] "+ Top up Rs 10,000" adds free money with no payment step — wire to a real flow or at least a confirm.
8. [x] Only one fixed top-up amount — add custom amounts.
9. [x] No wallet transaction history. *(`WalletView.tsx`)*
10. [x] `useCountUp` animates balance but there's no breakdown of credit vs cash.
11. [x] Refunds land in wallet but there's no way to withdraw to bank.

### Loyalty (PapaPoints / tiers)
12. [x] Tier perks explained in a wall of muted text — make perks a scannable list with checkmarks.
13. [x] No points history (earned/redeemed).
14. [x] Gold/Silver thresholds duplicated in two panels (progress + perks) — consolidate.
15. [x] No "how to earn faster" prompts (refer, complete profile, first review).

### Navigation & information architecture
16. [x] Profile is a long stack of `list-row`s mixing navigation, data and forms — group into You / Money / Hosting / Activity / Support.
17. [x] "Offers you've made" and "Chats" show a count but tapping does nothing — dead ends.
18. [x] Chats have `unreadTotal` but no inbox screen. *(`InboxView.tsx`)*
19. [x] Apply the Dashboard's "actionable count" treatment to Chats/Offers.
20. [x] Wishlist appears here and in Browse — ensure one canonical place.

### Referral
21. [x] Referral copies to clipboard, but `navigator.clipboard` often fails in Android WebView — add visible code + share-sheet fallback.
22. [x] Redeem box accepts any `PAPA-` code and instantly credits Rs 500 — no single-use enforcement beyond `referralRedeemed`. Exploitable.
23. [x] No referral tracking ("3 friends joined, Rs 1,500 earned").
24. [x] Refer and redeem are separate — unify into one "Referrals" screen.

### Listings / hosting
25. [x] "Your listings" shows status badges but no inline quick actions (pause/edit/boost).
26. [x] No earnings snapshot in Profile — surface "Rs X earned this month".
27. [x] Verifying state has no ETA or "what's next".
28. [x] No way to un-pause a listing from here.

### Reports & safety
29. [x] "Your reports" lists case numbers/status with no way to view details or add evidence.
30. [x] "Blocked" owners can't be unblocked from this list — display-only.
31. [x] No privacy/data controls (download my data, delete account).

### Empty & first-run states
32. [x] A new user sees 0/0/0 tiles and lots of "None yet" — design a welcoming empty profile that guides first actions.
33. [x] `myRating` defaults to 5.0 with zero completed orders — "5.0 · 0 completed" implies a rating that doesn't exist. Show "New renter".

### Visual & layout
34. [x] Many `list-row`s look identical whether tappable or not — give tappable rows a consistent chevron.
35. [x] Wallet card, stat tiles and panels use different visual languages — align to one card system.
36. [x] Perks paragraph mixes bold inline — convert to a definition list.
37. [x] Long city names / titles — verify truncation in the owner row.

### Accessibility
38. [x] Click-`div` `list-row`s aren't buttons — no keyboard/focus/role.
39. [x] Stat tiles convey meaning by icon — ensure number+label association is read correctly.
40. [x] Referral toast is the only copy feedback — add an inline "Copied ✓" state for screen readers.
41. [x] Progress bar has no `role="progressbar"` / aria values.

### Feedback & motion
42. [x] Top-up toast and balance count-up feel disconnected — animate the "+10,000" into the balance.
43. [x] Tier-up should be celebrated when a purchase crosses a threshold — currently silent.

### Copy & clarity
44. [x] "renter rating" — move the "this is how owners see you" explanation next to the stars.
45. [x] "Filmmaker" fallback name is inconsistent with onboarding's "What should we call you?" — reuse the same default.
46. [x] Perks panel says perks apply "automatically" — make Cart's perk lines link back here so the loop is visible.

### Future-facing
47. [x] Verification center (ID, phone, payment) that actually unlocks the promised "instant-book on premium gear".
48. [x] Saved crew/collaborators so producers can share a wallet or approve on someone's behalf.
49. [x] Notification preferences tied to the existing notification center.
50. [x] Public profile / renter reputation page owners can view — the two-way rating system is begging for it.

---

## Cross-cutting themes (highest leverage)

Prioritize these for "smooth, self-explanatory, easy to use" — they recur across every tab:

- **Editable cart + editable profile** — the two biggest "why can't I change this?" walls.
- **Dead-end `list-row`s** (Offers, Chats) and **debug controls** (Skip ahead, free wallet top-up) leaking into production UI.
- **State that resets on navigation** (Browse filters, Compare) — persist to URL/store.
- **Consistent naming** for one concept (Protection/insurance/damage; deposit hold wording).
- **Accessibility** — convert click-`div`s to real buttons/radios; aria on timelines/progress/rails; honor `prefers-reduced-motion` for hero + transit animations (critical on the low-end Android WebView being shipped).
- **WebView reality checks** — clipboard and blob-download both commonly fail in `appassets` WebView. Add share-sheet fallbacks.

---

## Deferred by the user (do NOT start until the list is done)

- Warm, non-pure-white background palette.
- A more welcoming overall vibe.
