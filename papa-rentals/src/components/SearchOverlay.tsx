import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, ITEMS } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { buzz, highlightMatch, money, searchRank } from '../utils'
import { ItemArt, RatingCompact } from './ui'
import { Icon } from './icons'

function Marked({ text, q }: { text: string; q: string }) {
  return (
    <>
      {highlightMatch(text, q).map((seg, i) => (seg.hit ? <mark key={i}>{seg.text}</mark> : <span key={i}>{seg.text}</span>))}
    </>
  )
}

/**
 * Full-screen search: recents + trending when idle, ranked photo-rich
 * suggestions while typing. Navigation contract matches the old dropdown —
 * submit records the recent search and lands on #/browse?q=….
 */
export default function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { go } = useNav()
  const { state, dispatch } = useStore()
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const pool = useMemo(() => [...ITEMS, ...state.myListings.filter((l) => !l.paused)], [state.myListings])

  const results = useMemo(() => {
    if (!q.trim()) return { items: [], cats: [] }
    const items = pool
      .map((i) => ({ i, score: searchRank(i, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .map((r) => r.i)
    const cats = CATEGORIES.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 2)
    return { items, cats }
  }, [q, pool])

  const trending = useMemo(() => [...ITEMS].sort((a, b) => b.timesRented - a.timesRented).slice(0, 5), [])

  function submit(text = q) {
    const t = text.trim()
    if (!t) return
    buzz()
    dispatch({ type: 'ADD_RECENT_SEARCH', q: t })
    onClose()
    go({ name: 'browse', query: t })
  }

  function openItem(id: string) {
    buzz()
    onClose()
    go({ name: 'item', id })
  }

  return (
    <div className="search-overlay" role="dialog" aria-label="Search">
      <div className="search-overlay-head">
        <div className="searchbox">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Search cameras, lights, spaces…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            aria-label="Search gear"
          />
          {q && <button className="clear-btn" onClick={() => setQ('')} aria-label="Clear search"><Icon name="x" size={15} /></button>}
        </div>
        <button className="link-btn" onClick={onClose}>Cancel</button>
      </div>

      <div className="search-overlay-body">
        {!q.trim() ? (
          <>
            {state.recentSearches.length > 0 && (
              <>
                <h4>Recent searches</h4>
                <div className="chip-cloud">
                  {state.recentSearches.map((r) => (
                    <button key={r} className="filter-chip chip-ico" onClick={() => submit(r)}><Icon name="clock" size={14} /> {r}</button>
                  ))}
                </div>
              </>
            )}
            <h4>Trending on set</h4>
            <div className="chip-cloud">
              {trending.map((i) => (
                <button key={i.id} className="filter-chip chip-ico" onClick={() => openItem(i.id)}><Icon name={i.icon} size={14} /> {i.name}</button>
              ))}
            </div>
            <h4>Departments</h4>
            {CATEGORIES.map((c) => (
              <button key={c.id} className="sug-row" onClick={() => { buzz(); onClose(); go({ name: 'browse', category: c.id }) }}>
                <span className="sug-cat-ico" style={{ background: c.gradient }}><Icon name={c.icon} size={22} /></span>
                <span className="sug-title">{c.name}</span>
                <span className="sug-meta"><Icon name="chevron-right" size={16} /></span>
              </button>
            ))}
          </>
        ) : (
          <>
            {results.cats.map((c) => (
              <button key={c.id} className="sug-row" onClick={() => { buzz(); onClose(); go({ name: 'browse', category: c.id }) }}>
                <span className="sug-cat-ico" style={{ background: c.gradient }}><Icon name={c.icon} size={22} /></span>
                <span className="sug-title"><Marked text={c.name} q={q} /></span>
                <span className="sug-meta">department</span>
              </button>
            ))}
            {results.items.map((i) => (
              <button key={i.id} className="sug-row" onClick={() => openItem(i.id)}>
                <span className="sug-thumb"><ItemArt item={i} size="thumb" /></span>
                <span style={{ minWidth: 0 }}>
                  <span className="sug-title" style={{ display: 'block' }}><Marked text={i.name} q={q} /></span>
                  <span className="sug-sub" style={{ display: 'block' }}>
                    <RatingCompact rating={i.rating} count={i.ratingCount} /> · {i.timesRented} rentals
                  </span>
                </span>
                <span className="sug-meta">{money(i.pricePerDay)}/d</span>
              </button>
            ))}
            {results.items.length === 0 && results.cats.length === 0 && (
              <div className="empty-state" style={{ padding: '40px 10px' }}>
                <div className="big"><Icon name="search" size={56} /></div>
                <p>Nothing matches “{q}” — try a different spelling; typos are okay.</p>
              </div>
            )}
            {(results.items.length > 0 || results.cats.length > 0) && (
              <button className="search-all-btn" onClick={() => submit()}>
                Search all results for “{q.trim()}” <Icon name="arrow-right" size={15} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
