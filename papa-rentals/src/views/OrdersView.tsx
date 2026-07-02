import { useState } from 'react'
import { getItem, getOwner } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import type { Order, OrderStatus } from '../types'
import { buzz, downloadReceipt, fmtDate, money, todayISO } from '../utils'
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
  requested: 'Waiting for the owner to approve — usually just a few minutes.',
  confirmed: 'Owner has confirmed your booking. Gear is being reserved.',
  preparing: 'Gear is being tested, charged and packed for you.',
  in_transit: 'Your gear is on the way — share the PIN at handover.',
  in_use: 'Shoot day! Gear is with you. Support is one tap away.',
  returned: 'Gear returned. Owner is inspecting; deposit hold release is queued.',
  completed: 'All done — deposit hold released. Rate your experience!',
  cancelled: 'This order was cancelled.',
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
  const { state, dispatch } = useStore()
  const { toast, go } = useNav()
  const [rateOpen, setRateOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)
  const [claimOpen, setClaimOpen] = useState(false)

  const stepIdx = STEPS.findIndex((s) => s.id === order.status)
  const firstItem = getItem(order.lines[0].itemId)
  const owner = getOwner(firstItem.ownerId)
  const done = order.status === 'completed'
  const hasClaim = state.claims.some((c) => c.orderId === order.id)
  const cancelled = order.status === 'cancelled'
  const cancellable = ['requested', 'confirmed', 'preparing'].includes(order.status)

  function bookAgain() {
    buzz()
    let added = 0
    for (const l of order.lines) {
      const dur = l.unit === 'hour' ? 1 : Math.round((new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / 86400000)
      const start = todayISO(2)
      const endD = new Date(start + 'T00:00:00')
      endD.setDate(endD.getDate() + dur)
      const pad = (n: number) => String(n).padStart(2, '0')
      const end = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())}`
      dispatch({ type: 'ADD_TO_CART', booking: { ...l, startDate: start, endDate: l.unit === 'hour' ? start : end, negotiated: false } })
      added++
    }
    toast(`${added} item${added > 1 ? 's' : ''} re-added — fresh dates set, adjust in cart 🔁`)
    go({ name: 'cart' })
  }

  return (
    <div className="order-card">
      <div className="order-head">
        <div>
          <b>{order.id}</b>{' '}
          <span className="muted small">· {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {order.paymentMethod}</span>
          {order.reported && <Badge tone="red">🚩 Reported</Badge>}
          {order.extendedDays ? <Badge tone="purple">+{order.extendedDays}d extended</Badge> : null}
        </div>
        <b>{money(order.total)}</b>
      </div>

      {order.status === 'requested' && (
        <div className="status-banner waiting">⏳ {STATUS_HINT.requested}</div>
      )}
      {cancelled && (
        <div className="status-banner cancelled">
          ↩️ Cancelled {order.cancelledAt && `on ${new Date(order.cancelledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
          {order.refundedToWallet ? ` · ${money(order.refundedToWallet)} refunded to wallet` : ''}
          {order.cancellationFee ? ` (10% late fee: ${money(order.cancellationFee)})` : ''}
        </div>
      )}

      {!cancelled && order.status !== 'requested' && (
        <>
          <div className="timeline">
            {STEPS.map((s, i) => (
              <div key={s.id} className={`step ${i < stepIdx ? 'done' : i === stepIdx ? 'current' : ''}`}>
                <div className="bubble">{i < stepIdx ? '✓' : s.icon}</div>
                {s.label}
              </div>
            ))}
          </div>
          <p className="muted small" style={{ margin: '4px 0 10px' }}>
            {STATUS_HINT[order.status]}
            {!done && !cancelled && order.autoAdvanceAt && ' · updates automatically 🔄'}
          </p>
        </>
      )}

      {order.status === 'in_transit' && order.driver && (
        <>
          <div className="route" aria-hidden="true">
            <svg viewBox="0 0 300 40" preserveAspectRatio="none">
              <path d="M8 32 C 80 32, 90 8, 150 8 S 220 32, 292 32" fill="none" stroke="var(--line)" strokeWidth="3" strokeDasharray="6 5" strokeLinecap="round" />
              <circle r="6" fill="var(--accent)" style={{ offsetPath: "path('M8 32 C 80 32, 90 8, 150 8 S 220 32, 292 32')" }} className="dot-anim" />
              <text x="4" y="24" fontSize="12">🏬</text>
              <text x="284" y="24" fontSize="12">🎬</text>
            </svg>
          </div>
          <div className="driver-card">
            <span style={{ fontSize: 26 }}>🧑‍✈️</span>
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 14 }}>{order.driver.name}</b>
              <div className="muted small">{order.driver.vehicle} · <a href={`tel:${order.driver.phone.replace(/\s/g, '')}`} style={{ color: 'var(--accent)', fontWeight: 700 }}>📞 Call</a></div>
            </div>
            <div className="pin" title="Share at handover">{order.driver.pin}</div>
          </div>
          <p className="muted small" style={{ margin: '0 0 8px' }}>Share the PIN with {order.driver.name.split(' ')[0]} to confirm handover — that's your proof of delivery.</p>
        </>
      )}

      {order.lines.map((b, i) => {
        const item = getItem(b.itemId)
        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', fontSize: 13 }}>
            <ItemArt item={item} size="thumb" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{item.name}</b> {b.negotiated && <Badge tone="purple">🤝</Badge>}
              <div className="muted small">
                {b.unit === 'hour' ? `${fmtDate(b.startDate)} · ${b.hours}h` : `${fmtDate(b.startDate)} → ${fmtDate(b.endDate)}`} · ×{b.qty}
              </div>
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {done && order.lineRatings?.[i] != null && <Stars value={order.lineRatings[i]} size={11} />}
              {money(b.rate)}/{b.unit === 'hour' ? 'hr' : 'd'}
            </span>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {!done && !cancelled && (
          <button className="btn btn-outline btn-sm" onClick={() => { buzz(); dispatch({ type: 'ADVANCE_ORDER', orderId: order.id }) }}>
            ⏩ Skip ahead
          </button>
        )}
        {order.status === 'in_use' && (
          <button className="btn btn-outline btn-sm" onClick={() => setExtendOpen(true)}>📅 Extend rental</button>
        )}
        {cancellable && (
          <button className="btn btn-ghost btn-sm" onClick={() => setCancelOpen(true)}>↩️ Cancel order</button>
        )}
        {done && !order.myRatingOfOwner && (
          <button className="btn btn-primary btn-sm" onClick={() => setRateOpen(true)}>★ Rate this rental</button>
        )}
        {done && order.myRatingOfOwner && (
          <span style={{ fontSize: 13, alignSelf: 'center' }}>
            You rated: <Stars value={order.myRatingOfOwner} size={12} /> · Owner rated you: <Stars value={order.ownerRatingOfMe ?? 5} size={12} /> <Badge tone="green">Published together ✓</Badge>
          </span>
        )}
        {(done || cancelled) && (
          <button className="btn btn-ghost btn-sm" onClick={bookAgain}>🔁 Book again</button>
        )}
        {(done || order.status === 'returned' || order.status === 'in_use') && order.lines.some((l) => l.insurance) && !hasClaim && (
          <button className="btn btn-ghost btn-sm" onClick={() => setClaimOpen(true)}>🛡️ File claim</button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => go({ name: 'support' })}>🎧 Get help</button>
        <button className="btn btn-ghost btn-sm" onClick={() => downloadReceipt(order)}>🧾 Receipt</button>
        {!order.reported && !cancelled && (
          <button className="btn btn-ghost btn-sm" onClick={() => setReportOpen(true)}>🚩 Report</button>
        )}
      </div>

      {done && (
        <p className="small" style={{ color: 'var(--green)', fontWeight: 700, margin: '10px 0 0' }}>
          🏆 +{order.pointsEarned} PapaPoints earned · deposit hold of {money(order.depositHold)} released ✓
        </p>
      )}

      {rateOpen && (
        <RateModal
          order={order}
          ownerName={owner.name}
          onClose={() => setRateOpen(false)}
          onDone={() => toast('Both ratings published together — no retaliation possible ★')}
        />
      )}
      {reportOpen && <ReportModal targetName={owner.name} ownerId={owner.id} orderId={order.id} onClose={() => setReportOpen(false)} />}
      {cancelOpen && <CancelModal order={order} onClose={() => setCancelOpen(false)} />}
      {extendOpen && <ExtendModal order={order} onClose={() => setExtendOpen(false)} />}
      {claimOpen && <ClaimModal order={order} onClose={() => setClaimOpen(false)} />}
    </div>
  )
}

/* ---------------- cancel with clear policy ---------------- */
function CancelModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { dispatch } = useStore()
  const { toast } = useNav()
  const startsSoon = order.lines.some((l) => l.startDate <= todayISO(2))
  const fee = order.status === 'requested' || !startsSoon ? 0 : Math.round(order.total * 0.1)
  const refund = order.total - fee + order.walletUsed

  return (
    <Modal title="↩️ Cancel this order?" onClose={onClose}>
      <div className="price-summary" style={{ borderTop: 'none' }}>
        <div className="price-line"><span>Amount paid</span><b>{money(order.total + order.walletUsed)}</b></div>
        {fee > 0 && <div className="price-line"><span>Late cancellation fee (inside 48h)</span><b style={{ color: 'var(--red)' }}>−{money(fee)}</b></div>}
        <div className="price-line total"><span>Refund to wallet</span><span style={{ color: 'var(--green)' }}>{money(refund)}</span></div>
        <div className="price-line"><span className="muted">Deposit hold</span><span className="muted">released immediately</span></div>
      </div>
      <p className="muted small">{fee === 0 ? '✅ You’re outside the 48-hour window — this cancellation is free.' : '⚠️ Your rental starts within 48 hours, so a 10% fee applies.'}</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Keep order</button>
        <button
          className="btn btn-primary" style={{ flex: 1, background: 'var(--red)' }}
          onClick={() => {
            dispatch({ type: 'CANCEL_ORDER', orderId: order.id })
            toast(`Cancelled — ${money(refund)} back in your wallet`)
            onClose()
          }}
        >
          Cancel order
        </button>
      </div>
    </Modal>
  )
}

/* ---------------- extend mid-shoot ---------------- */
function ExtendModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const { toast } = useNav()
  const [days, setDays] = useState(1)
  const dayLines = order.lines.filter((l) => l.unit === 'day')
  const cost = dayLines.reduce((s, l) => s + l.rate * l.qty * days, 0)
  const fromWallet = Math.min(state.walletBalance, cost)

  if (dayLines.length === 0) {
    return (
      <Modal title="📅 Extend rental" onClose={onClose}>
        <p className="muted">Hourly bookings can’t be extended — make a fresh booking instead.</p>
      </Modal>
    )
  }

  return (
    <Modal title="📅 Shoot ran over? Extend it." onClose={onClose}>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        Keep the gear at your negotiated rate — no re-booking, no new deposit.
      </p>
      <label className="field">
        Extra days
        <span className="qty-stepper">
          <button onClick={() => setDays(Math.max(1, days - 1))} aria-label="Fewer days">−</button>
          <b>{days}</b>
          <button onClick={() => setDays(Math.min(14, days + 1))} aria-label="More days">+</button>
        </span>
      </label>
      <div className="price-summary">
        <div className="price-line"><span>Extension cost</span><b>{money(cost)}</b></div>
        {fromWallet > 0 && <div className="price-line"><span>From wallet</span><b className="credit">−{money(fromWallet)}</b></div>}
        <div className="price-line total"><span>Charged to {order.paymentMethod}</span><span>{money(cost - fromWallet)}</span></div>
      </div>
      <button
        className="btn btn-primary btn-block" style={{ marginTop: 12 }}
        onClick={() => {
          dispatch({ type: 'EXTEND_ORDER', orderId: order.id, days })
          toast(`Extended by ${days} day${days > 1 ? 's' : ''} 📅`)
          onClose()
        }}
      >
        Extend {days} day{days > 1 ? 's' : ''} · {money(cost)}
      </button>
    </Modal>
  )
}

