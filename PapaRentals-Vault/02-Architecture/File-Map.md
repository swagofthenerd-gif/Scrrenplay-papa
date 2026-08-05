---
title: File Map
tags: [architecture, reference]
area: architecture
---

# File Map

Line counts from commit `2b23b34`. Use this to answer "which file implements X"
without grepping.

## Core

| File | Lines | What it owns |
|---|---:|---|
| `src/store.tsx` | 1283 | `AppState`, every action, the reducer, `TICK`, persistence, `migrate()` |
| `src/utils.ts` | 680 | Money, dates, totals, downloads, verification and split-payment maths |
| `src/types.ts` | 508 | Every domain type |
| `src/nav.tsx` | 226 | `View` union, hash routing, `go()` |
| `src/App.tsx` | 230 | Route switch, bottom nav, onboarding gate |
| `src/recs.ts` | 93 | Recommendation scoring |
| `src/vendors.ts` | 81 | Vendor-side derivations |

## Data

| File | Lines | What it holds |
|---|---:|---|
| `src/data/catalog.ts` | 445 | Items, owners, kits, `getItem`, `getOwner`, driver and renter pools |
| `src/data/promos.ts` | 99 | Promo codes and campaigns |
| `src/data/services.ts` | 87 | Crew/services offerings |
| `src/data/images.ts` | 57 | Image mapping |

## Views

| File | Lines | Screen |
|---|---:|---|
| `views/CartView.tsx` | 1176 | [[Cart-and-Checkout]] |
| `views/Browse.tsx` | 898 | [[Browse-and-Search]] |
| `views/ItemDetail.tsx` | 888 | Listing detail, offers, `ReportModal` |
| `views/OrdersView.tsx` | 808 | [[Orders-and-Delivery]] |
| `views/Home.tsx` | 799 | [[Home-and-Discovery]] |
| `views/ProfileView.tsx` | 669 | [[Profile-and-Identity]] |
| `views/OrderDetailView.tsx` | 243 | One order, return checklist |
| `views/SettingsView.tsx` | 233 | Preferences, payouts, privacy |
| `views/KitDetail.tsx` | 198 | Kit contents |
| `views/WalletView.tsx` | 194 | [[Money-Wallet-and-Points]] |
| `views/ListSpace.tsx` | 187 | Create a listing |
| `views/InboxView.tsx` | 176 | [[Messaging]] |
| `views/HostDashboard.tsx` | 175 | [[Hosting-Vendor-Side]] |
| `views/Support.tsx` | 148 | Help centre |
| `views/VendorView.tsx` | 145 | Vendor storefront |
| `views/ReferralsView.tsx` | 137 | Refer, redeem, track |
| `views/PublicProfileView.tsx` | 132 | Renter profile owners see |
| `views/VerifyView.tsx` | 130 | Verification centre |
| `views/CrewView.tsx` | 115 | Saved collaborators |
| `views/Services.tsx` | 48 | Crew & services |

## Components

| File | Lines | What it is |
|---|---:|---|
| `components/icons.tsx` | 830 | Every icon + `Avatar`. One `IconName` union. |
| `components/ui.tsx` | 390 | `Badge`, `Modal`, `Stars`, `ItemArt`, `useCountUp` |
| `components/StudioHero.tsx` | 292 | Parallax storyboard hero on Home |
| `components/SearchOverlay.tsx` | 217 | Search sheet with recents and saved searches |
| `components/deptMarks.ts` | 158 | Department SVG marks |
| `components/TransitMap.tsx` | 151 | Live delivery map — see [[Orders-and-Delivery]] |
| `components/VendorCard.tsx` | 106 | Vendor card |
| `components/SmartImage.tsx` | 96 | Lazy, correctly-sized images |
| `components/ProximityMap.tsx` | 88 | Distance rings on Browse |
| `components/primitives.tsx` | 58 | Low-level primitives |
| `components/DeptRow.tsx` | 55 | Shared department row (Home + Browse) |
| `components/Deferred.tsx` | 48 | Mount-on-approach wrapper — see [[Performance-Notes]] |
| `components/ThemeToggle.tsx` | 43 | Light/dark control |
| `components/ServicesBand.tsx` | 43 | Services strip |

## Styling

`src/styles.css` — one stylesheet. Design tokens are CSS custom properties on
`:root`, overridden under `:root[data-theme='dark']`. See [[Design-System]].
