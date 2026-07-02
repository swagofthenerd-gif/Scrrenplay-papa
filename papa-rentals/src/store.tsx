import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { AppState, Booking, ChatMessage, Offer, Order, OrderStatus, Review, UserReport } from './types'
import { POINTS_PER_100, cartTotals, uid } from './utils'

const STORAGE_KEY = 'papa-rentals-v1'

const initialState: AppState = {
  cart: [],
  wishlist: [],
  orders: [],
  offers: [],
  chats: {},
  walletBalance: 5000, // welcome credit
  points: 120,
  myReviews: {},
  reports: [],
}

type Action =
  | { type: 'ADD_TO_CART'; booking: Booking }
  | { type: 'REMOVE_FROM_CART'; index: number }
  | { type: 'CLEAR_CART' }
  | { type: 'TOGGLE_WISHLIST'; itemId: string }
  | { type: 'PLACE_ORDER'; promoCode?: string; walletUsed: number }
  | { type: 'ADVANCE_ORDER'; orderId: string }
  | { type: 'RATE_ORDER'; orderId: string; rating: number }
  | { type: 'ADD_REVIEW'; itemId: string; review: Review }
  | { type: 'ADD_OFFER'; offer: Offer }
  | { type: 'ACCEPT_COUNTER'; offerId: string }
  | { type: 'ADD_CHAT'; ownerId: string; message: ChatMessage }
  | { type: 'REPORT'; report: UserReport; orderId?: string }
  | { type: 'ADD_WALLET'; amount: number }

const STATUS_FLOW: OrderStatus[] = ['confirmed', 'preparing', 'in_transit', 'in_use', 'returned', 'completed']

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_TO_CART':
      return { ...state, cart: [...state.cart, action.booking] }
    case 'REMOVE_FROM_CART':
      return { ...state, cart: state.cart.filter((_, i) => i !== action.index) }
    case 'CLEAR_CART':
      return { ...state, cart: [] }
    case 'TOGGLE_WISHLIST':
      return {
        ...state,
        wishlist: state.wishlist.includes(action.itemId)
          ? state.wishlist.filter((id) => id !== action.itemId)
          : [...state.wishlist, action.itemId],
      }
    case 'PLACE_ORDER': {
      if (state.cart.length === 0) return state
      const t = cartTotals(state.cart, action.promoCode, action.walletUsed)
      const pointsEarned = Math.floor((t.total - t.deposit) / 100) * POINTS_PER_100
      const order: Order = {
        id: `PR-${Date.now().toString().slice(-6)}`,
        createdAt: new Date().toISOString(),
        lines: state.cart,
        status: 'confirmed',
        subtotal: t.subtotal,
        transportFee: t.transportFee,
        insuranceFee: t.insuranceFee,
        operatorFee: t.operatorFee,
        serviceFee: t.serviceFee,
        discount: t.discount,
        promoCode: action.promoCode,
        walletUsed: t.walletUsed,
        deposit: t.deposit,
        total: t.total,
        pointsEarned,
      }
      return {
        ...state,
        cart: [],
        orders: [order, ...state.orders],
        walletBalance: state.walletBalance - t.walletUsed,
        points: state.points + pointsEarned,
      }
    }
    case 'ADVANCE_ORDER': {
      return {
        ...state,
        orders: state.orders.map((o) => {
          if (o.id !== action.orderId) return o
          const idx = STATUS_FLOW.indexOf(o.status)
          if (idx >= STATUS_FLOW.length - 1) return o
          const next = STATUS_FLOW[idx + 1]
          // owner rates you back when the order completes
          return next === 'completed' ? { ...o, status: next, ownerRatingOfMe: 5 } : { ...o, status: next }
        }),
      }
    }
    case 'RATE_ORDER':
      return {
        ...state,
        orders: state.orders.map((o) => (o.id === action.orderId ? { ...o, myRatingOfOwner: action.rating } : o)),
      }
    case 'ADD_REVIEW':
      return { ...state, myReviews: { ...state.myReviews, [action.itemId]: action.review } }
    case 'ADD_OFFER':
      return { ...state, offers: [action.offer, ...state.offers] }
    case 'ACCEPT_COUNTER':
      return {
        ...state,
        offers: state.offers.map((o) =>
          o.id === action.offerId && o.status === 'countered' ? { ...o, status: 'accepted', offeredPerDay: o.counterPerDay ?? o.offeredPerDay } : o
        ),
      }
    case 'ADD_CHAT': {
      const existing = state.chats[action.ownerId] ?? []
      return { ...state, chats: { ...state.chats, [action.ownerId]: [...existing, action.message] } }
    }
    case 'REPORT':
      return {
        ...state,
        reports: [...state.reports, action.report],
        orders: action.orderId ? state.orders.map((o) => (o.id === action.orderId ? { ...o, reported: true } : o)) : state.orders,
      }
    case 'ADD_WALLET':
      return { ...state, walletBalance: state.walletBalance + action.amount }
    default:
      return state
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...initialState, ...JSON.parse(raw) }
  } catch {
    /* corrupted state — start fresh */
  }
  return initialState
}

const StoreContext = createContext<{ state: AppState; dispatch: (a: Action) => void }>({
  state: initialState,
  dispatch: () => {},
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage full or unavailable */
    }
  }, [state])
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  return useContext(StoreContext)
}

export function useMyReview(itemId: string) {
  const { state } = useStore()
  return state.myReviews[itemId]
}
