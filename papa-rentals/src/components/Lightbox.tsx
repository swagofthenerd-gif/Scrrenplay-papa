import { useEffect, useRef, useState } from 'react'
import { Icon } from './icons'

/* Full-screen photo viewer. Renting a Rs 150,000 camera off a 390px phone means
   the photo is the inspection — it is how you check the mount, the wear on the
   barrel, whether the case is the one you were promised. A thumbnail you cannot
   open is asking people to commit to gear they have not actually seen.

   Deliberately built out of the same scroll-snap the inline gallery uses rather
   than a JS pager: the browser's own scrolling is smoother than anything we'd
   write, keeps momentum, and costs nothing on the low-end WebView this ships in.
   Pinch-zoom is left to the browser for the same reason — the one gesture people
   actually need here is the one we must not intercept. */
export function Lightbox({
  images,
  alt,
  startAt = 0,
  onClose,
}: {
  images: string[]
  alt: string
  startAt?: number
  onClose: () => void
}) {
  const [page, setPage] = useState(startAt)
  const trackRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  /* Jump to the tapped photo before the first paint, or the viewer opens on
     photo 1 and then visibly slides — which reads as the wrong photo opening. */
  useEffect(() => {
    const el = trackRef.current
    if (el) el.scrollLeft = startAt * el.clientWidth
  }, [startAt])

  // Lock the page behind, preserving scroll position — same approach as Modal.
  useEffect(() => {
    const y = window.scrollY
    const { style } = document.body
    style.position = 'fixed'
    style.top = `-${y}px`
    style.left = '0'
    style.right = '0'
    return () => {
      style.position = ''
      style.top = ''
      style.left = ''
      style.right = ''
      window.scrollTo(0, y)
    }
  }, [])

  /* Escape closes and arrows page, because a viewer you can only leave by
     hitting a 40px X is a trap on a keyboard. Focus starts on Close so the
     first Tab lands somewhere sensible rather than in the page underneath. */
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  })

  function step(dir: number) {
    const el = trackRef.current
    if (!el) return
    const next = Math.max(0, Math.min(images.length - 1, page + dir))
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`${alt} — photo viewer`}>
      {/* The backdrop closes, but only the backdrop: a tap that lands on the
          photo is someone looking at it, not someone leaving. */}
      <button className="lightbox-scrim" aria-label="Close photo viewer" onClick={onClose} />

      <div
        className="lightbox-track"
        ref={trackRef}
        onScroll={() => {
          const el = trackRef.current
          if (el) setPage(Math.round(el.scrollLeft / el.clientWidth))
        }}
      >
        {images.map((src, i) => (
          <div className="lightbox-slide" key={src}>
            <img src={src} alt={i === 0 ? alt : `${alt} — photo ${i + 1}`} decoding="async" />
          </div>
        ))}
      </div>

      <div className="lightbox-bar">
        {images.length > 1 && (
          <span className="lightbox-count" aria-live="polite">
            {page + 1} of {images.length}
          </span>
        )}
        <button ref={closeRef} className="lightbox-close" onClick={onClose} aria-label="Close photo viewer">
          <Icon name="x" size={20} />
        </button>
      </div>

      {images.length > 1 && (
        <>
          <button className="lightbox-nav prev" onClick={() => step(-1)} disabled={page === 0} aria-label="Previous photo">
            <Icon name="chevron-left" size={22} />
          </button>
          <button
            className="lightbox-nav next"
            onClick={() => step(1)}
            disabled={page === images.length - 1}
            aria-label="Next photo"
          >
            <Icon name="chevron-right" size={22} />
          </button>
        </>
      )}
    </div>
  )
}
