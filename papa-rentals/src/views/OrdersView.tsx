import { useState } from 'react'
import { getItem, getOwner } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import type { Order, OrderStatus } from '../types'
import { fmtDate, money, todayISO, uid } from '../utils'
import { Badge, ItemArt, Modal, Stars } from '../components/ui'
import { ReportModal } from './ItemDetail'

const STEPS: { id: OrderStatus; label: string; icon: string }[] = [
  { id: 'confirmed', label: 'Confirmed', icon: '✓' },
  { id: 'preparing', label: 'Preparing', icon: '📦' },
  { id: 'in_transit', label: 'On the way', icon: '🚐' },
  { id: 'in_use', label: 'On set', icon: '🎬' },
  { id: 'returned', label: 'Returned', icon: '↩︎' },
  { id: 'completed', label: 'Done', icon: '🏁' },
]

const STATUS_HINT: Record<OrderStatus, string> = {
  confirmed: 'Owner has confirmed your booking. Gear is being reserved.',
  preparing: 'Gear is being tested, charged and packed for you.',
  in_transit: 'Your gear is on the way — live-tracked like a food order. 🚐',
  in_use: 'Shoot day! Gear is with you. Support is one tap away.',
  returned: 'Gear returned. Owner is inspecting; deposit refund is queued.',
  completed: 'All done — deposit refunded. Rate your experience!',
}

export default function OrdersView() {
  const { go } = useNav()
  const { state } = useStore()

  if (state.orders.length === 0) {
    return (
      <div className="empty-state">
        <div className="big">📦</div>
        <h3>No orders yet</h3>
        <p>Your bookings and their live status will appear here.</p>
        <button className="btn btn-primary" onClick={() => go({ name: 'browse' })}>Find gear</button>
      </div>
    )
  }

  return (
    <div className="section">
      <div className="section-head"><h2>📦 Your orders</h2></div>
      {state.orders.map((o) => <OrderCard key={o.id} order={o} />)}
    </div>
  )
}

function OrderCard({ order }: { order: Order }) {
  const { dispatch } = useStore()
  const { toast } = useNav()
  const [rateOpen, setRateOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const stepIdx = STEPS.findIndex((s) => s.id === order.status)
  const firstItem = getItem(order.lines[0].itemId)
  const owner = getOwner(firstItem.ownerId)
  const done = order.status === 'completed'

  return (
    <div className="order-card">
      <div className="order-head">
        <div>
          <b>{order.id}</b>{' '}
          <span className="muted small">· {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          {order.reported && <Badge tone="red">🚩 Reported</Badge>}
        </div>
        <b>{money(order.total)}</b>
      </div>

      <div className="timeline">
        {STEPS.map((s, i) => (
          <div key={s.id} className={`step ${i < stepIdx ? 'done' : i === stepIdx ? 'current' : ''}`}>
            <div className="bubble">{i < stepIdx ? '✓' : s.icon}</div>
            {s.label}
          </div>
        ))}
      </div>
      <p className="muted small" style={{ margin: '4px 0 10px' }}>{STATUS_HINT[order.status]}</p>

      {order.lines.map((b, i) => {
        const item = getItem(b.itemId)
        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', fontSize: 13 }}>
            <ItemArt item={item} size="thumb" />
            <div style={{ flex: 1 }}>
              <b>{item.name}</b> {b.negotiated && <Badge tone="purple">🤝</Badge>}
              <div className="muted small">{fmtDate(b.startDate)} → {fmtDate(b.endDate)} · ×{b.qty}</div>
            </div>
            <span>{money(b.agreedPricePerDay)}/d</span>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {!done && (
          <button className="btn btn-primary btn-sm" onClick={() => dispatch({ type: 'ADVANCE_ORDER', orderId: order.id })}>
            ▶ Simulate next update
          </button>
        )}
        {done && !order.myRatingOfOwner && (
          <button className="btn btn-primary btn-sm" onClick={() => setRateOpen(true)}>★ Rate this rental</button>
        )}
        {done && order.myRatingOfOwner && (
          <span style={{ fontSize: 13, alignSelf: 'center' }}>
            You rated: <Stars value={order.myRatingOfOwner} /> · Owner rated you: <Stars value={order.ownerRatingOfMe ?? 5} /> <Badge tone="green">Two-way ✓</Badge>
          </span>
        )}
        {!order.reported && (
          <button className="btn btn-ghost btn-sm" onClick={() => setReportOpen(true)}>🚩 Report an issue</button>
        )}
      </div>
      {done && order.pointsEarned > 0 && (
        <p className="small" style={{ color: 'var(--green)', fontWeight: 700, margin: '10px 0 0' }}>
          🏆 +{order.pointsEarned} PapaPoints earned · deposit of {money(order.deposit)} refunded
        </p>
      )}

      {rateOpen && (
        <RateModal
          order={order}
          ownerName={owner.name}
          onClose={() => setRateOpen(false)}
          onDone={() => toast('Thanks! Your rating keeps the marketplace honest ★')}
        />
      )}
      {reportOpen && <ReportModal targetName={owner.name} orderId={order.id} onClose={() => setReportOpen(false)} />}
    </div>
  )
}

function RateModal({ order, ownerName, onClose, onDone }: { order: Order; ownerName: string; onClose: () => void; onDone: () => void }) {
  const { dispatch } = useStore()
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const firstItem = getItem(order.lines[0].itemId)

  function submit() {
    dispatch({ type: 'RATE_ORDER', orderId: order.id, rating })
    if (text.trim()) {
      dispatch({
        type: 'ADD_REVIEW',
        itemId: firstItem.id,
        review: { id: uid(), author: 'You', rating, text: text.trim(), date: todayISO(), role: 'renter' },
      })
    }
    onDone()
    onClose()
  }

  return (
    <Modal title={`★ Rate ${ownerName}`} onClose={onClose}>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        Ratings are two-way: the owner rates you too. Both ratings publish together, so nobody can retaliate.
      </p>
      <div style={{ textAlign: 'center', margin: '12px 0' }}>
        <Stars value={rating} size={20} onChange={setRating} />
      </div>
      <label className="field">
        Review of {firstItem.name} (optional)
        <input value={text} placeholder="How was the gear and the handover?" onChange={(e) => setText(e.target.value)} />
      </label>
      <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={submit}>Submit rating</button>
    </Modal>
  )
}
