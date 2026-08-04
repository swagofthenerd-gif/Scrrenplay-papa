# Papa Rentals

React 18 + TypeScript + Vite film-gear rental marketplace demo (Pakistan,
currency `Rs`). No backend — `useReducer` + Context persisted to localStorage.

## Two sources of context, and which to use

**For code** — conventions, traps, verification, deploy procedure — use the
project skill at `.claude/skills/papa-rentals/SKILL.md`. It is thorough and
it is the authority for anything about *how this codebase behaves*.

**For narrative** — what the app is, why decisions were made, what shipped
when, what's still open — read the vault:

```
../PapaRentals-Vault
```

It is committed to this repository, so it travels with the code rather than
living only on one machine.

Start with `../PapaRentals-Vault/00-Start/Home.md`, which maps a question to
the one note that answers it. Do **not** read the whole vault,
and do not grep this codebase to rediscover something already written there.

### Which one answers what

| Question | Go to |
|---|---|
| How do I build/preview/deploy? What are the traps? | the skill |
| Which file implements X? | vault `02-Architecture/File-Map.md` |
| What's left to build? | vault `06-Backlog/Backlog-Index.md` (all 250 closed) |
| Why is it built this way? | vault `04-Features/` (one file per area) |
| What happened last session? | vault `05-History/Session-Log.md` |
| What are the exact item numbers? | `.planning/IMPROVEMENTS-250.md` (canonical) |

## Ground truth

This directory is the ground truth for **behaviour**. The vault is the
ground truth for **reasoning and history**. When they disagree, the code
wins — but say so, and fix the vault rather than working around it silently.

The backlog's canonical copy is `.planning/IMPROVEMENTS-250.md` here. The
vault mirrors it at `06-Backlog/Improvements-250-verbatim.md` plus a
generated summary. If you close items here, re-copy and regenerate:

```bash
cp .planning/IMPROVEMENTS-250.md ../PapaRentals-Vault/06-Backlog/Improvements-250-verbatim.md
# then update the counts table in 06-Backlog/Backlog-Index.md
```

## After a work session

Add an entry to `../PapaRentals-Vault/05-History/Session-Log.md` so the next
session doesn't start from zero. That is the entire point of the vault existing.
`99-Meta/Vault-Maintenance.md` says which note covers what.
