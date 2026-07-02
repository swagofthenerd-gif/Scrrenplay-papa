import type { ReactNode } from 'react'
import { getCategory, getOwner } from '../data/catalog'
import type { Item } from '../types'
import { money } from '../utils'

export function Stars({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <span className="stars" style={{ fontSize: size }} role={onChange ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className={s <= Math.round(value) ? 'star on' : 'star'}
          onClick={onChange ? () => onChange(s) : undefined}
          style={onChange ? { cursor: 'pointer', fontSize: size + 8 } : undefined}
        >
          ★
        </span>
      ))}
    </span>
  )
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'green' | 'orange' | 'purple' | 'red' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function ItemArt({ item, size = 'card' }: { item: Item; size?: 'card' | 'hero' | 'thumb' }) {
  const cat = getCategory(item.category)
  return (
    <div className={`item-art art-${size}`} style={{ background: cat.gradient }}>
      <span>{item.emoji}</span>
      {item.flashDeal && size !== 'thumb' && (
        <div className="deal-ribbon">⚡ {item.flashDeal.percentOff}% OFF · ends in {item.flashDeal.endsInHours}h</div>
      )}
    </div>
  )
}

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
  const dealPrice = item.flashDeal ? Math.round(item.pricePerDay * (1 - item.flashDeal.percentOff / 100)) : null
  return (
    <div className="item-card" onClick={onOpen}>
      <ItemArt item={item} />
      <button
        className={`wish-btn ${wishlisted ? 'on' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onToggleWish()
        }}
        aria-label="Wishlist"
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
