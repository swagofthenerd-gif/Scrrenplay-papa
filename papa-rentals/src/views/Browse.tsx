import { useEffect, useMemo, useRef, useState } from 'react'
import { getItem } from '../data/catalog'
import { CATEGORIES, ITEMS, getOwner } from '../data/catalog'
import { Modal } from '../components/ui'
import { money } from '../utils'
import { useNav, type BrowseSort, type View } from '../nav'
import { useStore } from '../store'
import { daysBetween, dealActive, didYouMean, findConflict, fmtDate, fuzzyMatch, recommendedRate, refineTags, searchRank, todayISO, uid, weightedRating, buzz } from '../utils'
import { ItemCard, ListingPromo, RatingCompact } from '../components/ui'
import { DeptRow } from '../components/DeptRow'
import { ProximityMap } from '../components/ProximityMap'
import { Icon, type IconName } from '../components/icons'
import type { CategoryId, Item } from '../types'

const MAX_COMPARE = 3
const FILTER_MEMORY_KEY = 'papa-browse-filters'
/* How far above a price cap still counts as "nearly affordable" and is worth
   offering to watch. Wide enough to catch the Rs 26k lens behind a Rs 25k cap,
   tight enough that a Rs 90k camera never shows up as a near miss. */
const NEAR_MISS = 1.5
/* Watching is bulk here, so it needs a ceiling — a cap of Rs 5k in a big
   department would otherwise arm dozens of alerts from one tap. */
const MAX_WATCH = 8

/** The filter half of a Browse view — what's worth remembering per department. */
type FilterMemory = Pick<BrowseProps, 'verified' | 'instant' | 'offers' | 'minPrice' | 'maxPrice' | 'minCapacity' | 'maxKm' | 'hourly'>

function readFilterMemory(): Record<string, FilterMemory> {
  try {
    return JSON.parse(localStorage.getItem(FILTER_MEMORY_KEY) || '{}')
  } catch {
    return {}
  }
}
const PAGE = 24

/* A flat "under Rs 10k" bucket is useless in a department where nothing costs
   more than Rs 8k. Buckets are derived from the prices actually on screen. */
function priceBuckets(list: Item[]): number[] {
  if (list.length < 2) return []
  const prices = list.map((i) => i.pricePerDay).sort((a, b) => a - b)
  const at = (q: number) => prices[Math.floor((prices.length - 1) * q)]
  const round = (n: number) => (n >= 20000 ? Math.ceil(n / 5000) * 5000 : Math.ceil(n / 1000) * 1000)
  return [...new Set([at(0.25), at(0.5), at(0.75)].map(round))].filter((n) => n < prices[prices.length - 1])
}

/** Everything the results list is derived from — all of it lives in the URL. */
type BrowseProps = {
  category?: CategoryId
  query?: string
  dealsOnly?: boolean
  wishlistOnly?: boolean
  sort?: BrowseSort
  verified?: boolean
  instant?: boolean
  offers?: boolean
  minPrice?: number
  maxPrice?: number
  minCapacity?: number
  maxKm?: number
  hourly?: boolean
  from?: string
  to?: string
  compare?: string[]
}

