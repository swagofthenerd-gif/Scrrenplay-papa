import type { ReactNode } from 'react'

/*
 * StudioScene — the storyboard panorama.
 *
 * Checkered storyboard paper with ten boards pinned across it, one per rental
 * department, spaced to match the camera stops in StudioHero. Everything drawn
 * here is frame and annotation; the artwork itself lives in the boards.
 */

export const SCENE_W = 3960
export const SCENE_H = 420
/** camera targets; [0] is the wide-shot centre, [1..10] are the stations */
export const STATION_X = [1440, 540, 900, 1260, 1620, 1980, 2340, 2700, 3060, 3420, 3780]

const INK = '#3d382f'
const INK_SOFT = '#7d766a'

/* ---------------- sketch primitives ---------------- */

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

/* ---------------- defs ---------------- */

export function SceneDefs() {
  return (
    <defs>
      <filter id="sb-pencil" x="-3%" y="-6%" width="106%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="11" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="2.1" />
      </filter>
      {/* checkered storyboard sheet: alternating tinted squares on a ruled grid */}
      <pattern id="sb-check" patternUnits="userSpaceOnUse" width="96" height="96">
        <rect x="0" y="0" width="48" height="48" fill={INK_SOFT} opacity="0.055" />
        <rect x="48" y="48" width="48" height="48" fill={INK_SOFT} opacity="0.055" />
        <path d="M0 0 H96 M0 48 H96 M0 0 V96 M48 0 V96" stroke={INK_SOFT} strokeWidth="0.9" opacity="0.24" fill="none" />
      </pattern>
    </defs>
  )
}

/* ---------------- background layer ---------------- */

/*
 * The set used to be drawn behind the boards — a truss, wall, windows, road
 * cases. With the whole artwork now shown inside each board, that scenery
 * fought the drawings for attention and read as clutter. So the background is
 * just the sheet the boards are pinned to: checkered storyboard paper.
 */
export function SceneBackground() {
  return (
    <g stroke={INK_SOFT} fill="none">
      <rect x={-240} y={-40} width={SCENE_W + 480} height={SCENE_H + 80} fill="url(#sb-check)" stroke="none" />
    </g>
  )
}

/* ---------------- stations layer ---------------- */

/*
 * The stations are the real hand-drawn artwork, each shown whole rather than
 * cut out. A drawing is a picture, not an object, so every station is a
 * storyboard board pinned up on the set: a drawn frame with the complete
 * artwork inside it. That way nothing is ever sliced through, and the
 * rectangle reads as a deliberate panel rather than as a bad crop.
 *
 * The source drawings are all square, so the boards are square and uniform —
 * a wall of boards, which is what a storyboard wall actually looks like.
 */
export const PANEL = 300
export const PANEL_TOP = 52
const PANEL_PAD = 16

/*
 * A hand-pinned board never hangs true. The tilt is derived from the index so
 * it is stable across renders — a random one would jitter on every repaint.
 */
function panelTilt(i: number) {
  const deg = [-1.6, 1.1, -0.7, 1.7, -1.2, 0.8, -1.9, 1.3, -0.9, 1.5][i % 10]
  return `rotate(${deg} ${STATION_X[i + 1]} ${PANEL_TOP + PANEL / 2})`
}

function Pin({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y + 9} r={5} strokeWidth={2.2} />
}

const STATION_ART = [
  { id: 'cameras' }, { id: 'lenses' }, { id: 'lighting' }, { id: 'audio' }, { id: 'grip' },
  { id: 'drones' }, { id: 'transport' }, { id: 'studios' }, { id: 'props' }, { id: 'crew' },
]

export function SceneStations() {
  return (
    <g>
      {/* pencil-filtered line work: the boards and the director's marks */}
      <g filter="url(#sb-pencil)" stroke={INK} strokeWidth="2.7" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <PanArrow x={700} y={392} label="PAN" />
        <PanArrow x={1780} y={394} label="DOLLY IN" />
        <PanArrow x={2860} y={390} label="PAN" />
        {/* the boards' frames: drawn, so they belong in the wobble filter */}
        {STATION_ART.map((s, i) => (
          <g key={s.id} transform={panelTilt(i)}>
            <rect x={STATION_X[i + 1] - PANEL / 2} y={PANEL_TOP} width={PANEL} height={PANEL} rx={3} />
            <rect
              x={STATION_X[i + 1] - PANEL / 2 + 7}
              y={PANEL_TOP + 7}
              width={PANEL - 14}
              height={PANEL - 14}
              rx={2}
              strokeWidth={1.3}
              opacity={0.45}
            />
            <Pin x={STATION_X[i + 1]} y={PANEL_TOP} />
          </g>
        ))}
      </g>

      {/* the drawings themselves stay outside the displacement filter — they
          already have the hand's wobble in them, and smearing a scan reads as
          a rendering fault rather than as pencil. The whole drawing goes in the
          board, uncropped, inset far enough to clear the drawn frame. */}
      {STATION_ART.map((s, i) => (
        <image
          key={s.id}
          href={`${import.meta.env.BASE_URL}scene/${s.id}.webp`}
          x={STATION_X[i + 1] - PANEL / 2 + PANEL_PAD}
          y={PANEL_TOP + PANEL_PAD}
          width={PANEL - PANEL_PAD * 2}
          height={PANEL - PANEL_PAD * 2}
          preserveAspectRatio="xMidYMid meet"
          transform={panelTilt(i)}
        />
      ))}
    </g>
  )
}
