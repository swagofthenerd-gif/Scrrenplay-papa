---
title: Orders and Delivery
tags: [feature, decision]
area: orders
---

# Orders and Delivery

## The timeline

`requested → confirmed → preparing → in_transit → in_use → returned → completed`,
plus `cancelled`. A request-to-book order starts at `requested`; an instant-book
one starts at `confirmed`.

Each status carries a hint that names **who is doing what and what happens
next**. The line the others are measured against is *"Returned — owner is
inspecting; deposit hold release is queued."* A status that only names itself
makes people refresh.

## Status logging  `#decision`

`statusAt` records when the *current* stage began. That answers "preparing since
when" and nothing else — the moment an order moved past approval, how long
approval took was gone.

`statusLog` appends every transition with its timestamp. The first payoff: a
request-to-book order shows the approval time it actually took. Instant-book
orders show nothing, because there was no approval step and "approved in 0 min"
would be dressing up something that never happened.

> [!warning] Two routes to `confirmed`
> The manual step and the heartbeat. Only one set `statusAt`, so an
> auto-approved order showed no "Confirmed since" while a hand-advanced one did.
> Both now log. See [[The-Heartbeat]].

## The transit map  `#decision`

`components/TransitMap.tsx`. The original was a dashed curve with a dot orbiting
it on a 3.4s CSS loop — the same picture at the same speed regardless of which
vendor the van left or how far out it was.

It now draws the two facts the order knows: the vendor area it was picked up
from, and the address it is going to. The van sits at the position the ETA
implies, with the travelled portion of the route filled in behind it.

> [!important] Schematic on purpose
> Vendors have an *area* and a *distance*, not coordinates. Drawing invented
> streets would claim a precision the data does not have. The blocks behind the
> route are very low contrast so they read as decoration.

Two details that matter: the SVG is `aria-hidden`, so origin, destination and
remaining distance are also stated as text. And losing the CSS loop stopped the
marker animating forever in a card that had scrolled off screen.

A multi-vendor order is one van doing a round, so the map names every pickup and
uses the **longest** leg — the run isn't done until the furthest vendor has been
collected.

## Driver contact  `#decision`

A `tel:` link was the only way to reach the driver, which is the wrong default on
a shoot: you are usually somewhere too loud to take a call, and "gate code is
4417, come round the back" wants to be written down. Message and Call now sit
side by side, both at 44px.

Threads are keyed `driver:<orderId>` — Thursday's driver is not Friday's. See
[[Messaging]].

## Reviews are per item  `#decision`

Rating was already per item, but the note was one field labelled "applies to each
item", and it did: renting a camera and a tripod published the same sentence as a
review of both, on two different listings. Each line now has its own note, blank
lines publish nothing, and notes are kept on the order so editing a typo doesn't
mean retyping the review.

## Receipts and statements

Per-order receipts and a monthly CSV statement. Both go through
`downloadOrShow()` — see [[Traps]] for why.

## Split payment  `#decision`

Pay a third at checkout, the balance the day before pickup. See
[[Cart-and-Checkout]].

## Related

- [[Trust-Safety-and-Disputes]] — claims and disputes on an order
- [[Messaging]] — driver and per-order vendor threads
- [[Performance-Notes]] — why long histories defer
