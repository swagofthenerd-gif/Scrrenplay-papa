import { useEffect, useMemo, useRef, useState } from 'react'
import { TRANSPORT_OPTIONS, getItem, getOwner } from '../data/catalog'
import { useNav } from '../nav'
import { useMyReview, useStore } from '../store'
import type { Offer, TransportId } from '../types'
import {
  INSURANCE_RATE, OPERATOR_FEE_PER_DAY, daysBetween, evaluateOffer,
  fmtDate, money, recommendedPerDay, todayISO, uid,
} from '../utils'
import { Badge, ItemArt, Modal, Stars } from '../components/ui'

export default function ItemDetail({ id }: { id: string }) {
  const item = getItem(id)
  const owner = getOwner(item.ownerId)
  const { go, toast } = useNav()
  const { state, dispatch } = useStore()
  const myReview = useMyReview(id)

  const [startDate, setStartDate] = useState(todayISO(2))
  const [endDate, setEndDate] = useState(todayISO(3))
  const [pickupTime, setPickupTime] = useState('09:00')
  const [qty, setQty] = useState(1)
  const [insurance, setInsurance] = useState(item.deposit >= 100000)
  const [operator, setOperator] = useState(false)
  const [transport, setTransport] = useState<TransportId>('van')

  const [offerOpen, setOfferOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const days = daysBetween(startDate, endDate)
  const recPerDay = recommendedPerDay(id, days)

  // latest accepted offer for this item at this duration wins
  const acceptedOffer = state.offers.find((o) => o.itemId === id && o.status === 'accepted' && o.days === days)
  const perDay = acceptedOffer ? acceptedOffer.offeredPerDay : recPerDay
  const negotiated = Boolean(acceptedOffer)

  const sub = perDay * days * qty
  const insuranceFee = insurance ? Math.round(sub * INSURANCE_RATE) : 0
  const operatorFee = operator ? OPERATOR_FEE_PER_DAY * days : 0
  const transportFee = TRANSPORT_OPTIONS.find((t) => t.id === transport)?.fee ?? 0

  const wishlisted = state.wishlist.includes(id)

  function addToCart() {
    if (endDate < startDate) {
      toast('Return date must be after the start date')
      return
    }
    dispatch({
      type: 'ADD_TO_CART',
      booking: { itemId: id, startDate, endDate, pickupTime, qty, insurance, operator, transport, agreedPricePerDay: perDay, negotiated },
    })
    toast(`${item.name} added to cart 🛒`)
  }

  return (
    <div>
      <button className="back-btn" onClick={() => go({ name: 'browse', category: item.category })}>← Back to {item.category}</button>

      <div className="detail-grid">
        <div>
          <ItemArt item={item} size="hero" />
          <div className="panel" style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 21 }}>{item.name}</h2>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Stars value={item.rating} />
                  <span className="muted small">{item.rating} · {item.ratingCount} ratings · rented {item.timesRented}×</span>
                  {item.instantBook && <Badge tone="green">⚡ Instant book</Badge>}
                  {item.offersAccepted && <Badge tone="purple">🤝 Offers accepted</Badge>}
                </div>
              </div>
              <button className={`icon-btn ${wishlisted ? '' : ''}`} onClick={() => dispatch({ type: 'TOGGLE_WISHLIST', itemId: id })}>
                {wishlisted ? '♥' : '♡'}
              </button>
            </div>
            <p style={{ fontSize: 14, color: '#44403c' }}>{item.description}</p>
            <h4 style={{ fontSize: 14 }}>What's included</h4>
            <ul className="spec-list">
              {item.specs.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>

          <div className="panel">
            <div className="owner-row">
              <div className="owner-avatar">{owner.avatar}</div>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 14 }}>
                  {owner.name} {owner.verified && <Badge tone="green">✔︎ Verified</Badge>}
                  {owner.superOwner && <Badge tone="orange">👑 Super Owner</Badge>}
                </b>
                <div className="muted small">
                  ★ {owner.rating} ({owner.ratingCount}) · replies in ~{owner.responseMins} min · {owner.area} · {owner.distanceKm} km away · since {owner.memberSince}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setChatOpen(true)}>💬 Chat with owner</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setReportOpen(true)}>🚩 Report</button>
            </div>
          </div>

          <div className="panel">
            <h3 style={{ fontSize: 16 }}>Reviews</h3>
            {myReview && (
              <div className="review">
                <div className="review-head">
                  <b>{myReview.author} <Badge>You</Badge></b>
                  <Stars value={myReview.rating} />
                </div>
                <div className="muted small">{myReview.date}</div>
                <p style={{ margin: '6px 0 0' }}>{myReview.text}</p>
              </div>
            )}
            {item.reviews.map((rv) => (
              <div className="review" key={rv.id}>
                <div className="review-head">
                  <b>{rv.author}</b>
                  <Stars value={rv.rating} />
                </div>
                <div className="muted small">{rv.date}</div>
                <p style={{ margin: '6px 0 0' }}>{rv.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ---------------- Booking panel ---------------- */}
        <div>
          <div className="panel">
            <h3 style={{ fontSize: 16 }}>📅 Book your dates</h3>
            <div className="form-row">
              <label className="field">
                Start date
                <input type="date" value={startDate} min={todayISO()} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label className="field">
                Return date
                <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
            </div>
            <div className="form-row">
              <label className="field">
                Pickup / delivery time
                <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
              </label>
              <label className="field">
                Quantity
                <span className="qty-stepper">
                  <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                  <b>{qty}</b>
                  <button onClick={() => setQty(Math.min(5, qty + 1))}>+</button>
                </span>
              </label>
            </div>
            <p className="muted small" style={{ margin: '10px 0 0' }}>
              {days} day{days > 1 ? 's' : ''} · {fmtDate(startDate)} → {fmtDate(endDate)} at {pickupTime}
              {days >= 7 ? ' · 🎉 weekly rate applied (20% off)' : days >= 3 ? ' · 🎉 3+ day rate applied (10% off)' : ''}
            </p>

            <label className="toggle-row">
              <input type="checkbox" checked={insurance} onChange={(e) => setInsurance(e.target.checked)} />
              <span>
                <b>🛡️ Papa Damage Protection</b> — {Math.round(INSURANCE_RATE * 100)}% of rental. Covers accidental damage up to full value.
                {item.deposit >= 100000 && <span className="muted small"> (Strongly recommended for this item)</span>}
              </span>
            </label>
            <label className="toggle-row">
              <input type="checkbox" checked={operator} onChange={(e) => setOperator(e.target.checked)} />
              <span>
                <b>🧑‍🔧 Certified tech/operator</b> — {money(OPERATOR_FEE_PER_DAY)}/day. A pro who knows this gear, on set with you.
              </span>
            </label>

            <h4 style={{ fontSize: 14, marginTop: 14 }}>🚐 Transport to set</h4>
            {TRANSPORT_OPTIONS.map((t) => (
              <div key={t.id} className={`transport-opt ${transport === t.id ? 'active' : ''}`} onClick={() => setTransport(t.id)}>
                <span className="t-emoji">{t.emoji}</span>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 14 }}>{t.name}</b> <span className="muted small">· {t.eta}</span>
                  <div className="muted small">{t.detail}</div>
                </div>
                <b style={{ fontSize: 13 }}>{t.fee === 0 ? 'Free' : money(t.fee)}</b>
              </div>
            ))}

            <div className="fare-box">
              <div className="muted small">Recommended fare {negotiated && '· you negotiated 🤝'}</div>
              <div className="fare-amount">
                {money(perDay)} <span style={{ fontSize: 13, fontWeight: 600 }}>/day</span>
                {negotiated && <s className="muted" style={{ fontSize: 14, marginLeft: 8 }}>{money(recPerDay)}</s>}
              </div>
              {item.offersAccepted ? (
                <button className="btn btn-outline btn-sm btn-block" style={{ marginTop: 10 }} onClick={() => setOfferOpen(true)}>
                  🤝 Offer your price
                </button>
              ) : (
                <div className="muted small" style={{ marginTop: 8 }}>Owner has fixed pricing on this item.</div>
              )}
            </div>

            <div className="price-summary">
              <div className="price-line"><span>{money(perDay)} × {days} day{days > 1 ? 's' : ''} × {qty}</span><b>{money(sub)}</b></div>
              {insurance && <div className="price-line"><span>Damage protection</span><b>{money(insuranceFee)}</b></div>}
              {operator && <div className="price-line"><span>Operator ({days}d)</span><b>{money(operatorFee)}</b></div>}
              <div className="price-line"><span>Transport</span>{transportFee === 0 ? <b className="free">Free</b> : <b>{money(transportFee)}</b>}</div>
              <div className="price-line"><span>Refundable deposit</span><b>{money(item.deposit * qty)}</b></div>
              <div className="price-line total"><span>Est. total</span><span>{money(sub + insuranceFee + operatorFee + transportFee + item.deposit * qty)}</span></div>
            </div>

            <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={addToCart}>
              {item.instantBook ? '⚡ Add to cart — instant book' : 'Add to cart — request booking'}
            </button>
          </div>
        </div>
      </div>

      {offerOpen && (
        <OfferModal
          itemId={id}
          days={days}
          recommended={recPerDay}
          onClose={() => setOfferOpen(false)}
        />
      )}
      {chatOpen && <ChatModal ownerId={owner.id} ownerName={owner.name} itemName={item.name} onClose={() => setChatOpen(false)} />}
      {reportOpen && <ReportModal targetName={owner.name} onClose={() => setReportOpen(false)} />}
    </div>
  )
}

