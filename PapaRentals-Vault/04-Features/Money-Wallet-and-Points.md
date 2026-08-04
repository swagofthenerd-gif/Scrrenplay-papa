---
title: Money, Wallet and Points
tags: [feature, decision]
area: money
---

# Money, Wallet and Points

## The ledger is the point

> [!important] Every movement is recorded
> `record()` prepends a `ledger` row for any wallet or points change, skipping
> no-op amounts so history stays readable. A balance with no history cannot be
> trusted or disputed, and "where did my Rs 500 go" is the top support question.

## Cash vs promo credit

The wallet splits into **withdrawable cash** and **spend-only promo credit**.
Refund and referral money is spend-only — it comes off your next booking and
cannot be withdrawn to a bank. The wallet screen states both numbers rather than
one total that would imply you could take it all out.

## Points and tiers

1 point per Rs 100 spent; 1 point = Rs 1 at checkout.

| Tier | At | Buys |
|---|---:|---|
| Bronze Papa | 0 | Redeem points against any booking |
| Silver Papa | 500 | A free van delivery every month |
| Gold Papa | 2000 | 5% off every rental, priority support, early access |

`TIER_PERKS` is one array read by both the perk list and the progress line —
written out twice, they drifted the moment one changed.

### Tier-up is celebrated  `#decision`

Crossing a threshold was silent: the badge simply read differently the next time
you looked. `tierOf()` is now shared so before and after are computed the same
way (a crossing is undetectable otherwise), the moment is announced, and Profile
shows a celebration **once** before clearing it — a banner that never leaves is
not a celebration.

> [!note] Known balance issue
> A Rs 181,000 order earns 1,810 points, taking a new renter from Bronze past
> Silver into Gold in a single booking. Silver is effectively unreachable for
> anyone renting real gear. This is an economy-balance question, not a bug, and
> the thresholds have not been revisited.

## Top-up feedback  `#decision`

The toast said "+Rs 10,000" in a corner while the balance counted up
independently on the other side of the screen. The credited amount now rises out
of the balance it just joined, and the toast is left to say the thing only it
knows: which card was charged.

## Referrals  `#decision`

Referring and redeeming were two unrelated strips separated by half of Profile,
and neither ever said whether any of it had worked. One screen now: give your
code, use someone's, and see who used it.

> [!important] Simulated people, real money
> The friends are simulated on the heartbeat, because there is no backend to know
> them. Each conversion credits the wallet and writes a **ledger row** like any
> other movement, so "Rs 1,500 earned" is a sum of things that happened rather
> than a number the screen invented.

The code is printed on screen before it is anything else. Sharing tries the share
sheet, then the clipboard, then falls back on the code already being visible —
both of the first two are commonly unavailable in the WebView.

## Related

- [[Cart-and-Checkout]]
- [[Profile-and-Identity]]
