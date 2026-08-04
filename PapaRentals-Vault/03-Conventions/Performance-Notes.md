---
title: Performance Notes
tags: [conventions, performance]
area: conventions
---

# Performance Notes

The target is a low-end Android phone running a Capacitor WebView. Everything
here exists because of that.

## Deferred mounting

`components/Deferred.tsx` mounts its children only when they are about to come
into view, holding the space with a reserved block until then.

Two things it deliberately does **not** do:

- It never unmounts once mounted. A rail that remounted would lose its scroll
  position; an order card that remounted would close a modal someone had open.
- The placeholder keeps the section's `id`, so a jump link can still scroll to a
  section that hasn't rendered — the scroll lands on the placeholder, which
  brings it into view, which mounts the real thing.

Used by Home's rails and by the order history. Order cards are heavy — a
timeline, up to five modals, and in transit a map — so a forty-order history
built all of that on first paint. Five render eagerly (the tallest phone's first
screen), the rest on approach. Reserved height is measured, so end-to-end drift
over forty orders is under 1%.

> [!important] The eager count is spent across the whole list
> Not per month-group. Counting per group would render five cards for each of
> twelve months and defeat the point.

## Memoisation

`useMemo([state])` on the whole store object recomputes on every unrelated
change. Narrow deps to the slice actually read. Catalogue scans (`getItem`,
`getOwner`) are done once per order, not once per render row.

## Images

`SmartImage` handles lazy loading and correct sizing. Oversized art is expensive
in a memory-constrained WebView.

## Storage

`localStorage` is a few megabytes for the **entire** app. This is why avatars are
downscaled to a 256px JPEG before being stored — a phone camera JPEG is 3–8 MB on
its own and would blow the quota, taking all app state with it.

## Related

- [[Traps]]
- [[Architecture-Overview]]