/* ---------------- inDrive-style offer flow ---------------- */
function OfferModal({ itemId, days, recommended, onClose }: { itemId: string; days: number; recommended: number; onClose: () => void }) {
  const { dispatch } = useStore()
  const { toast } = useNav()
  const [amount, setAmount] = useState(Math.round(recommended * 0.85 / 50) * 50)
  const [pending, setPending] = useState<Offer | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(timer.current), [])

  const min = Math.round(recommended * 0.5 / 50) * 50
  const max = recommended

  function submit() {
    const offer: Offer = {
      id: uid(), itemId, days, recommendedPerDay: recommended, offeredPerDay: amount,
      status: 'pending', createdAt: new Date().toISOString(),
    }
    setPending(offer)
    // simulate the owner reviewing your offer
    timer.current = setTimeout(() => {
      const verdict = evaluateOffer(recommended, amount)
      const resolved: Offer = { ...offer, status: verdict.status, counterPerDay: verdict.counter }
      dispatch({ type: 'ADD_OFFER', offer: resolved })
      setPending(resolved)
      if (verdict.status === 'accepted') toast('Offer accepted! Price locked in 🎉')
    }, 1400)
  }

  function acceptCounter() {
    if (!pending) return
    dispatch({ type: 'ACCEPT_COUNTER', offerId: pending.id })
    toast('Counter-offer accepted — price locked in 🤝')
    onClose()
  }

  const pct = Math.round((amount / recommended) * 100)

  return (
    <Modal title="🤝 Offer your price" onClose={onClose}>
      {!pending ? (
        <>
          <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
            Recommended fare is <b>{money(recommended)}/day</b> for {days} day{days > 1 ? 's' : ''}. Name your price — the owner can accept, counter or decline. Fair offers get fast yeses.
          </p>
          <div className="fare-box">
            <div className="fare-amount">{money(amount)} /day</div>
            <div className="muted small">{pct}% of recommended {pct >= 92 ? '· 🟢 very likely accepted' : pct >= 72 ? '· 🟡 may get countered' : '· 🔴 likely declined'}</div>
            <input
              className="offer-slider" type="range" min={min} max={max} step={50}
              value={amount} onChange={(e) => setAmount(Number(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }} className="muted small">
              <span>{money(min)}</span><span>{money(max)}</span>
            </div>
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={submit}>
            Send offer to owner
          </button>
        </>
      ) : pending.status === 'pending' ? (
        <div className="empty-state" style={{ padding: '30px 10px' }}>
          <div className="big">⏳</div>
          <p>Offer of <b>{money(pending.offeredPerDay)}/day</b> sent.<br />Waiting for the owner…</p>
        </div>
      ) : pending.status === 'accepted' ? (
        <>
          <div className="offer-status accepted">✅ Accepted! You locked in {money(pending.offeredPerDay)}/day (was {money(recommended)}).</div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={onClose}>Book at this price</button>
        </>
      ) : pending.status === 'countered' ? (
        <>
          <div className="offer-status countered">
            ↩️ Owner countered with <b>{money(pending.counterPerDay!)}/day</b> (you offered {money(pending.offeredPerDay)}).
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={acceptCounter}>Accept counter</button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPending(null)}>Try again</button>
          </div>
        </>
      ) : (
        <>
          <div className="offer-status declined">❌ Declined — that one was too low. Try something closer to the recommended fare.</div>
          <button className="btn btn-outline btn-block" style={{ marginTop: 12 }} onClick={() => setPending(null)}>Make a new offer</button>
        </>
      )}
    </Modal>
  )
}

