import { ALSO_RENTED, ITEMS, getItem } from './data/catalog'
import type { AppState, CategoryId, Item } from './types'
import { weightedRating } from './utils'

/*
 * Client-side recommendations: content similarity between items plus a
 * personal category-affinity profile built from what the user has viewed,
 * wishlisted, carted and ordered. No network, no store changes — every
 * signal already persists in AppState.
 */

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0
  const A = new Set(a)
  let inter = 0
  for (const t of b) if (A.has(t)) inter++
  return inter / (A.size + new Set(b).size - inter)
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** How alike two items are: tags > category adjacency > price band > quality. */
export function similarity(a: Item, b: Item): number {
  const cat = a.category === b.category ? 1 : (ALSO_RENTED[a.category] ?? []).includes(b.category) ? 0.5 : 0
  const price = 1 - Math.min(1, Math.abs(Math.log2(b.pricePerDay / a.pricePerDay)) / 3)
  const quality = clamp01(weightedRating(b.rating, b.ratingCount) - 4)
  return 0.35 * jaccard(a.tags, b.tags) + 0.3 * cat + 0.2 * price + 0.15 * quality
}

function pool(state: AppState): Item[] {
  return [...ITEMS, ...state.myListings.filter((l) => !l.paused)].filter((i) => !state.blockedOwners.includes(i.ownerId))
}

function byId(state: AppState, id: string): Item | undefined {
  return pool(state).find((i) => i.id === id) ?? (ITEMS.some((i) => i.id === id) ? getItem(id) : undefined)
}

/** Items most similar to a seed item — powers "people also rented" and cross-sell. */
export function similarItems(seedId: string, state: AppState, n = 6): Item[] {
  const seed = byId(state, seedId)
  if (!seed) return []
  return pool(state)
    .filter((i) => i.id !== seedId && !i.mine)
    .map((i) => ({ i, s: similarity(seed, i) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((r) => r.i)
}

/** Category affinity from behavior; recency-decayed views weigh heaviest. */
export function categoryAffinity(state: AppState): Partial<Record<CategoryId, number>> {
  const aff: Partial<Record<CategoryId, number>> = {}
  const add = (id: string, w: number) => {
    const item = byId(state, id)
    if (item) aff[item.category] = (aff[item.category] ?? 0) + w
  }
  state.recentlyViewed.forEach((id, pos) => add(id, 3 * Math.pow(0.85, pos)))
  state.wishlist.forEach((id) => add(id, 2))
  state.orders.forEach((o) => o.lines.forEach((l) => add(l.itemId, 2)))
  state.cart.forEach((l) => add(l.itemId, 1.5))
  return aff
}

/** Seed items the "For you" row reasons from: recent views + wishlist. */
function seeds(state: AppState): Item[] {
  const ids = [...new Set([...state.recentlyViewed.slice(0, 5), ...state.wishlist])]
  return ids.map((id) => byId(state, id)).filter((i): i is Item => Boolean(i))
}

/**
 * Personalized "For you" ranking. Excludes what the user just viewed
 * (anti-echo) and their own listings. Empty until there's any signal.
 */
export function forYou(state: AppState, n = 8): Item[] {
  const aff = categoryAffinity(state)
  if (Object.keys(aff).length === 0) return []
  const seedItems = seeds(state)
  const recent = new Set(state.recentlyViewed.slice(0, 3))
  return pool(state)
    .filter((i) => !i.mine && !recent.has(i.id))
    .map((i) => {
      const simBoost = seedItems.reduce((m, s) => Math.max(m, similarity(s, i)), 0)
      const score =
        (aff[i.category] ?? 0) +
        0.6 * (weightedRating(i.rating, i.ratingCount) - 4) +
        (0.4 * Math.log10(i.timesRented + 1)) / 3 +
        0.5 * simBoost
      return { i, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((r) => r.i)
}
