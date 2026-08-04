---
title: Design System
tags: [conventions, design]
area: conventions
---

# Design System

One stylesheet, `src/styles.css`. Tokens are CSS custom properties on `:root`,
with dark overrides in a single `:root[data-theme='dark']` block so the two
copies cannot drift apart.

## Tokens

**Colour** — `--accent` `--accent-dark` `--accent-soft` · `--ink` `--muted` ·
`--line` `--line-strong` · `--bg` `--card` `--card-2` · `--green` `--green-soft`
`--green-ink` · `--purple` `--purple-soft` · `--red` `--red-soft` · `--star`
`--star-off`

**Paper texture** (the drawn/storyboard look) — `--paper` `--paper-2`
`--paper-line` `--ink-draw` `--ink-draw-soft`

**Radius** — `--r-sm` `--r-md` `--r-lg` `--r-xl` `--r-pill`

**Shadow** — `--shadow-xs` `--shadow-sm` `--shadow-md` `--shadow-lg`

**Type scale** — `--fs-xs` `--fs-sm` `--fs-base` `--fs-md` `--fs-lg`

> [!important] No invented hex values
> Every colour comes from a token. `var(--danger, #b42318)` shipped once with no
> `--danger` defined, so the fallback — a red belonging to no palette — was what
> always rendered, sitting next to the real `--red`.

## Contrast decisions

`--green` on `--green-soft` measures 3.09:1, below AA at badge text sizes.
`--green-ink` is a darker ink on the same tint reaching 4.7:1 without changing
the palette. `--green-ink` inverts in dark mode for the same reason.

## The card system

Every surface is: `var(--card)` background, rounded corner, `box-shadow`, and
**no border**.

| Class | Radius | Padding | Use |
|---|---|---|---|
| `.panel` | `--r-lg` | 18px | A section of a screen |
| `.stat-tile` | `--r-md` | 14px | One number and its label |
| `.list-row` | `--r-md` | 15px 16px | A tappable row |
| `.wallet-card` | `--r-xl` | 24px | **Exception**: gradient, the hero of Profile |

Referrals and the public profile each grew their own bordered stat tile before
this was settled, so three panels on one screen had three different edges. One
tile now.

## Motion

Animation is a progressive enhancement. Anything decorative needs a
`prefers-reduced-motion: reduce` bail-out, and `useCountUp` already snaps rather
than animating under it. Prefer position driven by data over an infinite loop —
a CSS loop keeps running in a card that has scrolled off screen.

## Related

- [[Code-Conventions]]
- [[Traps]]
