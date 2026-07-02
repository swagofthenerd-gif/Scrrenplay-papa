import { CATEGORIES, ITEMS, KITS, getItem } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { money } from '../utils'
import { Badge, ItemArt, ItemCard } from '../components/ui'

export default function Home() {
  const { go, toast } = useNav()
  const { state, dispatch } = useStore()

  const deals = ITEMS.filter((i) => i.flashDeal)
  const trending = [...ITEMS].sort((a, b) => b.timesRented - a.timesRented).slice(0, 8)

  return (
    <div>
      <div className="hero">
        <div className="hero-emoji">🎬</div>
        <h1>
          Rent everything for<br />your next shoot.
        </h1>
        <p>Cameras, glass, lights, grip trucks and crew vans — delivered to set like a food order, priced like a negotiation.</p>
        <div className="hero-badges">
          <span>⚡ Instant booking</span>
          <span>🤝 Offer your price</span>
          <span>🚐 Delivery to set</span>
          <span>🛡️ Damage protection</span>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2>Departments</h2>
          <button className="link-btn" onClick={() => go({ name: 'browse' })}>Browse all →</button>
        </div>
        <div className="cat-row">
          {CATEGORIES.slice(0, 10).map((c) => (
            <button key={c.id} className="cat-chip" onClick={() => go({ name: 'browse', category: c.id })}>
              <span className="cat-ico" style={{ background: c.gradient }}>{c.emoji}</span>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2>⚡ Flash deals</h2>
          <button className="link-btn" onClick={() => go({ name: 'browse', dealsOnly: true })}>See all →</button>
        </div>
        <div className="grid">
          {deals.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onOpen={() => go({ name: 'item', id: item.id })}
              wishlisted={state.wishlist.includes(item.id)}
              onToggleWish={() => dispatch({ type: 'TOGGLE_WISHLIST', itemId: item.id })}
            />
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2>🎒 Production kits</h2>
        </div>
        <div className="kit-grid">
          {KITS.map((kit) => {
            const kitItems = kit.itemIds.map(getItem)
            const full = kitItems.reduce((s, i) => s + i.pricePerDay, 0)
            const price = Math.round(full * (1 - kit.percentOff / 100))
            return (
              <div className="kit-card" key={kit.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 16 }}>{kit.emoji} {kit.name}</h3>
                  <Badge tone="purple">Save {kit.percentOff}%</Badge>
                </div>
                <div className="kit-thumbs">
                  {kitItems.map((i) => <ItemArt key={i.id} item={i} size="thumb" />)}
                </div>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>{kit.blurb}</p>
                <div>
                  <s className="muted small">{money(full)}</s> <b>{money(price)}</b><span className="muted"> /day</span>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    kitItems.forEach((i) =>
                      dispatch({
                        type: 'ADD_TO_CART',
                        booking: {
                          itemId: i.id,
                          startDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
                          endDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
                          pickupTime: '09:00',
                          qty: 1,
                          insurance: true,
                          operator: false,
                          transport: 'van',
                          agreedPricePerDay: Math.round(i.pricePerDay * (1 - kit.percentOff / 100)),
                          negotiated: false,
                        },
                      })
                    )
                    toast(`${kit.name} added to cart — adjust dates in cart 🎒`)
                  }}
                >
                  Add kit to cart
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2>🔥 Trending on set</h2>
        </div>
        <div className="grid">
          {trending.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onOpen={() => go({ name: 'item', id: item.id })}
              wishlisted={state.wishlist.includes(item.id)}
              onToggleWish={() => dispatch({ type: 'TOGGLE_WISHLIST', itemId: item.id })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
