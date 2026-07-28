import type { IconName } from './components/icons'

export type CategoryId =
  | 'cameras'
  | 'lenses'
  | 'lighting'
  | 'audio'
  | 'grip'
  | 'drones'
  | 'transport'
  | 'studios'
  | 'props'
  | 'crew'

export interface Category {
  id: CategoryId
  name: string
  icon: IconName
  gradient: string
}

export interface Owner {
  id: string
  name: string
  rating: number
  ratingCount: number
  verified: boolean
  superOwner: boolean
  responseMins: number
  area: string
  distanceKm: number
  memberSince: string
}

export interface Review {
  id: string
  author: string
  rating: number
  text: string
  date: string
  role: 'renter' | 'owner'
  ownerReply?: string
}

export interface DateRange {
  start: string
  end: string
}

export interface SpaceInfo {
  type: string
  sqft: number
  capacity: number
  amenities: string[]
  rules: string[]
  minHours?: number
}

export interface Item {
  id: string
  name: string
  category: CategoryId
  icon: IconName
  pricePerDay: number
  deposit: number
  rating: number
  ratingCount: number
  ownerId: string
  specs: string[]
  description: string
  tags: string[]
  image?: string // hero/card photo URL; gradient+icon art is the fallback
  images?: string[] // detail-page gallery (first entry === image)
  timesRented: number
  /** When the listing went live (epoch ms). Drives "New this week" and lets
      Trending rank recent momentum instead of all-time totals. */
  listedAt?: number
  instantBook: boolean
  offersAccepted: boolean
  insuranceRequired?: boolean
  hourly?: boolean // studios etc. can also be booked by the hour
  space?: SpaceInfo // present on studios & shoot locations
  flashDeal?: { percentOff: number; endsInHours: number }
  bookedRanges?: DateRange[] // dates already rented out by others
  reviews: Review[]
  // user-posted listing lifecycle
  mine?: boolean
  paused?: boolean
  pendingVerifyAt?: number
  inquiryAt?: number
  listingVerified?: boolean
  nextRequestAt?: number // when the next simulated booking request may arrive
}

export interface Kit {
  id: string
  name: string
  icon: IconName
  itemIds: string[]
  percentOff: number
  blurb: string
}

export type TransportId = 'pickup' | 'van' | 'truck'

export interface TransportOption {
  id: TransportId
  name: string
  icon: IconName
  fee: number
  eta: string
  detail: string
}

export type RentalUnit = 'day' | 'hour'

export interface Booking {
  id: string // stable per cart line, so edits/removals don't depend on array position
  itemId: string
  startDate: string
  endDate: string
  pickupTime: string
  qty: number
  unit: RentalUnit
  hours: number // used when unit === 'hour'
  insurance: boolean
  operator: boolean
  transport: TransportId
  rate: number // agreed price per unit (day or hour) — recommended or negotiated
  negotiated: boolean
}

export type OrderStatus =
  | 'requested'
  | 'confirmed'
  | 'preparing'
  | 'in_transit'
  | 'in_use'
  | 'returned'
  | 'completed'
  | 'cancelled'

export interface Driver {
  name: string
  phone: string
  vehicle: string
  pin: string // handover PIN, foodpanda-style
}

export interface Order {
  id: string
  createdAt: string
  lines: Booking[]
  status: OrderStatus
  subtotal: number
  transportFee: number
  insuranceFee: number
  operatorFee: number
  serviceFee: number
  promoDiscount: number
  tierDiscount: number
  vanPerk: number
  promoCode?: string
  walletUsed: number
  pointsUsed: number
  depositHold: number
  depositReleased?: boolean
  total: number // amount actually charged (deposit is a hold, not a charge)
  pointsEarned: number
  paymentMethod: string
  address: string
  approveAt?: number // for request-to-book orders
  driver?: Driver
  lineRatings?: number[]
  myRatingOfOwner?: number
  ownerRatingOfMe?: number
  reported?: boolean
  cancelledAt?: string
  cancellationFee?: number
  refundedToWallet?: number
  extendedDays?: number
  autoAdvanceAt?: number // orders progress on their own, foodpanda-style
  reminded?: boolean // shoot-day reminder sent
}

export type OfferStatus = 'pending' | 'accepted' | 'countered' | 'declined' | 'expired'

export interface Offer {
  id: string
  itemId: string
  unit: RentalUnit
  recommendedRate: number
  offeredRate: number
  counterRate?: number
  status: OfferStatus
  createdAt: number
  resolveAt?: number // owner "reviews" the offer at this time
  expiresAt: number // accepted deals expire like inDrive fares
}

