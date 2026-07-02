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
  flashDeal?: { percentOff: number; endsInHours: number }
  reviews: Review[]
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

export interface Booking {
  itemId: string
  startDate: string
  endDate: string
  pickupTime: string
  qty: number
  insurance: boolean
  operator: boolean
  transport: TransportId
  agreedPricePerDay: number // recommended, or the negotiated price
  negotiated: boolean
}

export type OrderStatus =
  | 'confirmed'
  | 'preparing'
  | 'in_transit'
  | 'in_use'
  | 'returned'
  | 'completed'

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
  discount: number
  promoCode?: string
  walletUsed: number
  deposit: number
  total: number
  pointsEarned: number
  myRatingOfOwner?: number
  ownerRatingOfMe?: number
  reported?: boolean
}

export type OfferStatus = 'pending' | 'accepted' | 'countered' | 'declined'

export interface Offer {
  id: string
  itemId: string
  days: number
  recommendedPerDay: number
  offeredPerDay: number
  counterPerDay?: number
  status: OfferStatus
  createdAt: string
}

export interface ChatMessage {
  id: string
  from: 'me' | 'owner'
  text: string
  time: string
}

export interface UserReport {
  id: string
  targetName: string
  reason: string
  note: string
  date: string
}

export interface AppState {
  cart: Booking[]
  wishlist: string[]
  orders: Order[]
  offers: Offer[]
  chats: Record<string, ChatMessage[]> // keyed by ownerId
  walletBalance: number
  points: number
  myReviews: Record<string, Review> // itemId -> my review
  reports: UserReport[]
}
