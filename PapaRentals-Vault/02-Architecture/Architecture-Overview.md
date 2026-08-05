---
title: Architecture Overview
tags: [architecture]
area: architecture
---

# Architecture Overview

```
main.tsx
  └── App.tsx ────────── route switch + bottom nav + onboarding gate
        ├── nav.tsx ──── hash routing: View union, viewToHash, parseHash, go()
        ├── store.tsx ── useReducer + Context, persisted to localStorage
        ├── views/ ───── one file per screen
        ├── components/ shared UI
        └── data/ ────── static catalog, promos, services, images
```

## The three pillars

**[[Routes|Routing]] — `nav.tsx`.** Hash-based, no router library. A `View`
discriminated union is the single source of truth for what a screen needs;
`viewToHash` and `parseHash` are inverses of each other. Navigate with `go(view)`.

**[[State-Model|State]] — `store.tsx`.** One `useReducer` over a single `AppState`
object, exposed through Context as `useStore()`. Every mutation is a typed
action. The whole tree is serialised to `localStorage['papa-rentals-v2']` on
change, and read back through `migrate()` on load.

**[[File-Map|Views]] — `views/*.tsx`.** One default-exported component per screen.
Views read `state` and dispatch actions; they never own domain state themselves.

## Why no backend

This is a demo built to be shown, not operated. The consequence is that
everything a server would normally do has to be modelled honestly in the client:

- **Time passing** is the `TICK` action — see [[The-Heartbeat]].
- **Other people acting** (owners approving, drivers driving, friends signing up)
  is simulated on that same heartbeat, using the same code paths a real event
  would take.
- **Money** is real state with a real ledger, even though no money moves.

> [!important] The rule that keeps this honest
> Simulated *events* are fine. Simulated *facts* are not. A referral friend can
> be invented on the heartbeat, but the Rs 500 they earn must be a real ledger
> row you can go and check — otherwise the screen is just asserting a number.

## Persistence and migration

`localStorage` is a few megabytes for the entire app — orders, chats, ledger,
avatars, everything. That budget is why avatars are downscaled before storage
(see [[Profile-and-Identity]]).

`migrate()` in `store.tsx` upgrades saved state from older shapes. It is
append-only in spirit: a returning user must never lose data or silently have a
preference reset. Notification preferences, for example, are read out of the old
settings key on first load rather than defaulting everyone back on.

## Related

- [[State-Model]] — every key in `AppState`
- [[The-Heartbeat]] — how simulated time works
- [[Performance-Notes]] — what the WebView forces
