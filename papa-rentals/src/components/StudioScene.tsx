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

const INK = '#413b33'
const INK_SOFT = '#8a8378'
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

/** engineering dimension line with end ticks and a pencilled figure */
function Dim({ x1, y1, x2, y2, label, up = true }: { x1: number; y1: number; x2: number; y2: number; label: string; up?: boolean }) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <g strokeWidth="1.2" opacity="0.5">
      <path d={`M${x1} ${y1} L ${x2} ${y2}`} />
      <path d={`M${x1} ${y1 - 6} V ${y1 + 6} M${x2} ${y2 - 6} V ${y2 + 6}`} />
      <text x={mx} y={up ? my - 6 : my + 14} fill={INK_SOFT} fontSize="12" fontWeight="600" letterSpacing="1" textAnchor="middle" stroke="none">
        {label}
      </text>
    </g>
  )
}

/** leader line pointing at a part, with its callout */
function Callout({ x, y, tx, ty, label }: { x: number; y: number; tx: number; ty: number; label: string }) {
  return (
    <g strokeWidth="1.2" opacity="0.5">
      <path d={`M${x} ${y} L ${tx} ${ty}`} />
      <circle cx={x} cy={y} r="2.4" fill={INK_SOFT} stroke="none" />
      <path d={`M${tx} ${ty} h ${tx > x ? 26 : -26}`} />
      <text
        x={tx > x ? tx + 30 : tx - 30}
        y={ty + 4}
        fill={INK_SOFT}
        fontSize="12.5"
        fontWeight="700"
        letterSpacing="1.2"
        textAnchor={tx > x ? 'start' : 'end'}
        stroke="none"
      >
        {label}
      </text>
    </g>
  )
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
    <g filter="url(#sb-pencil)" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* floor, with tape marks and a long stinger running the length of the set */}
      <R d={`M-240 386 Q 1200 380 2400 386 T ${SCENE_W + 240} 384`} w={2} o={0.7} />
      <g opacity="0.35" strokeWidth="2.4">
        {[430, 1150, 2160, 2960, 3660].map((x) => (
          <path key={x} d={`M${x} 392 l 26 -7 M${x + 8} 400 l 26 -7`} />
        ))}
      </g>

      <PanArrow x={666} y={104} label="PAN" />
      <PanArrow x={1746} y={108} label="DOLLY IN" />
      <PanArrow x={2826} y={102} label="PAN" />

      {/* ── 1 · CAMERAS ────────────────────────────────── */}
      <g transform="translate(540 53) scale(0.86)">
        <Shadow x={-30} y={378} w={300} />

        {/* ---- tripod ---- */}
        <R d="M14 292 L -70 378 M14 292 L 96 378 M16 292 L 22 372" w={2.4} />
        <path d="M-38 344 L 16 322 M62 342 L 16 322" strokeWidth="1.8" opacity="0.5" />
        <path d="M-74 380 l -10 5 M100 380 l 10 5 M22 374 l 0 8" opacity="0.65" />
        <R d="M-6 276 h 44 v 18 h -44 z" w={2.2} />
        <path d="M38 282 q 26 6 34 26" strokeWidth="2.2" />
        <path d="M70 306 q 6 8 2 14" strokeWidth="1.8" opacity="0.7" />

        {/* ---- lens barrel ---- */}
        <R d="M-178 178 L -46 188" w={2.6} />
        <R d="M-178 288 L -46 280" w={2.6} />
        {/* ring bands, each a curved face with knurling */}
        {[
          { x: -158, w: 22 }, { x: -128, w: 26 }, { x: -94, w: 20 }, { x: -68, w: 16 },
        ].map((b, i) => (
          <g key={b.x}>
            <path d={`M${b.x} ${180 + i * 2} q -9 54 0 108`} strokeWidth="2.1" opacity="0.85" />
            <path d={`M${b.x + b.w} ${181 + i * 2} q -9 53 0 106`} strokeWidth="2.1" opacity="0.85" />
            <Knurl x={b.x + 3} y={196 + i * 3} w={b.w - 6} h={76} gap={4} o={0.5} />
          </g>
        ))}
        {/* focus scale marks on the widest band */}
        <path d="M-126 196 h 22 M-126 206 h 14 M-126 216 h 20 M-126 226 h 12" strokeWidth="1.3" opacity="0.55" />
        {/* front element: concentric rings + glass */}
        <ellipse cx="-178" cy="233" rx="18" ry="57" strokeWidth="2.8" />
        <ellipse cx="-176" cy="233" rx="14" ry="47" strokeWidth="2" opacity="0.85" />
        <ellipse cx="-174" cy="233" rx="10" ry="37" strokeWidth="1.8" opacity="0.7" />
        <ellipse cx="-172" cy="233" rx="6" ry="25" strokeWidth="1.6" opacity="0.55" />
        {/* glass reflection arcs */}
        <path d="M-178 208 q 8 24 0 48" strokeWidth="1.4" opacity="0.4" />
        <path d="M-183 214 q 6 19 0 38" strokeWidth="1.2" opacity="0.3" />
        {/* barrel underside shading */}
        <Shade id="sh-cam-barrel" d="M-178 262 L -46 258 L -46 280 L -178 288 z" x={-186} y={252} w={148} h={40} gap={4.5} o={0.45} />
        {/* mount ring */}
        <path d="M-46 188 q -9 46 0 92" strokeWidth="2.6" />
        <path d="M-40 192 q -8 42 0 84" strokeWidth="1.6" opacity="0.5" />

        {/* ---- body ---- */}
        <R d="M-46 184 h 128 q 12 0 12 12 v 82 q 0 12 -12 12 h -128 q -6 0 -6 -8 v -90 q 0 -8 6 -8 z" w={2.9} />
        <Shade id="sh-cam-body" d="M40 184 h 42 q 12 0 12 12 v 82 q 0 12 -12 12 h -42 z" x={34} y={180} w={66} h={112} gap={5} o={0.4} />
        {/* pentaprism hump + hot shoe */}
        <R d="M-14 184 L 12 140 h 44 l 22 44" w={2.7} />
        <Shade id="sh-cam-hump" d="M40 152 L 56 140 L 78 184 L 44 184 z" x={36} y={136} w={48} h={52} gap={4.5} o={0.4} />
        <R d="M16 132 h 34 v 10 h -34 z" w={2.2} />
        <path d="M20 132 v -5 M46 132 v -5" strokeWidth="1.6" opacity="0.6" />
        {/* mode dial, knurled rim */}
        <ellipse cx="96" cy="164" rx="24" ry="11" strokeWidth="2.5" />
        <path d="M72 164 v 14 q 24 12 48 0 v -14" strokeWidth="2.4" />
        <Knurl x={74} y={166} w={44} h={16} gap={4} o={0.55} />
        <ellipse cx="96" cy="162" rx="15" ry="6.5" strokeWidth="1.6" opacity="0.6" />
        <path d="M96 156 v 4" strokeWidth="2" opacity="0.8" />
        {/* shutter button + top buttons */}
        <ellipse cx="-16" cy="176" rx="11" ry="5.5" strokeWidth="2.2" />
        <ellipse cx="-16" cy="174" rx="6" ry="3" strokeWidth="1.5" opacity="0.6" />
        <ellipse cx="-38" cy="180" rx="7" ry="3.5" strokeWidth="1.7" opacity="0.7" />
        {/* grip */}
        <R d="M94 196 q 34 10 32 48 q -2 36 -32 44" w={2.7} />
        <Shade id="sh-cam-grip" d="M94 196 q 34 10 32 48 q -2 36 -32 44 z" x={90} y={192} w={44} h={100} gap={4} o={0.5} />
        {/* rear detail: screen edge, buttons, strap lugs */}
        <path d="M82 200 v 74" strokeWidth="1.8" opacity="0.5" />
        <circle cx="70" cy="214" r="4.5" strokeWidth="1.7" opacity="0.7" />
        <circle cx="70" cy="232" r="4.5" strokeWidth="1.7" opacity="0.7" />
        <path d="M-46 196 l -12 -8 q -8 -6 0 -12" strokeWidth="2" opacity="0.75" />
        <path d="M88 190 l 10 -8 q 8 -6 0 -12" strokeWidth="2" opacity="0.75" />
        {/* media door seam */}
        <path d="M-30 226 h 60" strokeWidth="1.5" opacity="0.4" />
        <path d="M-30 226 v 46" strokeWidth="1.5" opacity="0.35" />

        {/* ---- engineering annotation ---- */}
        <Dim x1={-196} y1={318} x2={128} y2={318} label="A-CAM · 4.5K LF" />
        <Dim x1={-214} y1={176} x2={-214} y2={290} label="Ø114" up={false} />
        <Callout x={-172} y={233} tx={-206} ty={150} label="GLASS" />
        <Callout x={96} y={158} tx={142} ty={130} label="MODE" />
        <Callout x={33} y={136} tx={74} ty={104} label="SHOE" />
        <G d="M-236 233 H -196" />
        <G d="M-178 96 V 168" />
      </g>

      {/* ── 2 · LENSES ─────────────────────────────────── */}
      <g transform="translate(900 60) scale(0.84)">
        <Shadow x={0} y={372} w={300} />

        {/* trestle table the set is laid out on */}
        <R d="M-190 322 h 380 v 14 h -380 z" w={2.4} />
        <R d="M-172 336 L -160 380 M172 336 L 160 380" w={2.2} />
        <path d="M-160 358 H 160" strokeWidth="1.8" opacity="0.45" />

        {/* ---- hero prime, 3/4, iris open ---- */}
        {/* barrel walls */}
        <R d="M-96 176 L 62 194" w={2.8} />
        <R d="M-96 322 L 62 306" w={2.8} />
        {/* knurled focus ring */}
        <path d="M-52 184 q -11 68 0 134" strokeWidth="2.3" />
        <path d="M-8 189 q -11 66 0 128" strokeWidth="2.3" />
        <Knurl x={-48} y={200} w={38} h={100} gap={3.6} o={0.55} />
        {/* aperture ring with f-stops */}
        <path d="M16 192 q -10 60 0 118" strokeWidth="2.2" />
        <path d="M46 194 q -10 58 0 114" strokeWidth="2.2" />
        <path d="M20 214 h 22 M20 232 h 14 M20 250 h 22 M20 268 h 14 M20 286 h 20" strokeWidth="1.3" opacity="0.6" />
        <text x={24} y={206} fill={INK_SOFT} fontSize="11" fontWeight="700" stroke="none" letterSpacing="1">2 4 8 16</text>
        {/* barrel shading underneath */}
        <Shade id="sh-len-barrel" d="M-96 288 L 62 280 L 62 306 L -96 322 z" x={-104} y={276} w={174} h={52} gap={4.5} o={0.45} />
        {/* rear mount + contacts */}
        <path d="M62 194 q -10 56 0 112" strokeWidth="2.6" />
        <path d="M70 200 q -8 50 0 100" strokeWidth="1.7" opacity="0.55" />
        {[214, 228, 242, 256].map((y) => <path key={y} d={`M64 ${y} h 8`} strokeWidth="1.6" opacity="0.6" />)}

        {/* front element: rings then the iris */}
        <ellipse cx="-96" cy="249" rx="26" ry="73" strokeWidth="2.9" />
        <ellipse cx="-94" cy="249" rx="21" ry="62" strokeWidth="2.1" opacity="0.85" />
        <ellipse cx="-92" cy="249" rx="17" ry="52" strokeWidth="1.8" opacity="0.7" />
        <g transform="translate(-92 249) scale(0.36 1)" strokeWidth="4.4" opacity="0.75">
          {IRIS.map((d, i) => <path key={i} d={d} />)}
        </g>
        <g transform="translate(-92 249) scale(0.36 1)">
          <path d={IRIS_OPENING} strokeWidth="4" opacity="0.9" />
        </g>
        {/* glass highlight */}
        <path d="M-104 214 q 9 34 0 68" strokeWidth="1.5" opacity="0.35" />

        {/* ---- the rest of the set, standing in the open case ---- */}
        <R d="M96 214 h 150 v 108 h -150 z" w={2.5} />
        <path d="M96 214 l -16 -34 h 150 l 16 34" strokeWidth="2.2" opacity="0.7" />
        <path d="M96 250 h 150" strokeWidth="1.7" opacity="0.45" />
        <Shade id="sh-len-case" d="M96 250 h 150 v 72 h -150 z" x={92} y={246} w={158} h={80} gap={5.5} o={0.3} />
        {[124, 162, 200, 238].map((cx, i) => (
          <g key={cx}>
            <R d={`M${cx - 15} ${236 + i} h 30 v 78 h -30 z`} w={2.1} o={0.9} />
            <ellipse cx={cx} cy={236 + i} rx="15" ry="6" strokeWidth="2" />
            <ellipse cx={cx} cy={236 + i} rx="9" ry="3.6" strokeWidth="1.5" opacity="0.6" />
            <Knurl x={cx - 12} y={258 + i} w={24} h={22} gap={3.4} o={0.45} />
            <path d={`M${cx - 15} ${290 + i} h 30`} strokeWidth="1.5" opacity="0.5" />
          </g>
        ))}
        {/* caps + cloth on the bench */}
        <ellipse cx="-176" cy="316" rx="20" ry="8" strokeWidth="2.1" opacity="0.8" />
        <ellipse cx="-176" cy="312" rx="20" ry="8" strokeWidth="2.1" />
        <ellipse cx="-140" cy="318" rx="15" ry="6" strokeWidth="1.9" opacity="0.65" />
        <path d="M266 306 q 26 -14 48 -2 q -8 16 -28 16 q -18 0 -20 -14 z" strokeWidth="2" opacity="0.65" />

        {/* ---- annotation ---- */}
        <Dim x1={-122} y1={352} x2={78} y2={352} label="PL · T2.0" />
        <Callout x={-92} y={249} tx={-150} ty={150} label="IRIS" />
        <Callout x={-30} y={196} tx={20} ty={140} label="FOCUS" />
        <G d="M-96 122 V 168" />
      </g>

      {/* ── 3 · LIGHTING ───────────────────────────────── */}
      <g transform="translate(1260 0)">
        <Shadow x={-10} y={380} w={280} />
        {/* beam cone, hatched */}
        <path d="M-28 176 L -168 380 L 84 380 L 20 192 z" fill="url(#sb-cross)" stroke="none" opacity="0.55" />
        <path d="M-28 176 L -168 380 M20 192 L 84 380" opacity="0.34" strokeWidth="1.8" />
        {/* c-stand: riser, knuckles, legs at different heights */}
        <R d="M26 376 V 164" w={2.6} />
        <path d="M26 300 h 16 M26 250 h -14" opacity="0.5" strokeWidth="1.8" />
        <R d="M26 352 L -18 380 M26 352 L 24 380 M26 352 L 66 378" w={2.3} />
        <circle cx="26" cy="352" r="7" strokeWidth="2" />
        <circle cx="26" cy="238" r="6" strokeWidth="2" opacity="0.8" />
        {/* light head + softbox */}
        <R d="M8 146 h 40 v 30 h -40 z" w={2.6} />
        <path d="M14 152 h 28 M14 164 h 20" opacity="0.45" strokeWidth="1.6" />
        <R d="M8 158 L -52 130 L -52 214 L 8 186 z" w={2.7} />
        <path d="M-52 130 l -16 12 v 60 l 16 12" strokeWidth="2.2" opacity="0.8" />
        <path d="M-40 140 v 62 M-26 148 v 46" opacity="0.32" strokeWidth="1.5" />
        {/* sandbag on the leg */}
        <Sandbag x={4} y={378} />
        {/* tube lights leaning, marker-highlighted */}
        <path d="M104 378 L 138 226 M120 378 L 154 232 M136 378 L 168 240" strokeWidth="5.5" opacity="0.9" />
        <path d="M104 378 L 138 226 M120 378 L 154 232" stroke={MARKER} strokeWidth="1.8" opacity="0.5" />
        {/* gel frame + stinger */}
        <R d="M-150 292 h 54 v 66 h -54 z" w={2.1} o={0.8} />
        <rect x="-146" y="296" width="46" height="58" fill="url(#sb-hatch2)" stroke="none" />
        <Cable x={-140} y={388} w={120} />
        <Note x={-120} y={116} r={-3}>KEY LIGHT</Note>
      </g>

      {/* ── 4 · AUDIO ──────────────────────────────────── */}
      <g transform="translate(1620 0)">
        <Shadow x={-6} y={378} w={240} />
        {/* sound cart */}
        <R d="M-76 232 h 128 q 8 0 8 8 v 106 h -144 v -106 q 0 -8 8 -8 z" w={2.6} />
        <path d="M-84 288 H 60 M-84 320 H 60" opacity="0.55" strokeWidth="1.9" />
        <circle cx="-52" cy="362" r="15" strokeWidth="2.4" />
        <circle cx="-52" cy="362" r="5" opacity="0.5" strokeWidth="1.6" />
        <circle cx="30" cy="362" r="15" strokeWidth="2.4" />
        <circle cx="30" cy="362" r="5" opacity="0.5" strokeWidth="1.6" />
        {/* recorder + fader strip */}
        <R d="M-66 240 h 76 v 40 h -76 z" w={2.3} />
        <rect x="-62" y="244" width="30" height="18" fill="url(#sb-hatch2)" stroke="none" />
        {[-24, -10, 4].map((cx) => (
          <g key={cx}>
            <path d={`M${cx} 250 v 22`} strokeWidth="1.8" opacity="0.6" />
            <path d={`M${cx - 4} ${cx === -10 ? 258 : 264} h 8`} strokeWidth="3" />
          </g>
        ))}
        {[-52, -38, -24].map((cx) => <circle key={cx} cx={cx} cy="272" r="3.6" opacity="0.7" strokeWidth="1.6" />)}
        {/* headphones hanging off the handle */}
        <path d="M64 232 v -14" strokeWidth="2.2" />
        <R d="M52 208 q 24 -22 48 0" w={2.3} />
        <R d="M50 206 v 20 q 0 6 6 6 q 6 0 6 -6 v -20" w={2.1} />
        <R d="M100 206 v 20 q 0 6 -6 6 q -6 0 -6 -6 v -20" w={2.1} />
        {/* boom pole + blimp + windjammer fur */}
        <R d="M-116 380 L 40 172" w={2.8} />
        <path d="M-96 356 h 14 M-60 308 h 14" opacity="0.45" strokeWidth="1.6" />
        <g transform="rotate(-38 56 160)">
          <R d="M26 148 h 62 q 12 0 12 12 t -12 12 h -62 q -12 0 -12 -12 t 12 -12 z" w={2.6} />
          <path d="M26 152 v 20 M44 150 v 24 M62 150 v 24 M80 152 v 20" opacity="0.3" strokeWidth="1.5" />
          {/* fur wisps */}
          {[20, 34, 48, 62, 76, 90].map((x) => (
            <path key={x} d={`M${x} 146 l -3 -8 M${x + 5} 174 l 3 8`} opacity="0.4" strokeWidth="1.4" />
          ))}
        </g>
        <Cable x={64} y={388} w={100} />
        <Note x={-118} y={202} r={-4}>ROLL SOUND</Note>
      </g>

      {/* ── 5 · GRIP ───────────────────────────────────── */}
      <g transform="translate(1980 0)">
        <Shadow x={0} y={382} w={320} />
        {/* track with sleepers */}
        <R d="M-168 356 H 168 M-168 370 H 168" w={2.4} />
        {[-150, -100, -50, 0, 50, 100, 150].map((x) => (
          <path key={x} d={`M${x} 354 V 372`} strokeWidth="2" opacity="0.65" />
        ))}
        {/* dolly body + wheels + seat */}
        <rect x="-70" y="306" width="140" height="32" rx="7" fill="url(#sb-cross)" stroke="none" />
        <R d="M-70 306 h 140 q 7 0 7 7 v 18 q 0 7 -7 7 h -140 q -7 0 -7 -7 v -18 q 0 -7 7 -7 z" w={2.7} />
        <circle cx="-44" cy="350" r="12" strokeWidth="2.4" />
        <circle cx="44" cy="350" r="12" strokeWidth="2.4" />
        {/* column + camera plate */}
        <R d="M52 306 V 226" w={2.6} />
        <R d="M34 214 h 46 v 12 h -46 z" w={2.3} />
        <path d="M52 306 q 0 -20 -10 -30" opacity="0.45" strokeWidth="1.7" />
        {/* operator seat */}
        <R d="M-88 300 h 44 v 10 h -44 z" w={2.2} />
        <R d="M-70 300 v -26 h 26" w={2.1} o={0.8} />
        {/* c-stand with a solid flag */}
        <R d="M-124 376 V 218 M-146 378 L -124 356 L -102 378" w={2.4} />
        <R d="M-186 190 h 76 v 52 h -76 z" w={2.5} />
        <rect x="-182" y="194" width="68" height="44" fill="url(#sb-hatch)" stroke="none" />
        <path d="M-110 214 h 14" strokeWidth="2" opacity="0.6" />
        <Sandbag x={-128} y={378} />
        {/* stacked apple boxes + grip clamps */}
        <AppleBox x={106} y={328} w={62} h={26} />
        <AppleBox x={112} y={302} w={50} h={26} />
        <path d="M150 268 q 14 -10 24 2 q -10 12 -24 -2 z" strokeWidth="2" opacity="0.7" />
        <Note x={-72} y={182} r={-2}>SMOOTH MOVE</Note>
      </g>

      {/* ── 6 · DRONES ─────────────────────────────────── */}
      <g transform="translate(2340 0)">
        <Shadow x={-16} y={378} w={210} />
        {/* open pelican case with foam */}
        <R d="M-96 306 h 148 v 66 h -148 z" w={2.6} />
        <path d="M-96 306 l -12 -46 h 148 l 12 46" strokeWidth="2.3" opacity="0.7" />
        <path d="M-96 334 h 148" opacity="0.5" strokeWidth="1.8" />
        <rect x="-88" y="340" width="132" height="26" fill="url(#sb-cross)" stroke="none" />
        <path d="M-70 372 h 22 M0 372 h 22" opacity="0.4" strokeWidth="1.6" />
        {/* the drone, airborne a touch, with motion ticks */}
        <g transform="translate(0 -16)">
          <rect x="-26" y="262" width="52" height="24" rx="9" fill="url(#sb-hatch2)" stroke="none" />
          <R d="M-26 262 h 52 q 9 0 9 9 v 6 q 0 9 -9 9 h -52 q -9 0 -9 -9 v -6 q 0 -9 9 -9 z" w={2.7} />
          {/* arms */}
          <R d="M-24 268 L -68 244 M24 268 L 68 244 M-24 282 L -64 296 M24 282 L 64 296" w={2.4} />
          {/* motors + spinning props (dashed = motion) */}
          {[[-68, 244], [68, 244], [-64, 296], [64, 296]].map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <R d={`M${x - 5} ${y - 6} h 10 v 10 h -10 z`} w={2} o={0.85} />
              <ellipse cx={x} cy={y - 8} rx="24" ry="5" strokeWidth="1.8" opacity="0.55" strokeDasharray="7 6" />
              <ellipse cx={x} cy={y - 8} rx="16" ry="3.4" strokeWidth="1.4" opacity="0.35" />
            </g>
          ))}
          {/* gimbal camera */}
          <R d="M-9 286 h 18 v 12 h -18 z" w={2.2} />
          <circle cx="0" cy="292" r="5" strokeWidth="1.9" />
          <path d="M-14 286 q -4 8 0 14 M14 286 q 4 8 0 14" opacity="0.5" strokeWidth="1.6" />
        </g>
        {/* controller with sticks */}
        <R d="M84 320 h 62 v 40 h -62 z" w={2.4} />
        <path d="M92 316 h 46 v -18 h -46 z" strokeWidth="2.1" opacity="0.75" />
        <circle cx="98" cy="340" r="6" strokeWidth="2" />
        <circle cx="132" cy="340" r="6" strokeWidth="2" />
        <path d="M98 340 v -8 M132 340 v -8" opacity="0.6" strokeWidth="1.6" />
        {/* landing pad ring */}
        <ellipse cx="-16" cy="376" rx="52" ry="12" strokeWidth="1.9" opacity="0.4" strokeDasharray="9 8" />
        <Note x={-88} y={214} r={-3}>EYES IN THE SKY</Note>
      </g>

      {/* ── 7 · TRANSPORT ──────────────────────────────── */}
      <g transform="translate(2700 0)">
        <Shadow x={30} y={382} w={300} />
        {/* roller dock door */}
        <R d="M-186 156 h 156 v 196 h -156 z" w={2.3} o={0.8} />
        {Array.from({ length: 8 }, (_, i) => 180 + i * 24).map((y) => (
          <path key={y} d={`M-186 ${y} H -30`} opacity="0.4" strokeWidth="1.7" />
        ))}
        <path d="M-160 168 h 104" opacity="0.5" strokeWidth="2" />
        {/* the van, 3/4 */}
        <R d="M-24 346 v -84 q 0 -14 14 -14 h 104 q 18 0 27 14 l 28 38 q 7 9 7 20 v 26 z" w={2.9} />
        <path d="M-24 262 h 118" opacity="0.5" strokeWidth="1.8" />
        {/* cab windows */}
        <R d="M96 264 l 24 32 h -38 v -32 z" w={2.3} />
        <path d="M96 264 v 32" opacity="0.45" strokeWidth="1.6" />
        {/* side panel + door seam + handle */}
        <path d="M-24 318 h 168" opacity="0.4" strokeWidth="1.7" />
        <path d="M40 248 V 346" opacity="0.35" strokeWidth="1.7" />
        <path d="M28 300 h 14" strokeWidth="2.4" opacity="0.7" />
        <rect x="-18" y="270" width="54" height="42" fill="url(#sb-hatch2)" stroke="none" />
        {/* wheels with hubs */}
        <circle cx="6" cy="354" r="18" strokeWidth="2.7" />
        <circle cx="6" cy="354" r="7" strokeWidth="1.8" opacity="0.6" />
        <circle cx="104" cy="354" r="18" strokeWidth="2.7" />
        <circle cx="104" cy="354" r="7" strokeWidth="1.8" opacity="0.6" />
        <path d="M-30 352 h 8 M158 348 h 8" opacity="0.5" strokeWidth="1.8" />
        {/* loading cart with road cases */}
        <R d="M186 320 h 66 v 42 h -66 z" w={2.3} />
        <path d="M186 340 h 66" opacity="0.5" strokeWidth="1.7" />
        <circle cx="200" cy="370" r="8" strokeWidth="2.1" />
        <circle cx="238" cy="370" r="8" strokeWidth="2.1" />
        <R d="M192 286 h 52 v 34 h -52 z" w={2.2} o={0.85} />
        <Note x={-150} y={140} r={-2}>LOAD IN 6AM</Note>
      </g>

      {/* ── 8 · STUDIOS & SPACES ───────────────────────── */}
      <g transform="translate(3060 0)">
        <Shadow x={-30} y={380} w={250} />
        {/* cyc sweep, drawn with a couple of searching curves */}
        <R d="M-140 168 V 300 Q -140 380 -56 380 H 150" w={2.8} />
        <path d="M-124 182 V 302 Q -124 364 -60 364 H 140" opacity="0.4" strokeWidth="1.8" />
        <G d="M-140 300 H 150" />
        {/* seamless paper rolls on a stand */}
        <R d="M40 380 L 70 196 M58 380 L 88 202 M76 380 L 104 210" w={5.5} o={0.9} />
        <circle cx="70" cy="194" r="8" strokeWidth="2.2" />
        <circle cx="88" cy="200" r="8" strokeWidth="2.2" />
        <circle cx="104" cy="208" r="8" strokeWidth="2.2" />
        <path d="M62 210 q 10 6 20 2 M80 216 q 10 6 20 2" opacity="0.4" strokeWidth="1.5" />
        {/* floor tape marks + a stand-in mark */}
        <path d="M-70 366 l 24 -8 M-62 376 l 24 -8" strokeWidth="2.6" opacity="0.45" />
        <ellipse cx="-40" cy="372" rx="30" ry="8" strokeWidth="1.7" opacity="0.35" strokeDasharray="8 7" />
        {/* small ladder + light stand in the corner */}
        <g opacity="0.85">
          <R d="M150 378 V 250 M176 378 V 250" w={2.1} />
          {[262, 290, 318, 346].map((y) => <path key={y} d={`M150 ${y} H 176`} strokeWidth="1.8" opacity="0.7" />)}
        </g>
        <Note x={-124} y={150} r={-3}>THE SPACE</Note>
      </g>

      {/* ── 9 · PROPS & SETS ───────────────────────────── */}
      <g transform="translate(3420 0)">
        <Shadow x={-10} y={376} w={280} />
        {/* rug with fringe */}
        <path d="M-150 366 h 250" strokeWidth="2.2" opacity="0.5" />
        {Array.from({ length: 14 }, (_, i) => -146 + i * 18).map((x) => (
          <path key={x} d={`M${x} 366 v 8`} strokeWidth="1.4" opacity="0.35" />
        ))}
        {/* tufted sofa */}
        <R d="M-104 300 v -38 q 0 -14 14 -14 h 124 q 14 0 14 14 v 38" w={2.7} />
        <path d="M-70 254 v 44 M-24 250 v 48 M22 254 v 44" opacity="0.32" strokeWidth="1.6" />
        <rect x="-116" y="300" width="176" height="44" rx="12" fill="url(#sb-cross)" stroke="none" />
        <R d="M-116 300 h 176 q 12 0 12 12 v 20 q 0 12 -12 12 h -176 q -12 0 -12 -12 v -20 q 0 -12 12 -12 z" w={2.8} />
        {/* arms */}
        <R d="M-116 300 q -18 -6 -18 16 v 28" w={2.4} />
        <R d="M60 300 q 18 -6 18 16 v 28" w={2.4} />
        <path d="M-104 344 v 18 M48 344 v 18" strokeWidth="2.3" />
        {/* cushions */}
        <path d="M-88 292 q 20 -14 42 0 M-38 292 q 20 -14 42 0" opacity="0.4" strokeWidth="1.8" />
        {/* side table with vase + books */}
        <R d="M96 306 h 64 v 8 h -64 z" w={2.3} />
        <R d="M104 314 v 58 M152 314 v 58" w={2.1} />
        <R d="M116 306 q -8 -22 6 -30 q -8 -14 8 -16 q 16 2 8 16 q 14 8 6 30 z" w={2.3} />
        <path d="M124 262 q 6 -14 -2 -20 M130 262 q 10 -10 4 -18" opacity="0.55" strokeWidth="1.6" />
        <R d="M132 300 h 26 v 6 h -26 z" w={1.9} o={0.8} />
        {/* floor lamp with a hatched shade */}
        <R d="M-166 372 V 226 M-186 376 h 40" w={2.5} />
        <R d="M-192 226 h 52 l -10 -40 h -32 z" w={2.6} />
        <rect x="-188" y="192" width="44" height="32" fill="url(#sb-hatch)" stroke="none" />
        <path d="M-176 232 v 10 M-160 232 v 10" opacity="0.35" strokeWidth="1.5" />
        {/* leaning picture frame */}
        <g transform="rotate(-6 190 330)">
          <R d="M170 288 h 44 v 58 h -44 z" w={2.2} />
          <path d="M178 296 h 28 v 42 h -28 z" opacity="0.4" strokeWidth="1.6" />
          <path d="M180 330 l 12 -18 8 12 6 -8" opacity="0.4" strokeWidth="1.5" />
        </g>
        <Note x={-126} y={168} r={-3}>SET DRESSING</Note>
      </g>

      {/* ── 10 · CREW GEAR ─────────────────────────────── */}
      <g transform="translate(3780 0)">
        <Shadow x={-10} y={378} w={280} />
        {/* two director chairs, one angled */}
        {[0, 96].map((ox, i) => (
          <g key={ox} transform={`translate(${-96 + ox} 0) ${i ? 'rotate(4 0 330)' : ''}`}>
            <R d="M0 372 L 52 300 M52 372 L 0 300 M0 300 v -20 M52 300 v -20" w={2.5} />
            <path d="M-4 280 h 60" strokeWidth="5.5" />
            <path d="M0 322 h 52" strokeWidth="4.5" opacity="0.85" />
            <path d="M-2 372 h 12 M42 372 h 12" opacity="0.5" strokeWidth="1.8" />
            <path d="M2 276 q 24 -6 48 0" opacity="0.4" strokeWidth="1.6" />
          </g>
        ))}
        {/* slate resting on the first chair */}
        <g transform="rotate(-10 -60 300)">
          <R d="M-92 268 h 66 v 44 h -66 z" w={2.3} />
          <path d="M-94 276 l 70 -3" strokeWidth="6" opacity="0.8" />
          <path d="M-86 290 h 50 M-86 302 h 32" opacity="0.45" strokeWidth="1.7" />
          <path d="M-94 272 l 8 -10 h 62" opacity="0.5" strokeWidth="1.8" />
        </g>
        {/* toolbox cart with drawers */}
        <R d="M104 286 h 88 v 76 h -88 z" w={2.6} />
        {[308, 330].map((y) => <path key={y} d={`M104 ${y} H 192`} opacity="0.55" strokeWidth="1.9" />)}
        {[297, 319, 341].map((y) => <path key={y} d={`M136 ${y} h 24`} strokeWidth="2.6" opacity="0.7" />)}
        <circle cx="122" cy="372" r="10" strokeWidth="2.3" />
        <circle cx="174" cy="372" r="10" strokeWidth="2.3" />
        {/* walkie chargers + coffee on top */}
        <R d="M112 262 h 20 v 24 h -20 z" w={2} o={0.85} />
        <path d="M118 262 v -10 M126 262 v -14" opacity="0.6" strokeWidth="1.6" />
        <R d="M148 266 h 18 l -3 20 h -12 z" w={2} o={0.85} />
        <path d="M152 262 q 3 -8 8 -2" opacity="0.45" strokeWidth="1.5" />
        <Note x={-92} y={224} r={-2}>VIDEO VILLAGE</Note>
      </g>
    </g>
  )
}
