import { useEffect, useMemo, useRef, useState } from 'react'
import { NavContext, useHashRouter, useNav } from './nav'
import { StoreProvider, useStore } from './store'
import { CATEGORIES, ITEMS, getCategory } from './data/catalog'
import { buzz, fmtTimeAgo, fuzzyMatch, money } from './utils'
import { Modal } from './components/ui'
import ListSpace from './views/ListSpace'
import HostDashboard from './views/HostDashboard'
import Support from './views/Support'
import Home from './views/Home'
import Browse from './views/Browse'
import ItemDetail from './views/ItemDetail'
import CartView from './views/CartView'
import OrdersView from './views/OrdersView'
import ProfileView from './views/ProfileView'

/* ---------------- smart search: suggestions, recents, typo tolerance ---------------- */
function SearchBox() {
  const { go } = useNav()
  const { state, dispatch } = useStore()
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onTap = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', onTap)
    return () => document.removeEventListener('mousedown', onTap)
  }, [])

  const suggestions = useMemo(() => {
    if (!q.trim()) return []
    const pool = [...ITEMS, ...state.myListings.filter((l) => !l.paused)]
    const matches = pool.filter((i) => fuzzyMatch(`${i.name} ${i.tags.join(' ')} ${i.category}`, q)).slice(0, 5)
    const cats = CATEGORIES.filter((c) => fuzzyMatch(c.name, q)).slice(0, 2)
    return [...cats.map((c) => ({ kind: 'cat' as const, c })), ...matches.map((i) => ({ kind: 'item' as const, i }))]
  }, [q, state.myListings])

  function submit(text = q) {
    const t = text.trim()
    if (!t) return
    dispatch({ type: 'ADD_RECENT_SEARCH', q: t })
    setFocused(false)
    setQ('')
    go({ name: 'browse', query: t })
  }

  const showRecents = focused && !q.trim() && state.recentSearches.length > 0
  const showSuggestions = focused && suggestions.length > 0

  return (
    <div className="search-wrap" ref={wrapRef}>
      <div className="searchbox">
        <span aria-hidden="true">🔍</span>
        <input
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Search cameras, lights, trucks…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          aria-label="Search gear"
        />
        {q && <button className="clear-btn" onClick={() => setQ('')} aria-label="Clear search">✕</button>}
      </div>
      {(showRecents || showSuggestions) && (
        <div className="suggestions">
          {showRecents &&
            state.recentSearches.map((r) => (
              <button key={r} className="suggestion" onClick={() => submit(r)}>
                🕐 {r}
              </button>
            ))}
          {showSuggestions &&
            suggestions.map((s) =>
              s.kind === 'cat' ? (
                <button key={s.c.id} className="suggestion" onClick={() => { setFocused(false); setQ(''); go({ name: 'browse', category: s.c.id }) }}>
                  {s.c.emoji} <b>{s.c.name}</b> <span className="s-meta">department</span>
                </button>
              ) : (
                <button key={s.i.id} className="suggestion" onClick={() => { setFocused(false); setQ(''); go({ name: 'item', id: s.i.id }) }}>
                  {s.i.emoji} {s.i.name}
                  <span className="s-meta">{money(s.i.pricePerDay)}/d</span>
                </button>
              )
            )}
        </div>
      )}
    </div>
  )
}

/* ---------------- notification center ---------------- */
function NotificationSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore()
  const { go } = useNav()

  useEffect(() => {
    // mark read when the sheet closes, so unread styling is visible while open
    return () => dispatch({ type: 'READ_NOTIFICATIONS' })
  }, [dispatch])

  return (
    <Modal title="🔔 Notifications" onClose={onClose}>
      {state.notifications.length === 0 ? (
        <div className="empty-state" style={{ padding: '36px 10px' }}>
          <div className="big">🔕</div>
          <p>All caught up. Order updates, offers and replies land here.</p>
        </div>
      ) : (
        state.notifications.map((n) => (
          <div
            key={n.id}
            className={`notif-row ${n.read ? '' : 'unread'}`}
            onClick={() => {
              if (n.link) {
                onClose()
                location.hash = n.link
              }
            }}
          >
            <span className="n-emoji">{n.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{n.title}</b>
              {n.body && <div className="muted" style={{ fontSize: 13 }}>{n.body}</div>}
              <div className="muted small">{fmtTimeAgo(n.at)}</div>
            </div>
          </div>
        ))
      )}
      <button className="btn btn-ghost btn-block" style={{ marginTop: 14 }} onClick={() => { dispatch({ type: 'READ_NOTIFICATIONS' }); go({ name: 'orders' }) }}>
        View all orders
      </button>
    </Modal>
  )
}

