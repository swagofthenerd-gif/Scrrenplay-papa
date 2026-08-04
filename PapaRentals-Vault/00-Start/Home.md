---
title: Papa Rentals — Vault Home
tags: [moc, start-here]
updated: 2026-08-04
---

# Papa Rentals

A film-gear rental marketplace for Pakistan. React 18 + TypeScript + Vite,
shipped inside a Capacitor Android wrapper. **No backend** — all state is a
`useReducer` + Context tree persisted to `localStorage`.

> [!important] Ground truth
> The **code** is the authority on behaviour. This vault is the authority on
> **reasoning and history** — why something is the way it is, and what happened
> when. Where they disagree, the code wins; fix the vault rather than working
> around it.

## Start here

| If you want to know… | Read |
|---|---|
| What the product actually is | [[What-Papa-Rentals-Is]] |
| How the app is put together | [[Architecture-Overview]] |
| Which file does what | [[File-Map]] |
| Every screen and its URL | [[Routes]] |
| The shape of all app state | [[State-Model]] |
| Rules to follow when writing code here | [[Code-Conventions]] |
| **Traps that have already cost time** | [[Traps]] ← read before editing |
| How to build, verify and deploy | [[Build-and-Deploy]] |
| How a change gets proven | [[Verification]] |
| What was built and when | [[Session-Log]] |
| The 250-item backlog | [[Backlog-Index]] |
| A flat list of every note | [[Index]] |

## Feature notes

One note per area, explaining the decisions rather than the code:

- [[Home-and-Discovery]]
- [[Browse-and-Search]]
- [[Cart-and-Checkout]]
- [[Orders-and-Delivery]]
- [[Profile-and-Identity]]
- [[Money-Wallet-and-Points]]
- [[Messaging]]
- [[Trust-Safety-and-Disputes]]
- [[Hosting-Vendor-Side]]

## Status

- **Backlog: 250 of 250 closed.** See [[Backlog-Index]].
- Branch: `claude/papa-rentals-backlog-stm370`
- Live build: deployed from `gh-pages` — see [[Build-and-Deploy]]

## Conventions used in this vault

- Wikilinks throughout; open in Obsidian for the graph view and backlinks.
- Tags: `#decision` on a note recording a judgement call, `#trap` on anything
  that has already broken once, `#invariant` on rules that must hold.
- Callouts flag the two things worth stopping for: `> [!warning]` for traps and
  `> [!important]` for invariants.
