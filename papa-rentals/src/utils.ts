import { CATEGORIES, CURRENCY, PROMO_CODES, TRANSPORT_OPTIONS, getItem, getOwner } from './data/catalog'
import type { Booking, DateRange, Item, OfferStatus, Order, SavedSearch } from './types'

export function money(n: number): string {
  return `${CURRENCY} ${Math.round(n).toLocaleString('en-PK')}`
}

/* A saved search is a query + optional department + price cap; render it as one
   readable line so the chip says what it will actually re-run. */
export function savedLabel(s: SavedSearch): string {
  const base = s.q || CATEGORIES.find((c) => c.id === s.category)?.name || 'All gear'
  return s.maxPrice ? `${base} · under ${money(s.maxPrice)}` : base
}

/* ---------------- dates (local-time correct, not UTC) ---------------- */

export function toISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return toISO(d)
}

export function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000)
  return Math.max(1, diff + 1) // inclusive of both days, minimum 1 day
}

/* Move a booking to a new start date without changing how long it runs.
   Deliberately not daysBetween — that returns billing days (inclusive, floored
   at 1), so using it here would stretch every line by a day each time. */
export function shiftBooking(b: Booking, start: string): Booking {
  const span = Math.max(0, Math.round((new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) / 86400000))
  const end = new Date(start + 'T00:00:00')
  end.setDate(end.getDate() + span)
  return { ...b, startDate: start, endDate: b.unit === 'hour' ? start : toISO(end) }
}

