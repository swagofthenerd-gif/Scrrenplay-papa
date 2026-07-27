import { useEffect, useMemo, useState } from 'react'
import { getItem } from '../data/catalog'
import { CATEGORIES, ITEMS, getOwner } from '../data/catalog'
import { Modal } from '../components/ui'
import { money } from '../utils'
import { useNav, type BrowseSort, type View } from '../nav'
import { useStore } from '../store'
import { daysBetween, dealActive, didYouMean, findConflict, fmtDate, fuzzyMatch, recommendedRate, refineTags, searchRank, todayISO, uid, weightedRating, buzz } from '../utils'
import { ItemCard, RatingCompact } from '../components/ui'
import { DeptMark, Icon, type IconName } from '../components/icons'
import type { CategoryId, Item } from '../types'

const MAX_COMPARE = 3
const FILTER_MEMORY_KEY = 'papa-browse-filters'

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

  const result = useMemo(() => {
    let list = pool
    if (category) list = list.filter((i) => i.category === category)
    if (dealsOnly) list = list.filter((i) => dealActive(i.id))
    if (wishlistOnly) list = list.filter((i) => state.wishlist.includes(i.id))
    // typo-tolerant: "alexia" still finds the Alexa
    if (query) list = list.filter((i) => fuzzyMatch(haystacks.get(i.id) ?? i.name, query))
    if (verifiedOnly) list = list.filter((i) => getOwner(i.ownerId).verified)
    if (instantOnly) list = list.filter((i) => i.instantBook)
    if (offersOnly) list = list.filter((i) => i.offersAccepted)
    if (minPrice) list = list.filter((i) => i.pricePerDay >= minPrice)
    if (maxPrice) list = list.filter((i) => i.pricePerDay <= maxPrice)
    if (minCapacity) list = list.filter((i) => (i.space?.capacity ?? 0) >= minCapacity)
    if (hourlyOnly) list = list.filter((i) => i.hourly)
    /* Sorting by nearest still lists a lens 40 km away at the bottom. Capping the
       radius is what actually answers "what can I pick up today". */
    if (maxKm) list = list.filter((i) => getOwner(i.ownerId).distanceKm <= maxKm)
    /* "Is it free the week I shoot" is the question every other filter is a
       proxy for. Checking it here beats opening ten items to find out. */
    let busy = 0
    if (dateFrom && dateTo) {
      const before = list.length
      list = list.filter((i) => !findConflict(i.id, { start: dateFrom, end: dateTo }, state.orders, state.cart))
      busy = before - list.length
    }
    // distance is looked up once per item, not once per comparator call
    const dist = new Map<string, number>(list.map((i) => [i.id, getOwner(i.ownerId).distanceKm]))
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
    return { sorted, busy }
  }, [pool, haystacks, category, query, dealsOnly, wishlistOnly, sort, verifiedOnly, instantOnly, offersOnly, minPrice, maxPrice, minCapacity, maxKm, hourlyOnly, dateFrom, dateTo, state.orders, state.cart, state.wishlist])
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

  useEffect(() => setShown(PAGE), [items])

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

        <div className="cat-row" style={{ marginBottom: 12 }}>
          <button
            className={`cat-chip ${!category ? 'active' : ''}`}
            aria-pressed={!category}
            onClick={() => patch({ category: undefined, minCapacity: undefined, hourly: false })}
          >
            <span className="cat-ico"><Icon name="sliders" size={26} /></span>
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`cat-chip ${category === c.id ? 'active' : ''}`}
              aria-pressed={category === c.id}
              onClick={() => patch({ category: category === c.id ? undefined : c.id })}
            >
              <span className="cat-ico" aria-hidden="true"><DeptMark id={c.id} size={44} /></span>
              {c.name}
            </button>
          ))}
        </div>

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
          <div className="kit-card promo-card" style={{ margin: '4px 0 14px' }}>
            <span className="promo-ico"><Icon name="home" size={24} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 14 }}>Have a space crews would love?</b>
              <div className="muted small">Post it free — you keep 90% of every booking.</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => go({ name: 'post' })}>List it</button>
          </div>
        )}

        {items.length === 0 ? (
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
          </div>
        ) : (
          <div className={dense ? 'dense-list' : 'grid'}>
            {items.slice(0, shown).map((item, idx) => (
              <div key={item.id} style={{ position: 'relative' }}>
                <ItemCard
                  item={item}
                  index={idx}
                  onOpen={() => go({ name: 'item', id: item.id, from: dateFrom, to: dateTo })}
                  wishlisted={state.wishlist.includes(item.id)}
                  onToggleWish={() => dispatch({ type: 'TOGGLE_WISHLIST', itemId: item.id })}
                />
                <button
                  className={`cmp-btn ${compare.includes(item.id) ? 'on' : ''}`}
                  aria-label={compare.includes(item.id) ? `Remove ${item.name} from compare` : `Compare ${item.name}`}
                  aria-pressed={compare.includes(item.id)}
                  onClick={() => toggleCompare(item)}
                >
                  <Icon name="scale" size={16} />
                </button>
                {sort === 'nearest' && (
                  <span className="muted small" style={{ display: 'block', marginTop: 2 }}>
                    {getOwner(item.ownerId).distanceKm} km away
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {shown < items.length && (
          <button className="btn btn-outline" style={{ width: '100%', marginTop: 12 }} onClick={() => setShown((n) => n + PAGE)}>
            Show {Math.min(PAGE, items.length - shown)} more · {items.length - shown} left
          </button>
        )}
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