/* ---------------- damage claim ---------------- */
const CLAIM_REASONS = ['Arrived damaged', 'Failed during shoot', 'Missing accessory', 'Damaged in transit back']

function ClaimModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { dispatch } = useStore()
  const { toast } = useNav()
  const insuredLines = order.lines.filter((l) => l.insurance)
  const [lineIdx, setLineIdx] = useState(0)
  const [reason, setReason] = useState(CLAIM_REASONS[0])
  const line = insuredLines[lineIdx]
  const item = getItem(line.itemId)
  const maxAmount = item.deposit * line.qty
  const [amount, setAmount] = useState(Math.min(10000, maxAmount))

  return (
    <Modal title="🛡️ File a damage claim" onClose={onClose}>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        Papa Protection covers accidental damage up to full value. Approved claims are credited to your wallet — most resolve within a day.
      </p>
      <label className="field">
        Item
        <select value={lineIdx} onChange={(e) => setLineIdx(Number(e.target.value))}>
          {insuredLines.map((l, i) => <option key={i} value={i}>{getItem(l.itemId).name}</option>)}
        </select>
      </label>
      <label className="field" style={{ marginTop: 10 }}>
        What happened?
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {CLAIM_REASONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label className="field" style={{ marginTop: 10 }}>
        Claim amount (up to {money(maxAmount)})
        <input
          type="number" inputMode="numeric" value={amount} min={500} max={maxAmount}
          onChange={(e) => setAmount(Math.min(maxAmount, Math.max(0, Number(e.target.value) || 0)))}
        />
      </label>
      <button
        className="btn btn-primary btn-block" style={{ marginTop: 14 }}
        disabled={amount < 500}
        onClick={() => {
          buzz()
          dispatch({ type: 'FILE_CLAIM', orderId: order.id, itemName: item.name, reason, amount })
          toast('Claim filed — track it in Help Center 🛡️')
          onClose()
        }}
      >
        Submit claim · {money(amount)}
      </button>
    </Modal>
  )
}

