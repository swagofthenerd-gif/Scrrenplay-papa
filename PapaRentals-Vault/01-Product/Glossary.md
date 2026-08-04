---
title: Glossary
tags: [product, reference]
---

# Glossary

Terms that mean something specific in this codebase.

| Term | Meaning |
|---|---|
| **Item** | One rentable thing — a camera, a light, a space. Lives in `data/catalog.ts`. |
| **Owner / Vendor** | Who the item belongs to. Has an area, a distance, a rating and a response time. |
| **Booking** | One cart line: an item, dates, quantity, a rate. Not yet an order. |
| **Order** | A committed set of bookings with a status, a total and a delivery address. |
| **Offer** | A renter's proposed rate on an item. Owner accepts, counters or declines. |
| **Kit** | A pre-bundled set of items sold at a bundle rate. |
| **Deposit hold** | An authorization on the card, **never a charge**. Released after a clean return. Getting this wrong in copy is a trust failure. |
| **PapaPoints** | Loyalty points. 1 point per Rs 100 spent; 1 point = Rs 1 at checkout. |
| **Tier** | Bronze / Silver / Gold Papa, from points. See [[Money-Wallet-and-Points]]. |
| **Wallet** | Client-side balance. Splits into withdrawable **cash** and spend-only **promo credit**. |
| **Ledger** | Every wallet and points movement. A balance with no history cannot be trusted or disputed. |
| **Premium gear** | An item with a deposit over Rs 100,000. Instant-book on these requires full verification. See [[Profile-and-Identity]]. |
| **Split payment** | Pay a third at checkout, the balance the day before pickup. |
| **Crew** | Saved collaborators who can browse or book on your account. |
| **Claim** | Money is owed — gear broke. Distinct from a **report**. |
| **Report** | The vendor or gear was wrong. Goes to Trust & Safety, may escalate to **mediation**. |
| **Mediation** | Both sides being actively arbitrated. A distinct state from "reported". |
| **Heartbeat / TICK** | The `TICK` action that advances simulated time — approvals, deliveries, chat replies, referral conversions. |
