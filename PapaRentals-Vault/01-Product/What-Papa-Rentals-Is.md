---
title: What Papa Rentals Is
tags: [product]
area: product
---

# What Papa Rentals Is

A marketplace where filmmakers in Pakistan rent camera gear, lighting, grip and
shooting spaces from the people who own them. Currency is `Rs`. Cities are
Pakistani; vendors, drivers and renters carry Pakistani names.

The pitch the app makes on its own home screen: *"priced like a negotiation,
delivered like a food order."* That sentence is the product strategy, and two
mechanics follow from it.

## Priced like a negotiation

Rates are not fixed. A renter can accept the recommended rate or **make an
offer**, and the owner accepts, counters or declines. See [[Browse-and-Search]].
This is why `Offer` is a first-class object in [[State-Model]] rather than a
discount code.

## Delivered like a food order

Gear does not sit behind a counter waiting for collection. It is **driven to
your shoot**, with a named driver, a vehicle, a live ETA and a handover PIN — the
whole vocabulary of food delivery applied to a Rs 150,000 cinema camera. See
[[Orders-and-Delivery]].

## Both sides of the market

The same person can be a renter and a host. A renter books gear; a host lists
their own and answers booking requests from a dashboard. See
[[Hosting-Vendor-Side]].

## What it is not

- **Not backed by a server.** There is no API, no auth, no database. Everything
  is client state — see [[Architecture-Overview]] for what that costs.
- **Not a payment processor.** Cards, deposits and payouts are simulated. The
  deposit is modelled honestly as an *authorization hold* rather than a charge,
  because that distinction changes what the UI is allowed to claim.
- **Not a KYC system.** Verification is a one-tap simulation, and the
  verification screen says so out loud rather than implying real identity checks.

## Who it runs on

The target device is a **low-end Android phone**, running the app inside a
Capacitor WebView. This is not a footnote — it is the single most influential
constraint in the codebase. It is why downloads have fallbacks, why the
clipboard is never the only route, why animation has reduced-motion bail-outs,
and why a long list does not mount all at once. See [[Traps]] and
[[Performance-Notes]].