/* ---------------- Chat with owner ---------------- */
const OWNER_REPLIES = [
  'Salaam! Yes, it’s available for those dates. 👍',
  'We can include an extra battery at no charge if you book today.',
  'Pickup any time after 8am works. Delivery also possible!',
  'It was serviced last week — everything is in perfect shape.',
  'For multi-day bookings I can be flexible on the rate, send an offer!',
]

function ChatModal({ ownerId, ownerName, itemName, onClose }: { ownerId: string; ownerName: string; itemName: string; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [text, setText] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const msgs = state.chats[ownerId] ?? []
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight })
  }, [msgs.length])
  useEffect(() => () => clearTimeout(timer.current), [])

  function send() {
    const t = text.trim()
    if (!t) return
    dispatch({ type: 'ADD_CHAT', ownerId, message: { id: uid(), from: 'me', text: t, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } })
    setText('')
    const reply = OWNER_REPLIES[Math.floor(Math.random() * OWNER_REPLIES.length)]
    timer.current = setTimeout(() => {
      dispatch({ type: 'ADD_CHAT', ownerId, message: { id: uid(), from: 'owner', text: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } })
    }, 1200)
  }

  return (
    <Modal title={`💬 ${ownerName}`} onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>Asking about: {itemName}</p>
      <div className="chat-box" ref={boxRef}>
        {msgs.length === 0 && <div className="muted small" style={{ textAlign: 'center', padding: 20 }}>Say salaam — owners reply in minutes.</div>}
        {msgs.map((m) => (
          <div key={m.id} className={`chat-msg ${m.from}`}>{m.text}</div>
        ))}
      </div>
      <div className="chat-input-row">
        <input
          value={text}
          placeholder="Type a message…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="btn btn-primary btn-sm" onClick={send}>Send</button>
      </div>
    </Modal>
  )
}

