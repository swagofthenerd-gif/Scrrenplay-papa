import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, ITEMS } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { buzz, dealActive, money } from '../utils'
import { Icon } from './icons'

/*
 * StudioHero — the "walk the studio" storyboard.
 *
 * A wide hand-sketched storyboard panorama of a film studio. Scrolling the
 * hero pans a virtual camera across the set; each snap stop frames one
 * equipment station (a category) in close-up, and tapping the framed station
 * opens that category in Browse. Frame 0 is the establishing wide shot with
 * the greeting and today's offers.
 *
 * Art direction: director's storyboard — graphite pencil on warm paper,
 * wobble via one shared displacement filter per layer, cross-hatch shading,
 * grease-pencil orange highlights, panel captions like "SC 03 · CU — LIGHTING".
 */

/* scene geometry: 10 stations spaced 360 units apart on a 3960×420 board */
const SCENE_W = 3960
const SCENE_H = 420
const STATION_X = [1980, 540, 900, 1260, 1620, 1980, 2340, 2700, 3060, 3420, 3780] // [0]=wide-shot center

const INK = '#4a443c'
const INK_SOFT = '#8a8378'
const PAPER_LINE = '#d8cfbc'
const MARKER = '#ff6b2c'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const easeInOut = (t: number) => t * t * (3 - 2 * t)

/* ------------------------------------------------------------------ */
/* Sketch helpers                                                      */
/* ------------------------------------------------------------------ */

function Hatch({ x, y, w, h, o = 0.5 }: { x: number; y: number; w: number; h: number; o?: number }) {
  // loose ground-shadow hatching under a station
  return <rect x={x} y={y} width={w} height={h} fill="url(#sb-hatch)" opacity={o} stroke="none" rx={h / 2} />
}

function Note({ x, y, children, r = -2 }: { x: number; y: number; children: string; r?: number }) {
  // pencil annotation, hand-blocked capitals
  return (
    <text
      x={x}
      y={y}
      transform={`rotate(${r} ${x} ${y})`}
      fill={INK_SOFT}
      fontSize="17"
      fontWeight="700"
      fontStyle="italic"
      letterSpacing="3"
      stroke="none"
    >
      {children}
    </text>
  )
}

