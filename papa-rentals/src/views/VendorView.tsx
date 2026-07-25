import { useEffect, useMemo, useRef, useState } from 'react'
import { useNav } from '../nav'
import { useStore } from '../store'
import { getVendor, categoryName } from '../vendors'
import type { CategoryId } from '../types'
import { fuzzyMatch, money } from '../utils'
import { ItemCard, Stars } from '../components/ui'
import { Avatar, Icon } from '../components/icons'

/*
 * Vendor storefront — a foodpanda-style "restaurant page": vendor header with
 * full Airbnb-grade detail, then their gear grouped into category sections with
 * sticky tabs that scroll-spy, plus search-within-vendor.
 */
export default function VendorView({ id }: { id: string }) {
  const { go, back } = useNav()
  const { state, dispatch } = useStore()
  const vendor = useMemo(() => getVendor(id, state), [id, state])
  const { owner } = vendor
  const [q, setQ] = useState('')

  // group items by category, preserving the vendor's most-stocked order
  const groups = useMemo(() => {
    const filtered = q.trim()
      ? vendor.items.filter((i) => fuzzyMatch(`${i.name} ${i.tags.join(' ')} ${i.category}`, q))
      : vendor.items
    const map = new Map<CategoryId, typeof vendor.items>()
    for (const i of filtered) {
      if (!map.has(i.category)) map.set(i.category, [])
      map.get(i.category)!.push(i)
    }
    return [...map.entries()]
  }, [vendor.items, q])

  const [activeCat, setActiveCat] = useState<CategoryId | null>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // scroll-spy: highlight the category tab for the section currently in view
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setActiveCat(vis[0].target.getAttribute('data-cat') as CategoryId)
      },
      { rootMargin: '-140px 0px -60% 0px', threshold: 0 }
    )
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [groups])

  function jumpTo(cat: CategoryId) {
    sectionRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const cardProps = (itemId: string) => ({
    onOpen: () => go({ name: 'item', id: itemId }),
    wishlisted: state.wishlist.includes(itemId),
    onToggleWish: () => dispatch({ type: 'TOGGLE_WISHLIST', itemId }),
  })

  return (
    <div>
      <button className="back-btn" onClick={back}><Icon name="chevron-left" size={16} /> Back</button>

      <div className="vendor-hero panel">
        <div className="vendor-hero-top">
          <Avatar name={owner.name} id={owner.id} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="vendor-name-row">
              <h2 style={{ fontSize: 20 }}>{owner.name}</h2>
              {owner.superOwner && <span className="vendor-badge super"><Icon name="crown" size={12} /> Super</span>}
              {owner.verified && <span className="vendor-badge verified"><Icon name="check" size={12} /> Verified</span>}
            </div>
            <div className="vendor-meta" style={{ marginTop: 4 }}>
              <Stars value={owner.rating} size={13} />
              <span className="muted small">{owner.rating} ({owner.ratingCount})</span>
            </div>
          </div>
        </div>
        <div className="vendor-stat-row">
          <div className="vendor-stat"><Icon name="clock" size={15} /><b>~{owner.responseMins} min</b><span className="muted small">replies</span></div>
          <div className="vendor-stat"><Icon name="pin" size={15} /><b>{owner.distanceKm} km</b><span className="muted small">{owner.area}</span></div>
          <div className="vendor-stat"><Icon name="box" size={15} /><b>{vendor.count}</b><span className="muted small">listings</span></div>
          <div className="vendor-stat"><Icon name="calendar" size={15} /><b>{owner.memberSince}</b><span className="muted small">since</span></div>
        </div>
        <div className="vendor-ribbons" style={{ marginTop: 12 }}>
          {vendor.instant && <span className="v-ribbon instant"><Icon name="bolt" size={12} /> Instant book</span>}
          {vendor.offers && <span className="v-ribbon offer"><Icon name="handshake" size={12} /> Offers OK</span>}
          {vendor.hasDeal && <span className="v-ribbon deal"><Icon name="bolt" size={12} /> Flash deal on now</span>}
        </div>
      </div>

      <div className="searchbox vendor-search">
        <Icon name="search" size={16} />
        <input
          type="search"
          enterKeyHint="search"
          placeholder={`Search ${owner.name}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search this vendor"
        />
        {q && <button className="clear-btn" onClick={() => setQ('')} aria-label="Clear"><Icon name="x" size={15} /></button>}
      </div>

      {groups.length > 1 && (
        <div className="vendor-tabs">
          {groups.map(([cat]) => (
            <button
              key={cat}
              className={`vendor-tab ${activeCat === cat ? 'active' : ''}`}
              onClick={() => jumpTo(cat)}
            >
              {categoryName(cat)}
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="empty-state">
          <div className="big"><Icon name="search" size={56} /></div>
          <p>No gear matches “{q}” at {owner.name}.</p>
        </div>
      ) : (
        groups.map(([cat, items]) => (
          <div
            key={cat}
            className="section vendor-section"
            data-cat={cat}
            ref={(el) => { sectionRefs.current[cat] = el }}
          >
            <div className="section-head"><h3 style={{ fontSize: 16 }}>{categoryName(cat)} <span className="muted small">· {items.length}</span></h3></div>
            <div className="grid">
              {items.map((item) => <ItemCard key={item.id} item={item} {...cardProps(item.id)} />)}
            </div>
          </div>
        ))
      )}
      <div className="muted small" style={{ textAlign: 'center', padding: '24px 0 8px' }}>
        {money(vendor.minPrice)} lowest daily rate · prices shown before deposit &amp; delivery
      </div>
    </div>
  )
}
