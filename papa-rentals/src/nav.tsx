import { createContext, useContext, useEffect, useState } from 'react'
import type { CategoryId } from './types'

export type BrowseSort = 'relevance' | 'popular' | 'price_asc' | 'price_desc' | 'rating' | 'nearest'

const BROWSE_SORTS: BrowseSort[] = ['relevance', 'popular', 'price_asc', 'price_desc', 'rating', 'nearest']

export type View =
  | { name: 'home' }
  | {
      name: 'browse'
      category?: CategoryId
      query?: string
      dealsOnly?: boolean
      wishlistOnly?: boolean
      sort?: BrowseSort
      verified?: boolean
      instant?: boolean
      offers?: boolean
      minPrice?: number
      maxPrice?: number
      minCapacity?: number
      maxKm?: number
      hourly?: boolean
      from?: string
      to?: string
      compare?: string[]
    }
  | { name: 'item'; id: string; from?: string; to?: string }
  | { name: 'vendor'; id: string }
  | { name: 'kit'; id: string }
  | { name: 'cart' }
  | { name: 'orders' }
  | { name: 'profile' }
  | { name: 'post' }
  | { name: 'dashboard' }
  | { name: 'support'; orderId?: string }
  | { name: 'services' }
  | { name: 'order'; id: string }
  | { name: 'wallet' }
  | { name: 'settings' }
  | { name: 'referrals' }
  | { name: 'verify' }
  | { name: 'publicProfile' }
  | { name: 'inbox'; ownerId?: string }

export function viewToHash(v: View): string {
  switch (v.name) {
    case 'home': return '#/'
    /* Dates ride along so an item opened from a date-filtered Browse lands
       pre-set to the shoot the renter already told us about. */
    case 'item': return `#/item/${v.id}${v.from && v.to ? `?from=${v.from}&to=${v.to}` : ''}`
    case 'vendor': return `#/vendor/${v.id}`
    case 'kit': return `#/kit/${v.id}`
    case 'cart': return '#/cart'
    case 'orders': return '#/orders'
    case 'profile': return '#/profile'
    case 'post': return '#/post'
    case 'dashboard': return '#/dashboard'
    case 'support': return v.orderId ? `#/support/${v.orderId}` : '#/support'
    case 'services': return '#/services'
    case 'order': return `#/order/${v.id}`
    case 'wallet': return '#/wallet'
    case 'settings': return '#/settings'
    case 'referrals': return '#/referrals'
    case 'verify': return '#/verify'
    case 'publicProfile': return '#/me'
    case 'inbox': return v.ownerId ? `#/inbox/${v.ownerId}` : '#/inbox'
    case 'browse': {
      const p = new URLSearchParams()
      if (v.category) p.set('cat', v.category)
      if (v.query) p.set('q', v.query)
      if (v.dealsOnly) p.set('deals', '1')
      if (v.wishlistOnly) p.set('wish', '1')
      if (v.sort) p.set('sort', v.sort)
      if (v.verified) p.set('ver', '1')
      if (v.instant) p.set('inst', '1')
      if (v.offers) p.set('off', '1')
      if (v.minPrice) p.set('min', String(v.minPrice))
      if (v.maxPrice) p.set('max', String(v.maxPrice))
      if (v.minCapacity) p.set('cap', String(v.minCapacity))
      if (v.maxKm) p.set('km', String(v.maxKm))
      if (v.hourly) p.set('hr', '1')
      if (v.from) p.set('from', v.from)
      if (v.to) p.set('to', v.to)
      if (v.compare && v.compare.length) p.set('cmp', v.compare.join(','))
      const qs = p.toString()
      return `#/browse${qs ? '?' + qs : ''}`
    }
  }
}