function PanArrow({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x} ${y} q 45 -14 90 0`} />
      <path d={`M${x + 78} ${y - 9} l 14 8 -16 5`} />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The storyboard scene, drawn once, panned by the camera              */
/* ------------------------------------------------------------------ */

function SceneDefs() {
  return (
    <defs>
      <filter id="sb-pencil" x="-2%" y="-4%" width="104%" height="108%">
        <feTurbulence type="fractalNoise" baseFrequency="0.013" numOctaves="2" seed="7" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="4.5" />
      </filter>
      <pattern id="sb-hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(34)">
        <line x1="0" y1="0" x2="0" y2="7" stroke={INK} strokeWidth="1.1" opacity="0.28" />
      </pattern>
      <pattern id="sb-hatch2" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(-28)">
        <line x1="0" y1="0" x2="0" y2="9" stroke={INK} strokeWidth="1" opacity="0.2" />
      </pattern>
    </defs>
  )
}

/** slow layer: wall, window light, pipe grid, hanging fixtures, stencils */
function SceneBackground() {
  return (
    <g filter="url(#sb-pencil)" stroke={INK_SOFT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* wall / floor boundary */}
      <path d={`M-200 308 Q 900 302 2000 308 T ${SCENE_W + 200} 306`} />
      {/* ceiling pipe grid */}
      <path d={`M-200 44 H ${SCENE_W + 200} M-200 66 H ${SCENE_W + 200}`} opacity="0.7" />
      {[260, 760, 1260, 1760, 2260, 2760, 3260, 3760].map((x) => (
        <path key={x} d={`M${x} 44 V 66`} opacity="0.7" />
      ))}
      {/* hanging fresnels */}
      {[700, 1900, 3120].map((x) => (
        <g key={x}>
          <path d={`M${x} 66 v 26`} />
          <path d={`M${x - 16} 92 h 32 l -5 30 h -22 z`} />
          <path d={`M${x - 20} 90 l -8 -12 M${x + 20} 90 l 8 -12`} opacity="0.6" />
          <path d={`M${x - 9} 128 l -4 14 M${x + 9} 128 l 4 14`} opacity="0.4" />
        </g>
      ))}
      {/* big window, panes + light shaft */}
      <g>
        <rect x="1040" y="96" width="360" height="170" rx="6" />
        <path d="M1130 96 V 266 M1220 96 V 266 M1310 96 V 266 M1040 181 H 1400" opacity="0.7" />
        <path d="M1080 266 L 960 306 M1360 266 L 1470 306" opacity="0.35" />
      </g>
      <g>
        <rect x="2880" y="102" width="300" height="160" rx="6" />
        <path d="M2955 102 V 262 M3030 102 V 262 M3105 102 V 262 M2880 182 H 3180" opacity="0.7" />
      </g>
      {/* stencils & set dressing */}
      <Note x={340} y={140} r={0}>STAGE 2</Note>
      <rect x={470} y={112} width={60} height={34} rx={4} opacity="0.55" />
      <path d="M480 129 h 40" opacity="0.5" />
      <circle cx="2255" cy="130" r="24" opacity="0.6" />
      <path d="M2255 130 l 0 -15 M2255 130 l 10 6" opacity="0.6" />
      <Note x={3560} y={120} r={0}>QUIET PLEASE</Note>
    </g>
  )
}

/** main layer: the ten stations + floor detail + storyboard annotations */
function SceneStations() {
  return (
    <g filter="url(#sb-pencil)" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* floor sketch line */}
      <path d={`M-200 384 Q 1200 378 2400 384 T ${SCENE_W + 200} 382`} strokeWidth="2" opacity="0.7" />

      {/* pan annotations between stations */}
      <g strokeWidth="2" opacity="0.75">
        <PanArrow x={660} y={106} />
        <Note x={648} y={90}>PAN</Note>
        <PanArrow x={1740} y={110} />
        <Note x={1712} y={94}>DOLLY IN</Note>
        <PanArrow x={2820} y={104} />
        <Note x={2810} y={88}>PAN</Note>
      </g>

      {/* 1 · CAMERAS — cine camera on sticks + monitor (x 540) */}
      <g transform="translate(540 0)">
        <Hatch x={-120} y={372} w={240} h={14} />
        {/* tripod */}
        <path d="M0 250 L -62 372 M0 250 L 62 372 M0 250 L 0 372 M-24 315 H 24" />
        {/* body + matte box */}
        <rect x="-52" y="196" width="86" height="54" rx="10" fill="url(#sb-hatch2)" />
        <rect x="-52" y="196" width="86" height="54" rx="10" />
        <path d="M34 210 h 26 l 14 -10 v 42 l -14 -10 h -26 z" />
        <circle cx="-30" cy="186" r="14" />
        <circle cx="0" cy="186" r="14" />
        <path d="M-66 222 h -12" />
        {/* director's monitor */}
        <rect x="-140" y="252" width="64" height="46" rx="6" />
        <path d="M-108 298 V 372 M-128 372 h 40" />
        <path d="M-130 262 l 44 26 M-86 262 l -44 26" opacity="0.4" strokeWidth="1.6" />
        {/* marker highlight */}
        <circle cx="-4" cy="222" r="86" stroke={MARKER} strokeWidth="3" opacity="0.55" strokeDasharray="4 10" />
      </g>

      {/* 2 · LENSES — flight case table with primes (x 900) */}
      <g transform="translate(900 0)">
        <Hatch x={-110} y={372} w={220} h={13} />
        <path d="M-90 306 H 90 M-80 306 V 372 M80 306 V 372" />
        <rect x="-84" y="252" width="168" height="54" rx="8" />
        <path d="M-84 279 H 84" opacity="0.6" />
        {[-56, -18, 20, 58].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="266" r="12" />
            <circle cx={cx} cy="266" r="6" opacity="0.6" />
          </g>
        ))}
        <rect x="-30" y="212" width="26" height="40" rx="7" fill="url(#sb-hatch2)" />
        <rect x="-30" y="212" width="26" height="40" rx="7" />
        <circle cx="-17" cy="212" r="11" />
        <Note x={-46} y={196} r={-3}>THE GLASS</Note>
      </g>

      {/* 3 · LIGHTING — softbox on c-stand + tubes + beam (x 1260) */}
      <g transform="translate(1260 0)">
        <Hatch x={-130} y={372} w={260} h={14} />
        {/* beam cone */}
        <path d="M-30 176 L -140 372 M14 190 L 60 372" opacity="0.3" strokeWidth="1.8" />
        <path d="M-30 176 L -140 372 L 60 372 L 14 190 Z" fill="url(#sb-hatch2)" stroke="none" opacity="0.5" />
        {/* c-stand */}
        <path d="M22 372 V 168 M2 372 h 40 M22 348 l -30 24 M22 348 l 30 24" />
        {/* head + softbox octagon */}
        <rect x="8" y="150" width="34" height="26" rx="6" />
        <path d="M8 160 L -44 138 L -44 206 L 8 184 Z" />
        <path d="M-44 138 l -14 10 v 48 l 14 10" />
        {/* tubes leaning on wall */}
        <path d="M96 372 L 128 236 M112 372 L 144 240" strokeWidth="5" opacity="0.85" />
        <path d="M96 372 L 128 236 M112 372 L 144 240" stroke={MARKER} strokeWidth="1.6" opacity="0.5" />
        {/* stinger */}
        <path d="M-90 380 q 30 -14 60 0 t 60 0" strokeWidth="1.8" opacity="0.6" />
        <Note x={-104} y={128} r={-3}>KEY LIGHT</Note>
      </g>

      {/* 4 · AUDIO — sound cart + boom (x 1620) */}
      <g transform="translate(1620 0)">
        <Hatch x={-110} y={372} w={220} h={13} />
        {/* cart */}
        <rect x="-70" y="236" width="120" height="106" rx="10" />
        <path d="M-70 288 H 50" opacity="0.7" />
        <circle cx="-46" cy="358" r="14" />
        <circle cx="26" cy="358" r="14" />
        {/* recorder + knobs */}
        <rect x="-56" y="248" width="70" height="30" rx="5" />
        {[-42, -26, -10].map((cx) => <circle key={cx} cx={cx} cy="263" r="4" opacity="0.8" />)}
        {/* headphones hanging */}
        <path d="M64 236 q 22 -18 44 0" />
        <path d="M64 236 v 16 m 44 -16 v 16" />
        {/* boom pole + blimp */}
        <path d="M-96 372 L 44 176" />
        <ellipse cx="52" cy="166" rx="26" ry="14" transform="rotate(-36 52 166)" fill="url(#sb-hatch2)" />
        <ellipse cx="52" cy="166" rx="26" ry="14" transform="rotate(-36 52 166)" />
        <Note x={-88} y={210} r={-4}>ROLL SOUND</Note>
      </g>

      {/* 5 · GRIP — dolly on track + flag (x 1980) */}
      <g transform="translate(1980 0)">
        <Hatch x={-150} y={374} w={300} h={14} />
        {/* track */}
        <path d="M-150 356 H 150 M-150 368 H 150" />
        {[-120, -60, 0, 60, 120].map((x) => <path key={x} d={`M${x} 356 V 368`} opacity="0.7" />)}
        {/* dolly */}
        <rect x="-66" y="308" width="132" height="30" rx="8" fill="url(#sb-hatch2)" />
        <rect x="-66" y="308" width="132" height="30" rx="8" />
        <circle cx="-40" cy="348" r="10" />
        <circle cx="40" cy="348" r="10" />
        <path d="M56 308 V 232 q 0 -10 10 -10 h 18" />
        {/* flag on stand */}
        <path d="M-108 372 V 220 M-126 372 h 36" />
        <rect x="-160" y="196" width="70" height="46" rx="4" fill="url(#sb-hatch)" />
        <rect x="-160" y="196" width="70" height="46" rx="4" />
        <Note x={-58} y={188} r={-2}>SMOOTH MOVE</Note>
      </g>

      {/* 6 · DRONES — quad on a pelican case (x 2340) */}
      <g transform="translate(2340 0)">
        <Hatch x={-110} y={372} w={220} h={13} />
        <rect x="-78" y="312" width="156" height="60" rx="10" />
        <path d="M-78 336 H 78 M-52 312 v -10 h 104 v 10" opacity="0.7" />
        {/* drone */}
        <rect x="-24" y="268" width="48" height="22" rx="8" fill="url(#sb-hatch2)" />
        <rect x="-24" y="268" width="48" height="22" rx="8" />
        <path d="M-24 274 L -62 254 M24 274 L 62 254 M-24 286 L -58 296 M24 286 L 58 296" />
        <ellipse cx="-66" cy="250" rx="20" ry="5" />
        <ellipse cx="66" cy="250" rx="20" ry="5" />
        <ellipse cx="-62" cy="298" rx="18" ry="5" opacity="0.8" />
        <ellipse cx="62" cy="298" rx="18" ry="5" opacity="0.8" />
        <circle cx="0" cy="280" r="5" opacity="0.8" />
        <Note x={-64} y={238} r={-3}>EYES IN THE SKY</Note>
      </g>

      {/* 7 · TRANSPORT — van at the roller dock (x 2700) */}
      <g transform="translate(2700 0)">
        <Hatch x={-150} y={374} w={300} h={14} />
        {/* dock door behind */}
        <rect x="-160" y="170" width="150" height="180" rx="6" opacity="0.65" />
        {[196, 222, 248, 274, 300, 326].map((y) => <path key={y} d={`M-160 ${y} H -10`} opacity="0.4" />)}
        {/* van */}
        <path d="M-30 344 v -78 q 0 -12 12 -12 h 96 q 16 0 24 12 l 26 34 q 6 8 6 18 v 26 z" fill="url(#sb-hatch2)" />
        <path d="M-30 344 v -78 q 0 -12 12 -12 h 96 q 16 0 24 12 l 26 34 q 6 8 6 18 v 26 z" />
        <path d="M84 262 l 22 30 h -34 v -30 z" opacity="0.8" />
        <circle cx="8" cy="352" r="16" />
        <circle cx="98" cy="352" r="16" />
        <path d="M-30 316 h 164" opacity="0.5" />
        <Note x={-92} y={150} r={-2}>LOAD IN 6AM</Note>
      </g>

      {/* 8 · STUDIOS — cyc corner + backdrop rolls (x 3060) */}
      <g transform="translate(3060 0)">
        <Hatch x={-120} y={374} w={240} h={13} />
        {/* cyc sweep */}
        <path d="M-120 180 V 300 Q -120 372 -48 372 H 130" />
        <path d="M-104 196 V 302 Q -104 356 -52 356 H 120" opacity="0.5" />
        {/* backdrop rolls */}
        <path d="M36 372 L 62 200 M52 372 L 80 206 M70 372 L 96 214" strokeWidth="6" opacity="0.85" />
        <circle cx="62" cy="198" r="7" />
        <circle cx="80" cy="204" r="7" />
        <circle cx="96" cy="212" r="7" />
        <Note x={-96} y={162} r={-3}>THE SPACE</Note>
      </g>

      {/* 9 · PROPS — sofa vignette (x 3420) */}
      <g transform="translate(3420 0)">
        <Hatch x={-130} y={372} w={260} h={13} />
        {/* sofa */}
        <path d="M-96 296 v -34 q 0 -12 12 -12 h 120 q 12 0 12 12 v 34" />
        <rect x="-108" y="296" width="168" height="44" rx="12" fill="url(#sb-hatch2)" />
        <rect x="-108" y="296" width="168" height="44" rx="12" />
        <path d="M-96 296 q -14 -4 -14 14 v 30 h 172 v -30 q 0 -18 -14 -14" opacity="0.7" />
        <path d="M-88 340 v 16 M52 340 v 16" />
        <path d="M-24 262 v 34" opacity="0.5" />
        {/* floor lamp */}
        <path d="M108 372 V 220 M88 372 h 40" />
        <path d="M88 220 h 40 l -8 -34 h -24 z" fill="url(#sb-hatch)" />
        <path d="M88 220 h 40 l -8 -34 h -24 z" />
        <Note x={-102} y={228} r={-3}>SET DRESSING</Note>
      </g>

      {/* 10 · CREW — director chair, slate, cart (x 3780) */}
      <g transform="translate(3780 0)">
        <Hatch x={-120} y={372} w={240} h={13} />
        {/* director chair */}
        <path d="M-64 372 L -8 296 M-8 372 L -64 296 M-64 296 v -18 M-8 296 v -18" />
        <path d="M-70 278 h 68" strokeWidth="5" />
        <path d="M-64 318 h 56" strokeWidth="4" opacity="0.8" />
        {/* slate */}
        <rect x="30" y="304" width="74" height="56" rx="6" transform="rotate(-8 67 332)" />
        <path d="M28 312 l 74 -10" strokeWidth="5" opacity="0.8" transform="rotate(-8 67 332)" />
        <path d="M40 330 h 52 M40 344 h 52" opacity="0.5" transform="rotate(-8 67 332)" />
        {/* toolbox cart */}
        <rect x="118" y="292" width="76" height="66" rx="8" />
        <path d="M118 314 H 194 M118 336 H 194" opacity="0.7" />
        <circle cx="134" cy="366" r="9" />
        <circle cx="178" cy="366" r="9" />
        <Note x={-70} y={252} r={-2}>VIDEO VILLAGE</Note>
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The hero                                                            */
/* ------------------------------------------------------------------ */

export default function StudioHero() {
  const { go } = useNav()
  const { state } = useStore()
  const trackRef = useRef<HTMLDivElement>(null)
  const midRef = useRef<SVGSVGElement>(null)
  const bgRef = useRef<SVGSVGElement>(null)
  const spotRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState(0)

  // live per-category stats: count, from-price, live deal
  const stats = useMemo(() => {
    const pool = [...ITEMS, ...state.myListings.filter((l) => !l.paused)].filter(
      (i) => !state.blockedOwners.includes(i.ownerId)
    )
    return CATEGORIES.map((c) => {
      const items = pool.filter((i) => i.category === c.id)
      return {
        cat: c,
        count: items.length,
        minPrice: items.reduce((m, i) => Math.min(m, i.pricePerDay), Infinity),
        deals: items.filter((i) => dealActive(i.id)).length,
      }
    })
  }, [state.myListings, state.blockedOwners])

  const totalDeals = stats.reduce((s, x) => s + x.deals, 0)
  const bestOff = useMemo(() => {
    const pool = ITEMS.filter((i) => dealActive(i.id))
    return pool.reduce((m, i) => Math.max(m, i.flashDeal?.percentOff ?? 0), 0)
  }, [])

  /* camera: map scroll progress → layer transforms */
  useEffect(() => {
    const track = trackRef.current
    const mid = midRef.current
    const bg = bgRef.current
    const spot = spotRef.current
    if (!track || !mid || !bg || !spot) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0

    const render = () => {
      raf = 0
      const W = track.clientWidth
      const H = track.clientHeight
      if (!W || !H) return
      const k = H / SCENE_H // scene units → px
      const f = Math.max(0, track.scrollLeft / W)
      const n = STATION_X.length - 1 // 10 stations

      // wide-shot scale: fit ~2100 scene units into the viewport
      const sWide = Math.min(0.60, W / (2400 * k))
      let s: number
      let cx: number // camera target in scene units
      if (f <= 1) {
        const t = easeInOut(clamp01(f))
        s = lerp(sWide, 1, t)
        cx = lerp(STATION_X[0], STATION_X[1], t)
      } else {
        const i = Math.min(n - 1, Math.floor(f))
        const t = easeInOut(clamp01(f - i))
        s = 1
        cx = lerp(STATION_X[i], STATION_X[Math.min(n, i + 1)], t)
      }

      const settle = f < 0.5 ? 0 : 1 - Math.min(1, Math.abs(f - Math.round(f)) * 2.2)
      const dolly = reduced ? 1 : 1 + 0.05 * settle
      const cxPx = cx * k

      mid.style.transformOrigin = `${cxPx}px 62%`
      const dy = lerp(H * 0.16, -H * 0.10, easeInOut(clamp01(f)))
      mid.style.transform = `translate(${W / 2 - cxPx}px, ${dy}px) scale(${s * dolly})`
      const bgFactor = reduced ? 1 : 0.45
      bg.style.transformOrigin = `${cxPx}px 60%`
      bg.style.transform = `translate(${(W / 2 - cxPx) * bgFactor}px, ${dy}px) scale(${Math.max(s, 0.8)})`
      spot.style.opacity = String(0.85 * settle)

      const active = Math.round(f)
      setFrame((prev) => (prev === active ? prev : active))
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(render)
    }
    render()
    // re-render once fonts/layout settle
    const t = setTimeout(render, 60)
    track.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      track.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [])

  function jumpTo(i: number) {
    const track = trackRef.current
    if (!track) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    track.scrollTo({ left: i * track.clientWidth, behavior: reduced ? 'auto' : 'smooth' })
  }

  function openFrame(i: number) {
    buzz()
    if (i === 0) {
      jumpTo(1) // wide shot: start the walk
      return
    }
    go({ name: 'browse', category: CATEGORIES[i - 1].id })
  }

  const active = stats[frame - 1] // undefined on the wide shot
  const svgStyle = { aspectRatio: `${SCENE_W} / ${SCENE_H}` } as const

  return (
    <div className="studio-hero">
      <div className="studio-stage">
        {/* the storyboard, two parallax layers */}
        <svg ref={bgRef} className="studio-layer" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} style={svgStyle} aria-hidden="true">
          <SceneDefs />
          <SceneBackground />
        </svg>
        <svg ref={midRef} className="studio-layer" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} style={svgStyle} aria-hidden="true">
          <SceneStations />
        </svg>
        <div ref={spotRef} className="studio-spot" aria-hidden="true" />

        {/* storyboard panel chrome */}
        <div className="studio-panel" aria-hidden="true">
          <i /><i /><i /><i />
        </div>

        {/* snap track: one full-width slide per frame */}
        <div className="studio-track" ref={trackRef}>
          <div className="studio-slide" role="group" aria-label="The studio — wide shot">
            <button className="studio-tap" onClick={() => openFrame(0)} aria-label="Start the studio walk">
              <div className="studio-title">
                <div className="studio-sc">SC 01 · WIDE — THE STUDIO</div>
                <h1>
                  {state.profile.name ? `Salaam, ${state.profile.name}.` : 'Rent everything'}<br />
                  {state.profile.name ? 'Walk the studio.' : 'for your next shoot.'}
                </h1>
                <div className="studio-offers">
                  {bestOff > 0 && <span className="studio-tag deal"><Icon name="bolt" size={12} /> Up to {bestOff}% off today</span>}
                  {totalDeals > 0 && <span className="studio-tag"><Icon name="ticket" size={12} /> {totalDeals} live deals</span>}
                  <span className="studio-tag"><Icon name="handshake" size={12} /> Offer your price</span>
                </div>
                <div className="studio-hint">Scroll to walk the set <Icon name="arrow-right" size={13} /></div>
              </div>
            </button>
          </div>
          {stats.map((s, idx) => (
            <div key={s.cat.id} className="studio-slide" role="group" aria-label={`${s.cat.name} station — tap to browse`}>
              <button
                className="studio-tap"
                onClick={() => openFrame(idx + 1)}
                aria-label={`Browse ${s.cat.name}`}
              />
            </div>
          ))}
        </div>

        {/* settled-frame caption card */}
        <div className={`studio-caption ${frame > 0 ? 'on' : ''}`} aria-hidden={frame === 0}>
          {active && (
            <>
              <div className="studio-sc">SC {String(frame + 1).padStart(2, '0')} · CU — {active.cat.name.toUpperCase()}</div>
              <div className="studio-caption-main">
                <b>{active.cat.name}</b>
                <span className="muted">
                  {active.count} rental{active.count === 1 ? '' : 's'}
                  {Number.isFinite(active.minPrice) && <> · from {money(active.minPrice)}</>}
                </span>
                {active.deals > 0 && <span className="studio-tag deal"><Icon name="bolt" size={11} /> {active.deals} deal{active.deals > 1 ? 's' : ''}</span>}
              </div>
              <div className="studio-caption-cta">Tap to open <Icon name="arrow-right" size={12} /></div>
            </>
          )}
        </div>
      </div>

      {/* filmstrip: jump to any station */}
      <div className="studio-strip" role="tablist" aria-label="Studio stations">
        <button
          className={`studio-stop ${frame === 0 ? 'active' : ''}`}
          onClick={() => jumpTo(0)}
          aria-label="Wide shot"
        >
          <Icon name="clapperboard" size={16} />
        </button>
        {CATEGORIES.map((c, i) => (
          <button
            key={c.id}
            className={`studio-stop ${frame === i + 1 ? 'active' : ''}`}
            onClick={() => jumpTo(i + 1)}
            aria-label={c.name}
          >
            <Icon name={c.icon} size={16} />
          </button>
        ))}
      </div>
    </div>
  )
}
