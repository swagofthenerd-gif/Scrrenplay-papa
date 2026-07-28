import type { CategoryId } from '../types'
import type { IconName } from '../components/icons'

/* Contextual merchandising. What a Pakistani crew needs in December (wedding
   films, warm practicals, gimbals) has nothing to do with what they need in
   July (rain cover, indoor studios), and a home screen that reads the same all
   year is one that never speaks to the shoot you're actually planning.

   Two window shapes, because the seasons genuinely have two shapes:

   - `annual` is solar and repeats forever — wedding season, monsoon, the
     March–June ad rush. Written as MM-DD so it needs no maintenance.
   - `dates` is for anything that moves against the Gregorian calendar. Ramadan
     and Eid shift about eleven days earlier each year, and there is no honest
     formula to fake here, so those years are listed explicitly. When the list
     runs out the promo simply stops showing, which is the correct failure: a
     silently wrong Ramadan banner is worse than no banner. */
export interface Promo {
  id: string
  icon: IconName
  title: string
  blurb: string
  cta: string
  /** Where the CTA lands. Everything is optional; an empty target is just Browse. */
  target: { category?: CategoryId; query?: string; dealsOnly?: boolean }
  /** Repeats every year. Inclusive. May wrap past new year (11-01 → 02-15). */
  annual?: { from: string; to: string }
  /** Explicit inclusive ISO windows, for anything lunar-dated. */
  dates?: { from: string; to: string }[]
  /** Higher wins when windows overlap. */
  priority?: number
}

export const PROMOS: Promo[] = [
  {
    id: 'wedding',
    icon: 'sparkles',
    title: 'Wedding season is here',
    blurb: 'Gimbals, warm practicals and second bodies — the kit every shaadi film runs on.',
    cta: 'See wedding kit',
    target: { query: 'gimbal' },
    annual: { from: '11-01', to: '02-15' },
    priority: 2,
  },
  {
    id: 'monsoon',
    icon: 'warehouse',
    title: 'Shooting through the monsoon',
    blurb: 'Covered studios and rain-safe rigs, so a downpour costs you an hour instead of a day.',
    cta: 'Find covered spaces',
    target: { category: 'studios' },
    annual: { from: '07-01', to: '08-31' },
    priority: 1,
  },
  {
    id: 'ad-rush',
    icon: 'flame',
    title: 'Ad season — book early',
    blurb: 'Brand shoots take the good cameras first. The March–June rush is when calendars fill.',
    cta: 'Lock in a camera',
    target: { category: 'cameras' },
    annual: { from: '03-01', to: '06-15' },
    priority: 1,
  },
  {
    id: 'ramadan',
    icon: 'bulb',
    title: 'Ramadan campaign shoots',
    blurb: 'Night schedules, soft light and quiet audio kit for the season’s TVC rush.',
    cta: 'Browse lighting',
    target: { category: 'lighting' },
    /* Approximate first/last days in Pakistan; listed rather than computed. */
    dates: [
      { from: '2026-02-17', to: '2026-03-19' },
      { from: '2027-02-07', to: '2027-03-08' },
      { from: '2028-01-27', to: '2028-02-25' },
    ],
    priority: 3,
  },
]

function mmdd(iso: string) {
  return iso.slice(5)
}

/* `todayIso` is passed in rather than read here so the caller owns "now" — the
   store already has a heartbeat, and a function that reads the clock itself
   can't be tested against a date that isn't today. */
export function activePromo(todayIso: string): Promo | undefined {
  const today = mmdd(todayIso)
  const matches = PROMOS.filter((p) => {
    if (p.dates?.some((d) => todayIso >= d.from && todayIso <= d.to)) return true
    if (!p.annual) return false
    const { from, to } = p.annual
    // A window like 11-01 → 02-15 wraps the new year, so it's two ranges.
    return from <= to ? today >= from && today <= to : today >= from || today <= to
  })
  return matches.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0]
}
