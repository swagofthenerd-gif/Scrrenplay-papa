import { useMemo, useState } from 'react'
import { CATEGORIES, ITEMS, getOwner } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { ItemCard } from '../components/ui'

type Sort = 'popular' | 'price_asc' | 'price_desc' | 'rating' | 'nearest'

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
  const { go } = useNav()
  const { state, dispatch } = useStore()
  const [sort, setSort] = useState<Sort>('popular')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [instantOnly, setInstantOnly] = useState(false)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)

  const items = useMemo(() => {
    let list = [...ITEMS]
    if (category) list = list.filter((i) => i.category === category)
    if (dealsOnly) list = list.filter((i) => i.flashDeal)
    if (wishlistOnly) list = list.filter((i) => state.wishlist.includes(i.id))
    if (query) {
      const q = query.toLowerCase()
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q)) ||
          i.description.toLowerCase().includes(q)
      )
    }
    if (verifiedOnly) list = list.filter((i) => getOwner(i.ownerId).verified)
    if (instantOnly) list = list.filter((i) => i.instantBook)
    if (maxPrice) list = list.filter((i) => i.pricePerDay <= maxPrice)
    switch (sort) {
      case 'price_asc': list.sort((a, b) => a.pricePerDay - b.pricePerDay); break
      case 'price_desc': list.sort((a, b) => b.pricePerDay - a.pricePerDay); break
      case 'rating': list.sort((a, b) => b.rating - a.rating); break
      case 'nearest': list.sort((a, b) => getOwner(a.ownerId).distanceKm - getOwner(b.ownerId).distanceKm); break
      default: list.sort((a, b) => b.timesRented - a.timesRented)
    }
    return list
  }, [category, query, dealsOnly, wishlistOnly, sort, verifiedOnly, instantOnly, maxPrice, state.wishlist])

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
      <button className="back-btn" onClick={() => go({ name: 'home' })}>← Home</button>
      <div className="section" style={{ marginTop: 10 }}>
        <div className="section-head">
          <h2>{title}</h2>
          <span className="muted small">{items.length} listings</span>
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
            ✔︎ Verified owners
          </button>
          <button className={`filter-chip ${instantOnly ? 'active' : ''}`} onClick={() => setInstantOnly(!instantOnly)}>
            ⚡ Instant book
          </button>
          <select
            className="filter-chip"
            value={maxPrice ?? ''}
            onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Any price</option>
            <option value="10000">Under Rs 10k/day</option>
            <option value="25000">Under Rs 25k/day</option>
            <option value="50000">Under Rs 50k/day</option>
          </select>
          <select className="filter-chip" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="popular">Most rented</option>
            <option value="rating">Top rated</option>
            <option value="nearest">Nearest first</option>
            <option value="price_asc">Price: low → high</option>
            <option value="price_desc">Price: high → low</option>
          </select>
        </div>

        {items.length === 0 ? (
          <div className="empty-state">
            <div className="big">🎥</div>
            <p>Nothing matches — try clearing a filter.</p>
          </div>
        ) : (
          <div className="grid">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onOpen={() => go({ name: 'item', id: item.id })}
                wishlisted={state.wishlist.includes(item.id)}
                onToggleWish={() => dispatch({ type: 'TOGGLE_WISHLIST', itemId: item.id })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
