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

const INK = '#2b2721'
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
function Solid({ d, o = 1 }: { d: string; o?: number }) {
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

export function SceneStations() {
  return (
    <g filter="url(#sb-pencil)" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* floor */}
      <R d={`M-240 386 Q 1200 380 2400 386 T ${SCENE_W + 240} 384`} w={2.2} o={0.7} />

      {/* ── 1 · CAMERAS — the classic twin-reel movie camera on sticks ── */}
      <g transform="translate(540 0)">
        <Shadow x={0} y={380} w={280} />
        {/* wooden tripod */}
        <R d="M-6 296 L -78 380 M6 296 L 82 380 M0 300 L 4 374" w={3} />
        <path d="M-46 344 L 0 328 L 50 344" strokeWidth="2.4" opacity="0.7" />
        <path d="M-84 382 l -12 6 M88 382 l 12 6" strokeWidth="2.4" opacity="0.7" />
        {/* pan head */}
        <R d="M-22 286 h 44 v 14 h -44 z" w={2.8} />
        <path d="M22 292 q 30 6 40 30" strokeWidth="2.6" />
        {/* body */}
        <R d="M-58 200 h 116 v 86 h -116 z" w={3.4} />
        <Shade id="sh-cam-b" d="M14 200 h 44 v 86 h -44 z" x={10} y={196} w={52} h={94} gap={5} o={0.55} />
        <path d="M-58 244 h 116" strokeWidth="2.2" opacity="0.5" />
        {/* twin magazines */}
        {[{ cx: -26, cy: 148, r: 48 }, { cx: 40, cy: 158, r: 40 }].map((m, i) => (
          <g key={m.cx}>
            <circle cx={m.cx} cy={m.cy} r={m.r} strokeWidth="3.4" />
            <circle cx={m.cx} cy={m.cy} r={m.r - 11} strokeWidth="2.2" opacity="0.8" />
            <Solid d={`M${m.cx} ${m.cy - 9} a 9 9 0 1 0 0.1 0 z`} />
            {/* spokes */}
            {[0, 60, 120, 180, 240, 300].map((a) => {
              const rad = (a * Math.PI) / 180
              const r0 = 12
              const r1 = m.r - 13
              return (
                <path
                  key={a}
                  d={`M${(m.cx + r0 * Math.cos(rad)).toFixed(1)} ${(m.cy + r0 * Math.sin(rad)).toFixed(1)} L${(m.cx + r1 * Math.cos(rad)).toFixed(1)} ${(m.cy + r1 * Math.sin(rad)).toFixed(1)}`}
                  strokeWidth="2.2"
                  opacity="0.7"
                />
              )
            })}
            <path d={`M${m.cx - m.r} ${m.cy + m.r - 6} q ${m.r} 22 ${m.r * 2} 0`} strokeWidth="2" opacity={i ? 0.4 : 0.6} />
          </g>
        ))}
        {/* lens */}
        <R d="M-58 226 h -46 v 34 h 46" w={3.2} />
        <ellipse cx="-104" cy="243" rx="12" ry="21" strokeWidth="3.2" />
        <Solid d="M-104 230 a 7 13 0 1 0 0.1 0 z" o={0.85} />
        <Knurl x={-96} y={228} w={32} h={30} gap={5} o={0.45} />
        {/* crank + viewfinder */}
        <path d="M58 250 h 20 l 10 18" strokeWidth="2.8" />
        <circle cx="90" cy="272" r="6" strokeWidth="2.4" />
        <R d="M-40 186 h 34 v 14 h -34 z" w={2.6} />
      </g>

      {/* ── 2 · LENSES — prime with the iris open ── */}
      <g transform="translate(900 40) scale(0.9)">
        <Shadow x={0} y={368} w={280} />
        {/* bench */}
        <R d="M-170 320 h 340 v 14 h -340 z" w={2.8} />
        <R d="M-150 334 L -140 380 M150 334 L 140 380" w={2.6} />
        {/* hero lens */}
        <R d="M-86 188 L 60 202" w={3.4} />
        <R d="M-86 312 L 60 298" w={3.4} />
        <Shade id="sh-len-b" d="M-86 278 L 60 272 L 60 298 L -86 312 z" x={-94} y={266} w={162} h={54} gap={5} o={0.5} />
        {/* rings */}
        <path d="M-44 195 q -10 56 0 112" strokeWidth="2.8" />
        <path d="M-4 199 q -10 54 0 106" strokeWidth="2.8" />
        <Knurl x={-40} y={210} w={34} h={86} gap={4} o={0.55} />
        <path d="M22 202 q -9 50 0 98" strokeWidth="2.6" />
        <path d="M22 224 h 20 M22 244 h 13 M22 264 h 20" strokeWidth="1.6" opacity="0.6" />
        {/* mount */}
        <path d="M60 202 q -9 48 0 96" strokeWidth="3" />
        {[216, 230, 244, 258].map((y) => <path key={y} d={`M62 ${y} h 9`} strokeWidth="1.8" opacity="0.6" />)}
        {/* front element + iris */}
        <ellipse cx="-86" cy="250" rx="24" ry="63" strokeWidth="3.4" />
        <ellipse cx="-84" cy="250" rx="19" ry="52" strokeWidth="2.4" opacity="0.85" />
        <Solid d="M-83 250 m -15 0 a 15 42 0 1 0 30 0 a 15 42 0 1 0 -30 0 z" o={0.9} />
        <g transform="translate(-83 250) scale(0.34 1)" stroke="#f6f0e4" strokeWidth="8" opacity="0.85">
          {IRIS.map((d, i) => <path key={i} d={d} />)}
        </g>
        <g transform="translate(-83 250) scale(0.34 1)" stroke="#f6f0e4" strokeWidth="7">
          <path d={IRIS_OPENING} />
        </g>
        {/* the rest of the set standing behind */}
        {[110, 156, 202, 248].map((cx, i) => (
          <g key={cx}>
            <R d={`M${cx - 16} ${232 + i * 2} h 32 v 88 h -32 z`} w={2.8} />
            <ellipse cx={cx} cy={232 + i * 2} rx="16" ry="6.5" strokeWidth="2.6" />
            <Solid d={`M${cx} ${232 + i * 2} m -9 0 a 9 3.6 0 1 0 18 0 a 9 3.6 0 1 0 -18 0 z`} o={0.8} />
            <Knurl x={cx - 13} y={256 + i * 2} w={26} h={26} gap={3.6} o={0.5} />
          </g>
        ))}
      </g>

      {/* ── 3 · LIGHTING — fresnel with barn doors on a stand ── */}
      <g transform="translate(1260 0)">
        <Shadow x={0} y={380} w={260} />
        {/* stand */}
        <R d="M0 372 V 214" w={3.2} />
        <R d="M-58 380 L 0 346 L 58 380" w={3} />
        <path d="M0 346 v 26" strokeWidth="2.6" />
        <circle cx="0" cy="252" r="7" strokeWidth="2.4" />
        <Sandbag x={-40} y={378} />
        {/* head */}
        <R d="M-34 156 h 68 v 62 h -68 z" w={3.4} />
        <Shade id="sh-lit-h" d="M6 156 h 28 v 62 h -28 z" x={2} y={152} w={36} h={70} gap={4.5} o={0.5} />
        <path d="M-20 218 v 10 M20 218 v 10" strokeWidth="2.4" />
        {/* barn doors, splayed */}
        <R d="M-34 156 L -74 116 L -74 176 L -34 190" w={2.8} />
        <R d="M34 156 L 74 116 L 74 176 L 34 190" w={2.8} />
        <R d="M-34 156 L -20 108 h 42 l 12 48" w={2.8} />
        <Shade id="sh-lit-d" d="M-34 156 L -74 116 L -74 176 L -34 190 z" x={-80} y={110} w={52} h={86} gap={5} o={0.4} />
        {/* front lens with concentric fresnel rings */}
        <ellipse cx="0" cy="187" rx="26" ry="26" strokeWidth="2.6" opacity="0.9" />
        <ellipse cx="0" cy="187" rx="17" ry="17" strokeWidth="2" opacity="0.7" />
        <ellipse cx="0" cy="187" rx="8" ry="8" strokeWidth="1.8" opacity="0.6" />
        {/* beam */}
        <path d="M-30 200 L -120 380 M30 200 L 116 380" strokeWidth="2" opacity="0.3" />
        <path d="M-30 200 L -120 380 L 116 380 L 30 200 z" fill="url(#sb-cross)" stroke="none" opacity="0.4" />
        {/* spare tubes leaning */}
        <path d="M104 378 L 132 240 M120 378 L 148 246" strokeWidth="6" opacity="0.85" />
      </g>

      {/* ── 4 · AUDIO — megaphone + boom ── */}
      <g transform="translate(1620 0)">
        <Shadow x={0} y={380} w={270} />
        {/* megaphone cone */}
        <R d="M-110 186 L -110 300 L 30 262 L 30 224 Z" w={3.4} />
        <ellipse cx="-110" cy="243" rx="13" ry="57" strokeWidth="3.4" />
        <Solid d="M-110 243 m -8 0 a 8 46 0 1 0 16 0 a 8 46 0 1 0 -16 0 z" o={0.55} />
        <path d="M-92 206 L -92 288 M-70 214 L -70 280" strokeWidth="1.8" opacity="0.4" />
        {/* body + mouthpiece */}
        <R d="M30 224 h 44 v 38 h -44 z" w={3.2} />
        <Shade id="sh-meg" d="M30 244 h 44 v 18 h -44 z" x={26} y={240} w={52} h={26} gap={4} o={0.5} />
        <R d="M74 232 h 20 v 22 h -20 z" w={2.8} />
        {/* handle */}
        <R d="M40 262 q -6 34 22 34 q 26 0 20 -34" w={3} />
        {/* stand + boom behind */}
        <R d="M120 380 V 210" w={2.8} />
        <R d="M92 380 L 120 352 L 148 380" w={2.6} />
        <R d="M120 210 L 210 168" w={3} />
        <g transform="rotate(-24 220 164)">
          <R d="M196 150 h 54 q 11 0 11 12 t -11 12 h -54 q -11 0 -11 -12 t 11 -12 z" w={3} />
          {[202, 216, 230, 244].map((x) => <path key={x} d={`M${x} 150 v 24`} strokeWidth="1.6" opacity="0.35" />)}
        </g>
        <Cable x={-70} y={388} w={110} />
      </g>

      {/* ── 5 · GRIP — dolly on track, flag on a stand ── */}
      <g transform="translate(1980 0)">
        <Shadow x={0} y={382} w={330} />
        <R d="M-170 356 H 170 M-170 372 H 170" w={2.8} />
        {[-140, -84, -28, 28, 84, 140].map((x) => <path key={x} d={`M${x} 354 V 374`} strokeWidth="2.4" opacity="0.75" />)}
        {/* dolly */}
        <R d="M-74 302 h 148 v 36 h -148 z" w={3.4} />
        <Shade id="sh-gr-d" d="M-74 322 h 148 v 16 h -148 z" x={-78} y={318} w={156} h={24} gap={4.5} o={0.5} />
        <circle cx="-46" cy="350" r="14" strokeWidth="3" />
        <Solid d="M-46 350 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0 z" />
        <circle cx="46" cy="350" r="14" strokeWidth="3" />
        <Solid d="M46 350 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0 z" />
        {/* column + seat */}
        <R d="M54 302 V 224" w={3} />
        <R d="M32 210 h 48 v 14 h -48 z" w={2.8} />
        <R d="M-92 296 h 46 v 12 h -46 z" w={2.6} />
        <R d="M-76 296 v -28 h 28" w={2.6} />
        {/* c-stand + solid flag */}
        <R d="M-128 376 V 214" w={3} />
        <R d="M-158 380 L -128 350 L -98 380" w={2.8} />
        <R d="M-196 182 h 82 v 58 h -82 z" w={3.2} />
        <Shade id="sh-gr-f" d="M-196 182 h 82 v 58 h -82 z" x={-200} y={178} w={90} h={66} gap={4.5} o={0.55} />
        <AppleBox x={106} y={326} w={64} h={28} />
        <AppleBox x={112} y={298} w={52} h={28} />
      </g>

      {/* ── 6 · DRONES ── */}
      <g transform="translate(2340 0)">
        <Shadow x={-10} y={378} w={210} />
        {/* case */}
        <R d="M-100 308 h 152 v 66 h -152 z" w={3.2} />
        <path d="M-100 308 l -12 -44 h 152 l 12 44" strokeWidth="2.8" opacity="0.75" />
        <Shade id="sh-dr-c" d="M-100 338 h 152 v 36 h -152 z" x={-104} y={334} w={160} h={44} gap={5} o={0.4} />
        <path d="M-100 338 h 152" strokeWidth="2.2" opacity="0.55" />
        {/* drone */}
        <g transform="translate(0 -22)">
          <R d="M-30 258 h 60 q 11 0 11 11 v 8 q 0 11 -11 11 h -60 q -11 0 -11 -11 v -8 q 0 -11 11 -11 z" w={3.2} />
          <Shade id="sh-dr-b" d="M-30 276 h 71 v 12 h -71 z" x={-34} y={272} w={80} h={20} gap={4} o={0.5} />
          <R d="M-28 264 L -74 240 M28 264 L 74 240 M-28 282 L -70 296 M28 282 L 70 296" w={2.8} />
          {[[-74, 240], [74, 240], [-70, 296], [70, 296]].map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <R d={`M${x - 6} ${y - 7} h 12 v 12 h -12 z`} w={2.4} />
              <ellipse cx={x} cy={y - 9} rx="27" ry="5" strokeWidth="2.2" opacity="0.6" strokeDasharray="8 7" />
            </g>
          ))}
          <R d="M-11 288 h 22 v 14 h -22 z" w={2.6} />
          <Solid d="M0 295 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0 z" o={0.9} />
        </g>
        {/* controller */}
        <R d="M86 318 h 68 v 44 h -68 z" w={3} />
        <R d="M96 314 h 48 v -22 h -48 z" w={2.6} />
        <circle cx="102" cy="340" r="7" strokeWidth="2.4" />
        <circle cx="138" cy="340" r="7" strokeWidth="2.4" />
      </g>

      {/* ── 7 · TRANSPORT ── */}
      <g transform="translate(2700 0)">
        <Shadow x={30} y={382} w={310} />
        <R d="M-186 156 h 156 v 196 h -156 z" w={2.6} o={0.85} />
        {Array.from({ length: 8 }, (_, i) => 180 + i * 24).map((y) => (
          <path key={y} d={`M-186 ${y} H -30`} strokeWidth="1.8" opacity="0.42" />
        ))}
        <R d="M-24 346 v -86 q 0 -14 14 -14 h 106 q 18 0 27 15 l 28 38 q 7 9 7 20 v 27 z" w={3.6} />
        <Shade id="sh-van" d="M-24 312 h 158 v 34 h -158 z" x={-28} y={308} w={166} h={42} gap={5} o={0.45} />
        <R d="M98 264 l 25 33 h -39 v -33 z" w={2.8} />
        <path d="M42 246 V 346" strokeWidth="2" opacity="0.4" />
        <path d="M28 300 h 16" strokeWidth="3" opacity="0.75" />
        <circle cx="6" cy="354" r="20" strokeWidth="3.4" />
        <Solid d="M6 354 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0 z" />
        <circle cx="106" cy="354" r="20" strokeWidth="3.4" />
        <Solid d="M106 354 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0 z" />
        <R d="M190 318 h 70 v 44 h -70 z" w={2.8} />
        <circle cx="204" cy="370" r="9" strokeWidth="2.4" />
        <circle cx="246" cy="370" r="9" strokeWidth="2.4" />
        <R d="M196 282 h 56 v 36 h -56 z" w={2.6} />
      </g>

      {/* ── 8 · STUDIOS — cyc + seats ── */}
      <g transform="translate(3060 0)">
        <Shadow x={-30} y={380} w={250} />
        <R d="M-150 164 V 300 Q -150 380 -62 380 H 60" w={3.4} />
        <path d="M-132 180 V 302 Q -132 364 -66 364 H 50" strokeWidth="2" opacity="0.4" />
        {/* seat row, from the cinema reference */}
        {[86, 148, 210].map((x, i) => (
          <g key={x}>
            <R d={`M${x} 300 q 0 -46 26 -46 q 26 0 26 46`} w={3} />
            <R d={`M${x - 4} 300 h 60 v 22 h -60 z`} w={3} />
            <Shade id={`sh-st-${i}`} d={`M${x} 258 q 4 -40 26 -40 q 22 0 26 40 z`} x={x - 4} y={214} w={60} h={52} gap={4.5} o={0.45} />
            <path d={`M${x - 4} 322 v 46 M${x + 56} 322 v 46`} strokeWidth="2.6" />
          </g>
        ))}
        {/* paper rolls */}
        <R d="M-96 380 L -66 208 M-78 380 L -48 214" w={6} o={0.9} />
        <circle cx="-66" cy="206" r="9" strokeWidth="2.6" />
        <circle cx="-48" cy="212" r="9" strokeWidth="2.6" />
      </g>

      {/* ── 9 · PROPS — director's chair, lamp, side table ── */}
      <g transform="translate(3420 0)">
        <Shadow x={0} y={378} w={280} />
        {/* director's chair, the icon from the reference */}
        <R d="M-64 374 L 26 292 M26 374 L -64 292 M-64 292 V 250 M26 292 V 250" w={3.4} />
        <R d="M-72 236 h 106 v 20 h -106 z" w={3.2} />
        <Shade id="sh-pr-b" d="M-72 236 h 106 v 20 h -106 z" x={-76} y={232} w={114} h={28} gap={4} o={0.5} />
        <R d="M-64 288 h 90 v 16 h -90 z" w={3.2} />
        <path d="M-70 374 h 16 M16 374 h 16" strokeWidth="2.6" opacity="0.7" />
        <path d="M-64 264 h 90" strokeWidth="2.2" opacity="0.45" />
        {/* floor lamp */}
        <R d="M-166 372 V 224" w={3} />
        <R d="M-192 378 h 52" w={2.8} />
        <R d="M-196 224 h 60 l -12 -46 h -36 z" w={3.2} />
        <Shade id="sh-pr-l" d="M-196 224 h 60 l -12 -46 h -36 z" x={-200} y={174} w={68} h={54} gap={4.5} o={0.5} />
        {/* side table + vase */}
        <R d="M62 300 h 78 v 12 h -78 z" w={3} />
        <R d="M74 312 v 62 M128 312 v 62" w={2.6} />
        <R d="M86 300 q -10 -26 8 -36 q -10 -16 10 -18 q 20 2 10 18 q 18 10 8 36 z" w={3} />
        <Shade id="sh-pr-v" d="M86 300 q -10 -26 8 -36 q -10 -16 10 -18 q 20 2 10 18 q 18 10 8 36 z" x={80} y={242} w={48} h={62} gap={4} o={0.4} />
      </g>

      {/* ── 10 · CREW — clapperboard + reels + toolbox ── */}
      <g transform="translate(3780 0)">
        <Shadow x={0} y={378} w={300} />
        {/* clapperboard, the reference icon */}
        <g transform="rotate(-7 -60 280)">
          <R d="M-136 236 h 150 v 104 h -150 z" w={3.4} />
          <Solid d="M-140 200 l 152 -16 6 30 -152 16 z" o={0.9} />
          {[-116, -80, -44, -8].map((x) => (
            <path key={x} d={`M${x} 186 l 14 30`} stroke="#f6f0e4" strokeWidth="7" />
          ))}
          <path d="M-124 264 h 126 M-124 288 h 126 M-124 312 h 84" strokeWidth="2.2" opacity="0.5" />
        </g>
        {/* film reel */}
        <circle cx="86" cy="280" r="54" strokeWidth="3.4" />
        <circle cx="86" cy="280" r="14" strokeWidth="2.8" />
        <Solid d="M86 280 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0 z" />
        {[0, 72, 144, 216, 288].map((a) => {
          const rad = (a * Math.PI) / 180
          return (
            <circle
              key={a}
              cx={(86 + 32 * Math.cos(rad)).toFixed(1)}
              cy={(280 + 32 * Math.sin(rad)).toFixed(1)}
              r="12"
              strokeWidth="2.6"
            />
          )
        })}
        <path d="M140 280 q 34 6 40 40 q 4 30 -26 40" strokeWidth="3" />
        <path d="M148 292 q 26 8 30 34" strokeWidth="2" opacity="0.5" />
        {/* toolbox cart */}
        <R d="M-236 292 h 84 v 76 h -84 z" w={3} />
        <path d="M-236 316 H -152 M-236 340 H -152" strokeWidth="2.2" opacity="0.55" />
        {[303, 327, 351].map((y) => <path key={y} d={`M-206 ${y} h 24`} strokeWidth="3" opacity="0.7" />)}
        <circle cx="-218" cy="376" r="9" strokeWidth="2.6" />
        <circle cx="-170" cy="376" r="9" strokeWidth="2.6" />
      </g>
    </g>
  )
}
