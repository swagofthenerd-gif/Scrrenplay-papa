import type { ReactNode } from 'react'

/*
 * StudioScene — the storyboard panorama.
 *
 * Drawn as a director's board: rough graphite pencil on paper. Roughness
 * comes from three stacked techniques:
 *   1. a per-layer displacement filter (organic wobble on every stroke)
 *   2. <R> double-stroking — every important silhouette is drawn twice with a
 *      small offset, the way you press over a line you like
 *   3. overshoot + construction lines left in the drawing on purpose
 *
 * Ten stations sit on a 3960-unit board, one per rental department, spaced to
 * match the camera stops in StudioHero.
 */

export const SCENE_W = 3960
export const SCENE_H = 420
/** camera targets; [0] is the wide-shot centre, [1..10] are the stations */
export const STATION_X = [1440, 540, 900, 1260, 1620, 1980, 2340, 2700, 3060, 3420, 3780]

const INK = '#3d382f'
const INK_SOFT = '#7d766a'
const MARKER = '#ff6b2c'

/* ---------------- sketch primitives ---------------- */

/** rough double-stroked path: the confident line plus its searching twin */
function R({ d, w = 2.6, o = 1, dx = 1.6, dy = 1.3 }: { d: string; w?: number; o?: number; dx?: number; dy?: number }) {
  return (
    <>
      <path d={d} strokeWidth={w} opacity={o} />
      <path d={d} strokeWidth={w * 0.62} opacity={o * 0.4} transform={`translate(${dx} ${dy})`} />
    </>
  )
}

/** construction line — the light guide stroke a sketch is built on */
function G({ d }: { d: string }) {
  return <path d={d} strokeWidth="1.3" opacity="0.26" />
}

/** hand-drawn ellipse-ish ground shadow, scribbled not filled */
function Shadow({ x, y, w, h = 12 }: { x: number; y: number; w: number; h?: number }) {
  return (
    <>
      <ellipse cx={x} cy={y} rx={w / 2} ry={h / 2} fill="url(#sb-hatch)" stroke="none" opacity="0.75" />
      <path d={`M${x - w / 2} ${y} q ${w / 4} ${h / 2} ${w / 2} 0 t ${w / 2} 0`} strokeWidth="1.4" opacity="0.4" />
    </>
  )
}

function Note({ x, y, children, r = -2, s = 17 }: { x: number; y: number; children: ReactNode; r?: number; s?: number }) {
  return (
    <text
      x={x}
      y={y}
      transform={`rotate(${r} ${x} ${y})`}
      fill={INK_SOFT}
      fontSize={s}
      fontWeight="700"
      fontStyle="italic"
      letterSpacing="2.5"
      stroke="none"
    >
      {children}
    </text>
  )
}

function PanArrow({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g opacity="0.7">
      <path d={`M${x} ${y} q 46 -15 92 -1`} strokeWidth="2" />
      <path d={`M${x + 80} ${y - 11} l 14 10 -17 5`} strokeWidth="2" />
      <Note x={x + 4} y={y - 17} s={15}>{label}</Note>
    </g>
  )
}

/** coiled cable on the floor — the detail that makes a set feel lived-in */
function Cable({ x, y, w = 90 }: { x: number; y: number; w?: number }) {
  return (
    <g strokeWidth="1.8" opacity="0.62">
      <path d={`M${x} ${y} q ${w * 0.18} -13 ${w * 0.36} 0 t ${w * 0.36} 0 t ${w * 0.36} -2`} />
      <path d={`M${x + 6} ${y + 5} q ${w * 0.18} -12 ${w * 0.36} 0 t ${w * 0.36} 1`} opacity="0.6" />
    </g>
  )
}

/** stacked apple boxes */
function AppleBox({ x, y, w = 52, h = 26 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <>
      <R d={`M${x} ${y} h ${w} v ${h} h ${-w} z`} w={2.2} />
      <G d={`M${x + 6} ${y + h / 2} h ${w - 12}`} />
      <path d={`M${x + w * 0.3} ${y + 6} h ${w * 0.4}`} strokeWidth="1.5" opacity="0.45" />
    </>
  )
}

function Sandbag({ x, y }: { x: number; y: number }) {
  return (
    <>
      <R d={`M${x - 20} ${y} q -6 -16 8 -18 q 12 -2 12 0 q 14 2 8 18 q -14 5 -28 0 z`} w={2.2} />
      <path d={`M${x} ${y - 18} v -6`} strokeWidth="1.6" opacity="0.6" />
    </>
  )
}

