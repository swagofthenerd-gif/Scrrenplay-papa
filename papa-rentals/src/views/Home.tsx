import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, ITEMS, KITS, getItem, getOwner } from '../data/catalog'
import { activePromo } from '../data/promos'
import { useNav } from '../nav'
import { forYou, similarItems } from '../recs'
import { vendors } from '../vendors'
import { useStore } from '../store'
import { buzz, bundleDiscount, dealActive, dealEndsAt, fmtCountdown, fmtDate, money, savedLabel, todayISO, uid, weightedRating } from '../utils'
import { ItemArt, ItemCard, ListingPromo, Modal } from '../components/ui'
import { DeptRow } from '../components/DeptRow'
import { Chip, SectionHeader } from '../components/primitives'
import { Deferred } from '../components/Deferred'
import { Icon, type IconName } from '../components/icons'
import { VendorTile } from '../components/VendorCard'
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
  const [builderOpen, setBuilderOpen] = useState(false)
  /* Collapsed by default: the tail is six re-rankings of the same catalogue,
     and opening it should be a choice rather than the price of scrolling. */
  const [moreOpen, setMoreOpen] = useState(false)
  const [builderCat, setBuilderCat] = useState<string>('all')
  const [builderIds, setBuilderIds] = useState<string[]>([])
  const pullStart = useRef<number | null>(null)

  const builderChoices = useMemo(
    () => ITEMS.filter((i) => (builderCat === 'all' || i.category === builderCat) && !state.blockedOwners.includes(i.ownerId)),
    [builderCat, state.blockedOwners]
  )
  /* Resolved from the picked ids rather than from the filtered list, so switching
     the category chip never silently drops something already in the kit. */
  const builderItems = useMemo(
    () => builderIds.map((id) => ITEMS.find((i) => i.id === id)).filter((i): i is Item => Boolean(i)),
    [builderIds]
  )
  /* Recomputed per render off today's date: the app can sit open past midnight
     on a phone that never gets closed, and a promo whose season ended overnight
     should stop claiming it's on. */
  const promo = activePromo(todayISO(0))

  const builderFull = builderItems.reduce((s, i) => s + i.pricePerDay, 0)
  const builderDiscount = bundleDiscount(builderItems.length)
  const builderPrice = Math.round(builderFull * (1 - builderDiscount / 100))

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

  /* Resolved against the catalogue rather than through getItem, which falls back
     to ITEMS[0] for an unknown id — a draft on a listing that has since been
     deleted would otherwise offer to resume a booking on an unrelated camera. */
  const drafts = useMemo(
    () =>
      state.bookingDrafts
        .map((d) => ({ ...d, item: ITEMS.find((i) => i.id === d.itemId) }))
        .filter((d): d is typeof d & { item: Item } => Boolean(d.item) && !state.blockedOwners.includes(d.item!.ownerId))
        .slice(0, 3),
    [state.bookingDrafts, state.blockedOwners]
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
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className={`home-view${refreshing ? ' is-refreshing' : ''}`}>
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

      {/* Three boxed stat tiles competed with the hero for the same glance and
          read as a dashboard. The numbers still earn their place — they are the
          only proof on the page that anyone else uses this — but as one quiet
          line of type, not a second headline. */}
      <p className="proof-line" role="note">
        {proof.listings} listings · {proof.nearby > 0 ? proof.nearby : proof.vendors} vendors
        {proof.nearby > 0 && state.profile.city ? ` near ${state.profile.city}` : ''} · {proof.shoots.toLocaleString('en-GB')} shoots supplied
      </p>

      {/* Above the jump bar because it's the one thing on this page that's only
          true this month. Nothing renders out of season — an empty slot beats a
          banner for a season that ended. */}
      {promo && (
        <button
          className="season-promo"
          onClick={() => { buzz(); go({ name: 'browse', ...promo.target }) }}
        >
          <Icon name={promo.icon} size={22} className="season-promo-ico" />
          <span className="season-promo-text">
            <span className="season-promo-title">{promo.title}</span>
            <span className="muted small">{promo.blurb}</span>
          </span>
          <span className="season-promo-cta">{promo.cta} <Icon name="arrow-right" size={13} /></span>
        </button>
      )}

      {/* Wallet credit, an abandoned cart, a half-filled booking and saved
          searches each used to be their own full-width section with its own
          heading, so a returning user met four boxes before reaching any gear.
          They are all the same thing — unfinished business — so they are one
          object now, and it disappears entirely for anyone with none. */}
      {(cartCount > 0 || drafts.length > 0 || state.walletBalance > 0 || state.savedSearches.length > 0 || state.wishlist.length > 0) && (
        <div className="section">
          <div className="continue-card">
            {cartCount > 0 && (
              <button className="continue-row" onClick={() => { buzz(); go({ name: 'cart' }) }}>
                <Icon name="cart" size={18} />
                <span className="continue-text">
                  <b>{cartCount} item{cartCount > 1 ? 's' : ''} in your cart</b>
                  <span className="muted small">Finish booking before someone else takes the dates</span>
                </span>
                <Icon name="chevron-right" size={16} />
              </button>
            )}

            {/* Only the latest draft: the point is one obvious way back in, and a
                list of half-starts is the clutter this card replaced. */}
            {drafts.slice(0, 1).map((d) => (
              <button
                key={d.itemId}
                className="continue-row"
                onClick={() => { buzz(); go({ name: 'item', id: d.itemId, from: d.startDate, to: d.endDate }) }}
              >
                <Icon name="calendar" size={18} />
                <span className="continue-text">
                  <b>{d.item.name}</b>
                  <span className="muted small">
                    {fmtDate(d.startDate)} – {fmtDate(d.endDate)} · dates ready, never booked
                  </span>
                </span>
                <Icon name="chevron-right" size={16} />
              </button>
            ))}

            {state.walletBalance > 0 && (
              <button className="continue-row" onClick={() => { buzz(); go({ name: 'wallet' }) }}>
                <Icon name="wallet" size={18} />
                <span className="continue-text">
                  <b>{money(state.walletBalance)} credit</b>
                  <span className="muted small">Applied at checkout · {state.points} points on top</span>
                </span>
                <Icon name="chevron-right" size={16} />
              </button>
            )}

            {(state.savedSearches.length > 0 || state.wishlist.length > 0) && (
              <div className="continue-chips">
                {state.wishlist.length > 0 && (
                  <button className="slot-chip" onClick={() => { buzz(); go({ name: 'browse', wishlistOnly: true }) }}>
                    <Icon name="heart-filled" size={12} /> Wishlist ({state.wishlist.length})
                  </button>
                )}
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
            )}
          </div>
        </div>
      )}

      <div className="section">
        <SectionHeader
          title="Departments"
          action={<button className="link-btn" onClick={() => go({ name: 'browse' })}>Browse all <Icon name="arrow-right" size={13} /></button>}
        />
        <DeptRow showFrom onPick={(id) => go({ name: 'browse', category: id })} />
      </div>

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

      {/* Four full-width kit blocks, each with a blurb, a thumbnail strip, two
          buttons and a date field, ran most of a screen before the first vendor
          appeared. A kit is one idea — a discounted bundle for a kind of shoot —
          so a card states that idea and the detail page, which already has its
          own dates and an add button, handles the commitment. */}
      <Rail
        id="kits"
        title="Production kits"
        sub="One booking, one delivery, one discounted rate"
        action={{ label: 'Build your own', onClick: () => { buzz(); setBuilderOpen(true) } }}
      >
        {KITS.map((kit) => {
          const kitItems = kit.itemIds.map(getItem)
          const full = kitItems.reduce((s, i) => s + i.pricePerDay, 0)
          const price = Math.round(full * (1 - kit.percentOff / 100))
          return (
            <button key={kit.id} className="kit-tile" onClick={() => { buzz(); go({ name: 'kit', id: kit.id }) }}>
              <span className="kit-tile-head">
                <Icon name={kit.icon} size={16} />
                <b className="kit-tile-name">{kit.name}</b>
              </span>
              <span className="kit-thumbs">
                {kitItems.map((i) => <ItemArt key={i.id} item={i} size="thumb" />)}
              </span>
              <span className="kit-tile-price">
                <b>{money(price)}</b>
                <span className="muted small"> /day · {kitItems.length} items</span>
              </span>
              <span className="kit-tile-save">Save {kit.percentOff}% vs {money(full)}</span>
            </button>
          )
        })}
        <button className="kit-tile kit-tile-build" onClick={() => { buzz(); setBuilderOpen(true) }}>
          <span className="kit-tile-head"><Icon name="plus" size={16} /> <b className="kit-tile-name">Build your own</b></span>
          <span className="muted small">Bundle any gear — 2 items 5%, 5 or more 18% off.</span>
          <span className="kit-tile-save">Save up to 18%</span>
        </button>
      </Rail>

      {builderOpen && (
        <Modal title="Build your own kit" onClose={() => setBuilderOpen(false)}>
          <label className="muted small" style={{ display: 'block', marginBottom: 10 }}>
            Shoot date{' '}
            <input type="date" value={kitDate} min={todayISO(0)} onChange={(e) => setKitDate(e.target.value)} style={{ marginLeft: 6 }} />
          </label>
          <div className="rail-filters" style={{ marginBottom: 10 }}>
            <Chip active={builderCat === 'all'} onClick={() => setBuilderCat('all')}>All</Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c.id} active={builderCat === c.id} onClick={() => setBuilderCat(c.id)}>{c.name}</Chip>
            ))}
          </div>
          <div className="builder-list">
            {builderChoices.map((i) => {
              const picked = builderIds.includes(i.id)
              return (
                <button
                  key={i.id}
                  className={`builder-row ${picked ? 'picked' : ''}`}
                  aria-pressed={picked}
                  onClick={() => {
                    buzz()
                    setBuilderIds((prev) => (prev.includes(i.id) ? prev.filter((x) => x !== i.id) : [...prev, i.id]))
                  }}
                >
                  <ItemArt item={i} size="thumb" />
                  <span className="builder-info">
                    <span className="builder-name">{i.name}</span>
                    <span className="muted small">{money(i.pricePerDay)}/day</span>
                  </span>
                  <Icon name={picked ? 'check' : 'plus'} size={16} />
                </button>
              )
            })}
          </div>
          {/* The number that decides whether to add one more item has to be on
              screen while you're deciding, not on a confirmation after. */}
          <div className="builder-summary">
            <div>
              <b>{builderIds.length} item{builderIds.length === 1 ? '' : 's'}</b>
              {builderDiscount > 0
                ? <span className="muted"> · <s>{money(builderFull)}</s> {money(builderPrice)} /day · save {builderDiscount}%</span>
                : <span className="muted"> · add {2 - builderIds.length} more for 5% off</span>}
            </div>
            <button
              className="btn btn-primary btn-sm"
              disabled={builderIds.length < 2}
              onClick={() => {
                buzz()
                builderItems.forEach((i) =>
                  dispatch({
                    type: 'ADD_TO_CART',
                    booking: {
                      id: uid(), itemId: i.id, startDate: kitDate, endDate: kitDate,
                      pickupTime: '09:00', qty: 1, unit: 'day', hours: 4,
                      insurance: true, operator: false, transport: 'van',
                      rate: Math.round(i.pricePerDay * (1 - builderDiscount / 100)),
                      negotiated: false,
                    },
                  })
                )
                toast(`Your kit of ${builderItems.length} added · ${builderDiscount}% off`)
                setBuilderIds([])
                setBuilderOpen(false)
              }}
            >
              Add kit to cart
            </button>
          </div>
        </Modal>
      )}

      {/* Six storefront cards, each carrying its own rail of gear, was the single
          longest thing on this page — the vendors section alone outran everything
          below it. The full card still does its job on the vendors page; here a
          rail of tiles answers "who is near me" without spending four screens. */}
      <Rail
        id="vendors"
        title="Vendors near you"
        sub={`${vendorList.length} rental houses · ${vendorList.reduce((s, v) => s + v.count, 0)} listings`}
      >
        {vendorList.map((v) => <VendorTile key={v.owner.id} vendor={v} />)}
      </Rail>

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

      <ListingPromo
        icon="truck"
        title="Own a studio, camera kit or grip truck?"
        blurb="Become a vendor in 2 minutes — you keep 90% of every booking."
        cta="Start listing"
        onClick={() => go({ name: 'post' })}
      />

      {/* Seven more rails used to run from here to the bottom, all of them the
          same shape and most of them the same catalogue re-ranked — six screens
          that read as "the page never ends" rather than as six useful angles.
          They are all still here, behind one deliberate tap, which also means
          the cards inside them are never built for someone who didn't ask.
          Each still mounts a screen ahead of the scroll once opened. */}
      <div className="section">
        <button
          className="more-toggle"
          aria-expanded={moreOpen}
          onClick={() => { buzz(); setMoreOpen((v) => !v) }}
        >
          <span>
            <b>{moreOpen ? 'Fewer ways to browse' : 'More ways to browse'}</b>
            {!moreOpen && <span className="muted small"> · new arrivals, near your last shoot, trending, hidden gems</span>}
          </span>
          <Icon name={moreOpen ? 'chevron-up' : 'chevron-down'} size={18} />
        </button>
      </div>

      {moreOpen && (
        <>
      {/* Title and subtitle both used to over-promise: the rail is ranked by
          listing date, so it's "recent", and some of it has been booked. */}
      {justListed.length > 0 && (
        <Deferred id="new">
          <Rail id="new" title="Recently listed" icon="bulb" sub="The newest gear on Papa Rentals">
            {justListed.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
          </Rail>
        </Deferred>
      )}

      {coldStart.length > 0 && (
        <Deferred id="starters">
          <Rail id="starters" title="Popular starters" icon="sparkles" sub="Highest-rated gear in every department">
            {coldStart.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
          </Rail>
        </Deferred>
      )}

      {nearLastShoot.length > 0 && (
        <Deferred id="nearby">
          <Rail id="nearby" title="Near your last shoot" icon="pin" sub={`Vendors around ${lastShootArea}`}>
            {nearLastShoot.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
          </Rail>
        </Deferred>
      )}

      {seed && becauseViewed.length > 0 && (
        <Deferred id="because">
          <Rail id="because" title="Because you viewed" icon="target" sub={seed.name}>
            {becauseViewed.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
          </Rail>
        </Deferred>
      )}

      {/* Taller reservation than the plain rails: this one carries a filter row of
          space-type chips above its track. */}
      <Deferred id="spaces" minHeight={320}>
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
      </Deferred>

      {hiddenGems.length > 0 && (
        <Deferred id="gems">
          <Rail id="gems" title="Hidden gems" icon="gift" sub="4.5+ stars, under 12 bookings so far">
            {hiddenGems.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
          </Rail>
        </Deferred>
      )}

      {/* A grid, not a rail — it wraps to several rows, so it reserves more. */}
      <Deferred id="trending" minHeight={520}>
        <div className="section" id="trending">
          <SectionHeader icon="flame" title="Trending on set" sub="What crews in your city booked most this week" />
          <div className="grid">
            {trending.map((item, idx) => <ItemCard key={item.id} {...cardProps(item, idx)} />)}
          </div>
        </div>
      </Deferred>

      {/* The services pitch is orientation for a first visit, not something a
          returning renter needs above their cart every time. */}
      <ServicesBand />
        </>
      )}
    </div>
  )
}
