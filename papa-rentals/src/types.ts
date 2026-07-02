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
  emoji: string
  gradient: string
}

export interface Owner {
  id: string
  name: string
  avatar: string
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
  emoji: string
  pricePerDay: number
  deposit: number
  rating: number
  ratingCount: number
  ownerId: string
  specs: string[]
  description: string
  tags: string[]
  timesRented: number
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
}

export interface Kit {
  id: string
  name: string
  emoji: string
  itemIds: string[]
  percentOff: number
  blurb: string
}

export type TransportId = 'pickup' | 'van' | 'truck'

export interface TransportOption {
  id: TransportId
  name: string
  emoji: string
  fee: number
  eta: string
  detail: string
}

export type RentalUnit = 'day' | 'hour'

export interface Booking {
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
  emoji: string
  title: string
  body?: string
  at: number
  read: boolean
  link?: string // hash route to open
}

export interface Address {
  id: string
  label: string
  detail: string
}

export interface Profile {
  name: string
  city: string
  onboarded: boolean
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
  myReviews: Record<string, Review[]>
  reports: UserReport[]
  addresses: Address[]
  selectedAddressId: string
  recentSearches: string[]
  recentlyViewed: string[]
  blockedOwners: string[]
  promoCodesUsed: string[]
  myListings: Item[]
  freeVanPerkMonth?: string // YYYY-MM when the Silver free-delivery perk was last used
}