/** iris: blade edges sweeping from the barrel wall to the opening */
const IRIS = Array.from({ length: 9 }, (_, i) => {
  const a = (i * 2 * Math.PI) / 9
  const b = a + 0.78
  const R = 46
  const r = 20
  return `M${(R * Math.cos(a)).toFixed(1)} ${(R * Math.sin(a)).toFixed(1)} L${(r * Math.cos(b)).toFixed(1)} ${(r * Math.sin(b)).toFixed(1)}`
})
const IRIS_OPENING = Array.from({ length: 9 }, (_, i) => {
  const b = (i * 2 * Math.PI) / 9 + 0.78
  const r = 20
  return `${i === 0 ? 'M' : 'L'}${(r * Math.cos(b)).toFixed(1)} ${(r * Math.sin(b)).toFixed(1)}`
}).join(' ') + ' Z'

/* ---------------- technical-drawing toolkit ---------------- */

/** dense parallel-line shading clipped to a shape — the workhorse of the style */
function Shade({
  id, d, x, y, w, h, gap = 5, o = 0.5, sw = 1, dir = 1,
}: { id: string; d: string; x: number; y: number; w: number; h: number; gap?: number; o?: number; sw?: number; dir?: 1 | -1 }) {
  const n = Math.ceil((w + h) / gap) + 2
  return (
    <>
      <clipPath id={id}>
        <path d={d} />
      </clipPath>
      <g clipPath={`url(#${id})`} strokeWidth={sw} opacity={o}>
        {Array.from({ length: n }, (_, i) => {
          const off = x - h + i * gap
          return dir === 1
            ? <path key={i} d={`M${off} ${y + h} L${off + h} ${y}`} />
            : <path key={i} d={`M${off} ${y} L${off + h} ${y + h}`} />
        })}
      </g>
    </>
  )
}

/** knurled grip band: many short ticks, the way a focus ring is drawn */
function Knurl({ x, y, w, h, gap = 4.5, o = 0.7 }: { x: number; y: number; w: number; h: number; gap?: number; o?: number }) {
  return (
    <g strokeWidth="1.2" opacity={o}>
      {Array.from({ length: Math.max(1, Math.floor(w / gap)) }, (_, i) => (
        <path key={i} d={`M${x + i * gap} ${y} V ${y + h}`} />
      ))}
    </g>
  )
}

/** solid ink mass — barrel interiors, reel centres, shadow sides */
function Solid({ d, o = 0.72 }: { d: string; o?: number }) {
  return <path d={d} fill={INK} stroke="none" opacity={o} />
}

/* ---------------- defs ---------------- */

export function SceneDefs() {
  return (
    <defs>
      <filter id="sb-pencil" x="-3%" y="-6%" width="106%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="11" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="2.1" />
      </filter>
      <filter id="sb-pencil2" x="-3%" y="-6%" width="106%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.026" numOctaves="2" seed="29" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" />
      </filter>
      <pattern id="sb-hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(34)">
        <line x1="0" y1="0" x2="0" y2="7" stroke={INK} strokeWidth="1.1" opacity="0.3" />
      </pattern>
      <pattern id="sb-hatch2" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(-28)">
        <line x1="0" y1="0" x2="0" y2="9" stroke={INK} strokeWidth="1" opacity="0.22" />
      </pattern>
      <pattern id="sb-cross" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(18)">
        <line x1="0" y1="0" x2="0" y2="8" stroke={INK} strokeWidth="0.9" opacity="0.24" />
        <line x1="0" y1="0" x2="8" y2="0" stroke={INK} strokeWidth="0.9" opacity="0.18" />
      </pattern>
    </defs>
  )
}

/* ---------------- background layer ---------------- */

