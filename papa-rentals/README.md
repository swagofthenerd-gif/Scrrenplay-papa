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

## Run it

```bash
cd papa-rentals
npm install
npm run dev      # local dev server
npm run build    # production build (output in dist/)
```

Built with React 18 + TypeScript + Vite. All state persists in `localStorage` — no backend required for the demo. The marketplace catalog, offer negotiation, owner chat replies, and order progression are simulated client-side so every flow can be exercised end-to-end.
