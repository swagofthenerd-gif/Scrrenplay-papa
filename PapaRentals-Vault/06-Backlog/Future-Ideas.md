---
title: Future Ideas
tags: [backlog]
area: backlog
---

# Future Ideas

Not backlog items — things noticed while the backlog was being closed.

## Deferred by the user

**The warm palette / "more welcoming vibe" work.** Explicitly deferred until the
250 items were done. They now are, so this is the next thing on deck. It was held
back deliberately: re-tinting the whole app while fifty behavioural items were
still open would have made every screenshot comparison useless.

## Found while working

**Tier thresholds are unbalanced.** A Rs 181,000 order earns 1,810 points, taking
a new renter from Bronze past Silver into Gold in one booking. Silver is
effectively unreachable for anyone renting real gear. Economy balance, not a bug.
See [[Money-Wallet-and-Points]].

**`CartView.tsx` is 1176 lines.** It holds the cart, line editor, totals
presentation, address and card selection, and the review sheet. Nothing is wrong
with it, but it is the one file where finding a thing is genuinely slow.

**The bundle is 553 KB** (173 KB gzipped) in a single chunk, and Vite warns about
it on every build. Route-level code splitting would be the obvious move — most
users never open the host dashboard or the listing form.

**No automated test suite in the repo.** Verification is 22 ad-hoc Playwright
scripts written per feature and kept outside the repo. Promoting them to a
committed suite that CI could run would make the [[Verification]] discipline
survive a session boundary.

**No CI on pull requests.** Both workflows are push-to-main only, so a PR shows
zero checks. See [[Build-and-Deploy]].
