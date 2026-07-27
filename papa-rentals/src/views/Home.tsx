import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, ITEMS, KITS, getItem, getOwner } from '../data/catalog'
import { useNav } from '../nav'
import { forYou, similarItems } from '../recs'
import { vendors } from '../vendors'
import { useStore } from '../store'
import { buzz, dealActive, dealEndsAt, fmtCountdown, money, todayISO, uid, weightedRating } from '../utils'
import { Badge, ItemArt, ItemCard } from '../components/ui'
import { DeptMark, Icon } from '../components/icons'
import { VendorCard } from '../components/VendorCard'
import StudioHero from '../components/StudioHero'
import ServicesBand from '../components/ServicesBand'
import type { Item, SavedSearch } from '../types'

const RAIL_SEEN_KEY = 'papa-rail-impressions'

/* One reusable rail so every horizontal strip on Home scrolls, labels and
   keyboards the same way. Duplicating this markup is how sections drift apart. */
function Rail({
  id,
  title,
  icon,
  sub,
  action,
  filters,
  children,
}: {
  id?: string
  title: string
  icon?: React.ComponentProps<typeof Icon>['name']
  sub?: string
  action?: { label: string; onClick: () => void }
  filters?: React.ReactNode
  children: React.ReactNode
}) {
  const track = useRef<HTMLDivElement>(null)
  const [atEnd, setAtEnd] = useState(false)

  /* Which rails actually get seen decides which ones survive. No analytics
     backend yet, so impressions accumulate locally for the first one to read. */
  useEffect(() => {
    const el = track.current
    if (!el || !id) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        try {
          const seen = JSON.parse(localStorage.getItem(RAIL_SEEN_KEY) || '{}')
          seen[id] = (seen[id] ?? 0) + 1
          localStorage.setItem(RAIL_SEEN_KEY, JSON.stringify(seen))
        } catch { /* storage unavailable */ }
      },
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [id])

  function onScroll() {
    const el = track.current
    if (!el) return
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8)
  }

  return (
    <div className="section" id={id}>
      <div className="section-head">
        <div>
          <h2>{icon && <Icon name={icon} className="h-ico" />} {title}</h2>
          {sub && <div className="section-sub">{sub}</div>}
        </div>
        {action && (
          <button className="link-btn" onClick={action.onClick}>
            {action.label} <Icon name="arrow-right" size={13} />
          </button>
        )}
      </div>
      {filters && <div className="rail-filters">{filters}</div>}
      <div
        className="h-scroll"
        ref={track}
        onScroll={onScroll}
        role="group"
        aria-label={title}
        tabIndex={0}
      >
        {children}
      </div>
      {!atEnd && <div className="rail-more muted small" aria-hidden="true">Swipe for more <Icon name="chevron-right" size={12} /></div>}
    </div>
  )
}

/* Home is long. Without a jump bar the only way to reach the vendors is to
   flick past six rails, and nobody scrolls that far twice. */
const JUMPS: { id: string; label: string; icon: React.ComponentProps<typeof Icon>['name'] }[] = [
  { id: 'deals', label: 'Deals', icon: 'bolt' },
  { id: 'kits', label: 'Kits', icon: 'backpack' },
  { id: 'vendors', label: 'Vendors', icon: 'store' },
  { id: 'spaces', label: 'Spaces', icon: 'pin' },
  { id: 'trending', label: 'Trending', icon: 'flame' },
]

function JumpBar() {
  return (
    <nav className="jump-bar" aria-label="Jump to a section">
      {JUMPS.map((j) => (
        <button
          key={j.id}
          className="slot-chip"
          onClick={() => {
            buzz()
            document.getElementById(j.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        >
          <Icon name={j.icon} size={13} /> {j.label}
        </button>
      ))}
    </nav>
  )
}

/* A saved search with no typed words still has a category and a price cap, and
   an empty chip tells the renter nothing about what they saved. */
function savedLabel(s: SavedSearch): string {
  const base = s.q || CATEGORIES.find((c) => c.id === s.category)?.name || 'All gear'
  return s.maxPrice ? `${base} · under ${money(s.maxPrice)}` : base
}

/* Placeholders while a pull-to-refresh re-rolls the rails. An empty gap reads as
   a broken page; a shimmering card reads as "one second". */
function RailSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="h-scroll" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <div key={i} className="card-skeleton" />)}
    </div>
  )
}

