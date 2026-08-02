import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, ITEMS, deptFromPrice } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { buzz, highlightMatch, money, savedLabel, searchRank } from '../utils'
import { ItemArt, RatingCompact } from './ui'
import { DeptMark, Icon } from './icons'

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
    // Closing search dropped focus on the body, so the next Tab restarted from the
    // top of the page instead of the search button you just came from.
    const previous = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
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
            onKeyDown={(e) => {
              /* preventDefault matters: submit() closes the overlay, whose cleanup
                 returns focus to the search pill button. Without this, the same
                 Enter keystroke then natively activates that refocused button and
                 reopens search over the results we just navigated to. */
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
            aria-label="Search gear"
          />
          {q && <button className="clear-btn" onClick={() => setQ('')} aria-label="Clear search"><Icon name="x" size={15} /></button>}
        </div>
        <button className="link-btn" onClick={onClose}>Cancel</button>
      </div>

      <div className="search-overlay-body">
        {!q.trim() ? (
          <>
            {/* Saved searches live on Home too, but the overlay is where someone
                who came here to search actually is — repeating them costs one row
                and saves retyping a query they already told us they care about. */}
            {state.savedSearches.length > 0 && (
              <>
                <h4>Saved searches</h4>
                <div className="chip-cloud">
                  {state.savedSearches.map((s) => (
                    <button
                      key={s.id}
                      className="filter-chip chip-ico"
                      onClick={() => {
                        buzz()
                        onClose()
                        go({ name: 'browse', query: s.q, category: s.category, maxPrice: s.maxPrice })
                      }}
                    >
                      <Icon name="star" size={14} /> {savedLabel(s)}
                    </button>
                  ))}
                </div>
              </>
            )}
            {state.recentSearches.length > 0 && (
              <>
                <div className="search-sec-head">
                  <h4>Recent searches</h4>
                  <button
                    className="link-btn"
                    onClick={() => { buzz(); dispatch({ type: 'CLEAR_RECENT_SEARCHES' }) }}
                  >
                    Clear
                  </button>
                </div>
                <div className="chip-cloud">
                  {state.recentSearches.map((r) => (
                    // A recents list you can't prune keeps a mistyped query in
                    // front of you for six searches. Each chip carries its own X.
                    <span key={r} className="filter-chip chip-ico chip-removable">
                      <button className="chip-main" onClick={() => submit(r)}><Icon name="clock" size={14} /> {r}</button>
                      <button
                        className="chip-x"
                        aria-label={`Remove ${r} from recent searches`}
                        onClick={() => { buzz(); dispatch({ type: 'REMOVE_RECENT_SEARCH', q: r }) }}
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </span>
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
                <span className="sug-cat-ico"><DeptMark id={c.id} size={42} /></span>
                <span className="sug-title">{c.name}</span>
                {/* Same helper Home's chips use — two screens quoting different
                    entry prices for one department is worse than quoting none. */}
                <span className="sug-meta">
                  {deptFromPrice(c.id) !== undefined && <>from {money(deptFromPrice(c.id) as number)} </>}
                  <Icon name="chevron-right" size={16} />
                </span>
              </button>
            ))}
          </>
        ) : (
          <>
            {results.cats.map((c) => (
              <button key={c.id} className="sug-row" onClick={() => { buzz(); onClose(); go({ name: 'browse', category: c.id }) }}>
                <span className="sug-cat-ico"><DeptMark id={c.id} size={42} /></span>
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
