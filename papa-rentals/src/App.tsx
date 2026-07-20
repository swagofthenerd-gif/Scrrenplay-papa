import { useEffect, useRef, useState } from 'react'
import { NavContext, useHashRouter, useNav } from './nav'
import { StoreProvider, useStore } from './store'
import { buzz, fmtTimeAgo } from './utils'
import { Modal } from './components/ui'
import SearchOverlay from './components/SearchOverlay'
import ListSpace from './views/ListSpace'
import HostDashboard from './views/HostDashboard'
import Support from './views/Support'
import Home from './views/Home'
import Browse from './views/Browse'
import ItemDetail from './views/ItemDetail'
import CartView from './views/CartView'
import OrdersView from './views/OrdersView'
import ProfileView from './views/ProfileView'

/* ---------------- search entry: Airbnb-style pill opening the overlay ---------------- */
function SearchPill({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="search-wrap">
      <button className="search-pill" onClick={onOpen} aria-label="Search gear">
        <span className="sp-ico" aria-hidden="true">🔍</span>
        <span className="sp-label">Search cameras, lights, spaces…</span>
      </button>
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
  const [searchOpen, setSearchOpen] = useState(false)
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
          <SearchPill onOpen={() => setSearchOpen(true)} />
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

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
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
