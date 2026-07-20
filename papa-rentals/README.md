# 🎬 Papa Rentals

**The filmmaker's rental marketplace** — rent everything for your shoot like you order food, and price it like a negotiation.

Papa Rentals combines the best ideas from the apps that dominate their categories:

| Inspired by | Feature in Papa Rentals |
|---|---|
| **inDrive** | Recommended fare + **"Offer your price"** — owners accept, counter, or decline your bid in real time |
| **foodpanda** | Live order tracking timeline, delivery tiers (self-pickup / Papa Van / grip truck + crew), flash deals with countdowns, promo codes, wallet |
| **Airbnb** | Two-way 5-star ratings that publish together (no retaliation), verified & Super Owner badges, instant book, date-range booking |
| **Fat Llama / ShareGrid** | Damage protection insurance, refundable security deposits, multi-day rate discounts (10% at 3+ days, 20% weekly) |
| **Uber / Careem** | Transport with driver included, ETA estimates, in-app chat with quick owner replies |
| **Amazon / Daraz** | Shopping-style catalog with categories, search, filters, sort, wishlist, curated bundles ("Production Kits") |
| **Loyalty programs** | PapaPoints (1 pt / Rs 100), Bronze → Silver → Gold tiers with real perks, referral credits |

## Features

- 🛍️ **Shop the whole production**: cameras, lenses, lighting, audio, grip, drones, transport, studios, props, crew gear
- 📅 **Book exactly what you need**: date range, pickup/delivery time, quantity, insurance, certified operator add-on
- 🚐 **Transportation built in**: self pickup (free), insured Papa Van delivery, or a 5-ton grip truck with a rigging crew
- 🤝 **inDrive-style pricing**: see the recommended fare, then slide to your offer — the owner accepts (≥92%), counters (72–92%), or declines lowballs
- ⭐ **Two-way trust**: rate the owner, the owner rates you; report users to Trust & Safety from any listing or order
- 📦 **Order tracking**: Confirmed → Preparing → On the way → On set → Returned → Completed, with deposit auto-refund
- 👛 **Wallet, promos & points**: welcome credit, promo codes (`PAPA10`, `FIRSTSHOOT`, `INDIE5`), PapaPoints tiers, referral rewards
- ⚡ **Flash deals & kits**: time-limited discounts and designer-curated bundles at package prices

## v2 — the "breeze on any device" release

Every gap from the competitive audit, closed:

- **Real navigation**: hash router — hardware back button, deep links (`#/item/i1`), shareable URLs, per-route scroll restoration
- **Availability engine**: per-item booked ranges, 14-day availability strip, double-booking blocked with "next free date — tap to apply"
- **Money done right**: deposits are authorization *holds* (auto-released, never charged), cancellation flow with 48h policy + wallet refunds, per-owner transport fees, promo rules (first-order-only / min subtotal / single-use) with clear errors, PapaPoints redemption, Gold 5% + Silver free-delivery perks applied automatically, downloadable receipts, JazzCash/Easypaisa/card/COD selection
- **Sticky negotiation**: accepted offers lock for 24h and survive date changes (you always keep the better of deal vs. recommended); offers resolve via notifications even with the sheet closed
- **Mobile feel**: scroll-locked swipe-to-dismiss bottom sheets, 44px+ touch targets, safe-area + `dvh` layout, haptic taps, dark mode, reduced-motion support, real ticking flash-deal countdowns
- **PWA**: installable with manifest + icons; service worker makes it open instantly and work fully offline
- **Trust**: owner-approval flow for non-instant listings, courier card with call button + handover PIN, blind two-way ratings published together, per-item ratings with half-stars + histograms, owner replies to reviews, report case numbers with status tracking, block owners
- **Discovery**: typo-tolerant search with suggestions + recent searches, recently-viewed row, "people also rented" cross-sell, wishlist price-drop alerts, Bayesian-weighted "top rated" sort, book-again, hourly studio rentals, mid-shoot rental extension, address book, delivery time slots, 10-second onboarding

