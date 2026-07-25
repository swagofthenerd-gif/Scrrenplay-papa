import { CATEGORIES, ITEMS, OWNERS, getOwner } from './data/catalog'
import type { AppState, CategoryId, Item, Owner } from './types'
import { dealActive, weightedRating } from './utils'

/*
 * Vendor (owner) rollups for the foodpanda-style storefront model.
 * A "vendor" is an Owner; their catalog is every Item they list.
 */

export interface Vendor {
  owner: Owner
  items: Item[]
  categories: CategoryId[] // departments this vendor stocks, most-stocked first
  count: number
  minPrice: number
  hasDeal: boolean // any live flash deal
  instant: boolean // offers at least one instant-book listing
  offers: boolean // accepts price offers on at least one listing
}

/** All rentable items visible to the user (catalog + live user listings, minus blocked owners). */
function visibleItems(state: AppState): Item[] {
  const live = state.myListings.filter((l) => !l.paused)
  return [...ITEMS, ...live].filter((i) => !state.blockedOwners.includes(i.ownerId))
}

export function vendorItems(ownerId: string, state: AppState): Item[] {
  return visibleItems(state)
    .filter((i) => i.ownerId === ownerId)
    .sort((a, b) => Number(dealActive(b.id)) - Number(dealActive(a.id)) || b.timesRented - a.timesRented)
}

function buildVendor(owner: Owner, items: Item[]): Vendor {
  const byCat = new Map<CategoryId, number>()
  for (const i of items) byCat.set(i.category, (byCat.get(i.category) ?? 0) + 1)
  const categories = [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
  return {
    owner,
    items,
    categories,
    count: items.length,
    minPrice: items.reduce((m, i) => Math.min(m, i.pricePerDay), Infinity),
    hasDeal: items.some((i) => dealActive(i.id)),
    instant: items.some((i) => i.instantBook),
    offers: items.some((i) => i.offersAccepted),
  }
}

export type VendorSort = 'top' | 'nearest' | 'selection'

/** Storefront vendors that actually have listings, ranked. Excludes the current user + support. */
export function vendors(state: AppState, sort: VendorSort = 'top'): Vendor[] {
  const list = OWNERS
    .filter((o) => o.id !== 'me' && o.id !== 'support' && !state.blockedOwners.includes(o.id))
    .map((o) => buildVendor(o, vendorItems(o.id, state)))
    .filter((v) => v.count > 0)

  switch (sort) {
    case 'nearest':
      list.sort((a, b) => a.owner.distanceKm - b.owner.distanceKm)
      break
    case 'selection':
      list.sort((a, b) => b.count - a.count)
      break
    default: // 'top' — super owners first, then Bayesian rating
      list.sort(
        (a, b) =>
          Number(b.owner.superOwner) - Number(a.owner.superOwner) ||
          weightedRating(b.owner.rating, b.owner.ratingCount) - weightedRating(a.owner.rating, a.owner.ratingCount)
      )
  }
  return list
}

export function getVendor(ownerId: string, state: AppState): Vendor {
  return buildVendor(getOwner(ownerId), vendorItems(ownerId, state))
}

export function categoryName(id: CategoryId): string {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id
}
