import { useEffect, useState } from 'react'
import { Icon } from './icons'

/* The old transit graphic was a dashed squiggle with a dot looping along it on a
   3.4s timer. It said nothing: the same curve at the same speed whether the van
   was two minutes out or forty, leaving one vendor or another. This draws the
   two facts the order actually knows — where it left from and where it is going —
   and puts the van at the position the ETA implies, so a glance at it is worth
   something. It is deliberately schematic rather than a fake street map: vendors
   have an area and a distance, not coordinates, and drawing invented roads would
   be claiming precision the data does not have. */

const W = 300
const H = 132

/* One bend rather than a straight line, because a straight line between two pins
   reads as a diagram of a relationship and a bent one reads as a trip. */
const ROUTE: [number, number][] = [
  [30, 100],
  [96, 100],
  [138, 62],
  [204, 62],
  [270, 34],
]

/* Blocks behind the route give the pins somewhere to be. They carry no data, so
   they stay very low contrast — decoration that is legible as decoration. */
const BLOCKS = [
  { x: 16, y: 16, w: 62, h: 34 },
  { x: 92, y: 12, w: 78, h: 30 },
  { x: 186, y: 88, w: 70, h: 30 },
  { x: 44, y: 62, w: 40, h: 24 },
  { x: 226, y: 12, w: 54, h: 22 },
]

function pointAt(t: number): { x: number; y: number } {
  const lens: number[] = []
  let total = 0
  for (let i = 1; i < ROUTE.length; i++) {
    const d = Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1])
    lens.push(d)
    total += d
  }
  let want = Math.max(0, Math.min(1, t)) * total
  for (let i = 0; i < lens.length; i++) {
    if (want <= lens[i] || i === lens.length - 1) {
      const f = lens[i] === 0 ? 0 : Math.max(0, Math.min(1, want / lens[i]))
      return {
        x: ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * f,
        y: ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * f,
      }
    }
    want -= lens[i]
  }
  return { x: ROUTE[ROUTE.length - 1][0], y: ROUTE[ROUTE.length - 1][1] }
}

const d = `M ${ROUTE.map(([x, y]) => `${x} ${y}`).join(' L ')}`

/* The legend can show a saved address in full, but the status sentence has to
   read as a sentence — "DHA Phase 5 to House 4, Street 12, DHA Phase 6, Lahore"
   is the address wearing a sentence as a hat. The neighbourhood is the part that
   answers "where is my gear going", so drop the house and street. */
function shortPlace(s: string) {
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 3) return s
  return parts.slice(-2).join(', ')
}

export function TransitMap({
  from,
  to,
  distanceKm,
  startedAt,
  arrivesAt,
}: {
  from: string
  to: string
  distanceKm: number
  startedAt?: number
  arrivesAt?: number
}) {
  /* The van only moves when the clock says it has. Re-rendering every 15s rather
     than every second keeps a card that may be one of several on screen from
     doing per-second layout work for a marker that shifts a pixel a minute. */
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])

  /* No window to measure against means we genuinely do not know how far along it
     is, so the van sits at the start rather than guessing a midpoint. */
  const span = startedAt && arrivesAt ? arrivesAt - startedAt : 0
  const progress = span > 0 ? Math.max(0, Math.min(1, (now - startedAt!) / span)) : 0
  const van = pointAt(progress)
  const left = arrivesAt ? Math.max(0, arrivesAt - now) : 0
  const kmLeft = Math.max(0, Math.round(distanceKm * (1 - progress) * 10) / 10)
  const toShort = shortPlace(to)

  return (
    <div className="tmap">
      <svg viewBox={`0 0 ${W} ${H}`} className="tmap-svg" aria-hidden="true">
        {BLOCKS.map((b) => (
          <rect key={`${b.x}-${b.y}`} x={b.x} y={b.y} width={b.w} height={b.h} rx="4" className="tmap-block" />
        ))}
        <path d={d} className="tmap-road" />
        <path d={d} className="tmap-route" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - progress} />

        <circle cx={ROUTE[0][0]} cy={ROUTE[0][1]} r="7" className="tmap-node tmap-node-from" />
        <circle cx={ROUTE[ROUTE.length - 1][0]} cy={ROUTE[ROUTE.length - 1][1]} r="7" className="tmap-node tmap-node-to" />

        <circle cx={van.x} cy={van.y} r="11" className="tmap-van-halo" />
        <circle cx={van.x} cy={van.y} r="6" className="tmap-van" />
      </svg>

      <div className="tmap-legend">
        <span className="tmap-leg">
          <i className="tmap-dot tmap-dot-from" aria-hidden="true" />
          <span className="tmap-leg-txt">
            <b>Picked up</b>
            <span className="muted">{from}</span>
          </span>
        </span>
        <span className="tmap-leg tmap-leg-end">
          <i className="tmap-dot tmap-dot-to" aria-hidden="true" />
          <span className="tmap-leg-txt">
            <b>Dropping at</b>
            <span className="muted">{to}</span>
          </span>
        </span>
      </div>

      {/* The picture is aria-hidden, so the same facts have to exist as text or a
          screen reader gets an order with no delivery information at all. */}
      <p className="small tmap-status">
        <Icon name="van" size={14} />{' '}
        {span > 0 ? (
          <>
            {progress >= 1
              ? `Arriving now at ${toShort}`
              : `About ${kmLeft} km to go of ${distanceKm} km — ${from} to ${toShort}`}
          </>
        ) : (
          <>On the way from {from} to {toShort} — {distanceKm} km</>
        )}
        {left > 0 && span > 0 && <span className="sr-only"> Arriving in about {Math.ceil(left / 60000)} minutes.</span>}
      </p>
    </div>
  )
}