export function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function fmtTimeAgo(at: number): string {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function fmtCountdown(msLeft: number): string {
  if (msLeft <= 0) return 'ended'
  const h = Math.floor(msLeft / 3600000)
  const m = Math.floor((msLeft % 3600000) / 60000)
  const s = Math.floor((msLeft % 60000) / 1000)
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s).padStart(2, '0')}`
}

/* ---------------- flash deals: real, persistent countdowns ---------------- */

const DEALS_KEY = 'papa-deal-ends-v1'

function initDealEnds(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DEALS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fresh start */ }
  const map: Record<string, number> = {}
  try {
    localStorage.setItem(DEALS_KEY, JSON.stringify(map))
  } catch { /* private mode */ }
  return map
}

const dealEnds: Record<string, number> = initDealEnds()

/** When a flash deal ends (epoch ms). Fixed on first sight so the countdown is real. */
export function dealEndsAt(itemId: string): number {
  const item = getItem(itemId)
  if (!item.flashDeal) return 0
  if (!dealEnds[itemId]) {
    dealEnds[itemId] = Date.now() + item.flashDeal.endsInHours * 3600000
    try { localStorage.setItem(DEALS_KEY, JSON.stringify(dealEnds)) } catch { /* ignore */ }
  }
  return dealEnds[itemId]
}

export function dealActive(itemId: string): boolean {
  const item = getItem(itemId)
  return Boolean(item.flashDeal) && dealEndsAt(itemId) > Date.now()
}

/* ---------------- pricing ---------------- */

export const INSURANCE_RATE = 0.08
export const OPERATOR_FEE_PER_DAY = 6000
export const SERVICE_FEE_RATE = 0.05

/* A kit you assemble yourself earns the same kind of discount the curated kits
   carry, on the same logic: one booking, one delivery, one pickup. The top rung
   stops at 18% so a hand-built kit can match the best curated one but never
   undercut it — otherwise the curated kits become the worse deal by definition. */
export function bundleDiscount(count: number): number {
  if (count >= 5) return 18
  if (count === 4) return 15
  if (count === 3) return 10
  if (count === 2) return 5
  return 0
}
export const POINTS_PER_100 = 1 // earn 1 PapaPoint per Rs 100; redeem 1 point = Rs 1
export const GOLD_POINTS = 2000
export const SILVER_POINTS = 500

/** The tier a points balance buys. Three places worked this out inline with the
    same two comparisons; crossing a threshold is only detectable if before and
    after are computed the same way. */
export function tierOf(points: number): 'Bronze Papa' | 'Silver Papa' | 'Gold Papa' {
  return points >= GOLD_POINTS ? 'Gold Papa' : points >= SILVER_POINTS ? 'Silver Papa' : 'Bronze Papa'
}
export const GOLD_DISCOUNT_RATE = 0.05
export const HOURS_DIVISOR = 6 // hourly rate = day rate / 6, minimum 3 hours

export function hourlyRate(itemId: string): number {
  return Math.round(getItem(itemId).pricePerDay / HOURS_DIVISOR)
}

/** Recommended rate per unit, with flash deal + multi-day discounts applied. */
export function recommendedRate(itemId: string, days: number, unit: 'day' | 'hour' = 'day'): number {
  const item = getItem(itemId)
  let rate = unit === 'hour' ? hourlyRate(itemId) : item.pricePerDay
  if (dealActive(itemId)) rate *= 1 - item.flashDeal!.percentOff / 100
  if (unit === 'day') {
    if (days >= 7) rate *= 0.8
    else if (days >= 3) rate *= 0.9
  }
  return Math.round(rate)
}

/** inDrive-style offer engine: accepts strong offers, counters fair ones, declines lowballs. */
export function evaluateOffer(recommended: number, offered: number): { status: OfferStatus; counter?: number } {
  const ratio = offered / recommended
  if (ratio >= 0.92) return { status: 'accepted' }
  if (ratio >= 0.72) return { status: 'countered', counter: Math.round((offered + recommended) / 2 / 50) * 50 }
  return { status: 'declined' }
}

export const OFFER_TTL_MS = 24 * 3600000 // accepted deals stay valid for 24h, like a fare quote

/* ---------------- availability ---------------- */

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end
}

/** All ranges when this item is unavailable: seeded bookings + the user's own active orders + cart. */
export function unavailableRanges(itemId: string, orders: Order[], cart: Booking[]): DateRange[] {
  const item = getItem(itemId)
  const out: DateRange[] = [...(item.bookedRanges ?? [])]
  for (const o of orders) {
    if (o.status === 'cancelled' || o.status === 'completed') continue
    for (const l of o.lines) {
      if (l.itemId === itemId) out.push({ start: l.startDate, end: l.endDate })
    }
  }
  for (const l of cart) {
    if (l.itemId === itemId) out.push({ start: l.startDate, end: l.endDate })
  }
  return out
}

/* Honest scarcity. The tempting line on a card is "rented 3× this week", but the
   only demand number in the model is a lifetime total, and inventing a weekly
   figure from it would be a claim the data cannot support. What IS true and
   checkable is how much of the next fortnight is already spoken for — the same
   ranges the date picker refuses to book. Returns null when nothing about the
   item is urgent, because a badge on every card is a badge on none. */
const SCARCE_WINDOW_DAYS = 14
/* Two, measured rather than guessed: across the catalogue seventeen of twenty-four
   items have nothing booked in the fortnight and only five have two days or more,
   so this marks the busy fifth instead of decorating everything. */
const SCARCE_MIN_BOOKED = 2

export function scarcityNote(itemId: string, orders: Order[], cart: Booking[]): string | null {
  const ranges = unavailableRanges(itemId, orders, cart)
  if (!ranges.length) return null
  let booked = 0
  for (let i = 0; i < SCARCE_WINDOW_DAYS; i++) {
    const iso = todayISO(i)
    if (ranges.some((r) => rangesOverlap({ start: iso, end: iso }, r))) booked++
  }
  if (booked < SCARCE_MIN_BOOKED) return null
  if (booked >= SCARCE_WINDOW_DAYS) return 'Fully booked for two weeks'
  return `Booked ${booked} of the next ${SCARCE_WINDOW_DAYS} days`
}

/** Copies this vendor holds. Absent `units` means one: a space is a single room,
    and the safe default when a listing doesn't say is never to oversell it. */
export function stockOf(item: Item): number {
  return Math.max(1, item.units ?? 1)
}

/** What's left to add right now — stock minus the same item already sitting in
    the cart. Without the cart term the stepper caps each line independently and
    two lines of 2 still walk out with 4 of a 3-unit item. */
export function stockRemaining(item: Item, cart: Booking[]): number {
  const held = cart.filter((b) => b.itemId === item.id).reduce((n, b) => n + b.qty, 0)
  return Math.max(0, stockOf(item) - held)
}

export function findConflict(itemId: string, range: DateRange, orders: Order[], cart: Booking[]): DateRange | null {
  for (const r of unavailableRanges(itemId, orders, cart)) {
    if (rangesOverlap(range, r)) return r
  }
  return null
}

/** First date on/after `from` that starts an available stretch of `days` days. */
export function nextAvailable(itemId: string, from: string, days: number, orders: Order[], cart: Booking[]): string {
  const ranges = unavailableRanges(itemId, orders, cart)
  const d = new Date(from + 'T00:00:00')
  for (let i = 0; i < 60; i++) {
    const start = toISO(d)
    const endD = new Date(d)
    endD.setDate(endD.getDate() + days - 1)
    const candidate = { start, end: toISO(endD) }
    if (!ranges.some((r) => rangesOverlap(candidate, r))) return start
    d.setDate(d.getDate() + 1)
  }
  return from
}

/* ---------------- cart totals ---------------- */

export interface TotalsInput {
  promoCode?: string
  walletUsed: number
  redeemPoints: boolean
  points: number
  ordersCount: number
  promoCodesUsed: string[]
  freeVanPerkMonth?: string
}

export interface Totals {
  subtotal: number
  transportFee: number
  insuranceFee: number
  operatorFee: number
  serviceFee: number
  promoDiscount: number
  promoError?: string
  tierDiscount: number
  vanPerk: number
  pointsUsed: number
  walletUsed: number
  depositHold: number
  total: number
  usedVanPerk: boolean
}

export function lineDuration(b: Booking): number {
  return b.unit === 'hour' ? b.hours : daysBetween(b.startDate, b.endDate)
}

export function lineSubtotal(b: Booking): number {
  return b.rate * lineDuration(b) * b.qty
}

export function validatePromo(code: string | undefined, subtotal: number, opts: TotalsInput): { discount: number; error?: string } {
  if (!code) return { discount: 0 }
  const p = PROMO_CODES[code]
  if (!p) return { discount: 0, error: 'Invalid code — try PAPA10' }
  if (p.firstOrderOnly && opts.ordersCount > 0) return { discount: 0, error: `${code} is for your first order only` }
  if (p.singleUse && opts.promoCodesUsed.includes(code)) return { discount: 0, error: `${code} has already been used` }
  if (p.minSubtotal && subtotal < p.minSubtotal) return { discount: 0, error: `${code} needs a subtotal of ${money(p.minSubtotal)}+` }
  return { discount: Math.min(Math.round(subtotal * (p.percentOff / 100)), p.maxOff) }
}

export function cartTotals(cart: Booking[], opts: TotalsInput): Totals {
  let subtotal = 0
  let insuranceFee = 0
  let operatorFee = 0
  let depositHold = 0
  let transportFee = 0
  // transport is charged per owner per method — separate owners mean separate deliveries
  const shipments = new Set<string>()

  for (const b of cart) {
    const item = getItem(b.itemId)
    const sub = lineSubtotal(b)
    subtotal += sub
    if (b.insurance) insuranceFee += Math.round(sub * INSURANCE_RATE)
    if (b.operator) operatorFee += OPERATOR_FEE_PER_DAY * (b.unit === 'hour' ? 1 : daysBetween(b.startDate, b.endDate))
    depositHold += item.deposit * b.qty
    shipments.add(`${getOwner(item.ownerId).id}:${b.transport}`)
  }
  for (const s of shipments) {
    const t = s.split(':')[1]
    transportFee += TRANSPORT_OPTIONS.find((o) => o.id === t)?.fee ?? 0
  }

  // Silver+ perk: one free van delivery per month; Gold perk: 5% off everything
  const month = todayISO().slice(0, 7)
  const isSilver = opts.points >= SILVER_POINTS
  const isGold = opts.points >= GOLD_POINTS
  const vanFee = TRANSPORT_OPTIONS.find((o) => o.id === 'van')!.fee
  const hasVan = [...shipments].some((s) => s.endsWith(':van'))
  const usedVanPerk = isSilver && hasVan && opts.freeVanPerkMonth !== month
  const vanPerk = usedVanPerk ? vanFee : 0
  const tierDiscount = isGold ? Math.round(subtotal * GOLD_DISCOUNT_RATE) : 0

  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE)
  const promo = validatePromo(opts.promoCode, subtotal, opts)

  let payable = Math.max(0, subtotal + transportFee + insuranceFee + operatorFee + serviceFee - promo.discount - tierDiscount - vanPerk)
  const pointsUsed = opts.redeemPoints ? Math.min(opts.points, payable) : 0
  payable -= pointsUsed
  const walletUsed = Math.min(opts.walletUsed, payable)
  payable -= walletUsed

  return {
    subtotal, transportFee, insuranceFee, operatorFee, serviceFee,
    promoDiscount: promo.discount, promoError: promo.error,
    tierDiscount, vanPerk, pointsUsed, walletUsed,
    depositHold, total: payable, usedVanPerk,
  }
}

/* ---------------- ratings ---------------- */

/** Bayesian weighted rating so a 5.0 with 3 reviews doesn't beat a 4.9 with 400. */
export function weightedRating(rating: number, count: number): number {
  const m = 25
  const prior = 4.5
  return (rating * count + prior * m) / (count + m)
}

/** Synthesized star distribution for the histogram (deterministic per item). */
export function ratingHistogram(rating: number, count: number): number[] {
  const p5 = Math.min(88, Math.max(20, Math.round((rating - 3.6) * 62)))
  const p4 = Math.min(100 - p5, Math.round((5 - rating) * 45) + 8)
  const rest = 100 - p5 - p4
  const p3 = Math.round(rest * 0.6)
  const p2 = Math.round(rest * 0.3)
  const p1 = rest - p3 - p2
  return [p5, p4, p3, p2, p1].map((p) => Math.round((p / 100) * count))
}

/* ---------------- misc ---------------- */

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** Tiny haptic tap on supported phones — free "native feel". */
export function buzz(ms = 12) {
  try { navigator.vibrate?.(ms) } catch { /* unsupported */ }
}

/** Levenshtein distance capped at 3, for typo-tolerant search. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return dp[a.length][b.length]
}

/** Fuzzy match: substring, or any word within edit distance 1 (2 for longer words). */
export function fuzzyMatch(haystack: string, query: string): boolean {
  const h = haystack.toLowerCase()
  const q = query.toLowerCase().trim()
  if (!q) return true
  if (h.includes(q)) return true
  const words = h.split(/[^a-z0-9]+/)
  return q.split(/\s+/).every((qw) =>
    words.some((w) => {
      if (w.includes(qw) || qw.includes(w) && w.length >= 3) return true
      if (qw.length < 4) return false
      return editDistance(w.slice(0, qw.length + 1), qw) <= (qw.length >= 6 ? 2 : 1)
    })
  )
}

/** One query word fuzzy-matches a haystack word (same tolerance as fuzzyMatch). */
function wordTypoMatch(w: string, qw: string): boolean {
  if (w.includes(qw) || (qw.includes(w) && w.length >= 3)) return true
  if (qw.length < 4) return false
  return editDistance(w.slice(0, qw.length + 1), qw) <= (qw.length >= 6 ? 2 : 1)
}

/**
 * Graded relevance of an item for a query. Every query word must land
 * somewhere (AND, like fuzzyMatch); words score by where they hit:
 * name substring > name word-prefix > tag/category > description > typo-fuzzy.
 * Returns 0 for non-matches.
 */
export function fuzzyScore(item: Item, query: string): number {
  const q = query.toLowerCase().trim()
  if (!q) return 0
  const name = item.name.toLowerCase()
  const tags = `${item.tags.join(' ')} ${item.category}`.toLowerCase()
  const desc = item.description.toLowerCase()
  const nameWords = name.split(/[^a-z0-9]+/)
  const fuzzPool = [...nameWords, ...tags.split(/[^a-z0-9]+/)]
  let total = 0
  for (const qw of q.split(/\s+/)) {
    let best = 0
    if (name.includes(qw)) best = 3
    else if (nameWords.some((w) => w.startsWith(qw))) best = 2.5
    else if (tags.includes(qw)) best = 2
    else if (desc.includes(qw)) best = 1.2
    else if (fuzzPool.some((w) => wordTypoMatch(w, qw))) best = 1
    if (best === 0) return 0
    total += best
  }
  return total
}

/** Search ranking: relevance first, then reputation and popularity as tiebreakers. */
export function searchRank(item: Item, query: string): number {
  const fs = fuzzyScore(item, query)
  if (fs === 0) return 0
  return fs * 10 + (weightedRating(item.rating, item.ratingCount) - 4) * 4 + Math.log10(item.timesRented + 1) * 2
}

/** Split text into segments with query-word hits flagged, for <mark> rendering. */
export function highlightMatch(text: string, query: string): { text: string; hit: boolean }[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter((w) => w.length > 1)
  if (words.length === 0) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const marks = new Array<boolean>(text.length).fill(false)
  for (const w of words) {
    for (let at = lower.indexOf(w); at !== -1; at = lower.indexOf(w, at + 1)) {
      for (let k = at; k < at + w.length; k++) marks[k] = true
    }
  }
  const out: { text: string; hit: boolean }[] = []
  for (let i = 0; i < text.length; i++) {
    if (out.length === 0 || out[out.length - 1].hit !== marks[i]) out.push({ text: text[i], hit: marks[i] })
    else out[out.length - 1].text += text[i]
  }
  return out
}

/* ---------------- receipt ---------------- */

/** Hand the user a file, or show it to them if the device won't take one.

    Blob downloads are silently blocked inside the Android WebView this app ships
    in — the tap does nothing and the person is left thinking the button is
    broken. Three call sites need this (receipt, CSV statement, data export) and
    only the receipt had it, so the other two were dead buttons on the platform
    that matters most. `text` is what gets rendered if the download route fails;
    for anything that isn't already HTML it is shown as preformatted text, which
    is at least selectable and shareable. */
/* Three places invented their own fallback for a person who never typed a name:
   the header said "Filmmaker", the avatar said "You", and onboarding offered
   "Your name" as the placeholder — so the word you were shown while signing up
   was not the word you were then called. One default, used everywhere. */
export const NAME_FALLBACK = 'Filmmaker'

/** Longest edge of a stored avatar. A modern phone camera JPEG is 3-8 MB and
    localStorage is a few MB for the WHOLE app — orders, chats, ledger included —
    so storing the file as picked would blow the quota and take the rest of the
    app's state down with it. At 256px a 46px avatar is still crisp on a 3x
    screen. */
export const AVATAR_PX = 256

/** Downscale a picked image to a data: URL small enough to persist.
    Rejects rather than resolving to something unusable, so the caller can say
    what went wrong instead of silently storing nothing. */
export function toAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('That file is not an image.'))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, AVATAR_PX / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Could not process that image.'))
      ctx.drawImage(img, 0, 0, w, h)
      try {
        /* JPEG, not PNG: a PNG of a photo is several times larger for no visible
           gain at this size, and the difference is the difference between fitting
           in the quota and not. */
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      } catch {
        reject(new Error('Could not process that image.'))
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be opened.')) }
    img.src = url
  })
}
export const displayName = (name?: string) => (name?.trim() ? name.trim() : NAME_FALLBACK)

export function downloadOrShow(filename: string, body: string, mime: string) {
  const a = document.createElement('a')
  if (typeof a.download === 'string') {
    try {
      const blob = new Blob([body], { type: mime })
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      return
    } catch {
      /* fall through to the inline renderer */
    }
  }
  const html = mime === 'text/html'
    ? body
    : `<!doctype html><meta charset="utf-8"><title>${filename}</title><pre style="white-space:pre-wrap;font:13px/1.4 ui-monospace,monospace;padding:16px">${
        body.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`
  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
    return
  }
  // last resort: replace the current document (WebView with popups disabled)
  document.open()
  document.write(html)
  document.close()
}

export function downloadReceipt(order: Order) {
  const rows = order.lines.map((b) => {
    const item = getItem(b.itemId)
    const dur = lineDuration(b)
    return `<tr><td>${item.name} ×${b.qty}<br><small>${fmtDate(b.startDate)} to ${fmtDate(b.endDate)} · ${dur} ${b.unit}${dur > 1 ? 's' : ''}</small></td><td align="right">${money(lineSubtotal(b))}</td></tr>`
  }).join('')
  const fee = (label: string, v: number, neg = false) =>
    v > 0 ? `<tr><td>${label}</td><td align="right">${neg ? '−' : ''}${money(v)}</td></tr>` : ''
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${order.id}</title>
<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:32px auto;color:#1c1917}h1{font-size:20px}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid #eee;font-size:14px}.tot td{font-weight:800;border-bottom:none}</style>
</head><body>
<h1>Papa Rentals — Tax Invoice</h1>
<p>Order <b>${order.id}</b> · ${new Date(order.createdAt).toLocaleString()}<br>Payment: ${order.paymentMethod} · Deliver to: ${order.address}</p>
<table>${rows}
${fee('Transport', order.transportFee)}${fee('Damage protection', order.insuranceFee)}${fee('Operators', order.operatorFee)}${fee('Service fee', order.serviceFee)}
${fee('Promo discount', order.promoDiscount, true)}${fee('Gold tier discount', order.tierDiscount, true)}${fee('Free delivery perk', order.vanPerk, true)}
${fee('PapaPoints redeemed', order.pointsUsed, true)}${fee('Wallet credit', order.walletUsed, true)}
<tr class="tot"><td>Total charged</td><td align="right">${money(order.total)}</td></tr>
<tr><td>Security deposit (hold, auto-released after return)</td><td align="right">${money(order.depositHold)}</td></tr>
</table>
<p><small>Papa Rentals (Pvt) Ltd · support@paparentals.pk · This deposit is an authorization hold, not a charge.</small></p>
</body></html>`
  downloadOrShow(`papa-receipt-${order.id}.html`, html, 'text/html')
}

