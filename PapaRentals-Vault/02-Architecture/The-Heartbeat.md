---
title: The Heartbeat
tags: [architecture, decision]
area: architecture
---

# The Heartbeat

With no server, nothing would ever happen after you pressed a button. `TICK` is
the action that makes time pass. It fires on an interval and walks a list of
things that are now due.

## What the heartbeat drives

1. **Offer verdicts** — an owner accepts, counters or declines
2. **Chat replies** — vendors, support and drivers answer, each in their own register
3. **Request-to-book approvals** — `requested` → `confirmed`
4. **Report escalation** — `under_review` → `mediation` → `resolved`
5. **Referral conversions** — friends sign up, then complete a first rental and pay out
6. **Listing lifecycle** — a new listing verifies, then gets a first inquiry
7. **Order progression** — `autoAdvanceAt` steps an order along the delivery timeline
8. **Claim progression** — `filed` → `reviewing` → `approved`

## Design rules

> [!important] One code path per transition
> A transition must behave identically whether a human triggered it or the
> heartbeat did. There were once **two** routes from `requested` to `confirmed`
> — the manual step and the heartbeat — and only one of them set `statusAt`, so
> an auto-approved order showed no "Confirmed since" time while an identical
> hand-advanced one did. Fixed; do not reintroduce.

> [!warning] Simulation must be invisible to the user
> No user-facing string may reveal that progression is simulated. The "Skip
> ahead (demo)" control is gated behind `import.meta.env.DEV` and does not exist
> in the production bundle. This is verified, not assumed — see [[Verification]].

## Related

- [[State-Model]]
- [[Orders-and-Delivery]]
