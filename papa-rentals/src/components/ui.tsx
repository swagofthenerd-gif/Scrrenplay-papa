import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getCategory, getOwner } from '../data/catalog'
import type { Item } from '../types'
import { buzz, dealActive, dealEndsAt, fmtCountdown, money } from '../utils'
import { PhotoGallery, SmartImage } from './SmartImage'
import { Icon, STAR_PATH } from './icons'

/* ---------------- stars: SVG with fractional fill ---------------- */
function Star({ frac, size }: { frac: number; size: number }) {
  const id = useId() // unique clip per star — dupes would silently break the fill
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="star-svg">
      <defs><clipPath id={id}><rect width={24 * frac} height="24" /></clipPath></defs>
      <path d={STAR_PATH} fill="var(--star-off)" />
      <path d={STAR_PATH} fill="var(--star)" clipPath={`url(#${id})`} />
    </svg>
  )
}

export function Stars({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  const px = onChange ? size + 10 : size
  return (
    <span className="stars" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => {
        const frac = Math.max(0, Math.min(1, value - (s - 1)))
        return (
          <span
            key={s}
            className="star-wrap"
            onClick={onChange ? () => { buzz(); onChange(s) } : undefined}
            style={onChange ? { cursor: 'pointer', padding: '0 2px' } : undefined}
          >
            <Star frac={frac} size={px} />
          </span>
        )
      })}
    </span>
  )
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'green' | 'orange' | 'purple' | 'red' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

/* ---------------- live flash-deal countdown ---------------- */
export function DealCountdown({ itemId, prefix }: { itemId: string; prefix?: ReactNode }) {
  const [, force] = useState(0)
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const left = dealEndsAt(itemId) - Date.now()
  if (left <= 0) return null
  return <span>{prefix} ends in {fmtCountdown(left)}</span>
}

/* ---------------- bottom sheet: scroll-locked + swipe-to-dismiss ---------------- */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startY: number; delta: number } | null>(null)

  // lock body scroll while open, preserving position
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

  // close on Escape (desktop niceness)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function onTouchStart(e: React.TouchEvent) {
    const el = sheetRef.current
    if (!el || el.scrollTop > 4) return // only swipe-dismiss from the top
    drag.current = { startY: e.touches[0].clientY, delta: 0 }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!drag.current || !sheetRef.current) return
    const delta = Math.max(0, e.touches[0].clientY - drag.current.startY)
    drag.current.delta = delta
    sheetRef.current.style.transform = `translateY(${delta}px)`
    sheetRef.current.style.transition = 'none'
  }
  function onTouchEnd() {
    const el = sheetRef.current
    if (!drag.current || !el) return
    const { delta } = drag.current
    drag.current = null
    el.style.transition = ''
    if (delta > 90) {
      buzz()
      onClose()
    } else {
      el.style.transform = ''
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        role="dialog"
        aria-label={title}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

/* ---------------- item art: photo-first, gradient+icon fallback ---------------- */
const ART_GLYPH_SIZE = { card: 60, hero: 104, thumb: 26 } as const

export function ItemArt({ item, size = 'card' }: { item: Item; size?: 'card' | 'hero' | 'thumb' }) {
  const cat = getCategory(item.category)
  const ribbon = item.flashDeal && dealActive(item.id) && size !== 'thumb' && (
    <div className="deal-ribbon">
      <Icon name="bolt" size={11} /> {item.flashDeal.percentOff}% OFF · <DealCountdown itemId={item.id} />
    </div>
  )
  const glyph = <Icon name={item.icon} className="art-glyph" size={ART_GLYPH_SIZE[size]} />

  // hero with a multi-photo gallery: swipeable, dots, ribbon overlaid on the whole thing
  if (size === 'hero' && item.images && item.images.length > 0) {
    return (
      <PhotoGallery
        images={item.images}
        alt={item.name}
        overlay={ribbon || undefined}
        fallback={
          <div className="grad-fill" style={{ background: cat.gradient }} aria-hidden="true">
            {glyph}
          </div>
        }
      />
    )
  }

  // card/thumb (and photo-less hero): gradient+icon base, photo fades in on top
  return (
    <div className={`item-art art-${size}`} style={{ background: cat.gradient }} role="img" aria-label={item.name}>
      {glyph}
      {item.image && <SmartImage src={item.image} alt="" fallback={null} />}
      {ribbon}
    </div>
  )
}

/* ---------------- count-up number (respects reduced motion) ---------------- */
export function useCountUp(value: number, ms = 600): number {
  const [shown, setShown] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (from === value) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(from + (value - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return shown
}

/* ---------------- compact rating (single star, Airbnb-style) ---------------- */
export function RatingCompact({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="rating-compact" aria-label={`${rating.toFixed(1)} out of 5 stars${count ? `, ${count} reviews` : ''}`}>
      <svg className="rc-star" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d={STAR_PATH} fill="var(--star)" /></svg>
      {rating.toFixed(1)}
      {count != null && <span className="rc-count">({count})</span>}
    </span>
  )
}

/* ---------------- catalog card ---------------- */
export function ItemCard({
  item,
  onOpen,
  wishlisted,
  onToggleWish,
  index,
}: {
  item: Item
  onOpen: () => void
  wishlisted: boolean
  onToggleWish: () => void
  index?: number
}) {
  const owner = getOwner(item.ownerId)
  const hasDeal = dealActive(item.id)
  const dealPrice = hasDeal ? Math.round(item.pricePerDay * (1 - item.flashDeal!.percentOff / 100)) : null
  const stagger = index != null ? { className: 'item-card stagger', style: { ['--i' as string]: Math.min(index, 8) } } : { className: 'item-card' }
  return (
    <div {...stagger} onClick={onOpen}>
      <ItemArt item={item} />
      {item.instantBook && <div className="photo-badge"><Icon name="bolt" size={11} /> Instant</div>}
      <button
        className={`wish-btn ${wishlisted ? 'on' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          buzz()
          onToggleWish()
        }}
        aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Icon name={wishlisted ? 'heart-filled' : 'heart'} size={18} />
      </button>
      <div className="item-card-body">
        <div className="item-card-title">{item.name}</div>
        <div className="item-card-meta">
          <RatingCompact rating={item.rating} count={item.ratingCount} />
          <span className="muted small owner-inline">
            · {owner.verified && <Icon name="check" size={11} className="ic-verified" />}{owner.name}
          </span>
        </div>
        <div className="item-card-price">
          {dealPrice ? (
            <>
              <s className="muted">{money(item.pricePerDay)}</s> <b>{money(dealPrice)}</b>
            </>
          ) : (
            <b>{money(item.pricePerDay)}</b>
          )}
          <span className="muted"> /day</span>
          <span className="muted small"> · {owner.distanceKm} km</span>
        </div>
      </div>
    </div>
  )
}