export function parseHash(hash: string): View {
  const h = hash.replace(/^#\/?/, '')
  const [path, qs] = h.split('?')
  const seg = path.split('/').filter(Boolean)
  if (seg[0] === 'item' && seg[1]) {
    const p = new URLSearchParams(qs)
    return { name: 'item', id: seg[1], from: p.get('from') || undefined, to: p.get('to') || undefined }
  }
  if (seg[0] === 'vendor' && seg[1]) return { name: 'vendor', id: seg[1] }
  if (seg[0] === 'kit' && seg[1]) return { name: 'kit', id: seg[1] }
  if (seg[0] === 'cart') return { name: 'cart' }
  if (seg[0] === 'orders') return { name: 'orders' }
  if (seg[0] === 'profile') return { name: 'profile' }
  if (seg[0] === 'post') return { name: 'post' }
  if (seg[0] === 'dashboard') return { name: 'dashboard' }
  if (seg[0] === 'support') return { name: 'support', orderId: seg[1] }
  if (seg[0] === 'services') return { name: 'services' }
  if (seg[0] === 'order' && seg[1]) return { name: 'order', id: seg[1] }
  if (seg[0] === 'wallet') return { name: 'wallet' }
  if (seg[0] === 'settings') return { name: 'settings' }
  if (seg[0] === 'referrals') return { name: 'referrals' }
  if (seg[0] === 'verify') return { name: 'verify' }
  if (seg[0] === 'me') return { name: 'publicProfile' }
  if (seg[0] === 'inbox') return { name: 'inbox', ownerId: seg[1] }
  if (seg[0] === 'browse') {
    const p = new URLSearchParams(qs)
    const rawSort = p.get('sort')
    const num = (key: string) => {
      const n = Number(p.get(key))
      return Number.isFinite(n) && n > 0 ? n : undefined
    }
    return {
      name: 'browse',
      category: (p.get('cat') as CategoryId) || undefined,
      query: p.get('q') || undefined,
      dealsOnly: p.get('deals') === '1',
      wishlistOnly: p.get('wish') === '1',
      sort: BROWSE_SORTS.includes(rawSort as BrowseSort) ? (rawSort as BrowseSort) : undefined,
      verified: p.get('ver') === '1',
      instant: p.get('inst') === '1',
      offers: p.get('off') === '1',
      minPrice: num('min'),
      maxPrice: num('max'),
      minCapacity: num('cap'),
      maxKm: num('km'),
      hourly: p.get('hr') === '1',
      from: p.get('from') || undefined,
      to: p.get('to') || undefined,
      compare: p.get('cmp')?.split(',').filter(Boolean) ?? [],
    }
  }
  return { name: 'home' }
}

/* Scroll restoration: remember where you were per route, restore on back/forward. */
const scrollMemory = new Map<string, number>()

/* Browse filters live in the URL, so they survive back/forward — but the Browse
   tab in the bottom bar pointed at a bare `#/browse`, which threw away a
   carefully built set of filters the moment somebody checked their cart and came
   back. Remember the last browse URL and send the tab there instead. */
let lastBrowse: View = { name: 'browse' }
function rememberBrowse(v: View) {
  if (v.name === 'browse') lastBrowse = v
}
export function browseTabView(): View {
  return lastBrowse
}

export function useHashRouter(): { view: View; go: (v: View, opts?: { replace?: boolean }) => void; back: () => void } {
  const [view, setView] = useState<View>(() => {
    const v = parseHash(location.hash)
    rememberBrowse(v)
    return v
  })

  useEffect(() => {
    if (!location.hash) history.replaceState(null, '', '#/')
    const onHashChange = () => {
      const next = parseHash(location.hash)
      rememberBrowse(next)
      setView(next)
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

  function go(v: View, opts?: { replace?: boolean }) {
    const target = viewToHash(v)
    // Filter/sort tweaks rewrite the URL in place: no history spam, no scroll jump.
    if (opts?.replace) {
      if (target === location.hash) return
      const y = window.scrollY
      history.replaceState(null, '', target)
      scrollMemory.set(target, y)
      const next = parseHash(target)
      // replace-nav bypasses hashchange, so record filter tweaks here too
      rememberBrowse(next)
      setView(next)
      return
    }
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
  go: (v: View, opts?: { replace?: boolean }) => void
  back: () => void
  toast: (msg: string) => void
}>({ view: { name: 'home' }, go: () => {}, back: () => {}, toast: () => {} })

export function useNav() {
  return useContext(NavContext)
}
