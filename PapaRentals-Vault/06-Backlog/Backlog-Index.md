---
title: Backlog Index
tags: [backlog, moc]
area: backlog
updated: 2026-08-04
---

# Backlog Index

**250 items across 5 sections. All closed.**

The canonical copy lives in the repo at `papa-rentals/.planning/IMPROVEMENTS-250.md`.
[[Improvements-250-verbatim]] is the vault's mirror — regenerate it by copying
the file, don't hand-edit it.

## Status

| Section | Done | Not applicable | Open |
|---|---:|---:|---:|
| HOME | 49 | 1 | 0 |
| BROWSE | 50 | 0 | 0 |
| CART | 50 | 0 | 0 |
| ORDERS | 50 | 0 | 0 |
| PROFILE | 50 | 0 | 0 |
| **Total** | **249** | **1** | **0** |

## Legend

- `[x]` done **and verified against the built bundle**
- `[-]` measured and found not to apply — the premise is false. The note records
  how it was checked, so a later pass can re-test rather than re-argue.
- `[ ]` not started

The single `[-]` is HOME-19 (an icon legend). See [[Home-and-Discovery]].

## What the backlog taught  `#decision`

> [!warning] The backlog was stale in **both** directions
> In the final session, six ORDERS items and five PROFILE items were marked open
> but had been built in earlier sessions. Meanwhile several marked done needed
> re-checking. Auditing before implementing avoided eleven duplicate builds.
>
> Never trust a `[ ]`. Read the code, then verify in a browser, then tick.

Three separate features shipped as **controls wired to nothing** — the decorative
transit map, the dead download buttons, the notification toggles that were read
nowhere outside their own screen. If a control exists, check that something reads
it.

## Related

- [[Session-Log]]
- [[Verification]]