/* A deal without a visible clock is just a badge. */
function DealCountdown({ itemId }: { itemId: string }) {
  const [left, setLeft] = useState(() => dealEndsAt(itemId) - Date.now())
  useEffect(() => {
    const t = setInterval(() => setLeft(dealEndsAt(itemId) - Date.now()), 1000)
    return () => clearInterval(t)
  }, [itemId])
  if (left <= 0) return null
  return <span className="muted small"><Icon name="clock" size={12} /> {fmtCountdown(left)} left</span>
}

export default function Home() {
  const { go, toast } = useNav()
  const { state, dispatch } = useStore()
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  /* Bumping this re-rolls every rail that uses it, so a pull actually changes
     the page instead of playing a spinner for 700ms and lying about it. */
  const [shuffle, setShuffle] = useState(0)
  const [kitDate, setKitDate] = useState(todayISO(2))
  const pullStart = useRef<number | null>(null)

  /* Pull-to-refresh never calls preventDefault, so these handlers only observe the
     gesture — native scrolling (and the Android WebView's own overscroll) keeps
     working. Adding a preventDefault here would freeze the whole page in the wrapper. */
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
    if (!pulling) return
    setPulling(false)
    setRefreshing(true)
    buzz()
    setTimeout(() => {
      setShuffle((n) => n + 1)
      setRefreshing(false)
      toast('Refreshed — new picks for you')
    }, 600)
  }

  const visible = useMemo(
    () => [...ITEMS, ...state.myListings.filter((l) => !l.paused)].filter((i) => !state.blockedOwners.includes(i.ownerId)),
    [state.myListings, state.blockedOwners]
  )

  const spaces = useMemo(
    () => visible.filter((i) => i.space).sort((a, b) => b.timesRented - a.timesRented),
    [visible]
  )

  /* A rooftop and a greenscreen stage are not interchangeable, and a renter
     scanning for one shouldn't have to swipe past six of the other. */
  const spaceTypes = useMemo(
    () => Array.from(new Set(spaces.map((i) => i.space?.type).filter(Boolean) as string[])),
    [spaces]
  )
  const [spaceType, setSpaceType] = useState<string | null>(null)
  const shownSpaces = useMemo(
    () => (spaceType ? spaces.filter((i) => i.space?.type === spaceType) : spaces),
    [spaces, spaceType]
  )

  const deals = useMemo(() => visible.filter((i) => dealActive(i.id)), [visible, shuffle])

  /* Raw rental counts freeze the same eight items on the page forever. Damp the
     count and mix in rating so the strip breathes between refreshes. */
  const trending = useMemo(() => {
    const scored = visible.map((i) => ({
      i,
      score: Math.log10(i.timesRented + 1) * 2 + (weightedRating(i.rating, i.ratingCount) - 4),
    }))
    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, 14).map((s) => s.i)
    return top.slice(shuffle % 3, (shuffle % 3) + 8)
  }, [visible, shuffle])

  const recentlyViewed = useMemo(
    () => state.recentlyViewed.map(getItem).filter((i) => !state.blockedOwners.includes(i.ownerId)),
    [state.recentlyViewed, state.blockedOwners]
  )

  const picks = useMemo(() => forYou(state, 8), [state, shuffle])

  /* Cold start: a brand-new renter has no affinity, so "For you" would be blank.
     Show the highest-rated, most-rented starters instead of an empty section. */
  const coldStart = useMemo(
    () =>
      picks.length > 0
        ? []
        : [...visible]
            .sort((a, b) => weightedRating(b.rating, b.ratingCount) - weightedRating(a.rating, a.ratingCount))
            .slice(0, 8),
    [picks.length, visible]
  )

  const vendorList = useMemo(() => vendors(state, 'top'), [state.myListings, state.blockedOwners])

  /* Rotate the seed through recent history instead of pinning it to the last
     item — otherwise this rail never changes until you open something new. */
  const seed: Item | undefined = recentlyViewed.length ? recentlyViewed[shuffle % Math.min(recentlyViewed.length, 3)] : undefined
  const becauseViewed = useMemo(() => (seed ? similarItems(seed.id, state, 6) : []), [seed, state])

  /* Cheapest live price per department — a chip that says "from Rs X" is worth
     three that just say a name. */
  const catFrom = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of visible) m.set(i.category, Math.min(m.get(i.category) ?? Infinity, i.pricePerDay))
    return m
  }, [visible])

  /* Well-rated gear that hasn't been discovered yet — surfaces the long tail
     instead of showing the same top-sellers in three different rails. */
  const hiddenGems = useMemo(
    () =>
      visible
        .filter((i) => i.ratingCount >= 3 && i.rating >= 4.5 && i.timesRented < 12)
        .sort((a, b) => weightedRating(b.rating, b.ratingCount) - weightedRating(a.rating, a.ratingCount))
        .slice(0, 8),
    [visible]
  )

  /* Gear near where you last shot beats gear near where you live — a crew books
     for the location, and a short vendor hop is what keeps a call sheet on time. */
  const lastShootArea = useMemo(() => {
    const last = state.orders[0]
    if (!last) return undefined
    return getOwner(getItem(last.lines[0].itemId).ownerId).area
  }, [state.orders])

  const nearLastShoot = useMemo(
    () =>
      lastShootArea
        ? visible
            .filter((i) => getOwner(i.ownerId).area === lastShootArea)
            .sort((a, b) => weightedRating(b.rating, b.ratingCount) - weightedRating(a.rating, a.ratingCount))
            .slice(0, 8)
        : [],
    [visible, lastShootArea]
  )

  /* Nothing in the catalogue carries a listed-on date, so "new" is inferred from
     the gear nobody has rented yet — which is what a renter actually cares about. */
  const justListed = useMemo(
    () => visible.filter((i) => i.timesRented <= 2).sort((a, b) => b.rating - a.rating).slice(0, 8),
    [visible]
  )

  /* Real totals from the catalogue, not invented marketing numbers. */
  const proof = useMemo(
    () => ({
      listings: visible.length,
      vendors: vendorList.length,
      shoots: visible.reduce((s, i) => s + i.timesRented, 0),
    }),
    [visible, vendorList.length]
  )

  const cartCount = state.cart.length

  const cardProps = (item: Item, index?: number) => ({
    item,
    index,
    onOpen: () => go({ name: 'item', id: item.id }),
    wishlisted: state.wishlist.includes(item.id),
    onToggleWish: () => dispatch({ type: 'TOGGLE_WISHLIST', itemId: item.id }),
  })

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className={refreshing ? 'is-refreshing' : ''}>
      <div className={`ptr ${pulling || refreshing ? 'active' : ''}`} aria-hidden="true">
        <span className="spin"><Icon name="refresh" size={15} /></span> {refreshing ? 'Refreshing…' : 'Release to refresh'}
      </div>
      <StudioHero />

      <div className="proof-band" role="note">
        <div><b>{proof.listings}</b><span className="muted small"> listings</span></div>
        <div><b>{proof.vendors}</b><span className="muted small"> vendors</span></div>
        <div><b>{proof.shoots.toLocaleString('en-GB')}</b><span className="muted small"> shoots supplied</span></div>
      </div>

      <JumpBar />

      {state.walletBalance > 0 && (
        <div className="section">
          <button className="kit-card promo-card" style={{ width: '100%', textAlign: 'left' }} onClick={() => go({ name: 'wallet' })}>
            <span className="promo-ico"><Icon name="wallet" size={22} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 14 }}>{money(state.walletBalance)} credit ready to spend</b>
              <div className="muted small">Applied automatically at checkout · {state.points} points on top</div>
            </div>
            <Icon name="chevron-right" size={16} />
          </button>
        </div>
      )}

      {state.savedSearches.length > 0 && (
        <div className="section">
          <div className="section-head">
            <div><h2><Icon name="search" className="h-ico" /> Saved searches</h2></div>
          </div>
          <div className="rail-filters">
            {state.savedSearches.map((s) => (
              <span key={s.id} className="saved-search">
                <button
                  className="slot-chip"
                  onClick={() => { buzz(); go({ name: 'browse', query: s.q, category: s.category, maxPrice: s.maxPrice }) }}
                >
                  <Icon name="search" size={12} /> {savedLabel(s)}
                </button>
                <button
                  className="saved-search-x"
                  aria-label={`Remove saved search ${savedLabel(s)}`}
                  onClick={() => { buzz(); dispatch({ type: 'REMOVE_SAVED_SEARCH', id: s.id }); toast('Saved search removed') }}
                >
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {cartCount > 0 && (
        <div className="section">
          <button className="kit-card promo-card" style={{ width: '100%', textAlign: 'left' }} onClick={() => go({ name: 'cart' })}>
            <span className="promo-ico"><Icon name="cart" size={22} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 14 }}>Pick up where you left off</b>
              <div className="muted small">{cartCount} item{cartCount > 1 ? 's' : ''} waiting in your cart</div>
            </div>
            <Icon name="chevron-right" size={16} />
          </button>
        </div>
      )}

      <div className="section">
        <div className="section-head">
          <h2>Departments</h2>
          <span style={{ display: 'flex', gap: 12 }}>
            {state.wishlist.length > 0 && (
              <button className="link-btn" onClick={() => go({ name: 'browse', wishlistOnly: true })}>
                <Icon name="heart-filled" size={13} /> Wishlist ({state.wishlist.length})
              </button>
            )}
            {/* Trust is the first filter most renters reach for, and burying it
                three taps deep in Browse means most never find it. */}
            <button className="link-btn" onClick={() => go({ name: 'browse', verified: true })}>
              <Icon name="shield" size={13} /> Verified only
            </button>
            <button className="link-btn" onClick={() => go({ name: 'browse' })}>Browse all <Icon name="arrow-right" size={13} /></button>
          </span>
        </div>
        <div className="cat-row">
          {CATEGORIES.map((c) => {
            const from = catFrom.get(c.id)
            return (
              <button
                key={c.id}
                className="cat-chip"
                aria-label={from ? `${c.name}, from ${money(from)} per day` : c.name}
                onClick={() => go({ name: 'browse', category: c.id })}
              >
                <span className="cat-ico" aria-hidden="true"><DeptMark id={c.id} size={44} /></span>
                {c.name}
                {from != null && <span className="muted small" style={{ display: 'block' }}>from {money(from)}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <ServicesBand />

      {/* ---- Promoted offers & packages come first ---- */}
      {deals.length > 0 && (
        <Rail
          id="deals"
          title="Flash deals"
          icon="bolt"
          sub="Limited-time offers from vendors"
          action={{ label: 'See all', onClick: () => go({ name: 'browse', dealsOnly: true }) }}
        >
          {deals.map((item, idx) => (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <ItemCard {...cardProps(item, idx)} />
              <DealCountdown itemId={item.id} />
            </div>
          ))}
        </Rail>
      )}

      <div className="section" id="kits">
        <div className="section-head">
          <div>
            <h2><Icon name="backpack" className="h-ico" /> Production kits</h2>
            <div className="section-sub">Bundled packages at a package price</div>
          </div>
        </div>
        <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
          Shoot date for kits{' '}
          <input
            type="date"
            value={kitDate}
            min={todayISO(0)}
            onChange={(e) => setKitDate(e.target.value)}
            style={{ marginLeft: 6 }}
          />
        </label>
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
                  <s className="muted small">{money(full)}</s> <b>{money(price)}</b><span className="muted"> bundle /day · {kitItems.length} items</span>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    buzz()
                    kitItems.forEach((i) =>
                      dispatch({
                        type: 'ADD_TO_CART',
                        booking: {
                          id: uid(),
                          itemId: i.id,
                          startDate: kitDate,
                          endDate: kitDate,
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
                    toast(`${kit.name} added for ${kitDate}`)
                  }}
                >
                  Add kit to cart
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ---- Then the vendors, foodpanda-style storefront cards ---- */}
      <div className="section" id="vendors">
        <div className="section-head">
          <div>
            <h2><Icon name="store" className="h-ico" /> Vendors near you</h2>
            <div className="section-sub">{vendorList.length} rental houses · {vendorList.reduce((s, v) => s + v.count, 0)} listings · tap a vendor to explore their storefront</div>
          </div>
        </div>
        <div className="vendor-list">
          {vendorList.map((v, idx) => <VendorCard key={v.owner.id} vendor={v} index={idx} />)}
        </div>
        <div className="kit-card promo-card">
          <span className="promo-ico"><Icon name="home" size={26} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>Own a studio, camera kit or grip truck?</b>
            <div className="muted small">Become a vendor in 2 minutes — you keep 90% of every booking.</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => go({ name: 'post' })}>Start listing</button>
        </div>
      </div>

      {/* ---- Hybrid discovery tail ---- */}
      {recentlyViewed.length > 0 && (
        <Rail
          id="recent"
          title="Recently viewed"
          icon="eye"
          sub="Jump back to anything you were looking at"
          action={{ label: 'Wishlist', onClick: () => go({ name: 'browse', wishlistOnly: true }) }}
        >
          {recentlyViewed.slice(0, 10).map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
        </Rail>
      )}

      {refreshing ? (
        <div className="section">
          <div className="section-head"><h2><Icon name="sparkles" className="h-ico" /> For you</h2></div>
          <RailSkeleton />
        </div>
      ) : picks.length > 0 && (
        <Rail id="foryou" title="For you" icon="sparkles" sub="Picked from what you've been browsing">
          {picks.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
        </Rail>
      )}

      {justListed.length > 0 && (
        <Rail id="new" title="New this week" icon="bulb" sub="Freshly listed gear, not yet booked out">
          {justListed.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
        </Rail>
      )}

      {coldStart.length > 0 && (
        <Rail id="starters" title="Popular starters" icon="sparkles" sub="Highest-rated gear in every department">
          {coldStart.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
        </Rail>
      )}

      {nearLastShoot.length > 0 && (
        <Rail id="nearby" title="Near your last shoot" icon="pin" sub={`Vendors around ${lastShootArea}`}>
          {nearLastShoot.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
        </Rail>
      )}

      {seed && becauseViewed.length > 0 && (
        <Rail id="because" title="Because you viewed" icon="target" sub={seed.name}>
          {becauseViewed.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
        </Rail>
      )}

      <Rail
        id="spaces"
        title="Spaces to shoot at"
        icon="pin"
        action={{ label: 'All spaces', onClick: () => go({ name: 'browse', category: 'studios' }) }}
        filters={
          spaceTypes.length > 1 && (
            <>
              <button
                className={`slot-chip${spaceType === null ? ' active' : ''}`}
                aria-pressed={spaceType === null}
                onClick={() => { buzz(); setSpaceType(null) }}
              >
                All ({spaces.length})
              </button>
              {spaceTypes.map((t) => (
                <button
                  key={t}
                  className={`slot-chip${spaceType === t ? ' active' : ''}`}
                  aria-pressed={spaceType === t}
                  onClick={() => { buzz(); setSpaceType(spaceType === t ? null : t) }}
                >
                  {t}
                </button>
              ))}
            </>
          )
        }
      >
        {shownSpaces.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
      </Rail>

      {hiddenGems.length > 0 && (
        <Rail id="gems" title="Hidden gems" icon="gift" sub="4.5+ stars, under 12 bookings so far">
          {hiddenGems.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
        </Rail>
      )}

      <div className="section" id="trending">
        <div className="section-head">
          <div>
            <h2><Icon name="flame" className="h-ico" /> Trending on set</h2>
            <div className="section-sub">What crews in your city booked most this week</div>
          </div>
        </div>
        <div className="grid">
          {trending.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
        </div>
      </div>
    </div>
  )
}
