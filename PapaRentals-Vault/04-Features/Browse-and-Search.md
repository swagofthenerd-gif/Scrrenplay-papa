---
title: Browse and Search
tags: [feature]
area: browse
---

# Browse and Search

`views/Browse.tsx`, `views/ItemDetail.tsx`, `components/SearchOverlay.tsx`,
`components/ProximityMap.tsx`.

## Filters live in the URL  `#decision`

Filters were React state, so navigating to an item and back reset everything.
They are now part of the `browse` route — category, query, sort, price bounds,
distance cap, verified/instant/offers flags, dates and a compare set. See
[[Routes]].

## The proximity map  `#decision`

`ProximityMap` plots what the data actually says: how far each vendor is, and
roughly which way. Rings are labelled in km so it reads as *proximity*, not as a
street map — vendors have a distance, not coordinates.

Two bugs shaped it. Hashing ids for bearings clumped six owners into one quadrant
and stacked their pins, so bearings are spread evenly and sorted by id (which
also stops the map spinning as the list refilters). And two items from one vendor
share a distance, so they differ only by angle — a fixed angle is a shrinking gap
as radius drops, which overlapped pins near the centre. Separation is by arc
length with a small radial stagger.

## Search

Recent searches are kept, and separately so are **unmet** searches — ones that
returned nothing. They mean the opposite thing: a recent search is a route back
to something that exists, an unmet one is gear this marketplace does not have.
It is the only demand signal in the app that isn't already a booking, and it is
surfaced to hosts.

## Offers

Items with `offersAccepted` let a renter propose a rate. The heartbeat returns an
accept, a counter or a decline. Accepted offers lock for 24h.

## Availability

`bookedRanges` per item drive an "available on my dates" filter, low-stock
warnings, and availability alerts when something frees up.

## Related

- [[Home-and-Discovery]]
- [[Cart-and-Checkout]]
