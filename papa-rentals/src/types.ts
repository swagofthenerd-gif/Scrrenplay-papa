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
  image?: string // hero/card photo URL; the drawn art is the fallback
  images?: string[] // detail-page gallery (first entry === image)
  timesRented: number
  /** When the listing went live (epoch ms). Drives "New this week" and lets
      Trending rank recent momentum instead of all-time totals. */
  listedAt?: number
  instantBook: boolean
  offersAccepted: boolean
  insuranceRequired?: boolean
  /** How many identical copies this vendor actually holds. Absent means one —
      a studio is a single room, and assuming otherwise would let someone book
      a space twice over. */
  units?: number
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
  /* The kit page has to answer "is this the one for me", and a list of item
     names does not answer it — two kits can share a camera and suit completely
     different shoots. These are the questions people actually ask before
     booking a bundle they cannot inspect first. */
  bestFor?: string
  /** Named plainly, because the expensive surprise is what a kit quietly leaves out. */
  notIncluded?: string[]
  /** Whether the price assumes someone who knows how to rig it. */
  crewNote?: string
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
  /** When the order entered its current status. "Preparing since 2:14pm" is the
      difference between a progress bar and knowing somebody is on it. */
  statusAt?: number
  driver?: Driver
  /** Every status this order has entered, with when. statusAt only remembers the
      current one, so "how long did approval actually take" was unanswerable the
      moment the order moved on. Append-only. */
  statusLog?: { status: OrderStatus; at: number }[]
  lineRatings?: number[]
  /** The note left against each line, parallel to lineRatings. Kept on the order
      because "Edit your rating" reopened the form with the stars restored and the
      words gone, so editing a typo meant retyping the review. */
  lineReviews?: string[]
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
  /* "Reported" and "in dispute" are not the same thing and were the same value.
     A report is one side telling us something happened; mediation is both sides
     having been asked and the case being actively arbitrated. People chase the
     second and wait out the first, so collapsing them made every open case feel
     like it had been filed into a void. */
  status: 'under_review' | 'mediation' | 'resolved'
  /** When the case next changes hands. Drives the same heartbeat everything
      else in this app runs on. */
  nextAt?: number
  /** Set once mediation opens, so the order can say what is being arbitrated. */
  orderId?: string
  /** What you have added to the case since filing. A case you can only watch is
      a case you cannot influence, and mediation explicitly asks for your side. */
  evidence?: { id: string; text: string; at: number }[]
}

/** A friend who used your code. The app cannot know this for real without a
    backend, so it is simulated on the same heartbeat that already approves
    bookings and files claims — but the money is real state: each conversion
    writes a ledger row like any other credit, so "Rs 1,500 earned" is a sum of
    movements you can go and check rather than a number the screen made up. */
export interface ReferralFriend {
  id: string
  name: string
  joinedAt: number
  /** joined = code used, rented = first rental completed and the bonus paid. */
  status: 'joined' | 'rented'
  earned: number
  /** When this friend converts. Absent once they have. */
  convertsAt?: number
}

export interface AppNotification {
  id: string
  icon: IconName
  title: string
  body?: string
  at: number
  read: boolean
  link?: string // hash route to open
  /** Which Settings toggle governs this. Absent means "always deliver" — used
      for the handful that are not really optional, like a tier being reached. */
  channel?: NotifyChannel
}

export type NotifyChannel = 'orders' | 'offers' | 'chat' | 'deals'

/** Mirrors the Notifications toggles in Settings. Held in app state rather than
    only in the settings screen's own storage, because the reducer is what has to
    honour them — while they lived solely in Settings the switches changed a
    stored boolean and nothing else, and every notification arrived regardless. */
export type NotifyPrefs = Record<NotifyChannel, boolean>

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

/** A search that came back empty — one line of evidence that supply is missing. */
export interface UnmetSearch {
  q: string
  category?: CategoryId
  /** How many times it has been asked for, which is what separates noise from a gap. */
  count: number
  lastAt: number
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
  /** Optional contact details. Orders imply a vendor can reach the renter, so
      the profile should be able to hold a phone/email rather than pretending
      contact happens by magic. Optional because onboarding doesn't collect them. */
  phone?: string
  email?: string
  onboarded: boolean
  /** Whether the renter has completed ID verification. There is no real KYC in
      a client-only app, so this is a simulated one-tap step — but the badge that
      reads it must tell the truth rather than claim everyone is verified. */
  idVerified: boolean
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
  /* Searches that returned nothing. Kept separately from recentSearches because
     they mean the opposite thing: a recent search is a route back to something
     that exists, an unmet one is gear this marketplace does not have. It is the
     only demand signal in the app that isn't already a booking. */
  unmetSearches: UnmetSearch[]
  savedSearches: SavedSearch[]
  recentlyViewed: string[]
  bookingDrafts: BookingDraft[]
  /* Undefined means "follow the phone". Only set once the person has actually
     picked a side, so someone who never touches the toggle keeps tracking their
     system setting instead of being frozen into whatever it was on first launch. */
  theme?: 'light' | 'dark'
  blockedOwners: string[]
  promoCodesUsed: string[]
  myListings: Item[]
  ownerBookings: OwnerBooking[]
  claims: Claim[]
  availAlerts: AvailAlert[]
  priceAlerts: PriceAlert[]
  /** Set when points cross into a new tier, cleared once the celebration has
      been shown. Without it the banner reappears on every visit. */
  tierReached?: string
  notifyPrefs: NotifyPrefs
  referralRedeemed: boolean
  referrals: ReferralFriend[]
  /** Set the first time the code is shared; nobody joins before you tell them. */
  referralSharedAt?: number
  /** A redeemed referral whose Rs 500 hasn't been paid yet. Real referral
      programs release the bonus on a qualifying action, not on code entry, so
      an invented code can't be turned straight into wallet cash — the credit
      lands when the user's first rental completes. */
  referralPending: boolean
  freeVanPerkMonth?: string // YYYY-MM when the Silver free-delivery perk was last used
}
