import { useMemo, useState } from 'react'
import { getItem } from '../data/catalog'
import { CATEGORIES, ITEMS, getOwner } from '../data/catalog'
import { Modal } from '../components/ui'
import { money } from '../utils'
import { useNav } from '../nav'
import { useStore } from '../store'
import { dealActive, fuzzyMatch, searchRank, weightedRating } from '../utils'
import { ItemCard } from '../components/ui'

type Sort = 'relevance' | 'popular' | 'price_asc' | 'price_desc' | 'rating' | 'nearest'

export default function Browse({
  category,
  query,
  dealsOnly,
  wishlistOnly,
}: {
  category?: string
  query?: string
  dealsOnly?: boolean
  wishlistOnly?: boolean
}) {
  const { go, back } = useNav()
  const { state, dispatch } = useStore()
  // with a query, rank by relevance; otherwise by popularity
  const [sort, setSort] = useState<Sort>(query ? 'relevance' : 'popular')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [instantOnly, setInstantOnly] = useState(false)
  const [offersOnly, setOffersOnly] = useState(false)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [minCapacity, setMinCapacity] = useState<number | null>(null)
  const [hourlyOnly, setHourlyOnly] = useState(false)
  const [compare, setCompare] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)

  const items = useMemo(() => {
    let list = [...ITEMS, ...state.myListings.filter((l) => !l.paused)].filter((i) => !state.blockedOwners.includes(i.ownerId))
    if (category) list = list.filter((i) => i.category === category)
    if (dealsOnly) list = list.filter((i) => dealActive(i.id))
    if (wishlistOnly) list = list.filter((i) => state.wishlist.includes(i.id))
    if (query) {
      // typo-tolerant: "alexia" still finds the Alexa
      list = list.filter((i) => fuzzyMatch(`${i.name} ${i.tags.join(' ')} ${i.description} ${i.category}`, query))
    }
    if (verifiedOnly) list = list.filter((i) => getOwner(i.ownerId).verified)
    if (instantOnly) list = list.filter((i) => i.instantBook)
    if (offersOnly) list = list.filter((i) => i.offersAccepted)
    if (maxPrice) list = list.filter((i) => i.pricePerDay <= maxPrice)
    if (minCapacity) list = list.filter((i) => (i.space?.capacity ?? 0) >= minCapacity)
    if (hourlyOnly) list = list.filter((i) => i.hourly)
    switch (sort) {
      case 'relevance':
        if (query) list.sort((a, b) => searchRank(b, query) - searchRank(a, query))
        else list.sort((a, b) => b.timesRented - a.timesRented)
        break
      case 'price_asc': list.sort((a, b) => a.pricePerDay - b.pricePerDay); break
      case 'price_desc': list.sort((a, b) => b.pricePerDay - a.pricePerDay); break
      // weighted (Bayesian) so 3 five-star reviews don't beat 400 at 4.9
      case 'rating': list.sort((a, b) => weightedRating(b.rating, b.ratingCount) - weightedRating(a.rating, a.ratingCount)); break
      case 'nearest': list.sort((a, b) => getOwner(a.ownerId).distanceKm - getOwner(b.ownerId).distanceKm); break
      default: list.sort((a, b) => b.timesRented - a.timesRented)
    }
    return list
  }, [category, query, dealsOnly, wishlistOnly, sort, verifiedOnly, instantOnly, offersOnly, maxPrice, minCapacity, hourlyOnly, state.wishlist, state.blockedOwners, state.myListings])

  const activeFilters = [verifiedOnly, instantOnly, offersOnly, Boolean(maxPrice), Boolean(minCapacity), hourlyOnly].filter(Boolean).length

  const title = wishlistOnly
    ? '♥ Your wishlist'
    : dealsOnly
      ? '⚡ Flash deals'
      : query
        ? `Results for “${query}”`
        : category
          ? CATEGORIES.find((c) => c.id === category)?.name ?? 'Browse'
          : 'All gear'

  return (
    <div>
      <button className="back-btn" onClick={back}>← Back</button>
      <div className="section" style={{ marginTop: 4 }}>
        <div className="section-head">
          <h2>{title}</h2>
          <span className="muted small">{items.length} listings{activeFilters > 0 && ` · ${activeFilters} filter${activeFilters > 1 ? 's' : ''}`}</span>
        </div>

        <div className="cat-row" style={{ marginBottom: 12 }}>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`cat-chip ${category === c.id ? 'active' : ''}`}
              onClick={() => go({ name: 'browse', category: category === c.id ? undefined : c.id })}
            >
              <span className="cat-ico" style={{ background: c.gradient }}>{c.emoji}</span>
              {c.name}
            </button>
          ))}
        </div>

        <div className="filter-row">
          <button className={`filter-chip ${verifiedOnly ? 'active' : ''}`} onClick={() => setVerifiedOnly(!verifiedOnly)}>
            ✔︎ Verified
          </button>
          <button className={`filter-chip ${instantOnly ? 'active' : ''}`} onClick={() => setInstantOnly(!instantOnly)}>
            ⚡ Instant
          </button>
          <button className={`filter-chip ${offersOnly ? 'active' : ''}`} onClick={() => setOffersOnly(!offersOnly)}>
            🤝 Offers OK
          </button>
          <select
            className="filter-chip"
            value={maxPrice ?? ''}
            onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : null)}
            aria-label="Max price"
          >
            <option value="">Any price</option>
            <option value="10000">Under Rs 10k/day</option>
            <option value="25000">Under Rs 25k/day</option>
            <option value="50000">Under Rs 50k/day</option>
          </select>
          {category === 'studios' && (
            <>
              <button className={`filter-chip ${hourlyOnly ? 'active' : ''}`} onClick={() => setHourlyOnly(!hourlyOnly)}>
                ⏱️ Hourly OK
              </button>
              <select
                className="filter-chip"
                value={minCapacity ?? ''}
                onChange={(e) => setMinCapacity(e.target.value ? Number(e.target.value) : null)}
                aria-label="Crew size"
              >
                <option value="">Any crew size</option>
                <option value="15">15+ crew</option>
                <option value="30">30+ crew</option>
                <option value="60">60+ crew</option>
              </select>
            </>
          )}
          <select className="filter-chip" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            {query && <option value="relevance">Best match</option>}
            <option value="popular">Most rented</option>
            <option value="rating">Top rated</option>
            <option value="nearest">Nearest first</option>
            <option value="price_asc">Price: low → high</option>
            <option value="price_desc">Price: high → low</option>
          </select>
        </div>

        {category === 'studios' && !wishlistOnly && !dealsOnly && (
          <div className="kit-card" style={{ margin: '4px 0 14px', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 30 }}>🏡</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 14 }}>Have a space crews would love?</b>
              <div className="muted small">Post it free — you keep 90% of every booking.</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => go({ name: 'post' })}>List it</button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="empty-state">
            <div className="big">🎥</div>
            <p>Nothing matches — try clearing a filter{query ? ' or check the spelling' : ''}.</p>
            {(verifiedOnly || instantOnly || offersOnly || maxPrice) && (
              <button className="btn btn-outline btn-sm" onClick={() => { setVerifiedOnly(false); setInstantOnly(false); setOffersOnly(false); setMaxPrice(null) }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid">
            {items.map((item, idx) => (
              <div key={item.id} style={{ position: 'relative' }}>
                <ItemCard
                  item={item}
                  index={idx}
                  onOpen={() => go({ name: 'item', id: item.id })}
                  wishlisted={state.wishlist.includes(item.id)}
                  onToggleWish={() => dispatch({ type: 'TOGGLE_WISHLIST', itemId: item.id })}
                />
                <button
                  className={`cmp-btn ${compare.includes(item.id) ? 'on' : ''}`}
                  aria-label="Compare"
                  onClick={() =>
                    setCompare(
                      compare.includes(item.id)
                        ? compare.filter((x) => x !== item.id)
                        : compare.length >= 3 ? compare : [...compare, item.id]
                    )
                  }
                >
                  ⚖
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {compare.length >= 1 && (
        <div className="compare-tray">
          <b style={{ fontSize: 13 }}>⚖ {compare.length}/3 selected</b>
          <span style={{ flex: 1 }} />
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--bg)', borderColor: 'var(--muted)' }} onClick={() => setCompare([])}>Clear</button>
          <button className="btn btn-primary btn-sm" disabled={compare.length < 2} onClick={() => setCompareOpen(true)}>Compare</button>
        </div>
      )}

      {compareOpen && (
        <Modal title="⚖ Side by side" onClose={() => setCompareOpen(false)}>
          <table className="cmp-table">
            <tbody>
              <tr><th></th>{compare.map((id) => <td key={id}><b>{getItem(id).emoji} {getItem(id).name}</b></td>)}</tr>
              <tr><th>Price/day</th>{compare.map((id) => <td key={id}><b>{money(getItem(id).pricePerDay)}</b></td>)}</tr>
              <tr><th>Rating</th>{compare.map((id) => <td key={id}>★ {getItem(id).rating} ({getItem(id).ratingCount})</td>)}</tr>
              <tr><th>Rented</th>{compare.map((id) => <td key={id}>{getItem(id).timesRented}×</td>)}</tr>
              <tr><th>Deposit</th>{compare.map((id) => <td key={id}>{money(getItem(id).deposit)}</td>)}</tr>
              <tr><th>Instant</th>{compare.map((id) => <td key={id}>{getItem(id).instantBook ? '⚡ Yes' : 'Approval'}</td>)}</tr>
              <tr><th>Offers</th>{compare.map((id) => <td key={id}>{getItem(id).offersAccepted ? '🤝 Yes' : 'Fixed'}</td>)}</tr>
              <tr><th>Distance</th>{compare.map((id) => <td key={id}>{getOwner(getItem(id).ownerId).distanceKm} km</td>)}</tr>
              <tr><th>Top spec</th>{compare.map((id) => <td key={id} className="muted">{getItem(id).specs[0]}</td>)}</tr>
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {compare.map((id) => (
              <button key={id} className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => { setCompareOpen(false); go({ name: 'item', id }) }}>
                View {getItem(id).emoji}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
