import { getOwner } from '../data/catalog'
import { Icon } from './icons'
import type { Item } from '../types'

/* Vendors have a distance from the renter but no coordinates, and inventing
   lat/lng would put pins on streets nobody is actually on. This plots what the
   data really says instead: how far each space is, and roughly which way. Rings
   are labelled in km so the picture is read as proximity, not as a street map. */

const SIZE = 320
const CENTER = SIZE / 2
const EDGE = 118 // px from centre to the outer ring
/* Nothing sits closer in than this, or a nearby vendor's pin lands on top of the
   "you" marker and neither can be read. */
const INNER = 34

export function ProximityMap({ items, onOpen }: { items: Item[]; onOpen: (id: string) => void }) {
  const withOwners = items.map((item) => ({ item, owner: getOwner(item.ownerId) }))
  const far = Math.max(...withOwners.map((w) => w.owner.distanceKm), 1)
  const rings = [far / 3, (far * 2) / 3, far]

  /* Bearings are spread evenly per vendor rather than hashed. A hash over six
     owners clumped them all into one quadrant, stacked their pins, and left the
     ones underneath impossible to tap. Sorting by id keeps a vendor in the same
     direction between renders so the map doesn't spin as the list re-filters. */
  const ownerIds = [...new Set(withOwners.map((w) => w.owner.id))].sort()
  const seen = new Map<string, number>()

  const pins = withOwners.map(({ item, owner }) => {
    const slot = ownerIds.indexOf(owner.id)
    const n = seen.get(owner.id) ?? 0
    seen.set(owner.id, n + 1)
    const base = (slot / ownerIds.length) * Math.PI * 2 - Math.PI / 2
    const r0 = INNER + (owner.distanceKm / far) * (EDGE - INNER)
    /* Two spaces from one vendor share a distance, so they differ only by angle
       — and a fixed angle is a shrinking gap as the radius drops, which put two
       pins on top of each other close to the centre. Separating by arc length
       instead keeps the gap the width of a pin wherever it lands, with a small
       radial stagger so the innermost ring can't tie either. */
    const sep = Math.min(0.7, 64 / Math.max(r0, 36))
    const angle = base + n * sep
    const r = r0 + n * 12
    return {
      item,
      owner,
      x: CENTER + Math.cos(angle) * r,
      y: CENTER + Math.sin(angle) * r,
    }
  })

  return (
    <div className="pmap">
      <div className="pmap-stage">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="pmap-rings" aria-hidden="true">
          {rings.map((km, i) => (
            <g key={km}>
              <circle cx={CENTER} cy={CENTER} r={((i + 1) / rings.length) * EDGE} className="pmap-ring" />
              <text x={CENTER} y={CENTER - ((i + 1) / rings.length) * EDGE + 12} className="pmap-ring-label">
                {Math.round(km)} km
              </text>
            </g>
          ))}
        </svg>

        <div className="pmap-you" aria-hidden="true">
          <Icon name="pin" size={14} />
        </div>

        {pins.map(({ item, owner, x, y }) => (
          <button
            key={item.id}
            className="pmap-pin"
            style={{ left: `${(x / SIZE) * 100}%`, top: `${(y / SIZE) * 100}%` }}
            onClick={() => onOpen(item.id)}
            aria-label={`${item.name}, ${owner.area}, ${owner.distanceKm} km away`}
          >
            <Icon name={item.icon} size={15} />
            <span className="pmap-pin-km">{owner.distanceKm}</span>
          </button>
        ))}
      </div>

      <p className="muted small pmap-note">
        Distance from you — tap a pin to open the space. Rings are {Math.round(rings[0])}/{Math.round(rings[1])}/{Math.round(rings[2])} km.
      </p>
    </div>
  )
}
