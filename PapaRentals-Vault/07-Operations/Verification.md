---
title: Verification
tags: [operations, invariant]
area: operations
---

# Verification

## The rule

> [!important] Assert on behaviour, never on presence
> "The element exists" proves nothing. Assert that a request card navigates to
> `#/item/i1`, that the van's x-coordinate increases with elapsed ETA, that a
> muted notification never enters state. A test that would still pass with the
> feature removed is not a test.

Nothing is ticked in the backlog without being driven headless against the
**built** bundle.

## Setup

```bash
npm run build
npx vite preview --port 4173 &
```

Drive with `playwright-core`, launching Chromium directly. In this container:
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

To skip onboarding, seed `localStorage` then **reload** — the running app
persists its in-memory state straight back over anything injected without one:

```js
raw.profile = Object.assign({}, raw.profile, { name:'Test', city:'Lahore', onboarded:true })
await page.reload()
```

## Techniques worth reusing

**Reproduce the WebView.** Stub `URL.createObjectURL` to throw and `window.open`
to return null, then assert the fallback still renders. This is how the dead
download buttons were found.

**Capture blob contents.** `downloadOrShow` uses a detached `<a>`, so there is
nothing in the DOM to assert on. Override `URL.createObjectURL` to record what
the blob held.

**Prove a range, not a point.** Seed three orders at three ETAs and assert the
van's position *increases* — a single position proves only that a number was
rendered.

**Check the negative.** The public profile test asserts the wallet balance is
*absent*. Half of that feature's value is what it refuses to show.

## Traps in the harness itself

> [!warning] Scope lookups to the row that owns them
> Indexing `.tmap` positionally failed one run in three because three seeded
> orders shared a `createdAt` and the newest-first sort tied. The code was fine.

> [!warning] Suspect the measurement first
> A "list-row intercepts pointer events" failure was the modal's entry animation.
> `elementFromPoint` at the button's centre returned the button at every viewport
> tested.

## Current suites

22 scripts covering the ORDERS, PROFILE and CART work of the final session — the
transit map, driver chat, per-item reviews, deferred order history, order-scoped
threads, status logging, dispute states, notification preferences, avatars,
verification gating, the public profile, crew, the card system and split payment.
All green at commit `2b23b34`.

## Related

- [[Build-and-Deploy]]
- [[Traps]]
