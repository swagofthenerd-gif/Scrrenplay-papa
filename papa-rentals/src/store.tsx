import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import { DRIVER_POOL, PROMO_CODES, RENTER_POOL, getItem, getOwner, syncUserListings } from './data/catalog'
import type {
  Address, AppNotification, AppState, Booking, ChatMessage, ChatThread,
  Item, Offer, Order, OrderStatus, OwnerBooking, Review, UserReport,
} from './types'
import { OFFER_TTL_MS, cartTotals, dealActive, evaluateOffer, todayISO, uid } from './utils'
import type { TotalsInput } from './utils'

const STORAGE_KEY = 'papa-rentals-v2'

const initialState: AppState = {
  profile: { name: '', city: 'Lahore', onboarded: false },
  cart: [],
  wishlist: [],
  orders: [],
  offers: [],
  chats: {},
  notifications: [],
  walletBalance: 5000, // welcome credit
  points: 120,
  myReviews: {},
  reports: [],
  addresses: [
    { id: 'a1', label: '🎬 Studio', detail: 'Alhamra Arts Council, Gaddafi Stadium, Lahore' },
    { id: 'a2', label: '🏠 Home base', detail: 'House 12, Street 4, DHA Phase 3, Lahore' },
  ],
  selectedAddressId: 'a1',
  recentSearches: [],
  recentlyViewed: [],
  blockedOwners: [],
  promoCodesUsed: [],
  myListings: [],
  ownerBookings: [],
  claims: [],
  availAlerts: [],
  referralRedeemed: false,
}

export interface PlaceOrderOpts extends TotalsInput {
  paymentMethod: string
  address: string
}

type Action =
  | { type: 'SET_PROFILE'; name: string; city: string }
  | { type: 'ADD_TO_CART'; booking: Booking }
  | { type: 'REMOVE_FROM_CART'; index: number }
  | { type: 'CLEAR_CART' }
  | { type: 'TOGGLE_WISHLIST'; itemId: string }
  | { type: 'PLACE_ORDER'; opts: PlaceOrderOpts }
  | { type: 'ADVANCE_ORDER'; orderId: string }
  | { type: 'CANCEL_ORDER'; orderId: string }
  | { type: 'EXTEND_ORDER'; orderId: string; days: number }
  | { type: 'RATE_ORDER'; orderId: string; ratings: number[]; text?: string }
  | { type: 'ADD_OFFER'; offer: Offer }
  | { type: 'ACCEPT_COUNTER'; offerId: string }
  | { type: 'ADD_CHAT'; ownerId: string; message: ChatMessage }
  | { type: 'READ_CHAT'; ownerId: string }
  | { type: 'REPORT'; report: UserReport; orderId?: string; block?: string }
  | { type: 'ADD_WALLET'; amount: number }
  | { type: 'ADD_ADDRESS'; address: Address }
  | { type: 'SELECT_ADDRESS'; id: string }
  | { type: 'ADD_RECENT_SEARCH'; q: string }
  | { type: 'VIEW_ITEM'; itemId: string }
  | { type: 'READ_NOTIFICATIONS' }
  | { type: 'ADD_LISTING'; item: Item }
  | { type: 'TOGGLE_LISTING_PAUSE'; itemId: string }
  | { type: 'DELETE_LISTING'; itemId: string }
  | { type: 'ACCEPT_OWNER_BOOKING'; id: string }
  | { type: 'DECLINE_OWNER_BOOKING'; id: string }
  | { type: 'FILE_CLAIM'; orderId: string; itemName: string; reason: string; amount: number }
  | { type: 'ADD_AVAIL_ALERT'; itemId: string }
  | { type: 'REDEEM_REFERRAL'; code: string }
  | { type: 'TICK'; now: number }

const STATUS_FLOW: OrderStatus[] = ['confirmed', 'preparing', 'in_transit', 'in_use', 'returned', 'completed']

function notify(state: AppState, n: Omit<AppNotification, 'id' | 'at' | 'read'>): AppNotification[] {
  return [{ id: uid(), at: Date.now(), read: false, ...n }, ...state.notifications].slice(0, 40)
}