/* ---------------- per-item blind two-way rating ---------------- */
function RateModal({ order, ownerName, onClose, onDone }: { order: Order; ownerName: string; onClose: () => void; onDone: () => void }) {
  const { dispatch } = useStore()
  const [ratings, setRatings] = useState<number[]>(order.lines.map(() => 5))
  const [text, setText] = useState('')

  return (
    <Modal title={`★ Rate ${ownerName}`} onClose={onClose}>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        Ratings are two-way and blind: the owner has already rated you, and both publish the moment you submit — nobody can retaliate.
      </p>
      {order.lines.map((l, i) => {
        const item = getItem(l.itemId)
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
            <span style={{ fontSize: 14 }}>{item.emoji} <b>{item.name}</b></span>
            <Stars value={ratings[i]} size={13} onChange={(v) => setRatings(ratings.map((r, j) => (j === i ? v : r)))} />
          </div>
        )
      })}
      <label className="field" style={{ marginTop: 6 }}>
        Review (optional, applies to each item)
        <input value={text} placeholder="How was the gear and the handover?" enterKeyHint="done" onChange={(e) => setText(e.target.value)} />
      </label>
      <button
        className="btn btn-primary btn-block" style={{ marginTop: 14 }}
        onClick={() => {
          buzz()
          dispatch({ type: 'RATE_ORDER', orderId: order.id, ratings, text })
          onDone()
          onClose()
        }}
      >
        Publish ratings
      </button>
    </Modal>
  )
}
