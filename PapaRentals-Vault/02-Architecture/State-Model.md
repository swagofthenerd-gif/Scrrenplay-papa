---
title: State Model
tags: [architecture, reference]
area: architecture
---

# State Model

One `AppState` object, one reducer, persisted whole to
`localStorage['papa-rentals-v2']`.

## Keys

**Identity** — `profile` (name, city, phone, email, avatar, `idVerified`,
`phoneVerified`, `paymentVerified`), `crew`

**Shopping** — `cart`, `wishlist`, `recentlyViewed`, `bookingDrafts`,
`recentSearches`, `unmetSearches`, `savedSearches`, `availAlerts`, `priceAlerts`

**Commerce** — `orders`, `offers`, `promoCodesUsed`, `freeVanPerkMonth`

**Money** — `walletBalance`, `points`, `ledger`, `tierReached`

**Growth** — `referrals`, `referralRedeemed`, `referralSharedAt`,
`referralPending`

**Communication** — `chats`, `notifications`, `notifyPrefs`

**Trust** — `reports`, `claims`, `myReviews`, `blockedOwners`

**Hosting** — `myListings`, `ownerBookings`

**Settings** — `addresses`, `selectedAddressId`, `cards`, `selectedCardId`,
`theme`

## Actions

55 typed actions. Grouped by what they touch:

- **Profile** — `SET_PROFILE`, `VERIFY_ID`, `VERIFY_STEP`
- **Cart** — `ADD_TO_CART`, `UPDATE_CART_LINE`, `REMOVE_FROM_CART`, `RESTORE_CART_LINE`, `CLEAR_CART`, `TOGGLE_WISHLIST`
- **Orders** — `PLACE_ORDER`, `ADVANCE_ORDER`, `CANCEL_ORDER`, `EXTEND_ORDER`, `RATE_ORDER`, `PAY_BALANCE`
- **Offers** — `ADD_OFFER`, `ACCEPT_COUNTER`
- **Chat** — `ADD_CHAT`, `READ_CHAT`
- **Trust** — `REPORT`, `ADD_EVIDENCE`, `FILE_CLAIM`, `UNBLOCK_OWNER`
- **Money** — `ADD_WALLET`, `REDEEM_REFERRAL`, `SHARE_REFERRAL`, `CLEAR_TIER_UP`
- **Crew** — `ADD_CREW`, `SET_CREW_ACCESS`, `REMOVE_CREW`
- **Settings** — `ADD_ADDRESS`, `SELECT_ADDRESS`, `SET_ADDRESS_GEO`, `ADD_CARD`, `REMOVE_CARD`, `SELECT_CARD`, `SET_THEME`, `SET_NOTIFY_PREF`, `READ_NOTIFICATIONS`
- **Search** — `ADD_RECENT_SEARCH`, `RECORD_UNMET_SEARCH`, `REMOVE_RECENT_SEARCH`, `CLEAR_RECENT_SEARCHES`, `SAVE_SEARCH`, `REMOVE_SAVED_SEARCH`, `VIEW_ITEM`, `SAVE_BOOKING_DRAFT`
- **Hosting** — `ADD_LISTING`, `TOGGLE_LISTING_PAUSE`, `DELETE_LISTING`, `ACCEPT_OWNER_BOOKING`, `DECLINE_OWNER_BOOKING`, `ADD_AVAIL_ALERT`, `TOGGLE_PRICE_ALERT`
- **Time** — `TICK`

## Invariants

> [!important] Money always leaves a trace
> Any change to `walletBalance` or `points` writes a `ledger` row via `record()`.
> A balance with no history cannot be trusted or disputed, and the ledger is what
> makes "Rs 1,500 earned" a claim you can check rather than one you must believe.

> [!important] Notifications respect their channel
> `notify()` drops a notification whose `channel` is muted in `notifyPrefs`,
> at creation rather than at render. A muted channel must not sit in state
> inflating the unread badge. Notifications with no `channel` always deliver.

> [!important] Order status is append-only
> `statusLog` records every transition with its timestamp. `statusAt` alone only
> remembers the *current* stage, which is why "approved in 4 min" was
> unanswerable before the log existed. See [[Orders-and-Delivery]].

## Related

- [[The-Heartbeat]]
- [[Architecture-Overview]]