type NotifSpec = Omit<AppNotification, 'id' | 'at' | 'read'>

/** One step forward on the order timeline — used by the manual button AND the auto-advance heartbeat. */
function stepOrderForward(o: Order): { order: Order; notifs: NotifSpec[] } {
  const notifs: NotifSpec[] = []
  if (o.status === 'requested') {
    notifs.push({ emoji: '🤝', title: `Owner approved ${o.id}`, body: 'Your booking is confirmed.', link: '#/orders' })
    return { order: { ...o, status: 'confirmed', approveAt: undefined, autoAdvanceAt: Date.now() + 30000 }, notifs }
  }
  const idx = STATUS_FLOW.indexOf(o.status)
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return { order: o, notifs }
  const next = STATUS_FLOW[idx + 1]
  let patch: Partial<Order> = { status: next, autoAdvanceAt: next === 'completed' ? undefined : Date.now() + 35000 }
  if (next === 'in_transit' && !o.driver) {
    const d = DRIVER_POOL[Math.floor(Math.random() * DRIVER_POOL.length)]
    patch = { ...patch, driver: { ...d, pin: String(1000 + Math.floor(Math.random() * 9000)) } }
    notifs.push({ emoji: '🚐', title: `${o.id} is on the way`, body: `${d.name} is driving your gear over. Handover PIN inside.`, link: '#/orders' })
  }
  if (next === 'completed') {
    patch = { ...patch, depositReleased: true }
    notifs.push({ emoji: '🏁', title: `${o.id} complete — deposit hold released`, body: 'Rate your experience while it’s fresh!', link: '#/orders' })
  }
  return { order: { ...o, ...patch }, notifs }
}

const SUPPORT_RULES: [RegExp, string][] = [
  [/refund|cancel/i, 'Cancellations are free up to 48h before your start date; inside 48h a 10% fee applies. Refunds land in your Papa Wallet instantly — Orders → Cancel order. 💚'],
  [/deposit|hold/i, 'Deposits are authorization holds, never charges. They release automatically within 24h of a damage-free return — watch the status right on the order card.'],
  [/late|driver|delivery/i, 'Sorry about that! Your courier’s live card (with a call button and PIN) is on the order. If they’re 15+ minutes late, we auto-credit your delivery fee.'],
  [/damage|claim|broke|broken/i, 'If gear arrived damaged, file a claim from the order (🛡️ File claim). Papa Protection covers accidental damage up to full value — most claims resolve within a day.'],
  [/offer|price|negotiat/i, 'Tap “Offer your price” on any listing showing 💰 Offers OK. Offers ≥92% of the recommended fare are usually accepted instantly, and accepted deals stay locked for 24h.'],
  [/payout|earning|host|listing/i, 'Host payouts land in your wallet within 24h of a completed booking — you keep 90%. Track requests and earnings in Profile → Host dashboard.'],
]
const SUPPORT_FALLBACK = 'I’ve opened a ticket for a human specialist — they’ll follow up shortly. Meanwhile the Help Center FAQ might have your answer. 🎧'

function pickReply(ownerId: string, t: ChatThread): string {
  if (ownerId === 'support') {
    const lastMe = [...t.messages].reverse().find((m) => m.from === 'me')
    if (lastMe) {
      for (const [re, reply] of SUPPORT_RULES) if (re.test(lastMe.text)) return reply
    }
    return SUPPORT_FALLBACK
  }
  return OWNER_REPLIES[t.messages.length % OWNER_REPLIES.length]
}

