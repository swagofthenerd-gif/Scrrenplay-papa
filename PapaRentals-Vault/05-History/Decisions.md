---
title: Decision Register
tags: [history, decision, moc]
area: history
---

# Decision Register

Judgement calls that would otherwise be re-argued. Each links to the note
carrying the full reasoning.

| Decision | Why | Where |
|---|---|---|
| No backend, everything in `localStorage` | It is a demo to be shown, not operated | [[Architecture-Overview]] |
| Simulated events, never simulated facts | A referral friend can be invented; the Rs 500 they earn must be a real ledger row | [[Architecture-Overview]] |
| Hash routing, no router library | One `View` union stays the single source of what a screen needs | [[Routes]] |
| The deposit is a hold, never a charge | Modelling it as a charge would make the UI lie about money | [[Cart-and-Checkout]] |
| Maps are schematic, not street maps | Vendors have an area and a distance, not coordinates | [[Orders-and-Delivery]] |
| Premium = deposit > Rs 100,000 | What the owner is exposed to is what verification is about — not the daily rate | [[Profile-and-Identity]] |
| Split payment takes a third | A real commitment, while leaving the bulk until the shoot is happening | [[Cart-and-Checkout]] |
| Balance due the day before pickup | Late enough to be worth deferring, early enough that a failed payment is fixable | [[Cart-and-Checkout]] |
| Crew has two access levels only | More and nobody can recall from memory what a person is allowed to do | [[Profile-and-Identity]] |
| Crew defaults to browse | Spending someone else's money is a decision, not a default | [[Profile-and-Identity]] |
| Public profile shows *less* | Showing more would stop it working as a preview, its only purpose | [[Profile-and-Identity]] |
| Cancellations shown as a rate | "2 cancelled" reads as damning beside a hidden forty completed | [[Profile-and-Identity]] |
| Muted notifications dropped at creation | Otherwise they inflate the unread badge for alerts nobody asked for | [[State-Model]] |
| Threads keyed per driver / per order | Thursday's driver is not Friday's; two rentals must not merge | [[Messaging]] |
| Each thread kind has its own replies | Sales patter from a driver mid-delivery is the wrong register | [[Messaging]] |
| Avatars downscaled to 256px JPEG | A camera JPEG would blow the shared storage quota | [[Profile-and-Identity]] |
| `Deferred` never unmounts | A remounted card would close a modal someone had open | [[Performance-Notes]] |
| Eager count spent across the whole list | Per-group would render five cards per month and defeat the point | [[Performance-Notes]] |
| One card system, shadows never borders | Three panels on one screen had three different edges | [[Design-System]] |
| The wallet card keeps its gradient | It is the hero of its screen — a decision, not drift | [[Design-System]] |
| HOME-19 recorded as `[-]` not skipped | The premise was measured and found false; a later pass can re-test | [[Backlog-Index]] |

## Related

- [[Session-Log]]
- [[Traps]]