export default function Browse(props: BrowseProps) {
  const { category, query, dealsOnly, wishlistOnly, minPrice, maxPrice, minCapacity, maxKm } = props
  const { go, back, toast } = useNav()
  const { state, dispatch } = useStore()
  const saved = state.savedSearches.find(
    (s) => s.q.toLowerCase() === (query ?? '').toLowerCase() && s.category === category
  )
  // with a query, rank by relevance; otherwise by popularity
  const sort: BrowseSort = props.sort ?? (query ? 'relevance' : 'popular')
  const verifiedOnly = Boolean(props.verified)
  const instantOnly = Boolean(props.instant)
  const offersOnly = Boolean(props.offers)
  const hourlyOnly = Boolean(props.hourly)
  const { from: dateFrom, to: dateTo } = props
  const compare = props.compare ?? []
  const [compareOpen, setCompareOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dense, setDense] = useState(false)
  /* Where a space is decides whether a crew can reach it by call time, so the
     spaces department gets a map as an alternative to the grid. */
  const [mapView, setMapView] = useState(false)
  /* Long result sets render in pages — 200 cards mounted at once is what makes
     the filter chips feel laggy on a mid-range Android. */
  const [shown, setShown] = useState(PAGE)

  /* Filters rewrite the URL in place so they survive a trip to an item and back. */
  function patch(next: Partial<BrowseProps>) {
    const merged: View = { name: 'browse', ...props, ...next }
    go(merged, { replace: true })
  }

  const pool = useMemo(
    () => [...ITEMS, ...state.myListings.filter((l) => !l.paused)].filter((i) => !state.blockedOwners.includes(i.ownerId)),
    [state.myListings, state.blockedOwners]
  )

  // one lowercase haystack per item, built once instead of on every keystroke-driven filter pass
  const haystacks = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of pool) m.set(i.id, `${i.name} ${i.tags.join(' ')} ${i.description} ${i.category}`)
    return m
  }, [pool])

  /* getOwner is a linear scan of OWNERS. Resolving it here means one lookup per
     item instead of one per filter pass plus one per comparator call — `nearest`
     alone used to call it O(n log n) times on every keystroke. */
  const owners = useMemo(() => new Map(pool.map((i) => [i.id, getOwner(i.ownerId)])), [pool])

  /* Only the wishlist-only view reads the wishlist, but the pipeline below used
     to depend on state.wishlist directly, so tapping a heart on any card
     re-filtered and re-sorted the whole catalogue to produce an identical list.
     Collapsed to a key, the heart is free unless you are browsing the wishlist. */
  const wishKey = wishlistOnly ? state.wishlist.join(',') : ''

  const result = useMemo(() => {
    let list = pool
    if (category) list = list.filter((i) => i.category === category)
    if (dealsOnly) list = list.filter((i) => dealActive(i.id))
    if (wishlistOnly) {
      const wish = new Set(wishKey ? wishKey.split(',') : [])
      list = list.filter((i) => wish.has(i.id))
    }
    // typo-tolerant: "alexia" still finds the Alexa
    if (query) list = list.filter((i) => fuzzyMatch(haystacks.get(i.id) ?? i.name, query))
    if (verifiedOnly) list = list.filter((i) => owners.get(i.id)?.verified)
    if (instantOnly) list = list.filter((i) => i.instantBook)
    if (offersOnly) list = list.filter((i) => i.offersAccepted)
    if (minCapacity) list = list.filter((i) => (i.space?.capacity ?? 0) >= minCapacity)
    if (hourlyOnly) list = list.filter((i) => i.hourly)
    /* Sorting by nearest still lists a lens 40 km away at the bottom. Capping the
       radius is what actually answers "what can I pick up today". */
    if (maxKm) list = list.filter((i) => (owners.get(i.id)?.distanceKm ?? Infinity) <= maxKm)

    /* Price and dates are held back to here so the near-misses stay addressable.
       Folded into the filters above, an item a few hundred rupees over the cap
       is indistinguishable from one that was never a match, and the only thing
       left to offer is an empty grid. */
    const eligible = list
    let priced = eligible
    if (minPrice) priced = priced.filter((i) => i.pricePerDay >= minPrice)
    if (maxPrice) priced = priced.filter((i) => i.pricePerDay <= maxPrice)
    /* Only items just above the cap: something at four times the budget is not a
       near-miss, and watching it would produce a notification nobody wanted. */
    const overCap = maxPrice
      ? eligible
          .filter((i) => i.pricePerDay > maxPrice && i.pricePerDay <= maxPrice * NEAR_MISS)
          .sort((a, b) => a.pricePerDay - b.pricePerDay)
      : []

    /* "Is it free the week I shoot" is the question every other filter is a
       proxy for. Checking it here beats opening ten items to find out. */
    let busyItems: Item[] = []
    list = priced
    if (dateFrom && dateTo) {
      busyItems = priced.filter((i) => findConflict(i.id, { start: dateFrom, end: dateTo }, state.orders, state.cart))
      const busySet = new Set(busyItems.map((i) => i.id))
      list = priced.filter((i) => !busySet.has(i.id))
    }
    const busy = busyItems.length
    // distance is looked up once per item, not once per comparator call
    const dist = new Map<string, number>(list.map((i) => [i.id, owners.get(i.id)?.distanceKm ?? 0]))
    const sorted = [...list]
    switch (sort) {
      case 'relevance':
        if (query) sorted.sort((a, b) => searchRank(b, query) - searchRank(a, query))
        else sorted.sort((a, b) => b.timesRented - a.timesRented)
        break
      case 'price_asc': sorted.sort((a, b) => a.pricePerDay - b.pricePerDay); break
      case 'price_desc': sorted.sort((a, b) => b.pricePerDay - a.pricePerDay); break
      // weighted (Bayesian) so 3 five-star reviews don't beat 400 at 4.9
      case 'rating': sorted.sort((a, b) => weightedRating(b.rating, b.ratingCount) - weightedRating(a.rating, a.ratingCount)); break
      case 'nearest': sorted.sort((a, b) => (dist.get(a.id) ?? 0) - (dist.get(b.id) ?? 0)); break
      default: sorted.sort((a, b) => b.timesRented - a.timesRented)
    }
    return { sorted, busy, overCap, busyItems }
  }, [pool, haystacks, owners, category, query, dealsOnly, wishlistOnly, wishKey, sort, verifiedOnly, instantOnly, offersOnly, minPrice, maxPrice, minCapacity, maxKm, hourlyOnly, dateFrom, dateTo, state.orders, state.cart])
  const items = result.sorted
  const busyOnDates = result.busy

  /* Buckets come from the department you are in, before the price cut is applied. */
  const buckets = useMemo(
    () => priceBuckets(category ? pool.filter((i) => i.category === category) : pool),
    [pool, category]
  )

  /* Range handles need real end-stops, not a guessed 0–100k. A slider whose top
     half is empty makes every drag feel broken. */
  const priceRange = useMemo(() => {
    const scoped = category ? pool.filter((i) => i.category === category) : pool
    const prices = scoped.map((i) => i.pricePerDay)
    if (prices.length === 0) return { lo: 0, hi: 1000, step: 100 }
    const lo = Math.floor(Math.min(...prices) / 100) * 100
    const hi = Math.ceil(Math.max(...prices) / 100) * 100
    return { lo, hi, step: Math.max(100, Math.round((hi - lo) / 40 / 100) * 100) }
  }, [pool, category])

  /* Narrowing words drawn from the results themselves, so a chip can never lead
     to an empty page — a "did you mean" that dead-ends is worse than none. */
  const refinements = useMemo(() => (query ? refineTags(items, query) : []), [items, query])
  /* An empty page has two different causes, and they need different offers:
     a word nobody spells right, or two words that are each fine but never appear
     on the same listing. Broadening beats correcting when it is the second one. */
  const suggestion = useMemo(() => {
    if (!query || items.length > 0) return null
    const fix = didYouMean(query, pool)
    if (fix) return { term: fix, kind: 'fix' as const }
    const words = query.trim().split(/\s+/)
    if (words.length < 2) return null
    // Keep the word that finds the most on its own — that is the one they meant.
    const best = words
      .map((w) => ({ w, n: pool.filter((i) => fuzzyMatch(haystacks.get(i.id) ?? i.name, w)).length }))
      .sort((a, b) => b.n - a.n)[0]
    return best && best.n > 0 ? { term: best.w, kind: 'broaden' as const } : null
  }, [query, items.length, pool, haystacks])

  /* Filters are remembered per department, but never re-applied behind the
     renter's back — arriving at a page that silently hides half the catalogue is
     how people conclude the app is broken. It is offered as one tap instead. */
  const memoryKey = category ?? 'all'
  const current: FilterMemory = {
    verified: props.verified, instant: props.instant, offers: props.offers,
    minPrice, maxPrice, minCapacity, maxKm, hourly: props.hourly,
  }
  const hasCurrent = Object.values(current).some(Boolean)

  useEffect(() => {
    if (!hasCurrent) return
    const all = readFilterMemory()
    all[memoryKey] = current
    try {
      localStorage.setItem(FILTER_MEMORY_KEY, JSON.stringify(all))
    } catch { /* private mode — remembering filters is not worth failing over */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoryKey, JSON.stringify(current)])

  const [remembered, setRemembered] = useState<FilterMemory | null>(null)
  useEffect(() => {
    if (hasCurrent) { setRemembered(null); return }
    const saved = readFilterMemory()[memoryKey]
    setRemembered(saved && Object.values(saved).some(Boolean) ? saved : null)
  }, [memoryKey, hasCurrent])

  /* Filtered against the catalogue, not just listed. Offering a recent search as
     the escape route from a dead end and landing the person in a second dead end
     is worse than offering nothing — and the current query is excluded because
     that is the search they are already stuck inside. */
  const priorSearches = useMemo(
    () =>
      state.recentSearches
        .filter((r) => r.toLowerCase() !== (query ?? '').toLowerCase() && ITEMS.some((i) => fuzzyMatch(i.name, r)))
        .slice(0, 4),
    [state.recentSearches, query],
  )

  useEffect(() => setShown(PAGE), [items])

  /* Filtering is instant today because the catalogue is local, so the grid
     swaps contents with no sign anything happened — on a slow phone that reads
     as a tap that missed. A brief skeleton makes the change legible now, and is
     where a real request's latency will sit once listings come from a server.
     The signature deliberately excludes `sort`: reordering cards that are
     already on screen is visible on its own. */
  const filterKey = [category, query, dealsOnly, wishlistOnly, verifiedOnly, instantOnly, offersOnly, minPrice, maxPrice, minCapacity, maxKm, hourlyOnly, dateFrom, dateTo].join('|')
  const [swapping, setSwapping] = useState(false)
  const firstFilterPass = useRef(true)
  useEffect(() => {
    /* Skipped on mount, or every arrival at Browse would start on placeholders. */
    if (firstFilterPass.current) {
      firstFilterPass.current = false
      return
    }
    setSwapping(true)
    const t = setTimeout(() => setSwapping(false), 220)
    return () => clearTimeout(t)
  }, [filterKey])

  /* A search with no results is the only place the app learns about gear it does
     not carry. Recorded only when the query itself is what emptied the list —
     if filters are active the zero is about the filters, and blaming the search
     term would send hosts chasing demand that is already on the shelf. */
  useEffect(() => {
    if (items.length > 0 || !query || hasCurrent || Boolean(dateFrom && dateTo)) return
    const t = setTimeout(() => dispatch({ type: 'RECORD_UNMET_SEARCH', q: query, category }), 1200)
    /* Delayed, because the query updates per keystroke: without this, "ronin"
       would also file "ron" and "roni" as unmet demand. */
    return () => clearTimeout(t)
  }, [items.length, query, category, hasCurrent, dateFrom, dateTo, dispatch])

  /* Active filters, as removable pills — so you can always see and undo what's narrowing the list. */
  const pills: { label: string; clear: Partial<BrowseProps> }[] = []
  if (verifiedOnly) pills.push({ label: 'Verified', clear: { verified: false } })
  if (instantOnly) pills.push({ label: 'Instant', clear: { instant: false } })
  if (offersOnly) pills.push({ label: 'Offers OK', clear: { offers: false } })
  if (minPrice) pills.push({ label: `Over ${money(minPrice)}/day`, clear: { minPrice: undefined } })
  if (maxPrice) pills.push({ label: `Under ${money(maxPrice)}/day`, clear: { maxPrice: undefined } })
  if (minCapacity) pills.push({ label: `${minCapacity}+ crew`, clear: { minCapacity: undefined } })
  if (maxKm) pills.push({ label: `Within ${maxKm} km`, clear: { maxKm: undefined } })
  if (hourlyOnly) pills.push({ label: 'Hourly OK', clear: { hourly: false } })
  if (dateFrom && dateTo) pills.push({ label: `Free ${fmtDate(dateFrom)}–${fmtDate(dateTo)}`, clear: { from: undefined, to: undefined } })
  const activeFilters = pills.length
  /* The most recently added filter is the one most likely to have emptied the
     list, so that is the one the empty state offers to undo. */
  const lastFilter = pills.length > 0 ? pills[pills.length - 1] : null

  function clearAll() {
    go({ name: 'browse', category, query, dealsOnly, wishlistOnly }, { replace: true })
  }

  function toggleCompare(item: Item) {
    if (compare.includes(item.id)) {
      patch({ compare: compare.filter((x) => x !== item.id) })
      return
    }
    if (compare.length >= MAX_COMPARE) {
      toast(`You can compare ${MAX_COMPARE} at a time — remove one first`)
      return
    }
    buzz()
    patch({ compare: [...compare, item.id] })
  }

  const titleIcon: IconName | null = wishlistOnly ? 'heart-filled' : dealsOnly ? 'bolt' : null
  const title = wishlistOnly
    ? 'Your wishlist'
    : dealsOnly
      ? 'Flash deals'
      : query
        ? `Results for “${query}”`
        : category
          ? CATEGORIES.find((c) => c.id === category)?.name ?? 'Browse'
          : 'All gear'

  return (
    <div>
      <button className="back-btn" onClick={() => (history.length > 1 ? back() : go({ name: 'home' }))}>
        <Icon name="chevron-left" size={16} /> Back
      </button>
      <div className="section" style={{ marginTop: 4 }}>
        <div className="section-head">
          <h2>{titleIcon && <Icon name={titleIcon} className="h-ico" />}{title}</h2>
          <span className="muted small" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {items.length} listings{activeFilters > 0 && ` · ${activeFilters} filter${activeFilters > 1 ? 's' : ''}`}
            {category === 'studios' && items.length > 0 && (
              <button
                className="link-btn"
                aria-pressed={mapView}
                aria-label={mapView ? 'Switch to list of spaces' : 'Switch to map of spaces'}
                onClick={() => { buzz(); setMapView((m) => !m) }}
              >
                <Icon name={mapView ? 'scroll' : 'pin'} size={14} /> {mapView ? 'List' : 'Map'}
              </button>
            )}
            <button
              className="link-btn"
              aria-pressed={dense}
              aria-label={dense ? 'Switch to card view' : 'Switch to compact list view'}
              onClick={() => setDense((d) => !d)}
            >
              <Icon name={dense ? 'sliders' : 'scroll'} size={14} /> {dense ? 'Cards' : 'Compact'}
            </button>
          </span>
        </div>

        {/* Renters hunt the same gear every shoot cycle. Saving the search means
            the next hunt is one tap from Home instead of a retyped query. */}
        {(query || category) && (
          <button
            className="link-btn"
            style={{ marginBottom: 10 }}
            onClick={() => {
              buzz()
              if (saved) {
                dispatch({ type: 'REMOVE_SAVED_SEARCH', id: saved.id })
                toast('Removed from saved searches')
              } else {
                dispatch({ type: 'SAVE_SEARCH', q: query ?? '', category, maxPrice })
                toast('Saved — find it on Home')
              }
            }}
          >
            <Icon name={saved ? 'check-circle' : 'heart'} size={14} /> {saved ? 'Search saved' : 'Save this search'}
          </button>
        )}

        <DeptRow
          active={category}
          style={{ marginBottom: 12 }}
          onPick={(id) => patch({ category: category === id ? undefined : id })}
          onClear={() => patch({ category: undefined, minCapacity: undefined, hourly: false })}
        />

        {/* A date filter that quietly removes half the department reads as a thin
            catalogue. Naming what it hid — and offering the gear back — keeps the
            filter honest about being a filter. */}
        {busyOnDates > 0 && (
          <div className="muted small" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{busyOnDates} more {busyOnDates === 1 ? 'listing is' : 'listings are'} booked on those dates.</span>
            <button className="link-btn" onClick={() => { buzz(); patch({ from: undefined, to: undefined }) }}>Show them anyway</button>
          </div>
        )}

        {remembered && (
          <button
            className="link-btn"
            style={{ marginBottom: 8 }}
            onClick={() => { buzz(); patch(remembered); setRemembered(null) }}
          >
            <Icon name="undo" size={13} /> Reapply your last filters here
          </button>
        )}

        <div className="filter-row">
          {/* The chip row runs off the edge of a phone once four filters are on.
              One button that owns all of them — and says how many are live — is
              the difference between "filters exist" and "filters get used". */}
          <button
            className={`filter-chip chip-ico ${activeFilters > 0 ? 'active' : ''}`}
            onClick={() => { buzz(); setSheetOpen(true) }}
          >
            <Icon name="sliders" size={14} /> Filters
            {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
          </button>
          <button className={`filter-chip chip-ico ${verifiedOnly ? 'active' : ''}`} aria-pressed={verifiedOnly} onClick={() => patch({ verified: !verifiedOnly })}>
            <Icon name="check" size={14} /> Verified
          </button>
          <button className={`filter-chip chip-ico ${instantOnly ? 'active' : ''}`} aria-pressed={instantOnly} onClick={() => patch({ instant: !instantOnly })}>
            <Icon name="bolt" size={14} /> Instant
          </button>
          <button className={`filter-chip chip-ico ${offersOnly ? 'active' : ''}`} aria-pressed={offersOnly} onClick={() => patch({ offers: !offersOnly })}>
            <Icon name="handshake" size={14} /> Offers OK
          </button>
          <select
            className="filter-chip"
            value={maxPrice ?? ''}
            onChange={(e) => patch({ maxPrice: e.target.value ? Number(e.target.value) : undefined })}
            aria-label="Max price"
          >
            <option value="">Any price</option>
            {buckets.map((b) => (
              <option key={b} value={b}>Under {money(b)}/day</option>
            ))}
            {maxPrice && !buckets.includes(maxPrice) && <option value={maxPrice}>Under {money(maxPrice)}/day</option>}
          </select>
          {/* One tap for the filters people reach for anyway: verified vendor,
              instant book, well reviewed. */}
          <button
            className={`filter-chip chip-ico ${verifiedOnly && instantOnly && sort === 'rating' ? 'active' : ''}`}
            aria-pressed={verifiedOnly && instantOnly && sort === 'rating'}
            onClick={() => patch({ verified: true, instant: true, sort: 'rating' })}
          >
            <Icon name="shield" size={14} /> Safe bets
          </button>
          {category === 'studios' && (
            <>
              <button className={`filter-chip chip-ico ${hourlyOnly ? 'active' : ''}`} aria-pressed={hourlyOnly} onClick={() => patch({ hourly: !hourlyOnly })}>
                <Icon name="clock" size={14} /> Hourly OK
              </button>
              <select
                className="filter-chip"
                value={minCapacity ?? ''}
                onChange={(e) => patch({ minCapacity: e.target.value ? Number(e.target.value) : undefined })}
                aria-label="Crew size"
              >
                <option value="">Any crew size</option>
                <option value="15">15+ crew</option>
                <option value="30">30+ crew</option>
                <option value="60">60+ crew</option>
              </select>
            </>
          )}
          <select className="filter-chip" value={sort} onChange={(e) => patch({ sort: e.target.value as BrowseSort })} aria-label="Sort">
            {query && <option value="relevance">Best match</option>}
            <option value="popular">Most rented</option>
            <option value="rating">Top rated</option>
            <option value="nearest">Nearest first</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>

        {pills.length > 0 && (
          <div className="filter-row" style={{ marginTop: 2 }}>
            {pills.map((p) => (
              <button key={p.label} className="filter-chip active chip-ico" onClick={() => patch(p.clear)} aria-label={`Remove filter ${p.label}`}>
                {p.label} <Icon name="x" size={12} />
              </button>
            ))}
            <button className="filter-chip chip-ico" onClick={clearAll}>Clear all</button>
          </div>
        )}

        {refinements.length > 0 && (
          <div className="filter-row" style={{ marginTop: 2 }}>
            <span className="muted small" style={{ alignSelf: 'center', flex: 'none' }}>Narrow it:</span>
            {refinements.map((t) => (
              <button key={t} className="filter-chip chip-ico" onClick={() => { buzz(); patch({ query: `${query} ${t}`.trim() }) }}>
                + {t}
              </button>
            ))}
          </div>
        )}

        {category === 'studios' && !wishlistOnly && !dealsOnly && (
          <ListingPromo
            icon="home"
            title="Have a space crews would love?"
            blurb="Post it free — you keep 90% of every booking."
            cta="List it"
            onClick={() => go({ name: 'post' })}
            style={{ margin: '4px 0 14px' }}
          />
        )}

        {swapping ? (
          <div className={dense ? 'dense-list' : 'grid'} aria-busy="true" aria-label="Updating results">
            {Array.from({ length: Math.min(Math.max(items.length, 1), 6) }, (_, i) => (
              <div key={i} className="card-skeleton" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="big"><Icon name="camera" size={56} /></div>
            <p>
              {lastFilter
                ? `No listings left once “${lastFilter.label}” is applied.`
                : query
                  ? `Nothing matches “${query}” — check the spelling, or try a broader word.`
                  : 'Nothing here yet.'}
            </p>
            {suggestion && (
              <button className="btn btn-primary btn-sm" onClick={() => { buzz(); patch({ query: suggestion.term }) }}>
                {suggestion.kind === 'fix' ? <>Search “{suggestion.term}” instead</> : <>Search just “{suggestion.term}”</>}
              </button>
            )}
            {lastFilter && (
              <button className="btn btn-outline btn-sm" onClick={() => patch(lastFilter.clear)}>
                Remove “{lastFilter.label}”
              </button>
            )}
            {activeFilters > 1 && (
              <button className="btn btn-ghost btn-sm" onClick={clearAll}>
                Clear all {activeFilters} filters
              </button>
            )}
            {/* Recents live in the search overlay, which is one tap away — but a
                dead end is exactly where nobody wants to reopen a search box and
                retype. These are searches that already returned something for this
                person, so they are a way back out rather than another guess. */}
            {priorSearches.length > 0 && (
              <div className="empty-recents">
                <div className="muted small">Or go back to a search that worked:</div>
                <div className="filter-row" style={{ justifyContent: 'center' }}>
                  {priorSearches.map((r) => (
                    <button key={r} className="filter-chip chip-ico" onClick={() => { buzz(); patch({ query: r }) }}>
                      <Icon name="clock" size={12} /> {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : mapView && category === 'studios' ? (
          <ProximityMap items={items} onOpen={(id) => go({ name: 'item', id, from: dateFrom, to: dateTo })} />
        ) : (
          <div className={dense ? 'dense-list' : 'grid'}>
            {items.slice(0, shown).map((item, idx) => (
              <ItemCard
                key={item.id}
                item={item}
                index={idx}
                onOpen={() => go({ name: 'item', id: item.id, from: dateFrom, to: dateTo })}
                wishlisted={state.wishlist.includes(item.id)}
                onToggleWish={() => dispatch({ type: 'TOGGLE_WISHLIST', itemId: item.id })}
                compared={compare.includes(item.id)}
                onToggleCompare={() => toggleCompare(item)}
                footNote={sort === 'nearest' ? `${owners.get(item.id)?.distanceKm ?? getOwner(item.ownerId).distanceKm} km away` : undefined}
              />
            ))}
          </div>
        )}
        {!mapView && shown < items.length && (
          <button className="btn btn-outline" style={{ width: '100%', marginTop: 12 }} onClick={() => setShown((n) => n + PAGE)}>
            Show {Math.min(PAGE, items.length - shown)} more · {items.length - shown} left
          </button>
        )}

        {/* The gear a filter just hid is the gear this person actually wants.
            Dropping it silently makes the cap or the shoot window feel like the
            end of the search, when both are things that change on their own. */}
        <WatchOutOfRange overCap={result.overCap} busyItems={result.busyItems} maxPrice={maxPrice} />
      </div>
      {compare.length >= 1 && (
        <div className="compare-tray">
          <b style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="scale" size={15} /> {compare.length}/{MAX_COMPARE} selected</b>
          <span style={{ flex: 1 }} />
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--bg)', borderColor: 'var(--muted)' }} onClick={() => patch({ compare: [] })}>Clear</button>
          <button className="btn btn-primary btn-sm" disabled={compare.length < 2} onClick={() => setCompareOpen(true)}>Compare</button>
        </div>
      )}

      {sheetOpen && (
        <Modal title="Filters" onClose={() => setSheetOpen(false)}>
          <div className="sheet-group">
            <div className="sheet-label">Available on my dates</div>
            {/* Only applied once both ends are set — a half-entered range would
                silently empty the list while the renter is still typing. */}
            <div className="date-pair">
              <label className="date-field">
                <span className="muted small">From</span>
                <input
                  type="date"
                  min={todayISO()}
                  value={dateFrom ?? ''}
                  onChange={(e) => {
                    const v = e.target.value || undefined
                    patch({ from: v, to: dateTo && v && dateTo < v ? v : dateTo })
                  }}
                />
              </label>
              <label className="date-field">
                <span className="muted small">To</span>
                <input
                  type="date"
                  min={dateFrom || todayISO()}
                  value={dateTo ?? ''}
                  onChange={(e) => patch({ to: e.target.value || undefined })}
                />
              </label>
            </div>
            {dateFrom && dateTo ? (
              <button className="link-btn" onClick={() => { buzz(); patch({ from: undefined, to: undefined }) }}>Clear dates</button>
            ) : (
              (dateFrom || dateTo) && <div className="muted small">Pick both dates to filter by availability.</div>
            )}
          </div>

          <div className="sheet-group">
            <div className="sheet-label">Price per day</div>
            {/* Two handles over one track: the pair reads as a range, and each
                input keeps its own keyboard focus for screen-reader users. */}
            <div className="range-pair">
              <input
                type="range"
                min={priceRange.lo}
                max={priceRange.hi}
                step={priceRange.step}
                value={minPrice ?? priceRange.lo}
                aria-label="Minimum price per day"
                onChange={(e) => {
                  const v = Number(e.target.value)
                  patch({ minPrice: v <= priceRange.lo ? undefined : Math.min(v, (maxPrice ?? priceRange.hi) - priceRange.step) })
                }}
              />
              <input
                type="range"
                min={priceRange.lo}
                max={priceRange.hi}
                step={priceRange.step}
                value={maxPrice ?? priceRange.hi}
                aria-label="Maximum price per day"
                onChange={(e) => {
                  const v = Number(e.target.value)
                  patch({ maxPrice: v >= priceRange.hi ? undefined : Math.max(v, (minPrice ?? priceRange.lo) + priceRange.step) })
                }}
              />
            </div>
            <div className="muted small">
              {money(minPrice ?? priceRange.lo)} – {maxPrice ? money(maxPrice) : `${money(priceRange.hi)}+`} per day
            </div>
          </div>

          <div className="sheet-group">
            <div className="sheet-label">Trust &amp; booking</div>
            <div className="filter-row">
              <button className={`filter-chip chip-ico ${verifiedOnly ? 'active' : ''}`} aria-pressed={verifiedOnly} onClick={() => patch({ verified: !verifiedOnly })}>
                <Icon name="check" size={14} /> Verified
              </button>
              <button className={`filter-chip chip-ico ${instantOnly ? 'active' : ''}`} aria-pressed={instantOnly} onClick={() => patch({ instant: !instantOnly })}>
                <Icon name="bolt" size={14} /> Instant
              </button>
              <button className={`filter-chip chip-ico ${offersOnly ? 'active' : ''}`} aria-pressed={offersOnly} onClick={() => patch({ offers: !offersOnly })}>
                <Icon name="handshake" size={14} /> Offers OK
              </button>
            </div>
          </div>

          <div className="sheet-group">
            <div className="sheet-label">Pickup distance</div>
            <div className="filter-row">
              {[5, 10, 25].map((km) => (
                <button
                  key={km}
                  className={`filter-chip chip-ico ${maxKm === km ? 'active' : ''}`}
                  aria-pressed={maxKm === km}
                  onClick={() => patch({ maxKm: maxKm === km ? undefined : km })}
                >
                  <Icon name="pin" size={14} /> Within {km} km
                </button>
              ))}
            </div>
          </div>

          {category === 'studios' && (
            <div className="sheet-group">
              <div className="sheet-label">Space</div>
              <div className="filter-row">
                <button className={`filter-chip chip-ico ${hourlyOnly ? 'active' : ''}`} aria-pressed={hourlyOnly} onClick={() => patch({ hourly: !hourlyOnly })}>
                  <Icon name="clock" size={14} /> Hourly OK
                </button>
                <select
                  className="filter-chip"
                  value={minCapacity ?? ''}
                  onChange={(e) => patch({ minCapacity: e.target.value ? Number(e.target.value) : undefined })}
                  aria-label="Crew size"
                >
                  <option value="">Any crew size</option>
                  <option value="15">15+ crew</option>
                  <option value="30">30+ crew</option>
                  <option value="60">60+ crew</option>
                </select>
              </div>
            </div>
          )}

          <div className="sheet-group">
            <div className="sheet-label">Sort by</div>
            <select className="filter-chip" style={{ width: '100%' }} value={sort} onChange={(e) => patch({ sort: e.target.value as BrowseSort })} aria-label="Sort">
              {query && <option value="relevance">Best match</option>}
              <option value="popular">Most rented</option>
              <option value="rating">Top rated</option>
              <option value="nearest">Nearest first</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </div>

          <div className="sheet-actions">
            <button className="btn btn-ghost" disabled={activeFilters === 0} onClick={() => { buzz(); clearAll() }}>Clear all</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { buzz(); setSheetOpen(false) }}>
              Show {items.length} {items.length === 1 ? 'result' : 'results'}
            </button>
          </div>
        </Modal>
      )}

      {compareOpen && <CompareModal ids={compare} onClose={() => setCompareOpen(false)} onOpen={(id) => { setCompareOpen(false); go({ name: 'item', id }) }} />}
    </div>
  )
}

/* A way to stay in the running for gear a filter just excluded: the price cap and
   the shoot window are both things that move, and the alert plumbing already
   exists — it was only reachable one item at a time from the listing page. */
function WatchOutOfRange({ overCap, busyItems, maxPrice }: { overCap: Item[]; busyItems: Item[]; maxPrice?: number }) {
  const { state, dispatch } = useStore()
  const { toast } = useNav()

  const priceTargets = overCap.slice(0, MAX_WATCH)
  const dateTargets = busyItems.slice(0, MAX_WATCH)
  const watchedPrice = new Set(state.priceAlerts.map((a) => a.itemId))
  const watchedAvail = new Set(state.availAlerts.map((a) => a.itemId))
  const pricePending = priceTargets.filter((i) => !watchedPrice.has(i.id))
  const datePending = dateTargets.filter((i) => !watchedAvail.has(i.id))

  if (priceTargets.length === 0 && dateTargets.length === 0) return null

  return (
    <div className="panel" style={{ marginTop: 14 }}>
      {priceTargets.length > 0 && maxPrice && (
        <div className="watch-row">
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>
              {priceTargets.length} just above your {money(maxPrice)} cap
            </b>
            <div className="muted small">
              From {money(priceTargets[0].pricePerDay)}/day — {priceTargets[0].name}
              {priceTargets.length > 1 && ` and ${priceTargets.length - 1} more`}
            </div>
          </div>
          {pricePending.length === 0 ? (
            <span className="muted small chip-ico"><Icon name="check-circle" size={14} /> Watching</span>
          ) : (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                buzz()
                /* TOGGLE_PRICE_ALERT is a toggle: firing it at an item already
                   being watched would quietly cancel that watch instead. */
                pricePending.forEach((i) => dispatch({ type: 'TOGGLE_PRICE_ALERT', itemId: i.id }))
                toast(`Watching ${pricePending.length} — we’ll ping you if the price drops`)
              }}
            >
              <Icon name="bell" size={14} /> Notify me if they drop
            </button>
          )}
        </div>
      )}

      {dateTargets.length > 0 && (
        <div className="watch-row">
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>{dateTargets.length} booked on your dates</b>
            <div className="muted small">
              {dateTargets[0].name}
              {dateTargets.length > 1 && ` and ${dateTargets.length - 1} more`} — free up as other shoots wrap
            </div>
          </div>
          {datePending.length === 0 ? (
            <span className="muted small chip-ico"><Icon name="check-circle" size={14} /> Watching</span>
          ) : (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                buzz()
                datePending.forEach((i) => dispatch({ type: 'ADD_AVAIL_ALERT', itemId: i.id }))
                toast(`Watching ${datePending.length} — we’ll tell you when they free up`)
              }}
            >
              <Icon name="bell" size={14} /> Notify me when free
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* Side-by-side compare. Items are resolved once here instead of ~10 lookups per column. */
function CompareModal({ ids, onClose, onOpen }: { ids: string[]; onClose: () => void; onOpen: (id: string) => void }) {
  const { dispatch } = useStore()
  const { toast } = useNav()
  const cols = useMemo(() => ids.map((id) => ({ item: getItem(id), owner: getOwner(getItem(id).ownerId) })), [ids])
  const specRows = Math.max(...cols.map((c) => c.item.specs.length), 0)

  /* Comparing is the last step before deciding, so the winner should go straight
     into the cart. Dates match Item detail's defaults — a single day starting the
     day after tomorrow — and stay editable on the cart line. */
  function addToCart(item: Item) {
    buzz()
    const startDate = todayISO(2)
    const endDate = todayISO(3)
    dispatch({
      type: 'ADD_TO_CART',
      booking: {
        id: uid(), itemId: item.id, startDate, endDate, pickupTime: '09:00',
        qty: 1, unit: 'day', hours: 4,
        insurance: item.insuranceRequired || item.deposit >= 100000,
        operator: false, transport: 'van',
        rate: recommendedRate(item.id, daysBetween(startDate, endDate), 'day'),
        negotiated: false,
      },
    })
    toast(`${item.name} added to cart`)
  }

  return (
    <Modal title="Side by side" onClose={onClose}>
      <table className="cmp-table">
        <tbody>
          <tr><th></th>{cols.map(({ item }) => <td key={item.id}><b className="cmp-name"><Icon name={item.icon} size={16} /> {item.name}</b></td>)}</tr>
          <tr><th>Price/day</th>{cols.map(({ item }) => <td key={item.id}><b>{money(item.pricePerDay)}</b></td>)}</tr>
          <tr><th>Rating</th>{cols.map(({ item }) => <td key={item.id}><span className="cmp-cell"><RatingCompact rating={item.rating} count={item.ratingCount} /></span></td>)}</tr>
          <tr><th>Rented</th>{cols.map(({ item }) => <td key={item.id}>{item.timesRented}×</td>)}</tr>
          <tr><th>Deposit</th>{cols.map(({ item }) => <td key={item.id}>{money(item.deposit)}</td>)}</tr>
          <tr><th>Instant</th>{cols.map(({ item }) => <td key={item.id}>{item.instantBook ? 'Yes' : 'Approval'}</td>)}</tr>
          <tr><th>Offers</th>{cols.map(({ item }) => <td key={item.id}>{item.offersAccepted ? 'Yes' : 'Fixed'}</td>)}</tr>
          <tr><th>Vendor</th>{cols.map(({ item, owner }) => <td key={item.id}>{owner.name}{owner.verified ? ' ✓' : ''}</td>)}</tr>
          <tr><th>Distance</th>{cols.map(({ item, owner }) => <td key={item.id}>{owner.distanceKm} km</td>)}</tr>
          {Array.from({ length: specRows }, (_, r) => (
            <tr key={`spec-${r}`}>
              <th>{r === 0 ? 'Specs' : ''}</th>
              {cols.map(({ item }) => <td key={item.id} className="muted">{item.specs[r] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        {cols.map(({ item }) => (
          <div key={item.id} style={{ flex: 1, display: 'grid', gap: 6 }}>
            {/* Three buttons all reading "Add" is a screen-reader dead end. */}
            <button className="btn btn-primary btn-sm" aria-label={`Add ${item.name} to cart`} onClick={() => addToCart(item)}>
              <Icon name="cart" size={14} /> Add
            </button>
            <button className="btn btn-outline btn-sm" aria-label={`View ${item.name}`} onClick={() => onOpen(item.id)}>
              View <Icon name={item.icon} size={15} />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  )
}
