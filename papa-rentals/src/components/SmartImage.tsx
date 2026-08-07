import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Lightbox } from './Lightbox'
import { Icon } from './icons'

// URLs that already failed once this session — render the fallback immediately
// on remount instead of re-flashing a skeleton and re-requesting a dead image.
const failed = new Set<string>()

/**
 * Photo with skeleton shimmer while loading and a graceful fallback when the
 * network (or a dead URL) lets us down. The fallback is the caller's gradient
 * art, so offline the app simply looks like it did before photos existed.
 */
/* Intrinsic sizes matching the CSS boxes in styles.css. The containers already
   reserve space via aspect-ratio, but the attributes let the browser size the
   image before the CSS lands and stop a decoded photo from repainting the row. */
const ART_BOX = { card: [400, 300], hero: [800, 600], thumb: [54, 54] } as const

export function SmartImage({
  src,
  alt,
  fallback,
  eager,
  box = 'card',
}: {
  src: string
  alt: string
  fallback: ReactNode
  eager?: boolean
  box?: keyof typeof ART_BOX
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(() => (failed.has(src) ? 'error' : 'loading'))

  if (state === 'error') return <>{fallback}</>
  return (
    <>
      {state === 'loading' && <div className="art-skeleton skeleton" aria-hidden="true" />}
      <img
        className={`art-photo ${state === 'loaded' ? 'loaded' : ''}`}
        src={src}
        alt={alt}
        width={ART_BOX[box][0]}
        height={ART_BOX[box][1]}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setState('loaded')}
        onError={() => {
          failed.add(src)
          setState('error')
        }}
      />
    </>
  )
}

/** Swipeable photo gallery: CSS scroll-snap does the physics, dots follow scroll. */
export function PhotoGallery({ images, alt, fallback, overlay }: { images: string[]; alt: string; fallback: ReactNode; overlay?: ReactNode }) {
  const [page, setPage] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const live = images.filter((src) => !failed.has(src))

  if (live.length === 0) {
    return (
      <div className="gallery item-art art-hero">
        {fallback}
        {overlay}
      </div>
    )
  }

  return (
    <div className="gallery">
      <div
        className="gallery-track"
        ref={trackRef}
        onScroll={() => {
          const el = trackRef.current
          if (el) setPage(Math.round(el.scrollLeft / el.clientWidth))
        }}
      >
        {/* A real button, so the photo is reachable by keyboard and announces
            what tapping it does. The gallery still swipes: a scroll never fires
            a click, so the two gestures do not fight. */}
        {live.map((src, i) => (
          <button
            key={src}
            type="button"
            className="item-art art-hero gallery-shot"
            style={{ borderRadius: 0 }}
            onClick={() => setZoomed(true)}
            aria-label={`Open photo ${i + 1} of ${live.length} full screen`}
          >
            <SmartImage src={src} alt={i === 0 ? alt : `${alt} — photo ${i + 1}`} fallback={fallback} eager={i === 0} box="hero" />
            <span className="gallery-zoom" aria-hidden="true"><Icon name="search" size={15} /></span>
          </button>
        ))}
      </div>
      {live.length > 1 && (
        <div className="gallery-dots" aria-hidden="true">
          {live.map((src, i) => (
            <i key={src} className={i === page ? 'on' : ''} />
          ))}
        </div>
      )}
      {overlay}
      {zoomed && <Lightbox images={live} alt={alt} startAt={page} onClose={() => setZoomed(false)} />}
    </div>
  )
}
