---
title: Vault Maintenance
tags: [meta]
---

# Vault Maintenance

## Which note covers what

| If you change… | Update |
|---|---|
| A route | [[Routes]] |
| `AppState` or an action | [[State-Model]] |
| A file's size or purpose materially | [[File-Map]] |
| Anything that breaks once and is fixed | [[Traps]] — add a `> [!warning]` |
| A judgement call with a live alternative | [[Decisions]] |
| Behaviour in one area | the matching `04-Features/` note |
| The backlog | copy `IMPROVEMENTS-250.md` over [[Improvements-250-verbatim]], update [[Backlog-Index]] counts |
| Anything, at end of session | [[Session-Log]] |

## Regenerating the backlog mirror

```bash
cp papa-rentals/.planning/IMPROVEMENTS-250.md \
   PapaRentals-Vault/06-Backlog/Improvements-250-verbatim.md
```

The repo copy is canonical. Never hand-edit the mirror.

## Rules this vault follows

- **The code wins on behaviour.** If a note disagrees with the code, the note is
  wrong — fix it rather than working around it.
- **Record why, not what.** A note restating what a function does earns nothing;
  a note explaining the failure it prevents earns its place.
- **Name the failure.** "Bearings are spread evenly rather than hashed" is worth
  half as much without "a hash clumped six owners into one quadrant".
- **Record dead ends too.** HOME-19 is in the backlog as `[-]` with how it was
  measured, so nobody re-argues it from scratch.

## Provenance

Generated from the repository at commit `2b23b34` on 2026-08-04. Every table,
count and file size was read from the code, not recalled. The one number quoted
from elsewhere is the 113-commit branch length, from `git log`.