/**
 * Closest catalog word to a query that found nothing — the "did you mean" term.
 * Only vocabulary that actually appears in item names and tags is offered, so
 * accepting the suggestion can never lead to a second empty page.
 */
export function didYouMean(query: string, pool: Item[]): string | null {
  const q = query.toLowerCase().trim()
  if (q.length < 4) return null
  const vocab = new Set<string>()
  for (const i of pool) {
    for (const w of `${i.name} ${i.tags.join(' ')}`.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length >= 4) vocab.add(w)
    }
  }
  /* fuzzyMatch is an AND across query words, so the page is empty because of the
     one word that landed nowhere — not the longest one. Suggest a fix for that
     word, or there is nothing useful to say. */
  const words = q.split(/\s+/).filter((w) => w.length >= 4)
  const qw = words.find((w) => !pool.some((i) => fuzzyMatch(`${i.name} ${i.tags.join(' ')} ${i.category}`, w)))
  if (!qw) return null
  let best: string | null = null
  let bestD = Infinity
  for (const w of vocab) {
    const d = editDistance(w, qw)
    if (d < bestD) { bestD = d; best = w }
  }
  /* editDistance saturates at 3 — it returns 3 for "nothing like it" as readily
     as for a genuine three-edit typo, so 3 is never trustworthy here. Staying
     strictly under the cap is what keeps "sennhaizr" from suggesting "arri". */
  const limit = Math.min(2, Math.max(1, Math.floor(qw.length / 3)))
  if (!best || bestD === 0 || bestD > limit) return null
  // Return the whole corrected query, not the bare word — swapping one word out
  // of "sony camrea rig" should keep the rest of what was typed.
  return q.split(/\s+/).map((w) => (w === qw ? best : w)).join(' ')
}

/** Tags shared by enough of the current results to be worth offering as a narrowing chip. */
export function refineTags(list: Item[], query: string, max = 5): string[] {
  if (list.length < 4) return []
  const q = query.toLowerCase()
  const counts = new Map<string, number>()
  for (const i of list) {
    for (const t of new Set(i.tags.map((t) => t.toLowerCase()))) {
      if (q.includes(t)) continue // already in the query — narrowing by it changes nothing
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    // A tag on every result narrows nothing; a tag on one result is noise.
    .filter(([, n]) => n >= 2 && n < list.length)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([t]) => t)
}