export interface ChatMessage {
  id: string
  from: 'me' | 'owner'
  text: string
  time: string
  at: number
}

export interface ChatThread {
  messages: ChatMessage[]
  unread: number
  typingUntil?: number
  pendingReplyAt?: number
}

export interface UserReport {
  id: string
  caseNo: string
  targetName: string
  reason: string
  note: string
  date: string
  status: 'under_review' | 'resolved'
}

export interface AppNotification {
  id: string
  icon: IconName
  title: string
  body?: string
  at: number
  read: boolean
  link?: string // hash route to open
}

export type OwnerBookingStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'paid_out'

export interface OwnerBooking {
  id: string
  listingId: string
  renterName: string
  renterRating: number
  startDate: string
  endDate: string
  unit: RentalUnit
  hours: number
  rate: number // what the renter offered/agreed per unit
  total: number
  status: OwnerBookingStatus
  requestedAt: number
  completesAt?: number
  payoutAt?: number
}

export type ClaimStatus = 'filed' | 'reviewing' | 'approved'

export interface Claim {
  id: string
  orderId: string
  itemName: string
  reason: string
  amount: number
  status: ClaimStatus
  filedAt: number
  reviewAt: number
  approveAt: number
}

export interface AvailAlert {
  id: string
  itemId: string
  notifyAt: number
}

/** "Tell me if this gets cheaper." Holds the price at the moment it was set so
    the notification can say what it dropped from, not just that it dropped. */
export interface PriceAlert {
  id: string
  itemId: string
  price: number
}

/** A search worth coming back to. Renters hunt the same gear every shoot cycle,
    and retyping "arri 300 daylight" every week is the friction that loses them. */
/* A booking someone started shaping on an item page but never put in the cart.
   Only the dates are kept: everything else on that page (qty, transport,
   insurance) has a sensible default, but the dates are the one thing the person
   actually thought about, and losing them means retyping the shoot window. */
export interface BookingDraft {
  itemId: string
  startDate: string
  endDate: string
  savedAt: number
}

export interface SavedSearch {
  id: string
  q: string
  category?: CategoryId
  /** Price ceiling to watch. Set means "tell me when something fits under this". */
  maxPrice?: number
  createdAt: number
}

export interface Address {
  id: string
  label: string
  icon?: IconName
  detail: string
  /** Optional drop pin. Street addresses in Lahore routinely resolve to the
      wrong block, so a confirmed lat/lng is what the driver actually navigates
      to — but it stays optional, since a landmark note is often enough. */
  geo?: { lat: number; lng: number }
}

/* Only ever the last four digits. The deposit hold and the COD flow both talk
   about "your card", so one has to exist — but a demo has no business holding a
   full PAN, and the last four is all the UI ever needs to show. */
export interface SavedCard {
  id: string
  brand: string
  last4: string
  expiry: string
}

export interface Profile {
  name: string
  city: string
  onboarded: boolean
}

/** A single movement of wallet credit or loyalty points. */
export interface LedgerEntry {
  id: string
  at: number
  kind: 'wallet' | 'points'
  /** Positive credits the balance, negative debits it. */
  amount: number
  label: string
  /** Wallet credit from promos/referrals can't be withdrawn; refunds can. */
  cash?: boolean
  orderId?: string
}

export interface AppState {
  profile: Profile
  cart: Booking[]
  wishlist: string[]
  orders: Order[]
  offers: Offer[]
  chats: Record<string, ChatThread>
  notifications: AppNotification[]
  walletBalance: number
  points: number
  /** Every wallet and points movement, newest first. A balance with no history
      is impossible to trust or to dispute. */
  ledger: LedgerEntry[]
  myReviews: Record<string, Review[]>
  reports: UserReport[]
  addresses: Address[]
  selectedAddressId: string
  cards: SavedCard[]
  selectedCardId: string
  recentSearches: string[]
  savedSearches: SavedSearch[]
  recentlyViewed: string[]
  bookingDrafts: BookingDraft[]
  blockedOwners: string[]
  promoCodesUsed: string[]
  myListings: Item[]
  ownerBookings: OwnerBooking[]
  claims: Claim[]
  availAlerts: AvailAlert[]
  priceAlerts: PriceAlert[]
  referralRedeemed: boolean
  freeVanPerkMonth?: string // YYYY-MM when the Silver free-delivery perk was last used
}
