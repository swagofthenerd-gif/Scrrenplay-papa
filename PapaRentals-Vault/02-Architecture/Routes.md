---
title: Routes
tags: [architecture, reference]
area: architecture
---

# Routes

Defined by the `View` union in `nav.tsx`. Adding a screen means touching four
places: the union, `viewToHash`, `parseHash`, and the render switch in `App.tsx`.

> [!warning] The host route is `#/dashboard`, not `#/host`
> There is no `host` route and never was. A verification script once pointed at
> `#/host`, silently tested nothing, and "passed" an accessibility sweep on a
> screen it never visited. See [[Traps]].

| Hash | View | Screen | File |
|---|---|---|---|
| `#/` | `home` | Home | `views/Home.tsx` |
| `#/browse` | `browse` | Browse / search results | `views/Browse.tsx` |
| `#/item/:id` | `item` | Listing detail | `views/ItemDetail.tsx` |
| `#/vendor/:id` | `vendor` | Vendor storefront | `views/VendorView.tsx` |
| `#/kit/:id` | `kit` | Kit detail | `views/KitDetail.tsx` |
| `#/cart` | `cart` | Cart + checkout | `views/CartView.tsx` |
| `#/orders` | `orders` | Order list | `views/OrdersView.tsx` |
| `#/order/:id` | `order` | Single order detail | `views/OrderDetailView.tsx` |
| `#/profile` | `profile` | Your profile | `views/ProfileView.tsx` |
| `#/me` | `publicProfile` | Renter profile as owners see it | `views/PublicProfileView.tsx` |
| `#/verify` | `verify` | Verification centre | `views/VerifyView.tsx` |
| `#/crew` | `crew` | Saved collaborators | `views/CrewView.tsx` |
| `#/referrals` | `referrals` | Refer, redeem, track | `views/ReferralsView.tsx` |
| `#/wallet` | `wallet` | Balance + ledger | `views/WalletView.tsx` |
| `#/settings` | `settings` | Preferences, payouts, privacy | `views/SettingsView.tsx` |
| `#/inbox` / `#/inbox/:threadId` | `inbox` | Messages | `views/InboxView.tsx` |
| `#/support` / `#/support/:orderId` | `support` | Help centre | `views/Support.tsx` |
| `#/services` | `services` | Crew & services | `views/Services.tsx` |
| `#/post` | `post` | List your own gear/space | `views/ListSpace.tsx` |
| `#/dashboard` | `dashboard` | Host dashboard | `views/HostDashboard.tsx` |

## Browse carries its filters in the URL

`browse` is the one route with a large parameter surface — category, query,
sort, price bounds, distance, verified/instant/offers flags, date range and a
compare set. This is deliberate: filters used to be React state, so navigating
to an item and back reset everything. See [[Browse-and-Search]].

## Thread ids are namespaced

`#/inbox/:threadId` takes three shapes, because a conversation is not always with
a vendor:

- `o1` — the global thread with a vendor
- `support` — Papa Support
- `driver:PR-1234` — the driver on one specific delivery
- `order:PR-1234|o1` — a vendor thread scoped to one order

See [[Messaging]] for why they are separated.
