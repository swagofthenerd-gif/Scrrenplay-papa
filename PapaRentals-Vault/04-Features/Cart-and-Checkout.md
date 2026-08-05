---
title: Cart and Checkout
tags: [feature, decision]
area: cart
---

# Cart and Checkout

`views/CartView.tsx` — the largest file in the app at 1176 lines, because it
holds the cart, the line editor, the totals engine's presentation, address and
card selection, and the review sheet.

## Totals

`cartTotals()` in `utils.ts` is the single source. It computes subtotal,
insurance, operator fees, transport, service fee, promo and tier discounts, the
van perk, points and wallet applied, and the deposit hold.

> [!important] Transport is charged per owner per method
> Separate owners mean separate deliveries. A shipment set keyed by owner is what
> stops a three-vendor cart being charged one van fee.

> [!important] The deposit is a hold, not a charge
> It is never added to "charged now". Every surface that mentions it says so.

## Instant book vs approval  `#decision`

Whether checkout skips owner approval used to depend only on the listing. The
profile had promised since day one that verifying "unlocks instant-book on
premium gear" — and nothing read the flag, so premium gear already instant-booked
for everybody.

`canInstantBook(item, profile)` is now the rule: an instant-book listing with a
deposit over **Rs 100,000** requires a fully verified renter and falls back to
owner approval otherwise. Deposit rather than daily rate, because what the owner
is exposed to if the gear doesn't come back is what verification is about.

Both the cart and the listing say which side of the gate you are on.

## Split payment  `#decision`

Gear for a big shoot is booked weeks ahead, and the whole cost landing on confirm
is why a full cart gets abandoned and rebuilt closer to the day.

- **A third now**, the balance the day before pickup.
- A third because it is a real commitment — the number a vendor would accept as
  one — while leaving the bulk until the shoot is happening.
- The day before pickup because it is late enough to be worth deferring and early
  enough that a failed payment is still fixable.
- **Paying in full stays the default.** Deferring is a choice.

> [!important] The halves are derived from each other
> `splitPayment()` returns `paidNow` and `total - paidNow`. Computing each side
> independently left a rupee unaccounted for on roughly half of all totals.

The outstanding balance appears on the order card **above** the timeline, not
among the totals where it would read as a line already dealt with, and settles
from wallet credit first — the same order checkout uses.

## Perk lines link back  `#decision`

The perks panel promises perks apply "automatically", and at checkout they
appeared with nothing tying them to the tier that earned them. Both perk lines
are now controls that go to the perks panel — underlined rather than coloured,
since colour already means credit in a totals column.

## Related

- [[Money-Wallet-and-Points]]
- [[Profile-and-Identity]] — verification
- [[Orders-and-Delivery]]