## v3 — Studios & Spaces + user listings

- **Shoot locations marketplace** (Peerspace/Giggster-style): rooftop terraces, heritage havelis, raw warehouses, designer apartments, daylight studios and greenscreen stages — each with sqft, max crew, amenities, house rules and minimum-hours data, bookable by day or hour
- **"List your space"**: anyone can post a space in 2 minutes — type, area, size, pricing (with auto hourly rate), deposit, amenities, house rules, instant-book and accept-offers toggles, and a live earnings preview (you keep 90%)
- **Owner-side lifecycle**: new listings go through ⏳ pending verification → 🟢 live (with notification), receive simulated renter inquiries, and show a manage panel (pause/resume, two-tap delete, earnings per day) instead of a booking panel on your own listings
- User listings are first-class citizens: they appear in browse, home, and typo-tolerant search, persist across reloads, and are excluded correctly when paused
- Space-specific browse filters: hourly-availability chip and minimum crew-size selector

## v4 — the two-sided marketplace release

- **Host dashboard**: simulated renters send booking requests on your live listings (some with inDrive-style below-rate offers); accept or decline, watch bookings complete, and receive automatic 90% payouts to your wallet — with earnings, pending-payout and history views
- **Self-driving orders**: the tracking timeline advances automatically (confirmed → preparing → on the way → on set → returned → done) with notifications at each milestone; "Skip ahead" retained for demos
- **Papa Support**: Help Center with FAQ accordion, a keyword-aware support chat agent (refunds, deposits, late couriers, claims, payouts), quick-reply chips, and an emergency line
- **Damage claims**: file against insured orders; claims move filed → reviewing → approved and pay out to the wallet
- **Smoothness pack**: side-by-side compare tray (up to 3 items), native share sheet on listings, "notify me when available" alerts on booked dates, shoot-day reminders, "complete your setup" cross-sell in cart, pull-to-refresh on home, referral-code redemption (+Rs 500)

## v5 — the soft redesign

A full visual redesign in the Airbnb direction, plus deeper search and recommendations:

- **Design system**: real token scales (radius, shadow, type, spacing, easing) over a warm cream palette; softer rounded corners everywhere; layered low-opacity shadows; **Plus Jakarta Sans** bundled locally (variable woff2, precached — still works offline); dark mode and reduced-motion kept at full parity
- **Real photography**: curated Unsplash photos on every listing with a swipeable gallery on detail pages (scroll-snap + dots); skeleton shimmer while loading and automatic fallback to the gradient/emoji art when offline — photo IDs live in one file (`src/data/images.ts`) for easy swapping; the service worker caches photos (capped, stale-while-revalidate)
- **Airbnb-style cards**: 4:3 photo, heart-pop wishlist overlay, Instant pill on the photo, compact single-star rating line
- **Search, deepened**: full-screen search overlay (recents, trending, departments) with ranked photo-rich suggestions and match highlighting; ranking blends per-field relevance (name > tags > description > typo-fuzzy) with Bayesian rating and popularity; "Best match" sort on browse when a query is present
- **Recommendations, deepened**: item-similarity engine (tag Jaccard + category adjacency + price band + quality) powers "People also rented" and cart cross-sell; a recency-decayed category-affinity profile builds "✨ For you" and "Because you viewed …" rows on Home — all client-side
- **Motion**: springy bottom sheets and nav pill, staggered card entrances, animated rating histograms, wallet count-ups, press-scale feedback — all gated by `prefers-reduced-motion`
- **Detail page**: photo gallery hero with floating back button, sticky booking panel on desktop, and a fixed price + add-to-cart bar on phones

## Run it

```bash
cd papa-rentals
npm install
npm run dev      # local dev server
npm run build    # production build (output in dist/)
```

Built with React 18 + TypeScript + Vite. All state persists in `localStorage` — no backend required for the demo. The marketplace catalog, offer negotiation, owner chat replies, and order progression are simulated client-side so every flow can be exercised end-to-end.
