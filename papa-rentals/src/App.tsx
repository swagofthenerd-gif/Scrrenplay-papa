import { useEffect, useRef, useState } from 'react'
import { NavContext, browseTabView, useHashRouter, useNav } from './nav'
import { StoreProvider, useStore } from './store'
import { buzz, fmtTimeAgo } from './utils'
import { getItem } from './data/catalog'
import { ItemArt, Modal } from './components/ui'
import { Icon, IconSketchFilter, LogoMark } from './components/icons'
import SearchOverlay from './components/SearchOverlay'
import ListSpace from './views/ListSpace'
import HostDashboard from './views/HostDashboard'
import Support from './views/Support'
import Services from './views/Services'
import Home from './views/Home'
import Browse from './views/Browse'
import ItemDetail from './views/ItemDetail'
import VendorView from './views/VendorView'
import CartView from './views/CartView'
import OrdersView from './views/OrdersView'
import ProfileView from './views/ProfileView'
import WalletView from './views/WalletView'
import SettingsView from './views/SettingsView'
import InboxView from './views/InboxView'
import OrderDetailView from './views/OrderDetailView'

/* ---------------- search entry: Airbnb-style pill opening the overlay ---------------- */
function SearchPill({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="search-wrap">
      <button className="search-pill" onClick={onOpen} aria-label="Search gear">
        <span className="sp-ico"><Icon name="search" size={16} /></span>
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
    <Modal title="Notifications" onClose={onClose}>
      {state.notifications.length === 0 ? (
        <div className="empty-state" style={{ padding: '36px 10px' }}>
          <div className="big"><Icon name="bell-off" size={56} /></div>
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
            <span className="n-ico"><Icon name={n.icon} size={20} /></span>
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
    <Modal title="Welcome to Papa Rentals" onClose={() => dispatch({ type: 'SET_PROFILE', name: '', city })}>
      <div className="onboard-strip" aria-hidden="true">
        {['i1', 'i21', 'i12'].map((id) => <ItemArt key={id} item={getItem(id)} size="card" />)}
      </div>
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
        Start browsing — Rs 5,000 welcome credit inside
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
  const viewKey = view.name === 'item' ? `item-${view.id}` : view.name === 'vendor' ? `vendor-${view.id}` : view.name === 'order' ? `order-${view.id}` : view.name

  return (
    <NavContext.Provider value={{ view, go, back, toast }}>
      <IconSketchFilter />
      <div className="app-shell">
        <header className="topbar">
          <div className="logo" onClick={() => go({ name: 'home' })}>
            <LogoMark size={24} /> <span className="logo-word">papa</span><span>rentals</span>
          </div>
          <SearchPill onOpen={() => setSearchOpen(true)} />
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => setNotifOpen(true)} aria-label={`Notifications, ${unreadNotifs} unread`}>
              <Icon name="bell" />{unreadNotifs > 0 && <span className="dot">{unreadNotifs}</span>}
            </button>
            <button className="icon-btn" onClick={() => go({ name: 'cart' })} aria-label={`Cart, ${state.cart.length} items`}>
              <Icon name="cart" />{state.cart.length > 0 && <span className="dot">{state.cart.length}</span>}
            </button>
          </div>
        </header>

        <main className="view" key={viewKey}>
          {view.name === 'home' && <Home />}
          {/* Spread, not a hand-listed set: every filter added to the route was
              one more prop to forget here, and minPrice/maxKm already were. */}
          {view.name === 'browse' && <Browse {...view} />}
          {view.name === 'item' && <ItemDetail id={view.id} from={view.from} to={view.to} />}
          {view.name === 'vendor' && <VendorView id={view.id} />}
          {view.name === 'cart' && <CartView />}
          {view.name === 'orders' && <OrdersView />}
          {view.name === 'profile' && <ProfileView />}
          {view.name === 'post' && <ListSpace />}
          {view.name === 'dashboard' && <HostDashboard />}
          {view.name === 'support' && <Support orderId={view.orderId} />}
          {view.name === 'services' && <Services />}
          {view.name === 'wallet' && <WalletView />}
          {view.name === 'settings' && <SettingsView />}
          {view.name === 'inbox' && <InboxView ownerId={view.ownerId} />}
          {view.name === 'order' && <OrderDetailView id={view.id} />}
        </main>
      </div>

      <nav className="bottom-nav">
        <button className={view.name === 'home' || view.name === 'services' ? 'active' : ''} onClick={() => go({ name: 'home' })}>
          <span className="nav-ico"><Icon name="home" /></span>Home
        </button>
        <button className={view.name === 'browse' || view.name === 'item' ? 'active' : ''} onClick={() => go(browseTabView())}>
          <span className="nav-ico"><Icon name="search" /></span>Browse
        </button>
        <button className={view.name === 'cart' ? 'active' : ''} onClick={() => go({ name: 'cart' })}>
          <span className="nav-ico"><Icon name="cart" /></span>Cart
          {state.cart.length > 0 && <span className="dot">{state.cart.length}</span>}
        </button>
        <button className={['orders', 'order'].includes(view.name) ? 'active' : ''} onClick={() => go({ name: 'orders' })}>
          <span className="nav-ico"><Icon name="box" /></span>Orders
          {activeOrders > 0 && <span className="dot">{activeOrders}</span>}
        </button>
        <button className={['profile', 'post', 'dashboard', 'support', 'wallet', 'settings', 'inbox'].includes(view.name) ? 'active' : ''} onClick={() => go({ name: 'profile' })}>
          <span className="nav-ico"><Icon name="user" /></span>Profile
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
