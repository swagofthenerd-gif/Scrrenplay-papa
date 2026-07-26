import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, ITEMS } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { buzz, dealActive, money } from '../utils'
import { Icon } from './icons'
import { SCENE_W, SCENE_H, STATION_X, SceneDefs, SceneBackground, SceneStations } from './StudioScene'

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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const easeInOut = (t: number) => t * t * (3 - 2 * t)

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
  const wideRef = useRef<HTMLDivElement>(null)
  const artRef = useRef<HTMLDivElement>(null)
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
    const wide = wideRef.current
    const art = artRef.current
    if (!track || !mid || !bg || !spot || !wide || !art) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0

    const render = () => {
      raf = 0
      const W = track.clientWidth
      const H = art.clientHeight // the drawing panel, not the whole stage
      if (!W || !H) return
      const k = H / SCENE_H // scene units -> px at scale 1
      const f = Math.max(0, track.scrollLeft / W)
      const n = STATION_X.length - 1

      // A close-up frames one station (360 units) across the panel; the wide
      // shot pulls back to take in roughly three stations of the set.
      const sClose = 1.24 // the station should command the frame
      const sWide = Math.max(0.62, Math.min(0.9, W / (830 * k)))

      let s: number
      let cx: number // camera target, scene units
      let anchor: number // where the floor line sits in the panel
      if (f <= 1) {
        const t = easeInOut(clamp01(f))
        s = lerp(sWide, sClose, t)
        cx = lerp(STATION_X[0], STATION_X[1], t)
        anchor = lerp(0.93, 0.88, t)
      } else {
        const i = Math.min(n - 1, Math.floor(f))
        const t = easeInOut(clamp01(f - i))
        s = sClose
        cx = lerp(STATION_X[i], STATION_X[Math.min(n, i + 1)], t)
        anchor = 0.88
      }

      const settle = f < 0.5 ? 0 : 1 - Math.min(1, Math.abs(f - Math.round(f)) * 2.2)
      const dolly = reduced ? 1 : 1 + 0.045 * settle
      const FLOOR = 380 // the scene's floor line, kept pinned in frame

      // pin (cx, FLOOR) to (W/2, H*anchor) — origin 0 0 keeps the maths honest
      const place = (scale: number, par: number) => {
        const sc = scale * dolly
        const tx = W / 2 - cx * k * sc * par
        const ty = H * anchor - FLOOR * k * sc
        return `translate(${tx}px, ${ty}px) scale(${sc})`
      }
      mid.style.transform = place(s, 1)
      bg.style.transform = place(Math.max(s, 0.72), reduced ? 1 : 0.55)
      spot.style.opacity = String(0.8 * settle)

      // the establishing shot holds the frame, then dissolves as the camera
      // pushes past it into the first station — gone well before frame 1
      const wf = 1 - clamp01(f * 1.45)
      wide.style.opacity = String(wf)
      wide.style.transform = reduced ? 'none' : `scale(${1 + 0.12 * (1 - wf)})`

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
        {/* the drawing panel: two parallax layers, clipped above the caption strip */}
        <div className="studio-art" ref={artRef}>
          <svg ref={bgRef} className="studio-layer back" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} style={svgStyle} aria-hidden="true">
            <SceneDefs />
            <SceneBackground />
          </svg>
          <svg ref={midRef} className="studio-layer" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} style={svgStyle} aria-hidden="true">
            <SceneStations />
          </svg>
          <div
            ref={wideRef}
            className="studio-wide"
            aria-hidden="true"
            style={{ backgroundImage: `url(${import.meta.env.BASE_URL}scene/wide.webp)` }}
          />
          <div ref={spotRef} className="studio-spot" aria-hidden="true" />
          <div className="studio-panel" aria-hidden="true">
            <i /><i /><i /><i />
          </div>
        </div>

        {/* snap track: one full-width slide per frame */}
        <div className="studio-track" ref={trackRef}>
          <div className="studio-slide" role="group" aria-label="The studio — wide shot">
            <button className="studio-tap" onClick={() => openFrame(0)} aria-label="Start the studio walk">
              <div className="studio-title">
                <h1>
                  {state.profile.name ? `Salaam, ${state.profile.name}.` : 'Rent everything'}<br />
                  {state.profile.name ? 'Walk the studio.' : 'for your next shoot.'}
                </h1>
                <div className="studio-offers">
                  {bestOff > 0 && <span className="studio-tag deal"><Icon name="bolt" size={12} /> Up to {bestOff}% off today</span>}
                  {totalDeals > 0 && <span className="studio-tag"><Icon name="ticket" size={12} /> {totalDeals} live deals</span>}
                  <span className="studio-tag"><Icon name="handshake" size={12} /> Offer your price</span>
                </div>
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

        {/* caption strip — the pencil slug line under every storyboard panel */}
        <div className="studio-caption">
          <div className="studio-sc">
            SC {String(frame + 1).padStart(2, '0')} · {active ? `CU — ${active.cat.name.toUpperCase()}` : 'WIDE — THE STUDIO'}
          </div>
          {active ? (
            <>
              <div className="studio-caption-main">
                <b>{active.cat.name}</b>
                <span className="muted">
                  {active.count} rental{active.count === 1 ? '' : 's'}
                  {Number.isFinite(active.minPrice) && <> · from {money(active.minPrice)}</>}
                </span>
                {active.deals > 0 && (
                  <span className="studio-tag deal"><Icon name="bolt" size={11} /> {active.deals} deal{active.deals > 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="studio-caption-cta">Tap the frame to open {active.cat.name} <Icon name="arrow-right" size={12} /></div>
            </>
          ) : (
            <>
              <div className="studio-caption-main">
                <b>The studio</b>
                <span className="muted">{CATEGORIES.length} departments · every rentable on one set</span>
              </div>
              <div className="studio-caption-cta">Scroll to walk the set <Icon name="arrow-right" size={12} /></div>
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
