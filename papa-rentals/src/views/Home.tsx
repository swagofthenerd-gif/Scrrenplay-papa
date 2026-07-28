import { useEffect, useMemo, useRef, useState } from 'react'
import { ITEMS, KITS, getItem, getOwner } from '../data/catalog'
import { useNav } from '../nav'
import { forYou, similarItems } from '../recs'
import { vendors } from '../vendors'
import { useStore } from '../store'
import { buzz, dealActive, dealEndsAt, fmtCountdown, money, savedLabel, todayISO, uid, weightedRating } from '../utils'
import { Badge, ItemArt, ItemCard, ListingPromo } from '../components/ui'
import { DeptRow } from '../components/DeptRow'
import { SectionHeader } from '../components/primitives'
import { Icon, type IconName } from '../components/icons'
import { VendorCard } from '../components/VendorCard'
import StudioHero from '../components/StudioHero'
import ServicesBand from '../components/ServicesBand'
import type { Item } from '../types'

const RAIL_SEEN_KEY = 'papa-rail-impressions'

/* Same-day van delivery stops being reliable past this, so it's the honest
   boundary for calling a vendor "near you". */
const NEARBY_KM = 10

/* Pull distance (in finger-pixels) that arms the refresh, and the ceiling the
   damped indicator can reach however hard you yank. */
