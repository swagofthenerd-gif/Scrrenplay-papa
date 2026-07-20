import type { CategoryId } from '../types'

/*
 * Curated Unsplash photography for the catalog.
 *
 * Every photo ID lives here so a dead link is a one-line swap. The UI never
 * depends on these loading: SmartImage falls back to the category gradient +
 * emoji art on error, so an unreachable ID degrades to the old look.
 */

export function img(id: string, w = 800): string {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`
}

/** hero + gallery photo IDs per catalog item */
export const ITEM_IMAGES: Record<string, string[]> = {
  i1: ['photo-1478720568477-152d9b164e26', 'photo-1516035069371-29a1b244cc32'],
  i2: ['photo-1516035069371-29a1b244cc32', 'photo-1526170375885-4d8ecf77b99f'],
  i3: ['photo-1502920917128-1aa500764cbd', 'photo-1440404653325-ab127d49abc1'],
  i4: ['photo-1552168324-d612d77725e3', 'photo-1495707902641-75cac588d2e9'],
  i5: ['photo-1495707902641-75cac588d2e9', 'photo-1500634245200-e5245c7574ef'],
  i6: ['photo-1492684223066-81342ee5ff30', 'photo-1470229722913-7c0e2dbbafd3'],
  i7: ['photo-1563089145-599997674d42', 'photo-1550745165-9bc0b252726f'],
  i8: ['photo-1590602847861-f357a9332bbc', 'photo-1478737270239-2f02b77fc618'],
  i9: ['photo-1520523839897-bd0b52f945a0', 'photo-1598488035139-bdbb2231ce04'],
  i10: ['photo-1569420067112-b57b4f024595', 'photo-1478720568477-152d9b164e26'],
  i11: ['photo-1478720568477-152d9b164e26'],
  i12: ['photo-1473968512647-3e447244af8f', 'photo-1508614589041-895b88991e3e'],
  i13: ['photo-1508614589041-895b88991e3e', 'photo-1527977966376-1c8408f9f108'],
  i14: ['photo-1527786356703-4b100091cd2c', 'photo-1506521781263-d8422e82f27a'],
  i15: ['photo-1601584115197-04ecc0da31d7'],
  i16: ['photo-1494976388531-d1058494cdd8', 'photo-1533473359331-0135ef1b58bf'],
  i17: ['photo-1497366216548-37526070297c', 'photo-1497366811353-6870744d04b2'],
  i18: ['photo-1574717024653-61fd2cf4d44d', 'photo-1478720568477-152d9b164e26'],
  i19: ['photo-1493663284031-b7e3aefcae8e', 'photo-1555041469-a586c61ea9bc'],
  i20: ['photo-1574717024653-61fd2cf4d44d', 'photo-1478720568477-152d9b164e26'],
  i21: ['photo-1477959858617-67f85cf4f1df', 'photo-1449824913935-59a10b8d2000'],
  i22: ['photo-1600585154340-be6161a56a0c', 'photo-1600607687939-ce8a6c25118c'],
  i23: ['photo-1586528116311-ad8dd3c8310d', 'photo-1553413077-190dd305871c'],
  i24: ['photo-1600210492486-724fe5c67fb0', 'photo-1567767292278-a4f21aa2d36e'],
}

/** one representative photo per category, used for user-posted listings and the hero */
export const CATEGORY_IMAGE: Record<CategoryId, string> = {
  cameras: 'photo-1516035069371-29a1b244cc32',
  lenses: 'photo-1552168324-d612d77725e3',
  lighting: 'photo-1492684223066-81342ee5ff30',
  audio: 'photo-1478737270239-2f02b77fc618',
  grip: 'photo-1478720568477-152d9b164e26',
  drones: 'photo-1473968512647-3e447244af8f',
  transport: 'photo-1527786356703-4b100091cd2c',
  studios: 'photo-1497366216548-37526070297c',
  props: 'photo-1555041469-a586c61ea9bc',
  crew: 'photo-1478720568477-152d9b164e26',
}

export const HERO_IMAGE = img('photo-1478720568477-152d9b164e26', 1400)