/* ---------------- first-run onboarding ---------------- */
const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Multan', 'Peshawar']

function Onboarding() {
  const { dispatch } = useStore()
  const [name, setName] = useState('')
  const [city, setCity] = useState('Lahore')

  return (
    <Modal title="🎬 Welcome to Papa Rentals" onClose={() => dispatch({ type: 'SET_PROFILE', name: '', city })}>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        Rent everything for your shoot — priced like a negotiation, delivered like a food order. Set up takes 10 seconds.
      </p>
      <label className="field">
        What should we call you?
        <input value={name} placeholder="Your name" enterKeyHint="done" onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="field" style={{ marginTop: 12 }}>
        Your city
        <div className="city-row">
          {CITIES.map((c) => (
            <button key={c} className={`slot-chip ${city === c ? 'active' : ''}`} onClick={() => setCity(c)}>{c}</button>
          ))}
        </div>
      </div>
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 16 }}
        onClick={() => { buzz(); dispatch({ type: 'SET_PROFILE', name: name.trim(), city }) }}
      >
        Start browsing — Rs 5,000 welcome credit inside 🎁
      </button>
    </Modal>
  )
}

/* ---------------- shell ---------------- */
function Shell() {
  const { view, go, back } = useHashRouter()
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const { state } = useStore()

  function toast(msg: string) {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600)
  }

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const activeOrders = state.orders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length
  const unreadNotifs = state.notifications.filter((n) => !n.read).length
  const viewKey = view.name === 'item' ? `item-${view.id}` : view.name

  return (
    <NavContext.Provider value={{ view, go, back, toast }}>
      <div className="app-shell">
        <header className="topbar">
          <div className="logo" onClick={() => go({ name: 'home' })}>
            🎬 <span className="logo-word">papa</span><span>rentals</span>
          </div>
          <SearchBox />
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => setNotifOpen(true)} aria-label={`Notifications, ${unreadNotifs} unread`}>
              🔔{unreadNotifs > 0 && <span className="dot">{unreadNotifs}</span>}
            </button>
            <button className="icon-btn" onClick={() => go({ name: 'cart' })} aria-label={`Cart, ${state.cart.length} items`}>
              🛒{state.cart.length > 0 && <span className="dot">{state.cart.length}</span>}
            </button>
          </div>
        </header>

        <main className="view" key={viewKey}>
          {view.name === 'home' && <Home />}
          {view.name === 'browse' && (
            <Browse category={view.category} query={view.query} dealsOnly={view.dealsOnly} wishlistOnly={view.wishlistOnly} />
          )}
          {view.name === 'item' && <ItemDetail id={view.id} />}
          {view.name === 'cart' && <CartView />}
          {view.name === 'orders' && <OrdersView />}
          {view.name === 'profile' && <ProfileView />}
          {view.name === 'post' && <ListSpace />}
          {view.name === 'dashboard' && <HostDashboard />}
          {view.name === 'support' && <Support />}
        </main>
      </div>

      <nav className="bottom-nav">
        <button className={view.name === 'home' ? 'active' : ''} onClick={() => go({ name: 'home' })}>
          <span className="nav-ico">🏠</span>Home
        </button>
        <button className={view.name === 'browse' || view.name === 'item' ? 'active' : ''} onClick={() => go({ name: 'browse' })}>
          <span className="nav-ico">🔍</span>Browse
        </button>
        <button className={view.name === 'cart' ? 'active' : ''} onClick={() => go({ name: 'cart' })}>
          <span className="nav-ico">🛒</span>Cart
          {state.cart.length > 0 && <span className="dot">{state.cart.length}</span>}
        </button>
        <button className={view.name === 'orders' ? 'active' : ''} onClick={() => go({ name: 'orders' })}>
          <span className="nav-ico">📦</span>Orders
          {activeOrders > 0 && <span className="dot">{activeOrders}</span>}
        </button>
        <button className={['profile', 'post', 'dashboard', 'support'].includes(view.name) ? 'active' : ''} onClick={() => go({ name: 'profile' })}>
          <span className="nav-ico">👤</span>Profile
        </button>
      </nav>

      {notifOpen && <NotificationSheet onClose={() => setNotifOpen(false)} />}
      {!state.profile.onboarded && <Onboarding />}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </NavContext.Provider>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
