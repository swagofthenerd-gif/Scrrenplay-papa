import { useRef, useState } from 'react'
import type { ReactNode } from 'react'

// URLs that already failed once this session — render the fallback immediately
// on remount instead of re-flashing a skeleton and re-requesting a dead image.
const failed = new Set<string>()

/**
 * Photo with skeleton shimmer while loading and a graceful fallback when the
 * network (or a dead URL) lets us down. The fallback is the caller's gradient
 * art, so offline the app simply looks like it did before photos existed.
 */
export function SmartImage({ src, alt, fallback, eager }: { src: string; alt: string; fallback: ReactNode; eager?: boolean }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(() => (failed.has(src) ? 'error' : 'loading'))

  if (state === 'error') return <>{fallback}</>
  return (
    <>
      {state === 'loading' && <div className="art-skeleton skeleton" aria-hidden="true" />}
      <img
        className={`art-photo ${state === 'loaded' ? 'loaded' : ''}`}
        src={src}
        alt={alt}
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
        {live.map((src, i) => (
          <div key={src} className="item-art art-hero" style={{ borderRadius: 0 }}>
            <SmartImage src={src} alt={i === 0 ? alt : `${alt} — photo ${i + 1}`} fallback={fallback} eager={i === 0} />
          </div>
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
    </div>
  )
}