/* ---------------- Report ---------------- */
const REPORT_REASONS = ['Item not as described', 'No-show / late handover', 'Unsafe or damaged equipment', 'Inappropriate behaviour', 'Suspected scam or fraud', 'Other']

export function ReportModal({ targetName, orderId, onClose }: { targetName: string; orderId?: string; onClose: () => void }) {
  const { dispatch } = useStore()
  const { toast } = useNav()
  const [reason, setReason] = useState(REPORT_REASONS[0])
  const [note, setNote] = useState('')

  return (
    <Modal title={`🚩 Report ${targetName}`} onClose={onClose}>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        Reports go to our Trust & Safety team and are reviewed within 24 hours. Serious reports can freeze payouts and suspend accounts.
      </p>
      <label className="field">
        Reason
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label className="field" style={{ marginTop: 10 }}>
        Details (optional)
        <input value={note} placeholder="Tell us what happened…" onChange={(e) => setNote(e.target.value)} />
      </label>
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 14 }}
        onClick={() => {
          dispatch({ type: 'REPORT', orderId, report: { id: uid(), targetName, reason, note, date: todayISO() } })
          toast('Report submitted — Trust & Safety will review it 🚩')
          onClose()
        }}
      >
        Submit report
      </button>
    </Modal>
  )
}