export function SceneBackground() {
  const truss = Array.from({ length: 27 }, (_, i) => -180 + i * 160)
  const fixtures = Array.from({ length: 14 }, (_, i) => 120 + i * 300)
  return (
    <g filter="url(#sb-pencil2)" stroke={INK_SOFT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* ── ceiling: truss with cross-bracing, running the full board ── */}
      <path d={`M-240 22 H ${SCENE_W + 240} M-240 44 H ${SCENE_W + 240} M-240 74 H ${SCENE_W + 240}`} opacity="0.7" />
      {truss.map((x) => (
        <g key={x} opacity="0.5">
          <path d={`M${x} 22 L ${x + 80} 44 M${x + 80} 22 L ${x} 44`} strokeWidth="1.5" />
          <path d={`M${x} 22 V 44`} strokeWidth="1.6" />
        </g>
      ))}
      {/* hanging conduit + safety chains between the two rails */}
      {truss.filter((_, i) => i % 2 === 0).map((x) => (
        <path key={`c${x}`} d={`M${x + 40} 44 q 6 16 0 30`} opacity="0.32" strokeWidth="1.4" />
      ))}
      {/* HVAC duct run */}
      <g opacity="0.4">
        <path d="M-240 88 H 900 M-240 118 H 900" strokeWidth="1.8" />
        {Array.from({ length: 8 }, (_, i) => -160 + i * 140).map((x) => <path key={x} d={`M${x} 88 V 118`} strokeWidth="1.4" />)}
        <path d="M2500 84 H 3960 M2500 112 H 3960" strokeWidth="1.8" />
        {Array.from({ length: 10 }, (_, i) => 2560 + i * 140).map((x) => <path key={x} d={`M${x} 84 V 112`} strokeWidth="1.4" />)}
      </g>

      {/* ── hanging fixtures every ~300 units, alternating types ── */}
      {fixtures.map((x, i) => (
        <g key={x} transform={`translate(${x} 0)`} opacity={i % 3 === 1 ? 0.72 : 0.92}>
          <path d="M0 74 v 22" />
          <path d="M-4 74 v 22" opacity="0.4" />
          {i % 3 === 0 ? (
            <>
              {/* fresnel with barn doors */}
              <R d="M-17 96 h 34 l -6 32 h -22 z" w={2.1} o={0.9} />
              <path d="M-19 94 l -13 -15 M19 94 l 13 -15 M-13 92 l -7 -17 M13 92 l 7 -17" opacity="0.6" />
              <path d={`M-11 128 l -18 36 M11 128 l 18 36`} opacity="0.26" />
            </>
          ) : i % 3 === 1 ? (
            <>
              {/* soft panel */}
              <R d="M-24 96 h 48 v 26 h -48 z" w={2} o={0.85} />
              <path d="M-24 104 h 48 M-24 114 h 48" opacity="0.4" strokeWidth="1.4" />
              <path d="M-20 122 l -12 30 M20 122 l 12 30" opacity="0.22" />
            </>
          ) : (
            <>
              {/* space light / china ball */}
              <path d="M0 96 a 20 20 0 1 0 0.1 0" strokeWidth="2.1" />
              <path d="M-18 104 q 18 10 36 0 M-14 92 q 14 -8 28 0" opacity="0.4" strokeWidth="1.4" />
            </>
          )}
        </g>
      ))}

      {/* ── walls: windows, conduit runs, boards, signage ── */}
      <R d={`M-240 306 Q 900 300 2000 307 T ${SCENE_W + 240} 305`} w={2} o={0.85} />
      {/* conduit along the wall */}
      <path d={`M-240 176 H ${SCENE_W + 240}`} opacity="0.28" strokeWidth="1.5" />
      {Array.from({ length: 20 }, (_, i) => -100 + i * 210).map((x) => (
        <path key={`cl${x}`} d={`M${x} 172 v 8`} opacity="0.3" strokeWidth="1.4" />
      ))}

      {[{ x: 1030, w: 370, h: 172 }, { x: 2860, w: 310, h: 158 }].map(({ x, w, h }) => (
        <g key={x}>
          <R d={`M${x} 92 h ${w} v ${h} h ${-w} z`} w={2} o={0.85} />
          {[0.25, 0.5, 0.75].map((f) => <path key={f} d={`M${x + w * f} 92 V ${92 + h}`} opacity="0.6" />)}
          <path d={`M${x} ${92 + h / 2} H ${x + w}`} opacity="0.6" />
          <path d={`M${x + 30} ${92 + h} L ${x - 80} 306 M${x + w - 30} ${92 + h} L ${x + w + 92} 306`} opacity="0.3" />
          <path d={`M${x + 30} ${92 + h} L ${x - 80} 306 L ${x + w + 92} 306 L ${x + w - 30} ${92 + h} z`} fill="url(#sb-cross)" stroke="none" opacity="0.38" />
        </g>
      ))}

      {/* stencils, boards, signage spread across the whole wall */}
      <Note x={286} y={158} r={0}>STAGE 2</Note>
      <R d="M470 122 h 74 v 40 h -74 z" w={1.8} o={0.6} />
      <path d="M480 136 h 54 M480 148 h 38" opacity="0.45" />
      <Note x={1560} y={150} r={0} s={15}>NO SMOKING</Note>
      <R d="M2020 118 h 58 v 34 h -58 z" w={1.7} o={0.5} />
      <path d="M2030 130 h 38 M2030 142 h 24" opacity="0.4" />
      <Note x={2420} y={146} r={0} s={15}>EXIT</Note>
      <path d="M2404 152 h 66" opacity="0.4" strokeWidth="1.6" />
      <R d="M3480 112 h 96 v 62 h -96 z" w={1.8} o={0.55} />
      <path d="M3492 130 h 70 M3492 144 h 70 M3492 158 h 44" opacity="0.42" />
      <Note x={3470} y={102} r={0} s={15}>CALL SHEET</Note>
      {/* wall clock */}
      <circle cx="1700" cy="136" r="26" opacity="0.6" />
      <path d="M1700 136 V 118 M1700 136 l 12 8" opacity="0.6" />
      {[0, 90, 180, 270].map((a) => (
        <path key={a} d={`M${1700 + 22 * Math.cos((a * Math.PI) / 180)} ${136 + 22 * Math.sin((a * Math.PI) / 180)} l ${3 * Math.cos((a * Math.PI) / 180)} ${3 * Math.sin((a * Math.PI) / 180)}`} opacity="0.5" strokeWidth="1.6" />
      ))}

      {/* leaning ladder */}
      <g opacity="0.7">
        <path d="M2180 306 L 2216 130 M2210 306 L 2246 130" />
        {[0.15, 0.32, 0.49, 0.66, 0.83].map((f) => (
          <path key={f} d={`M${2180 + 36 * f} ${306 - 176 * f} L ${2210 + 36 * f} ${306 - 176 * f}`} strokeWidth="1.6" />
        ))}
      </g>

      {/* shelving + stacked road cases along the back wall */}
      {[760, 3180].map((x) => (
        <g key={x} opacity="0.5">
          <R d={`M${x} 240 h 120 v 66 h -120 z`} w={1.8} />
          <R d={`M${x + 16} 196 h 88 v 44 h -88 z`} w={1.8} />
          <path d={`M${x} 272 h 120 M${x + 16} 218 h 88`} opacity="0.6" />
          <path d={`M${x + 40} 240 v 66 M${x + 80} 240 v 66`} opacity="0.35" strokeWidth="1.4" />
        </g>
      ))}
      <g opacity="0.45">
        <R d="M1840 250 h 96 v 56 h -96 z" w={1.7} />
        <path d="M1840 278 h 96 M1888 250 v 56" opacity="0.55" />
      </g>
    </g>
  )
}

