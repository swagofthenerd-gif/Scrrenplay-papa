---
title: Session Log
tags: [history, moc]
area: history
updated: 2026-08-04
---

# Session Log

Newest first. Full history: `git log` on `claude/papa-rentals-backlog-stm370`
(113 commits ahead of `main`).

---

## Session — Closing the backlog (2026-08-04)

**Branch** `claude/papa-rentals-backlog-stm370` · **PR** #16 (draft) ·
**Result** 250/250 closed

Worked the ORDERS section in the handoff's priority order, then PROFILE, then the
last CART item. 18 commits.

### ORDERS
- `58b30bf` **Transit map made real** — the dashed squiggle on a 3.4s loop became
  the actual pickup area, destination and ETA-derived van position.
  [[Orders-and-Delivery]]
- `922a033` **Audit commit, no code** — ORDERS 7, 24, 26, 28, 38, 48 were already
  built and never ticked. Each verified before ticking.
- `6f0768a` **Driver chat** — per-delivery threads; collapsed three duplicate
  name lookups into `threadPeer`. [[Messaging]]
- `643f25d` **Per-item review notes** — one field had been publishing the same
  sentence as a review of every item in the order.
- `1ef0340` **Order-scoped vendor threads** — two rentals from one vendor no
  longer merge.
- `924c45b` **Status transition log** — plus a bug: the heartbeat's approval path
  set no `statusAt` at all.
- `0dc3f3c` **Deferred order history** — five cards eager, the rest on approach,
  <1% height drift.
- `aec394b` **Dispute states** — `under_review` → `mediation` → `resolved`.

### PROFILE
- `1600d90` **Downloads work in the WebView** — two of three were dead buttons.
  Also dropped an invented `#b42318` behind a non-existent `--danger` token.
- `a663c2b` **Referrals unified** — one screen, with tracking that writes real
  ledger rows. [[Money-Wallet-and-Points]]
- `de921ab` **Header copy** — "what owners see" beside the stars; one name
  fallback instead of three; city truncation.
- `1becd62` **Points loop** — tier-up celebrated, earn-faster prompts, top-up
  delta animating into the balance.
- `95e738e` **Case detail + evidence** — mediation asked for your side with
  nowhere to put it. [[Trust-Safety-and-Disputes]]
- `3aab6ff` **Perk lines link back** to the panel that grants them.
- `82c2dcc` **Notification toggles made real** — read nowhere outside their own
  screen; also fixed copy promising order alerts couldn't be disabled while
  offering a switch that disabled them.
- `2b0a716` **Avatar upload** — downscaled to 256px JPEG for the storage budget.
- `6827fc5` **Verification centre** — made the long-standing "unlocks
  instant-book on premium gear" promise actually true. [[Profile-and-Identity]]
- `2e06dad` **Public renter profile** at `#/me`.
- `036732b` **Crew + one card system.**

### CART
- `2b23b34` **Split payment** — a third now, the balance the day before pickup.

### Corrections made in-session
- `036732b`'s message claimed the backlog was closed while CART-43 was still
  open. Corrected in `2b23b34`'s message rather than silently re-ticking.
- One verification script was flaky one run in three — the **test** was wrong,
  not the code. See [[Traps]].

---

## Earlier sessions

Condensed from commit history.

**Profile IA** (`ef0e9e4`, PR #14) — first-run setup that offers something to do,
earnings on the hosting row, grouped sections, scannable perks, hourly bookings
given a way forward.

**Browse + Home redesign** (`2815bb3`, PR #13) — Home cut from nine screens to
under four, explanatory copy stripped so the drawings talk, the filmic grade and
paper texture shipped, cart and orders backlogs worked, Browse closed out with
stock warnings, watches, skeletons and the proximity map.

**Vendor home + vault wiring** (`67c4287`, PR #12) — Capacitor Android wrapper
added, unmet searches surfaced to hosts as a demand signal, theme choice made
explicit rather than inherited, kits made openable, saved searches added.

**Foundations** — the 250-item backlog written down after being lost to context
compaction once; the project skill added; hash routing, the store, the catalog
and the design system established.

## Related

- [[Backlog-Index]]
- [[Decisions]]
