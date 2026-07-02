import { useEffect, useRef, useState } from 'react'
import { NavContext } from './nav'
import type { View } from './nav'
import { StoreProvider, useStore } from './store'
import Home from './views/Home'
import Browse from './views/Browse'
import ItemDetail from './views/ItemDetail'
import CartView from './views/CartView'
import OrdersView from './views/OrdersView'
import ProfileView from './views/ProfileView'

function Shell() {
  const [view, setView] = useState<View>({ name: 'home' })
  const [search, setSearch] = useState('')
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const { state } = useStore()

  function go(v: View) {
    setView(v)
    window.scrollTo({ top: 0 })
  }

  function toast(msg: string) {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600)
  }

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  function submitSearch() {
    if (search.trim()) go({ name: 'browse', query: search.trim() })
  }

  const activeOrders = state.orders.filter((o) => o.status !== 'completed').length

  return (
    <NavContext.Provider value={{ view, go, toast }}>
      <div className="app-shell">
        <header className="topbar">
          <div className="logo" onClick={() => go({ name: 'home' })}>
            🎬 papa<span>rentals</span>
          </div>
          <div className="searchbox">
            <span>🔍</span>
            <input
              placeholder="Search cameras, lights, grip trucks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
            />
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => go({ name: 'browse', wishlistOnly: true })} aria-label="Wishlist">
              ♡{state.wishlist.length > 0 && <span className="dot">{state.wishlist.length}</span>}
            </button>
            <button className="icon-btn" onClick={() => go({ name: 'cart' })} aria-label="Cart">
              🛒{state.cart.length > 0 && <span className="dot">{state.cart.length}</span>}
            </button>
          </div>
        </header>

        <main>
          {view.name === 'home' && <Home />}
          {view.name === 'browse' && (
            <Browse category={view.category} query={view.query} dealsOnly={view.dealsOnly} wishlistOnly={view.wishlistOnly} />
          )}
          {view.name === 'item' && <ItemDetail id={view.id} />}
          {view.name === 'cart' && <CartView />}
          {view.name === 'orders' && <OrdersView />}
          {view.name === 'profile' && <ProfileView />}
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
        <button className={view.name === 'profile' ? 'active' : ''} onClick={() => go({ name: 'profile' })}>
          <span className="nav-ico">👤</span>Profile
        </button>
      </nav>

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
