import { useMemo, useRef, useState } from 'react'
import { CATEGORIES, ITEMS, KITS, getItem } from '../data/catalog'
import { HERO_IMAGE } from '../data/images'
import { useNav } from '../nav'
import { forYou, similarItems } from '../recs'
import { useStore } from '../store'
import { buzz, dealActive, money, todayISO } from '../utils'
import { Badge, ItemArt, ItemCard } from '../components/ui'
import { Icon } from '../components/icons'

export default function Home() {
  const { go, toast } = useNav()
  const { state, dispatch } = useStore()
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const pullStart = useRef<number | null>(null)

  function onTouchStart(e: React.TouchEvent) {
    if (window.scrollY <= 0) pullStart.current = e.touches[0].clientY
  }
  function onTouchMove(e: React.TouchEvent) {
    if (pullStart.current == null) return
    const delta = e.touches[0].clientY - pullStart.current
    setPulling(delta > 70)
  }
  function onTouchEnd() {
    pullStart.current = null
    if (pulling) {
      setPulling(false)
      setRefreshing(true)
      setTimeout(() => {
        setRefreshing(false)
        toast('You’re up to date')
      }, 700)
    } else {
      setPulling(false)
    }
  }

  const live = state.myListings.filter((l) => !l.paused)
  const visible = [...ITEMS, ...live].filter((i) => !state.blockedOwners.includes(i.ownerId))
  const spaces = visible.filter((i) => i.space).sort((a, b) => b.timesRented - a.timesRented)
  const deals = visible.filter((i) => dealActive(i.id))
  const trending = [...visible].sort((a, b) => b.timesRented - a.timesRented).slice(0, 8)
  const recentlyViewed = state.recentlyViewed.map(getItem).filter((i) => !state.blockedOwners.includes(i.ownerId))
  const picks = useMemo(() => forYou(state, 8), [state])
  const lastViewed = recentlyViewed[0]
  const becauseViewed = useMemo(
    () => (lastViewed ? similarItems(lastViewed.id, state, 6) : []),
    [lastViewed, state]
  )

  const cardProps = (item: (typeof ITEMS)[number], index?: number) => ({
    item,
    index,
    onOpen: () => go({ name: 'item', id: item.id }),
    wishlisted: state.wishlist.includes(item.id),
    onToggleWish: () => dispatch({ type: 'TOGGLE_WISHLIST', itemId: item.id }),
  })

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className={`ptr ${pulling || refreshing ? 'active' : ''}`} aria-hidden="true">
        <span className="spin"><Icon name="refresh" size={15} /></span> {refreshing ? 'Refreshing…' : 'Release to refresh'}
      </div>
      <div className="hero">
        <img
          className="hero-photo"
          src={HERO_IMAGE}
          alt=""
          loading="eager"
          decoding="async"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <div className="hero-scrim" aria-hidden="true" />
        <div className="hero-content">
          <h1>
            {state.profile.name ? `Salaam, ${state.profile.name}!` : 'Rent everything for'}<br />
            {state.profile.name ? 'What are we shooting?' : 'your next shoot.'}
          </h1>
          <p>Cameras, glass, lights, grip trucks and crew vans — delivered to set like a food order, priced like a negotiation.</p>
          <div className="hero-badges">
            <span><Icon name="bolt" size={13} /> Instant booking</span>
            <span><Icon name="handshake" size={13} /> Offer your price</span>
            <span><Icon name="van" size={13} /> Delivery to set</span>
            <span><Icon name="shield" size={13} /> Damage protection</span>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2>Departments</h2>
          <button className="link-btn" onClick={() => go({ name: 'browse' })}>Browse all <Icon name="arrow-right" size={13} /></button>
        </div>
        <div className="cat-row">
          {CATEGORIES.map((c) => (
            <button key={c.id} className="cat-chip" onClick={() => go({ name: 'browse', category: c.id })}>
              <span className="cat-ico" style={{ background: c.gradient }}><Icon name={c.icon} size={24} /></span>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {picks.length > 0 && (
        <div className="section">
          <div className="section-head">
            <div>
              <h2><Icon name="sparkles" className="h-ico" /> For you</h2>
              <div className="section-sub">Picked from what you've been browsing</div>
            </div>
          </div>
          <div className="h-scroll">
            {picks.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-head">
          <h2><Icon name="pin" className="h-ico" /> Spaces to shoot at</h2>
          <button className="link-btn" onClick={() => go({ name: 'browse', category: 'studios' })}>All spaces <Icon name="arrow-right" size={13} /></button>
        </div>
        <div className="h-scroll">
          {spaces.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
        </div>
        <div className="kit-card promo-card">
          <span className="promo-ico"><Icon name="home" size={26} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>Own a studio, rooftop or haveli?</b>
            <div className="muted small">List it in 2 minutes — you keep 90% of every booking.</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => go({ name: 'post' })}>List your space</button>
        </div>
      </div>

      {recentlyViewed.length > 0 && (
        <div className="section">
          <div className="section-head"><h2><Icon name="eye" className="h-ico" /> Recently viewed</h2></div>
          <div className="h-scroll">
            {recentlyViewed.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
          </div>
        </div>
      )}

      {lastViewed && becauseViewed.length > 0 && (
        <div className="section">
          <div className="section-head">
            <div>
              <h2><Icon name="target" className="h-ico" /> Because you viewed</h2>
              <div className="section-sub">{lastViewed.name}</div>
            </div>
          </div>
          <div className="h-scroll">
            {becauseViewed.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
          </div>
        </div>
      )}

      {deals.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h2><Icon name="bolt" className="h-ico" /> Flash deals</h2>
            <button className="link-btn" onClick={() => go({ name: 'browse', dealsOnly: true })}>See all <Icon name="arrow-right" size={13} /></button>
          </div>
          <div className="grid">
            {deals.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-head">
          <h2><Icon name="backpack" className="h-ico" /> Production kits</h2>
        </div>
        <div className="kit-grid">
          {KITS.map((kit) => {
            const kitItems = kit.itemIds.map(getItem)
            const full = kitItems.reduce((s, i) => s + i.pricePerDay, 0)
            const price = Math.round(full * (1 - kit.percentOff / 100))
            return (
              <div className="kit-card" key={kit.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name={kit.icon} size={18} /> {kit.name}</h3>
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
                    buzz()
                    kitItems.forEach((i) =>
                      dispatch({
                        type: 'ADD_TO_CART',
                        booking: {
                          itemId: i.id,
                          startDate: todayISO(2),
                          endDate: todayISO(2),
                          pickupTime: '09:00',
                          qty: 1,
                          unit: 'day',
                          hours: 4,
                          insurance: true,
                          operator: false,
                          transport: 'van',
                          rate: Math.round(i.pricePerDay * (1 - kit.percentOff / 100)),
                          negotiated: false,
                        },
                      })
                    )
                    toast(`${kit.name} added to cart — adjust dates in cart`)
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
          <h2><Icon name="flame" className="h-ico" /> Trending on set</h2>
        </div>
        <div className="grid">
          {trending.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
        </div>
      </div>
    </div>
  )
}