/* ---------------- stations layer ---------------- */

/*
 * The stations are the real hand-drawn artwork, extracted from the sketch
 * sheets as ink-baked PNGs rather than redrawn in SVG. Each keeps its drawn
 * aspect ratio and is bottom-aligned to the floor line, so objects stand on
 * the set instead of floating. Heights are per-object on purpose: a light
 * stand should tower over a lens case.
 */
const FLOOR = 386

const STATION_ART = [
  { id: 'cameras', aspect: 1.246, h: 252 },
  { id: 'lenses', aspect: 1.143, h: 168 },
  { id: 'lighting', aspect: 0.609, h: 292 },
  { id: 'audio', aspect: 0.921, h: 246 },
  { id: 'grip', aspect: 0.844, h: 286 },
  { id: 'drones', aspect: 1.769, h: 156 },
  { id: 'transport', aspect: 1.595, h: 198 },
  { id: 'studios', aspect: 1.469, h: 212 },
  { id: 'props', aspect: 1.219, h: 196 },
  { id: 'crew', aspect: 1.0, h: 208 },
]

export function SceneStations() {
  return (
    <g>
      {/* pencil-filtered line work: the set itself, not the gear */}
      <g filter="url(#sb-pencil)" stroke={INK} strokeWidth="2.7" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <PanArrow x={700} y={110} label="PAN" />
        <PanArrow x={1780} y={112} label="DOLLY IN" />
        <PanArrow x={2860} y={108} label="PAN" />
        <R d={`M-240 386 Q 1200 380 2400 386 T ${SCENE_W + 240} 384`} w={2.2} o={0.7} />
        {STATION_ART.map((s, i) => (
          <Shadow key={s.id} x={STATION_X[i + 1]} y={FLOOR} w={s.h * s.aspect * 0.86} />
        ))}
      </g>

      {/* the drawings themselves stay outside the displacement filter — they
          already have the hand's wobble in them, and smearing a scan reads as
          a rendering fault rather than as pencil */}
      {STATION_ART.map((s, i) => {
        const w = s.h * s.aspect
        return (
          <image
            key={s.id}
            href={`${import.meta.env.BASE_URL}scene/${s.id}.png`}
            x={STATION_X[i + 1] - w / 2}
            y={FLOOR - s.h}
            width={w}
            height={s.h}
          />
        )
      })}
    </g>
  )
}
