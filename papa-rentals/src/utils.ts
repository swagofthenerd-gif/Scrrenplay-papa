import { CURRENCY, PROMO_CODES, TRANSPORT_OPTIONS, getItem } from './data/catalog'
import type { Booking, OfferStatus } from './types'

export function money(n: number): string {
  return `${CURRENCY} ${Math.round(n).toLocaleString('en-PK')}`
}

export function todayISO(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000)
  return Math.max(1, diff + 1) // inclusive of both days, minimum 1 day
}

/**
 * Recommended fare: base price with multi-day discounts, flash deals applied.
 * 3+ days → 10% off, 7+ days → 20% off (like weekly rates on ShareGrid/Fat Llama).
 */
export function recommendedPerDay(itemId: string, days: number): number {
  const item = getItem(itemId)
  let perDay = item.pricePerDay
  if (item.flashDeal) perDay *= 1 - item.flashDeal.percentOff / 100
  if (days >= 7) perDay *= 0.8
  else if (days >= 3) perDay *= 0.9
  return Math.round(perDay)
}

/** inDrive-style offer engine: owner accepts strong offers, counters fair ones, declines lowballs. */
export function evaluateOffer(recommended: number, offered: number): { status: OfferStatus; counter?: number } {
  const ratio = offered / recommended
  if (ratio >= 0.92) return { status: 'accepted' }
  if (ratio >= 0.72) return { status: 'countered', counter: Math.round((offered + recommended) / 2 / 50) * 50 }
  return { status: 'declined' }
}

export const INSURANCE_RATE = 0.08 // 8% of line subtotal, damage protection
export const OPERATOR_FEE_PER_DAY = 6000 // certified operator/tech add-on
export const SERVICE_FEE_RATE = 0.05 // platform fee
export const POINTS_PER_100 = 1 // PapaPoints earned per Rs 100 spent

export interface Totals {
  subtotal: number
  transportFee: number
  insuranceFee: number
  operatorFee: number
  serviceFee: number
  discount: number
  deposit: number
  total: number
}

export function lineDays(b: Booking): number {
  return daysBetween(b.startDate, b.endDate)
}

export function lineSubtotal(b: Booking): number {
  return b.agreedPricePerDay * lineDays(b) * b.qty
}

export function cartTotals(cart: Booking[], promoCode: string | undefined, walletUsed: number): Totals & { walletUsed: number } {
  let subtotal = 0
  let insuranceFee = 0
  let operatorFee = 0
  let deposit = 0
  let transportFee = 0
  const transportsUsed = new Set<string>()

  for (const b of cart) {
    const item = getItem(b.itemId)
    const days = lineDays(b)
    const sub = lineSubtotal(b)
    subtotal += sub
    if (b.insurance) insuranceFee += Math.round(sub * INSURANCE_RATE)
    if (b.operator) operatorFee += OPERATOR_FEE_PER_DAY * days
    deposit += item.deposit * b.qty
    transportsUsed.add(b.transport)
  }
  // charge each distinct transport method once per order (consolidated delivery)
  for (const t of transportsUsed) {
    transportFee += TRANSPORT_OPTIONS.find((o) => o.id === t)?.fee ?? 0
  }

  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE)
  let discount = 0
  if (promoCode && PROMO_CODES[promoCode]) {
    const p = PROMO_CODES[promoCode]
    discount = Math.min(Math.round(subtotal * (p.percentOff / 100)), p.maxOff)
  }

  const payable = Math.max(0, subtotal + transportFee + insuranceFee + operatorFee + serviceFee - discount)
  const wallet = Math.min(walletUsed, payable)
  const total = payable - wallet + deposit

  return { subtotal, transportFee, insuranceFee, operatorFee, serviceFee, discount, deposit, total, walletUsed: wallet }
}

export function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}
