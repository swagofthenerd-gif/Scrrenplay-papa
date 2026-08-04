---
title: Traps
tags: [trap, conventions]
area: conventions
---

# Traps

Every one of these has already cost time. Read before editing.

## Dates

> [!warning] `daysBetween(start, end)` returns BILLING days
> It is `Math.max(1, diff + 1)` — inclusive, and floored at 1. Never use it to
> shift or offset a date range: it will silently be one day long and can never
> be zero.

> [!warning] `toISO(d)` builds from LOCAL date parts
> Not `toISOString()`. Reimplementing it as `toISOString().slice(0,10)` is off by
> one in PKT (UTC+5). Always import the real one.

## Routing

> [!warning] The host dashboard is `#/dashboard`, not `#/host`
> There is no `host` route. A verification script pointed at `#/host`, tested
> nothing, and "passed" an accessibility sweep on a screen it never visited.

## Deploy

> [!warning] `.nojekyll` is not produced by the build
> It exists only on the `gh-pages` branch. Delete it during a deploy and GitHub
> Pages starts ignoring `assets/` — leading-underscore and Jekyll processing
> rules — and serves a blank page. The `-not -name '.nojekyll'` guard in the
> deploy procedure is load-bearing. See [[Build-and-Deploy]].

> [!warning] `git ls-tree` can look empty in a chained command
> It has made `gh-pages` appear to have no files. Verify with `git show --stat`
> before concluding the branch is broken. Do not "fix" a deploy branch that isn't.

## The Android WebView

> [!warning] Blob downloads fail silently
> `URL.createObjectURL` + `<a download>` does nothing inside the WebView — no
> error, no file. Every download must go through `downloadOrShow()`, which falls
> back to `window.open`, then to rendering inline. Three separate features
> shipped as dead buttons before this was shared.

> [!warning] `navigator.clipboard` is commonly blocked
> Anything copyable must also be *visible* — the referral code is printed on
> screen, not only written to the clipboard. `navigator.share` is likewise absent
> outside a secure context. Assume both are missing and degrade.

> [!warning] Heavy animation needs a `prefers-reduced-motion` bail-out
> And an infinite CSS animation keeps running in a card that has scrolled off
> screen. Prefer data-driven position over a loop.

## React

> [!warning] `useMemo([state])` on the whole store object
> Recomputes on every unrelated change — a wallet top-up, a notification
> arriving. Narrow the deps to the slice actually read.

## Testing

> [!warning] Positional lookups race unstable sorts
> A test indexed `.tmap` by position while three seeded orders shared a
> `createdAt`. The newest-first sort tied, card order varied between runs, and
> the suite failed roughly one run in three — with the code entirely correct.
> Scope element lookups to the row that owns them.

> [!warning] Suspect the measurement before the code
> Related: a Playwright "element intercepts pointer events" failure turned out to
> be the modal's entry animation, not an overlap — `elementFromPoint` at the
> button's centre returned the button at every viewport tested.

## Related

- [[Code-Conventions]]
- [[Verification]]
- [[Performance-Notes]]
