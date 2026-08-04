---
title: Profile and Identity
tags: [feature, decision]
area: profile
---

# Profile and Identity

## The header

Avatar, name, verification standing, tier, city, and the renter rating.

> [!important] The rating is what **owners** see
> The explanation used to be a paragraph below the whole panel with the phone and
> email rows between it and the stars it referred to — so the score read as a mark
> you were being given. It now says "what owners see" on the same line as the
> stars.

**One name fallback.** Someone who never typed a name met three different
defaults: the header said "Filmmaker", the avatar initialled "You", and
onboarding offered "Your name" as its placeholder — so the word shown while
signing up was not the word you were then called. `displayName()` and
`NAME_FALLBACK` are shared by all three.

## Avatars  `#decision`

Everyone got a generated monogram with no way past it. There is no file host, so
the picture lives in `localStorage` with everything else.

`toAvatarDataUrl()` downscales to a **256px JPEG** before storing — 24 KB of
source PNG lands as 2.5 KB. JPEG not PNG: a PNG of a photo is several times
larger for no visible gain at this size, and that difference is fitting in the
quota or not.

> [!important] `null` means remove, `undefined` means don't touch
> An edit to your phone number must not wipe your photo.

## Verification centre  `#decision`

Three steps — **photo ID, phone, payment** — each stating what it is *for*:
owners want to know who has their camera, the driver needs a number that reaches
you, a deposit hold needs a card that can take one. A form with no stated payoff
is a form nobody fills in.

The payoff is quoted as the rule with its number in it — gear with a deposit over
Rs 100,000 — because "premium" means nothing until you can tell which listings it
covers. Completing all three is announced.

This screen says plainly that the demo has no real identity checks and nothing is
uploaded.

## Public profile  `#decision`

`#/me`. Ratings have been two-way and blind from the start — the owner rates you
at the same moment you rate them — but the renter's half went nowhere anyone could
look, including the renter.

Shown to its owner as a **preview of what owners get**, and so it renders only
that: no wallet, no points, no contact details, no order history. Showing more
would stop it working as a preview, which is the single thing it is for.

Two judgement calls:

- **Cancellations are disclosed**, as a completion *rate*. "2 cancelled" reads as
  damning beside a hidden forty completed and ordinary beside a visible one.
- **A new renter reads as new, not bad.** No ratings shows as absent, never 0.0,
  and the page says what owners will make of it.

## Crew  `#decision`

A shoot is not one person. A producer books gear the AD picked and the accountant
pays for, and with one account the answer was passing a phone around — which
hands over the wallet, the saved card and every past order.

Two access levels only (**browse** / **book**), because any more and nobody can
recall from memory what a given person is allowed to do. Everyone starts on
browse; spending someone else's money is a decision, not a default. The row that
grants booking says plainly that it spends your wallet.

## Reports and cases

See [[Trust-Safety-and-Disputes]].

## Related

- [[Money-Wallet-and-Points]]
- [[Cart-and-Checkout]] — what verification unlocks
