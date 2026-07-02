import { createContext, useContext } from 'react'
import type { CategoryId } from './types'

export type View =
  | { name: 'home' }
  | { name: 'browse'; category?: CategoryId; query?: string; dealsOnly?: boolean; wishlistOnly?: boolean }
  | { name: 'item'; id: string }
  | { name: 'cart' }
  | { name: 'orders' }
  | { name: 'profile' }

export const NavContext = createContext<{
  view: View
  go: (v: View) => void
  toast: (msg: string) => void
}>({ view: { name: 'home' }, go: () => {}, toast: () => {} })

export function useNav() {
  return useContext(NavContext)
}