const OWNER_REPLIES = [
  'Salaam! Yes, it’s available for those dates. 👍',
  'We can include an extra battery at no charge if you book today.',
  'Pickup any time after 8am works. Delivery also possible!',
  'It was serviced last week — everything is in perfect shape.',
  'For multi-day bookings I can be flexible on the rate, send an offer!',
  'Sure, my tech can give you a quick walkthrough at handover.',
]

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PROFILE':
      return { ...state, profile: { name: action.name, city: action.city, onboarded: true } }

    case 'ADD_TO_CART':
      return { ...state, cart: [...state.cart, action.booking] }
    case 'REMOVE_FROM_CART':
      return { ...state, cart: state.cart.filter((_, i) => i !== action.index) }
    case 'CLEAR_CART':
      return { ...state, cart: [] }

    case 'TOGGLE_WISHLIST': {
      const adding = !state.wishlist.includes(action.itemId)
      const item = getItem(action.itemId)
      let notifications = state.notifications
      if (adding && dealActive(action.itemId)) {
        notifications = notify(state, {
          emoji: '💸', title: `Price drop on ${item.name}`,
          body: `${item.flashDeal!.percentOff}% off right now — the deal is ticking.`,
          link: `#/item/${item.id}`,
        })
      }
      return {
        ...state,
        notifications,
        wishlist: adding ? [...state.wishlist, action.itemId] : state.wishlist.filter((id) => id !== action.itemId),
      }
    }

    case 'PLACE_ORDER': {
      if (state.cart.length === 0) return state
      const t = cartTotals(state.cart, action.opts)
      if (t.promoError) return state
      const needsApproval = state.cart.some((b) => !getItem(b.itemId).instantBook)
      const pointsEarned = Math.floor(t.total / 100)
      const order: Order = {
        id: `PR-${Date.now().toString().slice(-6)}`,
        createdAt: new Date().toISOString(),
        lines: state.cart,
        status: needsApproval ? 'requested' : 'confirmed',
        approveAt: needsApproval ? Date.now() + 12000 : undefined,
        autoAdvanceAt: needsApproval ? undefined : Date.now() + 25000,
        subtotal: t.subtotal,
        transportFee: t.transportFee,
        insuranceFee: t.insuranceFee,
        operatorFee: t.operatorFee,
        serviceFee: t.serviceFee,
        promoDiscount: t.promoDiscount,
        tierDiscount: t.tierDiscount,
        vanPerk: t.vanPerk,
        promoCode: t.promoDiscount > 0 ? action.opts.promoCode : undefined,
        walletUsed: t.walletUsed,
        pointsUsed: t.pointsUsed,
        depositHold: t.depositHold,
        total: t.total,
        pointsEarned,
        paymentMethod: action.opts.paymentMethod,
        address: action.opts.address,
      }
      return {
        ...state,
        cart: [],
        orders: [order, ...state.orders],
        walletBalance: state.walletBalance - t.walletUsed,
        points: state.points - t.pointsUsed + pointsEarned,
        promoCodesUsed: order.promoCode && PROMO_CODES[order.promoCode]?.singleUse
          ? [...state.promoCodesUsed, order.promoCode]
          : state.promoCodesUsed,
        freeVanPerkMonth: t.usedVanPerk ? todayISO().slice(0, 7) : state.freeVanPerkMonth,
        notifications: notify(state, needsApproval
          ? { emoji: '⏳', title: `Booking ${order.id} requested`, body: 'Waiting for owner approval — usually a few minutes.', link: '#/orders' }
          : { emoji: '✅', title: `Order ${order.id} confirmed`, body: 'Gear is being reserved for your dates.', link: '#/orders' }),
      }
    }

    case 'ADVANCE_ORDER': {
      let notifications = state.notifications
      const orders = state.orders.map((o) => {
        if (o.id !== action.orderId) return o
        const step = stepOrderForward(o)
        for (const n of step.notifs) notifications = notify({ ...state, notifications }, n)
        return step.order
      })
      return { ...state, orders, notifications }
    }

    case 'CANCEL_ORDER': {
      const o = state.orders.find((x) => x.id === action.orderId)
      if (!o || !['requested', 'confirmed', 'preparing'].includes(o.status)) return state
      const startsSoon = o.lines.some((l) => l.startDate <= todayISO(2))
      const fee = o.status === 'requested' || !startsSoon ? 0 : Math.round(o.total * 0.1)
      const refund = o.total - fee + o.walletUsed
      return {
        ...state,
        orders: state.orders.map((x) =>
          x.id === o.id
            ? { ...x, status: 'cancelled', cancelledAt: new Date().toISOString(), cancellationFee: fee, refundedToWallet: refund, depositReleased: true }
            : x
        ),
        walletBalance: state.walletBalance + refund,
        points: state.points + o.pointsUsed - o.pointsEarned,
        notifications: notify(state, {
          emoji: '↩️', title: `${o.id} cancelled`,
          body: fee > 0 ? `Refunded ${refund.toLocaleString()} to wallet (10% late-cancel fee applied).` : `Fully refunded to your wallet. Deposit hold released.`,
          link: '#/orders',
        }),
      }
    }

    case 'EXTEND_ORDER': {
      const o = state.orders.find((x) => x.id === action.orderId)
      if (!o || o.status !== 'in_use' || action.days < 1) return state
      const dayLines = o.lines.filter((l) => l.unit === 'day')
      if (dayLines.length === 0) return state
      const cost = dayLines.reduce((s, l) => s + l.rate * l.qty * action.days, 0)
      const fromWallet = Math.min(state.walletBalance, cost)
      const lines = o.lines.map((l) => {
        if (l.unit !== 'day') return l
        const d = new Date(l.endDate + 'T00:00:00')
        d.setDate(d.getDate() + action.days)
        const pad = (n: number) => String(n).padStart(2, '0')
        return { ...l, endDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
      })
      return {
        ...state,
        walletBalance: state.walletBalance - fromWallet,
        orders: state.orders.map((x) =>
          x.id === o.id ? { ...x, lines, total: x.total + cost, extendedDays: (x.extendedDays ?? 0) + action.days } : x
        ),
        notifications: notify(state, {
          emoji: '📅', title: `${o.id} extended by ${action.days} day${action.days > 1 ? 's' : ''}`,
          body: fromWallet >= cost ? `Rs ${cost.toLocaleString()} paid from wallet.` : `Rs ${cost.toLocaleString()} charged (Rs ${fromWallet.toLocaleString()} from wallet).`,
          link: '#/orders',
        }),
      }
    }

    case 'RATE_ORDER': {
      const o = state.orders.find((x) => x.id === action.orderId)
      if (!o) return state
      const avg = action.ratings.reduce((a, b) => a + b, 0) / Math.max(1, action.ratings.length)
      // blind two-way rating: the owner's rating of you publishes at the same moment yours does
      const ownerRating = 4 + (o.id.charCodeAt(o.id.length - 1) % 2)
      let myReviews = state.myReviews
      if (action.text?.trim()) {
        myReviews = { ...myReviews }
        o.lines.forEach((l, i) => {
          const review: Review = {
            id: uid(), author: state.profile.name || 'You', rating: action.ratings[i] ?? Math.round(avg),
            text: action.text!.trim(), date: todayISO(), role: 'renter',
          }
          myReviews[l.itemId] = [review, ...(myReviews[l.itemId] ?? [])]
        })
      }
      return {
        ...state,
        myReviews,
        orders: state.orders.map((x) =>
          x.id === o.id ? { ...x, lineRatings: action.ratings, myRatingOfOwner: avg, ownerRatingOfMe: ownerRating } : x
        ),
      }
    }

    case 'ADD_OFFER':
      return { ...state, offers: [action.offer, ...state.offers] }

    case 'ACCEPT_COUNTER':
      return {
        ...state,
        offers: state.offers.map((o) =>
          o.id === action.offerId && o.status === 'countered'
            ? { ...o, status: 'accepted', offeredRate: o.counterRate ?? o.offeredRate, expiresAt: Date.now() + OFFER_TTL_MS }
            : o
        ),
      }

    case 'ADD_CHAT': {
      const thread: ChatThread = state.chats[action.ownerId] ?? { messages: [], unread: 0 }
      const replyDelay = 1200 + Math.random() * 1500
      return {
        ...state,
        chats: {
          ...state.chats,
          [action.ownerId]: {
            ...thread,
            messages: [...thread.messages, action.message],
            typingUntil: Date.now() + replyDelay,
            pendingReplyAt: Date.now() + replyDelay,
          },
        },
      }
    }

    case 'READ_CHAT': {
      const thread = state.chats[action.ownerId]
      if (!thread || thread.unread === 0) return state
      return { ...state, chats: { ...state.chats, [action.ownerId]: { ...thread, unread: 0 } } }
    }

    case 'REPORT':
      return {
        ...state,
        reports: [...state.reports, action.report],
        blockedOwners: action.block && !state.blockedOwners.includes(action.block)
          ? [...state.blockedOwners, action.block]
          : state.blockedOwners,
        orders: action.orderId ? state.orders.map((o) => (o.id === action.orderId ? { ...o, reported: true } : o)) : state.orders,
        notifications: notify(state, {
          emoji: '🚩', title: `Report ${action.report.caseNo} filed`,
          body: 'Trust & Safety reviews reports within 24 hours.',
        }),
      }

    case 'ADD_WALLET':
      return { ...state, walletBalance: state.walletBalance + action.amount }

    case 'ADD_ADDRESS':
      return { ...state, addresses: [...state.addresses, action.address], selectedAddressId: action.address.id }
    case 'SELECT_ADDRESS':
      return { ...state, selectedAddressId: action.id }

    case 'ADD_RECENT_SEARCH': {
      const q = action.q.trim()
      if (!q) return state
      return { ...state, recentSearches: [q, ...state.recentSearches.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6) }
    }

    case 'VIEW_ITEM':
      if (state.recentlyViewed[0] === action.itemId) return state
      return { ...state, recentlyViewed: [action.itemId, ...state.recentlyViewed.filter((x) => x !== action.itemId)].slice(0, 8) }

    case 'READ_NOTIFICATIONS':
      if (!state.notifications.some((n) => !n.read)) return state
      return { ...state, notifications: state.notifications.map((n) => (n.read ? n : { ...n, read: true })) }

    case 'ADD_LISTING': {
      const myListings = [action.item, ...state.myListings]
      syncUserListings(myListings)
      return {
        ...state,
        myListings,
        notifications: notify(state, {
          emoji: '📤', title: `${action.item.name} submitted`,
          body: 'Our team verifies new spaces — usually live within minutes.',
          link: `#/item/${action.item.id}`,
        }),
      }
    }
    case 'TOGGLE_LISTING_PAUSE': {
      const myListings = state.myListings.map((l) => (l.id === action.itemId ? { ...l, paused: !l.paused } : l))
      syncUserListings(myListings)
      return { ...state, myListings }
    }
    case 'ACCEPT_OWNER_BOOKING': {
      const b = state.ownerBookings.find((x) => x.id === action.id)
      if (!b || b.status !== 'pending') return state
      return {
        ...state,
        ownerBookings: state.ownerBookings.map((x) =>
          x.id === b.id ? { ...x, status: 'accepted', completesAt: Date.now() + 50000 } : x
        ),
        notifications: notify(state, {
          emoji: '✅', title: `You accepted ${b.renterName}'s booking`,
          body: `Payout of Rs ${Math.round(b.total * 0.9).toLocaleString()} lands after the booking completes.`,
          link: '#/dashboard',
        }),
      }
    }
    case 'DECLINE_OWNER_BOOKING':
      return {
        ...state,
        ownerBookings: state.ownerBookings.map((x) => (x.id === action.id && x.status === 'pending' ? { ...x, status: 'declined' } : x)),
      }

    case 'FILE_CLAIM': {
      const now = Date.now()
      return {
        ...state,
        claims: [
          { id: uid(), orderId: action.orderId, itemName: action.itemName, reason: action.reason, amount: action.amount, status: 'filed', filedAt: now, reviewAt: now + 6000, approveAt: now + 18000 },
          ...state.claims,
        ],
        notifications: notify(state, {
          emoji: '🛡️', title: `Claim filed for ${action.itemName}`,
          body: 'Papa Protection is reviewing — most claims resolve within a day.',
          link: '#/support',
        }),
      }
    }

    case 'ADD_AVAIL_ALERT': {
      if (state.availAlerts.some((a) => a.itemId === action.itemId)) return state
      return { ...state, availAlerts: [...state.availAlerts, { id: uid(), itemId: action.itemId, notifyAt: Date.now() + 25000 }] }
    }

    case 'REDEEM_REFERRAL': {
      if (state.referralRedeemed || !/^PAPA-/i.test(action.code.trim())) return state
      return {
        ...state,
        referralRedeemed: true,
        walletBalance: state.walletBalance + 500,
        notifications: notify(state, { emoji: '🎁', title: 'Referral applied — Rs 500 added', body: 'Your friend gets Rs 500 too. Shukriya!' }),
      }
    }

    case 'DELETE_LISTING': {
      const myListings = state.myListings.filter((l) => l.id !== action.itemId)
      syncUserListings(myListings)
      return { ...state, myListings }
    }

    case 'TICK': {
      const now = action.now
      let changed = false
      let next = state

      // 1. resolve pending offers (the "owner" reviews your bid)
      const dueOffers = state.offers.filter((of) => of.status === 'pending' && of.resolveAt && of.resolveAt <= now)
      const expiredOffers = state.offers.filter((of) => of.status === 'accepted' && of.expiresAt <= now)
      if (dueOffers.length || expiredOffers.length) {
        changed = true
        let notifications = next.notifications
        const offers = next.offers.map((of) => {
          if (dueOffers.includes(of)) {
            const verdict = evaluateOffer(of.recommendedRate, of.offeredRate)
            const item = getItem(of.itemId)
            const resolved: Offer = { ...of, status: verdict.status, counterRate: verdict.counter, resolveAt: undefined }
            const msg = verdict.status === 'accepted'
              ? { emoji: '🎉', title: `Offer accepted on ${item.name}`, body: `Locked at Rs ${of.offeredRate.toLocaleString()}/${of.unit} for 24h.`, link: `#/item/${of.itemId}` }
              : verdict.status === 'countered'
                ? { emoji: '↩️', title: `Counter-offer on ${item.name}`, body: `Owner suggests Rs ${verdict.counter!.toLocaleString()}/${of.unit}.`, link: `#/item/${of.itemId}` }
                : { emoji: '❌', title: `Offer declined on ${item.name}`, body: 'Try something closer to the recommended fare.', link: `#/item/${of.itemId}` }
            notifications = notify({ ...next, notifications }, msg)
            return resolved
          }
          if (expiredOffers.includes(of)) return { ...of, status: 'expired' as const }
          return of
        })
        next = { ...next, offers, notifications }
      }

      // 2. owner chat replies land even if the sheet is closed
      const dueChats = Object.entries(next.chats).filter(([, t]) => t.pendingReplyAt && t.pendingReplyAt <= now)
      if (dueChats.length) {
        changed = true
        const chats = { ...next.chats }
        let notifications = next.notifications
        for (const [ownerId, t] of dueChats) {
          const reply: ChatMessage = {
            id: uid(), from: 'owner',
            text: pickReply(ownerId, t),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            at: now,
          }
          chats[ownerId] = { messages: [...t.messages, reply], unread: t.unread + 1, typingUntil: undefined, pendingReplyAt: undefined }
          notifications = notify({ ...next, notifications }, {
            emoji: '💬', title: `${getOwner(ownerId).name} replied`, body: reply.text, link: '#/profile',
          })
        }
        next = { ...next, chats, notifications }
      }

      // 3. request-to-book approvals
      const dueOrders = next.orders.filter((o) => o.status === 'requested' && o.approveAt && o.approveAt <= now)
      if (dueOrders.length) {
        changed = true
        let notifications = next.notifications
        const orders = next.orders.map((o) => {
          if (!dueOrders.includes(o)) return o
          notifications = notify({ ...next, notifications }, { emoji: '🤝', title: `Owner approved ${o.id}`, body: 'Your booking is confirmed. 🎬', link: '#/orders' })
          return { ...o, status: 'confirmed' as OrderStatus, approveAt: undefined, autoAdvanceAt: now + 25000 }
        })
        next = { ...next, orders, notifications }
      }

      // 4. user listing lifecycle: verification, then a first renter inquiry
      const dueListings = next.myListings.filter(
        (l) => (l.pendingVerifyAt && l.pendingVerifyAt <= now) || (l.inquiryAt && l.inquiryAt <= now)
      )
      if (dueListings.length) {
        changed = true
        let notifications = next.notifications
        const myListings = next.myListings.map((l) => {
          if (!dueListings.includes(l)) return l
          let out = l
          if (l.pendingVerifyAt && l.pendingVerifyAt <= now) {
            out = { ...out, pendingVerifyAt: undefined, listingVerified: true, nextRequestAt: now + 30000 }
            notifications = notify({ ...next, notifications }, {
              emoji: '✅', title: `${l.name} is live!`,
              body: 'Verified and visible to every filmmaker on Papa Rentals.',
              link: `#/item/${l.id}`,
            })
          }
          if (l.inquiryAt && l.inquiryAt <= now) {
            out = { ...out, inquiryAt: undefined }
            notifications = notify({ ...next, notifications }, {
              emoji: '👀', title: `First inquiry on ${l.name}`,
              body: '“Salaam! Is it available this Friday for a 6h commercial shoot?” — Rabia N.',
              link: `#/item/${l.id}`,
            })
          }
          return out
        })
        next = { ...next, myListings, notifications }
      }

      // 5. host side: booking requests arrive on live listings
      const requestDue = next.myListings.filter((l) => l.listingVerified && !l.paused && l.nextRequestAt && l.nextRequestAt <= now)
      if (requestDue.length) {
        changed = true
        let notifications = next.notifications
        let ownerBookings = next.ownerBookings
        const myListings = next.myListings.map((l) => {
          if (!requestDue.includes(l)) return l
          const open = ownerBookings.filter((b) => b.listingId === l.id && b.status === 'pending').length
          if (open >= 2) return { ...l, nextRequestAt: now + 180000 }
          const seed = ownerBookings.length + l.name.length
          const renter = RENTER_POOL[seed % RENTER_POOL.length]
          const unit = l.hourly && seed % 2 === 0 ? ('hour' as const) : ('day' as const)
          const dur = unit === 'hour' ? (l.space?.minHours ?? 4) : 1 + (seed % 3)
          const baseRate = unit === 'hour' ? Math.round(l.pricePerDay / 6) : l.pricePerDay
          const offered = l.offersAccepted && seed % 2 === 1
          const rate = offered ? Math.round((baseRate * 0.9) / 50) * 50 : baseRate
          const startOff = 2 + (seed % 5)
          const start = todayISO(startOff)
          const booking: OwnerBooking = {
            id: uid(), listingId: l.id, renterName: renter.name, renterRating: renter.rating,
            startDate: start, endDate: unit === 'hour' ? start : todayISO(startOff + dur - 1),
            unit, hours: unit === 'hour' ? dur : 0, rate, total: rate * dur,
            status: 'pending', requestedAt: now,
          }
          ownerBookings = [booking, ...ownerBookings]
          notifications = notify({ ...next, notifications }, {
            emoji: '📩', title: `Booking request: ${l.name}`,
            body: `${renter.name} (★${renter.rating}) wants ${dur} ${unit}${dur > 1 ? 's' : ''}${offered ? ` at an offered Rs ${rate.toLocaleString()}/${unit}` : ''}. Respond in your Host dashboard.`,
            link: '#/dashboard',
          })
          return { ...l, nextRequestAt: now + 150000 }
        })
        next = { ...next, myListings, ownerBookings, notifications }
      }

      // 6. accepted host bookings complete, then pay out 90% to the wallet
      const hostDue = next.ownerBookings.filter(
        (b) => (b.status === 'accepted' && b.completesAt && b.completesAt <= now) || (b.status === 'completed' && b.payoutAt && b.payoutAt <= now)
      )
      if (hostDue.length) {
        changed = true
        let notifications = next.notifications
        let walletBalance = next.walletBalance
        let myListings = next.myListings
        const ownerBookings = next.ownerBookings.map((b) => {
          if (!hostDue.includes(b)) return b
          if (b.status === 'accepted') {
            notifications = notify({ ...next, notifications }, {
              emoji: '🎬', title: `${b.renterName}'s booking completed`,
              body: 'Great hosting! Your payout is on the way.', link: '#/dashboard',
            })
            myListings = myListings.map((l) => (l.id === b.listingId ? { ...l, timesRented: l.timesRented + 1 } : l))
            return { ...b, status: 'completed' as const, payoutAt: now + 20000 }
          }
          const payout = Math.round(b.total * 0.9)
          walletBalance += payout
          notifications = notify({ ...next, notifications }, {
            emoji: '💰', title: `Payout received: Rs ${payout.toLocaleString()}`,
            body: `${b.renterName}'s booking — 90% of Rs ${b.total.toLocaleString()}, straight to your wallet.`, link: '#/dashboard',
          })
          return { ...b, status: 'paid_out' as const, payoutAt: undefined }
        })
        next = { ...next, ownerBookings, walletBalance, myListings, notifications }
      }

      // 7. damage claims: filed → reviewing → approved (credited to wallet)
      const claimsDue = next.claims.filter(
        (c) => (c.status === 'filed' && c.reviewAt <= now) || (c.status === 'reviewing' && c.approveAt <= now)
      )
      if (claimsDue.length) {
        changed = true
        let notifications = next.notifications
        let walletBalance = next.walletBalance
        const claims = next.claims.map((c) => {
          if (!claimsDue.includes(c)) return c
          if (c.status === 'filed') return { ...c, status: 'reviewing' as const }
          walletBalance += c.amount
          notifications = notify({ ...next, notifications }, {
            emoji: '✅', title: `Claim approved: Rs ${c.amount.toLocaleString()}`,
            body: `${c.itemName} — credited to your wallet. Sorry that happened!`, link: '#/support',
          })
          return { ...c, status: 'approved' as const }
        })
        next = { ...next, claims, walletBalance, notifications }
      }

      // 8. availability alerts
      const alertsDue = next.availAlerts.filter((a) => a.notifyAt <= now)
      if (alertsDue.length) {
        changed = true
        let notifications = next.notifications
        for (const a of alertsDue) {
          const item = getItem(a.itemId)
          notifications = notify({ ...next, notifications }, {
            emoji: '🎉', title: `${item.name} is now available`,
            body: 'The conflicting booking freed up — grab your dates before someone else does.',
            link: `#/item/${a.itemId}`,
          })
        }
        next = { ...next, availAlerts: next.availAlerts.filter((a) => !alertsDue.includes(a)), notifications }
      }

      // 9. shoot-day reminders the day before your start date
      const remindDue = next.orders.filter(
        (o) => !o.reminded && ['confirmed', 'preparing'].includes(o.status) && o.lines.some((l) => l.startDate <= todayISO(1))
      )
      if (remindDue.length) {
        changed = true
        let notifications = next.notifications
        const orders = next.orders.map((o) => {
          if (!remindDue.includes(o)) return o
          notifications = notify({ ...next, notifications }, {
            emoji: '🎬', title: `Shoot day soon — ${o.id}`,
            body: 'Gear arrives at your slot time. Charge your batteries and sleep well!', link: '#/orders',
          })
          return { ...o, reminded: true }
        })
        next = { ...next, orders, notifications }
      }

      // 10. orders drive themselves forward, foodpanda-style
      const autoDue = next.orders.filter(
        (o) => o.autoAdvanceAt && o.autoAdvanceAt <= now && !['completed', 'cancelled', 'requested'].includes(o.status)
      )
      if (autoDue.length) {
        changed = true
        let notifications = next.notifications
        const orders = next.orders.map((o) => {
          if (!autoDue.includes(o)) return o
          const step = stepOrderForward(o)
          for (const n of step.notifs) notifications = notify({ ...next, notifications }, n)
          return step.order
        })
        next = { ...next, orders, notifications }
      }

      return changed ? next : state
    }

    default:
      return state
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      const merged = { ...initialState, ...saved, profile: { ...initialState.profile, ...saved.profile } }
      syncUserListings(merged.myListings)
      return merged
    }
  } catch { /* corrupted state — start fresh */ }
  return initialState
}

const StoreContext = createContext<{ state: AppState; dispatch: (a: Action) => void }>({
  state: initialState,
  dispatch: () => {},
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* storage unavailable */ }
  }, [state])

  useEffect(() => {
    syncUserListings(state.myListings)
  }, [state.myListings])

  // the heartbeat: resolves offers, chat replies and approvals on time, even across reloads
  useEffect(() => {
    const t = setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), 1000)
    return () => clearInterval(t)
  }, [])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  return useContext(StoreContext)
}
