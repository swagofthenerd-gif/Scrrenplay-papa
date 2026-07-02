import { createContext, useContext, useEffect, useState } from 'react'
import type { CategoryId } from './types'

export type View =
  | { name: 'home' }
  | { name: 'browse'; category?: CategoryId; query?: string; dealsOnly?: boolean; wishlistOnly?: boolean }
  | { name: 'item'; id: string }
  | { name: 'cart' }
  | { name: 'orders' }
  | { name: 'profile' }
  | { name: 'post' }
  | { name: 'dashboard' }
  | { name: 'support' }

export function viewToHash(v: View): string {
  switch (v.name) {
    case 'home': return '#/'
    case 'item': return `#/item/${v.id}`
    case 'cart': return '#/cart'
    case 'orders': return '#/orders'
    case 'profile': return '#/profile'
    case 'post': return '#/post'
    case 'dashboard': return '#/dashboard'
    case 'support': return '#/support'
    case 'browse': {
      const p = new URLSearchParams()
      if (v.category) p.set('cat', v.category)
      if (v.query) p.set('q', v.query)
      if (v.dealsOnly) p.set('deals', '1')
      if (v.wishlistOnly) p.set('wish', '1')
      const qs = p.toString()
      return `#/browse${qs ? '?' + qs : ''}`
    }
  }
}

export function parseHash(hash: string): View {
  const h = hash.replace(/^#\/?/, '')
  const [path, qs] = h.split('?')
  const seg = path.split('/').filter(Boolean)
  if (seg[0] === 'item' && seg[1]) return { name: 'item', id: seg[1] }
  if (seg[0] === 'cart') return { name: 'cart' }
  if (seg[0] === 'orders') return { name: 'orders' }
  if (seg[0] === 'profile') return { name: 'profile' }
  if (seg[0] === 'post') return { name: 'post' }
  if (seg[0] === 'dashboard') return { name: 'dashboard' }
  if (seg[0] === 'support') return { name: 'support' }
  if (seg[0] === 'browse') {
    const p = new URLSearchParams(qs)
    return {
      name: 'browse',
      category: (p.get('cat') as CategoryId) || undefined,
      query: p.get('q') || undefined,
      dealsOnly: p.get('deals') === '1',
      wishlistOnly: p.get('wish') === '1',
    }
  }
  return { name: 'home' }
}

/* Scroll restoration: remember where you were per route, restore on back/forward. */
const scrollMemory = new Map<string, number>()

export function useHashRouter(): { view: View; go: (v: View) => void; back: () => void } {
  const [view, setView] = useState<View>(() => parseHash(location.hash))

  useEffect(() => {
    if (!location.hash) history.replaceState(null, '', '#/')
    const onHashChange = () => {
      setView(parseHash(location.hash))
      // restore remembered scroll for this route (0 for fresh visits)
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollMemory.get(location.hash) ?? 0 })
      })
    }
    const onScroll = () => scrollMemory.set(location.hash, window.scrollY)
    window.addEventListener('hashchange', onHashChange)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  function go(v: View) {
    const target = viewToHash(v)
    if (target === location.hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    scrollMemory.delete(target) // forward nav starts at the top
    location.hash = target
  }

  return { view, go, back: () => history.back() }
}

export const NavContext = createContext<{
  view: View
  go: (v: View) => void
  back: () => void
  toast: (msg: string) => void
}>({ view: { name: 'home' }, go: () => {}, back: () => {}, toast: () => {} })

export function useNav() {
  return useContext(NavContext)
}
