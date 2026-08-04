---
title: Hosting (Vendor Side)
tags: [feature]
area: hosting
---

# Hosting (Vendor Side)

The same person can rent and host. `views/HostDashboard.tsx` (`#/dashboard` —
**not** `#/host`, see [[Traps]]) and `views/ListSpace.tsx` (`#/post`).

## Listing

`ADD_LISTING` creates a listing, which the heartbeat then verifies and later
sends a first inquiry to. Listings can be paused or deleted rather than only
removed.

## Booking requests

`ownerBookings` holds requests from renters: pending → accepted/declined →
completed → paid_out. The host keeps 90% of every booking.

Profile's hosting row shows **earnings this month**, counted from bookings that
actually completed or paid out this calendar month — anything still pending is
not money. Before that the row was a door with no number beside it, so the one
question a host opens the screen with took a tap to answer.

## Demand signals

Unmet searches — queries that returned nothing — are surfaced to hosts as
evidence of gear the marketplace lacks. See [[Browse-and-Search]].

## Related

- [[Money-Wallet-and-Points]]
- [[Trust-Safety-and-Disputes]]
