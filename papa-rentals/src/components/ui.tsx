import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getCategory, getOwner } from '../data/catalog'
import type { Item } from '../types'
import { buzz, dealActive, dealEndsAt, fmtCountdown, money } from '../utils'

/* ---------------- stars with true half-star rendering ---------------- */
export function Stars({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <span className="stars" style={{ fontSize: onChange ? size + 10 : size }} aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => {
        const fill = Math.max(0, Math.min(1, value - (s - 1)))
        return (
          <span
            key={s}
            className="star-wrap"
            onClick={onChange ? () => { buzz(); onChange(s) } : undefined}
            style={onChange ? { cursor: 'pointer', padding: '0 2px' } : undefined}
          >
            <span className="star off">★</span>
            <span className="star on" style={{ width: `${fill * 100}%` }}>★</span>
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
export function DealCountdown({ itemId, prefix = '⚡' }: { itemId: string; prefix?: string }) {
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
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

/* ---------------- item art ---------------- */
export function ItemArt({ item, size = 'card' }: { item: Item; size?: 'card' | 'hero' | 'thumb' }) {
  const cat = getCategory(item.category)
  return (
    <div className={`item-art art-${size}`} style={{ background: cat.gradient }} role="img" aria-label={item.name}>
      <span>{item.emoji}</span>
      {item.flashDeal && dealActive(item.id) && size !== 'thumb' && (
        <div className="deal-ribbon">
          ⚡ {item.flashDeal.percentOff}% OFF · <DealCountdown itemId={item.id} prefix="" />
        </div>
      )}
    </div>
  )
}

/* ---------------- catalog card ---------------- */
export function ItemCard({
  item,
  onOpen,
  wishlisted,
  onToggleWish,
}: {
  item: Item
  onOpen: () => void
  wishlisted: boolean
  onToggleWish: () => void
}) {
  const owner = getOwner(item.ownerId)
  const hasDeal = dealActive(item.id)
  const dealPrice = hasDeal ? Math.round(item.pricePerDay * (1 - item.flashDeal!.percentOff / 100)) : null
  return (
    <div className="item-card" onClick={onOpen}>
      <ItemArt item={item} />
      <button
        className={`wish-btn ${wishlisted ? 'on' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          buzz()
          onToggleWish()
        }}
        aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        {wishlisted ? '♥' : '♡'}
      </button>
      <div className="item-card-body">
        <div className="item-card-title">{item.name}</div>
        <div className="item-card-meta">
          <Stars value={item.rating} />
          <span className="muted">{item.rating} ({item.ratingCount})</span>
        </div>
        <div className="item-card-meta muted small">
          {owner.verified && '✔︎ '} {owner.name} · {owner.distanceKm} km
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
          {item.instantBook && <Badge tone="green">⚡ Instant</Badge>}
        </div>
      </div>
    </div>
  )
}
