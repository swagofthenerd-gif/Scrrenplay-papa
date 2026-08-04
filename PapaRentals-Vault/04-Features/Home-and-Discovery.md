---
title: Home and Discovery
tags: [feature]
area: home
---

# Home and Discovery

`views/Home.tsx` + `components/StudioHero.tsx`, `ServicesBand`, `DeptRow`.

## Shape

A storyboard-styled hero, then a jump bar, then rails. Home was cut from nine
screens to under four during the backlog work — the explanatory copy came off and
the drawings were left to talk.

## Rails

For you · Because you viewed · Continue where you left off · Trending · Flash
deals · Recently viewed · Kits · Spaces · New this week · Near your last shoot
location.

All share one `<Rail title icon subtitle seeAll>` component; Home previously
hand-rolled the same header markup six times.

## Decisions worth keeping

- **Cold start never shows an empty rail.** "For you" falls back to editor's
  picks / most-rented rather than vanishing for new users.
- **Trending is time-decayed**, not an all-time `timesRented` sort, so rising
  gear surfaces instead of permanent winners.
- **Seasonal slot** — a data-driven promo for wedding season, Ramadan, ad-shoot
  week.
- **The city picked at onboarding does something visible** — "34 vendors near
  Lahore".
- **Pull-to-refresh actually reshuffles** recommendations rather than a 700ms
  `setTimeout` that always claimed you were up to date.
- **Below-the-fold rails defer** via `Deferred` — see [[Performance-Notes]].
- **The hero's parallax bails out** under `prefers-reduced-motion`.

## The icon legend that wasn't needed

Backlog item HOME-19 proposed a first-run legend explaining icons. Measured and
found false: zero icon-only controls lacked an accessible name, and every icon it
named sits beside its own words — bolt/backpack/flame are section-header glyphs
next to "Flash deals" / "Production kits" / "Trending on set". A legend would have
added an onboarding interruption to explain labels already on screen. Recorded as
`[-]` in the backlog rather than silently skipped.

## Related

- [[Browse-and-Search]]
- [[Performance-Notes]]
