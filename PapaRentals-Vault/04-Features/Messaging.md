---
title: Messaging
tags: [feature, decision]
area: messaging
---

# Messaging

`views/InboxView.tsx`. Chats are `Record<string, ChatThread>` keyed by **who you
are talking to** — and that is not always a vendor.

## Thread kinds

| Key | Who | Reply register |
|---|---|---|
| `o1`, `o2`… | A vendor, globally | Availability, rates, multi-day discounts |
| `support` | Papa Support | Rule-matched answers on refunds, deposits, claims |
| `driver:<orderId>` | The driver on one delivery | Short, about the next ten minutes |
| `order:<orderId>\|<ownerId>` | A vendor, about one order | About the booking you already have |

## Why scoped threads  `#decision`

**Driver.** Keyed per order because Thursday's driver is not Friday's, and
merging them would put two deliveries' handover instructions in one conversation.

**Per-order vendor.** "Message the vendor" from an order dropped you into the one
global thread. Rent from the same vendor twice and both conversations merged, so
"the lens mount on this one is loose" sat in the same scroll as three months of
availability questions with nothing saying which booking it was about — for
either side. The global thread stays where it belongs: on the listing and the
vendor page, because "do you have this in stock" genuinely isn't about an order.

## Registers matter  `#decision`

Each thread kind has its own replies. A driver mid-delivery answering with
"book today and I'll throw in a battery" is a vendor who hasn't noticed they're
on the road; an order thread answering the same way is a vendor who hasn't
noticed they're already mid-rental with you.

## `threadPeer()`  `#decision`

Three places separately derived a display name from a thread id, and the one in
the reducer named support after a random vendor — `getOwner` falls back to the
first vendor for an id it doesn't recognise. One helper now returns name,
subtitle, kind and owner id, which is also what lets a reply notification
deep-link to the thread rather than the inbox list.

## Related

- [[Orders-and-Delivery]]
- [[Trust-Safety-and-Disputes]]