const PULL_TRIGGER = 70
const PULL_MAX = 64

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
  /* Icon's own prop widens to string so stale persisted data can't crash it.
     A rail's icon is written in source, so it should be checked. */
  icon?: IconName
  sub?: string
  action?: { label: string; onClick: () => void }
  filters?: React.ReactNode
  children: React.ReactNode
}) {
  const track = useRef<HTMLDivElement>(null)
  const [atEnd, setAtEnd] = useState(false)
  /* A rail with three cards doesn't scroll, but the hint said "Swipe for more"
     anyway — an instruction that does nothing when you follow it. Measure the
     track and only claim there's more when there actually is. */
  const [atStart, setAtStart] = useState(true)
  const [overflows, setOverflows] = useState(false)

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

  function measure() {
    const el = track.current
    if (!el) return
    setOverflows(el.scrollWidth > el.clientWidth + 8)
    setAtStart(el.scrollLeft <= 8)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8)
  }

  /* Rails are filled from state, so card counts change under us (a wishlist
     toggle, a refresh reshuffle). Re-measure when the track resizes rather
     than trusting a single mount-time reading. */
  useEffect(() => {
    const el = track.current
    if (!el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [children])

  function nudge(dir: 1 | -1) {
    const el = track.current
    if (!el) return
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: 'smooth' })
  }

  return (
    <div className="section" id={id}>
      <SectionHeader
        icon={icon}
        title={title}
        sub={sub}
        action={
          action && (
            <button className="link-btn" onClick={action.onClick}>
              {action.label} <Icon name="arrow-right" size={13} />
            </button>
          )
        }
      />
      {filters && <div className="rail-filters">{filters}</div>}
      <div className="rail-track">
        <div
          className="h-scroll"
          ref={track}
          onScroll={measure}
          role="group"
          aria-label={title}
          tabIndex={0}
        >
          {children}
        </div>
        {/* Arrows are for pointers, not thumbs — CSS hides them on touch, where
            the swipe hint below carries the same message without stealing space. */}
        {overflows && !atStart && (
          <button className="rail-arrow prev" onClick={() => nudge(-1)} aria-label={`Scroll ${title} back`}>
            <Icon name="chevron-left" size={18} />
          </button>
        )}
        {overflows && !atEnd && (
          <button className="rail-arrow next" onClick={() => nudge(1)} aria-label={`Scroll ${title} forward`}>
            <Icon name="chevron-right" size={18} />
          </button>
        )}
      </div>
      {overflows && !atEnd && <div className="rail-more muted small" aria-hidden="true">Swipe for more <Icon name="chevron-right" size={12} /></div>}
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
  const [pullPx, setPullPx] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  /* Bumping this re-rolls every rail that uses it, so a pull actually changes
     the page instead of playing a spinner for 700ms and lying about it. */
  const [shuffle, setShuffle] = useState(0)
  const [kitDate, setKitDate] = useState(todayISO(2))
  const pullStart = useRef<number | null>(null)

  /* These handlers only observe the gesture — none of them calls preventDefault, so
     it doesn't matter that React attaches touchmove passively: native scrolling and
     the Android WebView's own overscroll keep working. Blocking touchmove here would
     be the difference between a smooth flick and a page that feels stuck. */
  function onTouchStart(e: React.TouchEvent) {
    if (window.scrollY <= 0) pullStart.current = e.touches[0].clientY
  }
  function onTouchMove(e: React.TouchEvent) {
    if (pullStart.current == null) return
    const delta = e.touches[0].clientY - pullStart.current
    if (delta <= 0) { setPullPx(0); setPulling(false); return }
    /* Square-root damping: the indicator tracks the finger closely at first and
       then visibly fights back, so the gesture tells you it's near the limit
       instead of snapping open the instant you cross an invisible threshold. */
    setPullPx(Math.min(PULL_MAX, Math.sqrt(delta) * 6))
    setPulling(delta > PULL_TRIGGER)
  }
  function onTouchEnd() {
    pullStart.current = null
    setPullPx(0)
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
     count, mix in rating, then divide by the listing's age: 40 rentals in two
     months is momentum, 40 spread over two years is not, and only the first is
     worth calling "trending". Gear with no listing date scores as mature rather
     than as brand new, so a missing field can't game its way to the top. */
  const trending = useMemo(() => {
    const scored = visible.map((i) => {
      const ageDays = i.listedAt ? Math.max(7, (Date.now() - i.listedAt) / 86400000) : 180
      return {
        i,
        score:
          (Math.log10(i.timesRented + 1) * 2 + (weightedRating(i.rating, i.ratingCount) - 4)) *
          // Gentle decay: a 30-day listing gets ~1.6x the weight of a 180-day one.
          Math.pow(30 / ageDays, 0.35),
      }
    })
    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, 14).map((s) => s.i)
    return top.slice(shuffle % 3, (shuffle % 3) + 8)
  }, [visible, shuffle])

  const recentlyViewed = useMemo(
    () => state.recentlyViewed.map(getItem).filter((i) => !state.blockedOwners.includes(i.ownerId)),
    [state.recentlyViewed, state.blockedOwners]
  )

  /* Depend on the slices `forYou`/`similarItems` actually read, not on `state`.
     Keyed on the whole object, both rails re-scored the entire catalogue on
     every TICK, wallet movement and notification — several times a minute, for
     an identical result. On the low-end WebView this ships inside that is the
     difference between a rail that scrolls and one that stutters. */
  const recsDeps = [state.recentlyViewed, state.wishlist, state.orders, state.cart, state.myListings, state.blockedOwners]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const picks = useMemo(() => forYou(state, 8), [...recsDeps, shuffle])

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const becauseViewed = useMemo(() => (seed ? similarItems(seed.id, state, 6) : []), [seed, ...recsDeps])

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
  /* Was `timesRented <= 2`, which called well-established gear "new" purely
     because nobody had booked it — the rail read as a bargain bin. Age is the
     thing the title actually claims, so rank on it. */
  const justListed = useMemo(
    () =>
      visible
        .filter((i) => i.listedAt !== undefined)
        .sort((a, b) => (b.listedAt as number) - (a.listedAt as number))
        .slice(0, 8),
    [visible]
  )

  /* Real totals from the catalogue, not invented marketing numbers. */
  const proof = useMemo(
    () => ({
      listings: visible.length,
      vendors: vendorList.length,
      /* The city picked during onboarding never appeared anywhere again, so it
         read as a question we asked for no reason. Counting the vendors inside
         delivery range makes it earn its place — and it's the number a renter
         actually wants: not how big the platform is, how big it is for them. */
      nearby: vendorList.filter((v) => v.owner.distanceKm <= NEARBY_KM).length,
      shoots: visible.reduce((s, i) => s + i.timesRented, 0),
    }),
    [visible, vendorList]
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
      {/* Height follows the damped pull distance while a finger is down, so the strip
          tracks the gesture instead of snapping open at a hidden threshold. The
          `dragging` class kills the CSS transition during the drag — otherwise every
          frame animates toward the last value and the strip lags behind the thumb. */}
      <div
        className={`ptr ${pulling || refreshing ? 'active' : ''} ${pullPx > 0 ? 'dragging' : ''}`}
        style={pullPx > 0 && !refreshing ? { height: pullPx } : undefined}
        aria-hidden="true"
      >
        <span className="spin"><Icon name="refresh" size={15} /></span>{' '}
        {refreshing ? 'Refreshing…' : pulling ? 'Release to refresh' : 'Pull to refresh'}
      </div>
      <StudioHero />

      <div className="proof-band" role="note">
        <div><b>{proof.listings}</b><span className="muted small"> listings</span></div>
        <div>
          <b>{proof.nearby > 0 ? proof.nearby : proof.vendors}</b>
          <span className="muted small">
            {proof.nearby > 0 && state.profile.city ? ` vendors near ${state.profile.city}` : ' vendors'}
          </span>
        </div>
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
          <SectionHeader icon="search" title="Saved searches" />
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
        <SectionHeader
          icon="clapperboard"
          title="Departments"
          action={
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
          }
        />
        <DeptRow showFrom onPick={(id) => go({ name: 'browse', category: id })} />
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
        <SectionHeader icon="backpack" title="Production kits" sub="One booking, one delivery, one discounted rate" />
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
        {/* The old subtitle ended "tap a vendor to explore their storefront".
            Telling people how to tap a card is an admission the card doesn't
            look tappable — the chevron and the pressed state do that job. */}
        <SectionHeader
          icon="store"
          title="Vendors near you"
          sub={`${vendorList.length} rental houses · ${vendorList.reduce((s, v) => s + v.count, 0)} listings`}
        />
        <div className="vendor-list">
          {vendorList.map((v, idx) => <VendorCard key={v.owner.id} vendor={v} index={idx} />)}
        </div>
        {/* House icon on a pitch that leads with "camera kit or grip truck" was
            the wrong picture; a truck matches what the sentence is asking for. */}
        <ListingPromo
          icon="truck"
          title="Own a studio, camera kit or grip truck?"
          blurb="Become a vendor in 2 minutes — you keep 90% of every booking."
          cta="Start listing"
          onClick={() => go({ name: 'post' })}
        />
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
          <SectionHeader icon="sparkles" title="For you" />
          <RailSkeleton />
        </div>
      ) : picks.length > 0 && (
        <Rail id="foryou" title="For you" icon="sparkles" sub="Picked from what you've been browsing">
          {picks.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
        </Rail>
      )}

      {/* Title and subtitle both used to over-promise: the rail is ranked by
          listing date, so it's "recent", and some of it has been booked. */}
      {justListed.length > 0 && (
        <Rail id="new" title="Recently listed" icon="bulb" sub="The newest gear on Papa Rentals">
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
        <SectionHeader icon="flame" title="Trending on set" sub="What crews in your city booked most this week" />
        <div className="grid">
          {trending.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
        </div>
      </div>
    </div>
  )
}
