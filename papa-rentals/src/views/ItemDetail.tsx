import { useEffect, useMemo, useRef, useState } from 'react'
import { ITEMS, TRANSPORT_OPTIONS, getItem, getOwner } from '../data/catalog'
import { similarItems } from '../recs'
import { useNav } from '../nav'
import { useStore } from '../store'
import type { Offer, RentalUnit, TransportId } from '../types'
import {
  INSURANCE_RATE, OFFER_TTL_MS, OPERATOR_FEE_PER_DAY, buzz, daysBetween, dealActive,
  findConflict, fmtCountdown, fmtDate, hourlyRate, money, nextAvailable, ratingHistogram,
  recommendedRate, todayISO, toISO, uid, unavailableRanges, rangesOverlap,
} from '../utils'
import { Badge, DealCountdown, ItemArt, ItemCard, Modal, RatingCompact, Stars } from '../components/ui'
import { Avatar, Icon } from '../components/icons'

const TIME_SLOTS = ['06:00', '09:00', '12:00', '15:00', '18:00']

export default function ItemDetail({ id }: { id: string }) {
  const item = getItem(id)
  const owner = getOwner(item.ownerId)
  const { go, back, toast } = useNav()
  const { state, dispatch } = useStore()

  useEffect(() => {
    dispatch({ type: 'VIEW_ITEM', itemId: id })
  }, [id, dispatch])

  const [startDate, setStartDate] = useState(todayISO(2))
  const [endDate, setEndDate] = useState(todayISO(3))
  const [pickupTime, setPickupTime] = useState('09:00')
  const [qty, setQty] = useState(1)
  const [unit, setUnit] = useState<RentalUnit>('day')
  const [hours, setHours] = useState(4)
  const [insurance, setInsurance] = useState(item.insuranceRequired || item.deposit >= 100000)
  const [operator, setOperator] = useState(false)
  const [transport, setTransport] = useState<TransportId>('van')

  const [offerOpen, setOfferOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const effEnd = unit === 'hour' ? startDate : endDate
  const days = unit === 'hour' ? 1 : daysBetween(startDate, effEnd)
  const recRate = recommendedRate(id, days, unit)

  // sticky negotiation: latest accepted, unexpired offer for this item+unit applies to any dates
  const deal = state.offers.find((o) => o.itemId === id && o.unit === unit && o.status === 'accepted' && o.expiresAt > Date.now())
  const rate = deal ? Math.min(deal.offeredRate, recRate) : recRate
  const negotiated = Boolean(deal && deal.offeredRate < recRate)

  const duration = unit === 'hour' ? hours : days
  const sub = rate * duration * qty
  const insuranceFee = insurance ? Math.round(sub * INSURANCE_RATE) : 0
  const operatorFee = operator ? OPERATOR_FEE_PER_DAY * days : 0
  const transportFee = TRANSPORT_OPTIONS.find((t) => t.id === transport)?.fee ?? 0

  const conflict = findConflict(id, { start: startDate, end: effEnd }, state.orders, state.cart)
  const nextFree = conflict ? nextAvailable(id, effEnd, duration === 0 ? 1 : days, state.orders, state.cart) : null
  const invalidRange = unit === 'day' && endDate < startDate

  const wishlisted = state.wishlist.includes(id)
  const thread = state.chats[owner.id]
  const chatUnread = thread?.unread ?? 0

  // similarity-ranked: tags + category adjacency + price band + quality
  const alsoRented = useMemo(() => similarItems(id, state, 6), [id, state])

  const histo = ratingHistogram(item.rating, item.ratingCount)
  const myReviews = state.myReviews[id] ?? []

  function addToCart() {
    if (invalidRange) {
      toast('Return date must be after the start date')
      return
    }
    if (conflict) {
      toast('Those dates are already booked — try the next free date')
      return
    }
    buzz()
    dispatch({
      type: 'ADD_TO_CART',
      booking: {
        itemId: id, startDate, endDate: effEnd, pickupTime, qty, unit, hours,
        insurance: item.insuranceRequired ? true : insurance, operator, transport, rate, negotiated,
      },
    })
    toast(`${item.name} added to cart`)
  }

  return (
    <div>
      <button className="back-btn detail-back" onClick={back}><Icon name="chevron-left" size={14} /> Back</button>

      <div className="detail-grid">
        <div>
          <div style={{ position: 'relative' }}>
            <ItemArt item={item} size="hero" />
            <button className="float-back" onClick={back} aria-label="Back"><Icon name="chevron-left" size={18} /></button>
          </div>
          <div className="panel" style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 21 }}>{item.name}</h2>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Stars value={item.rating} />
                  <span className="muted small">{item.rating} · {item.ratingCount} ratings · rented {item.timesRented}×</span>
                  {item.instantBook ? <Badge tone="green"><Icon name="bolt" size={14} /> Instant book</Badge> : <Badge tone="purple"><Icon name="handshake" size={14} /> Owner approval</Badge>}
                  {item.offersAccepted && <Badge tone="purple"><Icon name="coins" size={14} /> Offers OK</Badge>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="icon-btn"
                  onClick={async () => {
                    const url = location.href
                    try {
                      if (navigator.share) await navigator.share({ title: item.name, text: `${item.name} on Papa Rentals`, url })
                      else { await navigator.clipboard?.writeText(url); toast('Link copied — send it to your producer') }
                    } catch { /* user dismissed share sheet */ }
                  }}
                  aria-label="Share listing"
                >
                  <Icon name="arrow-up-right" size={16} />
                </button>
                <button
                  className="icon-btn"
                  style={wishlisted ? { color: 'var(--red)' } : undefined}
                  onClick={() => { buzz(); dispatch({ type: 'TOGGLE_WISHLIST', itemId: id }) }}
                  aria-label="Toggle wishlist"
                >
                  {wishlisted ? <Icon name="heart-filled" size={16} /> : <Icon name="heart" size={16} />}
                </button>
              </div>
            </div>
            <p style={{ fontSize: 14, opacity: 0.9 }}>{item.description}</p>
            <h4 style={{ fontSize: 14 }}>What's included</h4>
            <ul className="spec-list">
              {item.specs.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>

          {item.space && (
            <div className="panel">
              <h3 style={{ fontSize: 16 }}><Icon name="building" className="h-ico" size={16} /> About this space</h3>
              <div className="stat-row" style={{ marginTop: 10 }}>
                <div className="stat-tile"><div className="stat-num">{item.space.sqft.toLocaleString()}</div><div className="muted small">sqft</div></div>
                <div className="stat-tile"><div className="stat-num"><Icon name="users" size={14} /> {item.space.capacity}</div><div className="muted small">max crew</div></div>
                <div className="stat-tile"><div className="stat-num">{item.space.minHours ? `${item.space.minHours}h` : '1d'}</div><div className="muted small">minimum</div></div>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                Amenities
                <div className="slot-row">
                  {item.space.amenities.map((a) => <span key={a} className="slot-chip" style={{ cursor: 'default' }}>{a}</span>)}
                </div>
              </div>
              <h4 style={{ fontSize: 13, marginTop: 14, color: 'var(--muted)' }}>House rules</h4>
              <ul className="spec-list">
                {item.space.rules.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          )}

          <div className="panel">
            <div className="owner-row">
              <Avatar name={owner.name} id={owner.id} size={46} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>
                  {owner.name} {owner.verified && <Badge tone="green"><Icon name="check" size={14} /> Verified</Badge>}
                  {owner.superOwner && <Badge tone="orange"><Icon name="crown" size={14} /> Super Owner</Badge>}
                </b>
                <div className="muted small">
                  <RatingCompact rating={owner.rating} count={owner.ratingCount} /> · replies in ~{owner.responseMins} min · {owner.area} · {owner.distanceKm} km · since {owner.memberSince}
                </div>
              </div>
            </div>
            {!item.mine && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-outline btn-sm" style={{ position: 'relative' }} onClick={() => setChatOpen(true)}>
                <Icon name="chat" size={14} /> Chat with owner{chatUnread > 0 && <span className="dot" style={{ position: 'absolute', top: -5, right: -5, background: 'var(--accent)', color: '#fff', borderRadius: 999, minWidth: 17, height: 17, lineHeight: '17px', fontSize: 10, fontWeight: 700 }}>{chatUnread}</span>}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setReportOpen(true)}><Icon name="flag" size={14} /> Report</button>
            </div>
            )}
          </div>

          <div className="panel">
            <h3 style={{ fontSize: 16 }}>Reviews</h3>
            <div className="histo">
              {histo.map((count, i) => {
                const total = histo.reduce((a, b) => a + b, 0) || 1
                return (
                  <FragmentRow key={i} stars={5 - i} count={count} pct={(count / total) * 100} />
                )
              })}
            </div>
            {myReviews.map((rv) => (
              <div className="review" key={rv.id}>
                <div className="review-head">
                  <b>{rv.author} <Badge>You</Badge></b>
                  <Stars value={rv.rating} />
                </div>
                <div className="muted small">{rv.date}</div>
                <p style={{ margin: '6px 0 0' }}>{rv.text}</p>
              </div>
            ))}
            {item.reviews.map((rv) => (
              <div className="review" key={rv.id}>
                <div className="review-head">
                  <b>{rv.author}</b>
                  <Stars value={rv.rating} />
                </div>
                <div className="muted small">{rv.date}</div>
                <p style={{ margin: '6px 0 0' }}>{rv.text}</p>
                {rv.ownerReply && (
                  <div className="owner-reply">
                    <b style={{ fontSize: 12 }}><Avatar name={owner.name} id={owner.id} size={22} /> {owner.name} replied:</b>
                    <div>{rv.ownerReply}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ---------------- Booking panel (or manage panel for your own listing) ---------------- */}
        <div className="booking-panel-sticky">
          {item.mine ? (
            <ManagePanel itemId={item.id} />
          ) : (
          <div className="panel">
            <h3 style={{ fontSize: 16 }}><Icon name="calendar" className="h-ico" size={16} /> Book your dates</h3>

            {item.hourly && (
              <div className="unit-toggle" role="tablist">
                <button className={unit === 'day' ? 'active' : ''} onClick={() => setUnit('day')}>By day</button>
                <button className={unit === 'hour' ? 'active' : ''} onClick={() => { setUnit('hour'); setEndDate(startDate) }}>
                  By hour · {money(hourlyRate(id))}/hr
                </button>
              </div>
            )}

            <AvailabilityStrip itemId={id} selectedStart={startDate} selectedEnd={effEnd} onPick={(d) => {
              setStartDate(d)
              if (unit === 'day' && endDate < d) setEndDate(d)
            }} />

            <div className="form-row">
              <label className="field">
                Start date
                <input type="date" value={startDate} min={todayISO()} onChange={(e) => { setStartDate(e.target.value); if (unit === 'day' && endDate < e.target.value) setEndDate(e.target.value) }} />
              </label>
              {unit === 'day' ? (
                <label className="field">
                  Return date
                  <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
                </label>
              ) : (
                <label className="field">
                  Hours
                  <span className="qty-stepper">
                    <button onClick={() => setHours(Math.max(3, hours - 1))} aria-label="Fewer hours">−</button>
                    <b>{hours}h</b>
                    <button onClick={() => setHours(Math.min(14, hours + 1))} aria-label="More hours">+</button>
                  </span>
                </label>
              )}
            </div>

            <div className="field" style={{ marginTop: 10 }}>
              {transport === 'pickup' ? 'Pickup time' : 'Delivery slot'}
              <div className="slot-row">
                {TIME_SLOTS.map((t) => (
                  <button key={t} className={`slot-chip ${pickupTime === t ? 'active' : ''}`} onClick={() => setPickupTime(t)}>{t}</button>
                ))}
                <input
                  type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)}
                  style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '8px 12px', fontSize: 13, background: 'var(--card)', color: 'var(--ink)' }}
                  aria-label="Custom time"
                />
              </div>
            </div>

            <div className="form-row">
              <label className="field">
                Quantity
                <span className="qty-stepper">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease quantity">−</button>
                  <b>{qty}</b>
                  <button onClick={() => setQty(Math.min(5, qty + 1))} aria-label="Increase quantity">+</button>
                </span>
              </label>
            </div>

            {conflict ? (
              <div className="conflict-note">
                <Icon name="ban" size={14} /> Booked {fmtDate(conflict.start)}–{fmtDate(conflict.end)}.
                {nextFree && <> Next free: <button onClick={() => {
                  setStartDate(nextFree)
                  if (unit === 'day') {
                    const d = new Date(nextFree + 'T00:00:00')
                    d.setDate(d.getDate() + days - 1)
                    setEndDate(toISO(d))
                  }
                }}>{fmtDate(nextFree)} — tap to apply</button></>}
                {' · '}
                <button onClick={() => {
                  dispatch({ type: 'ADD_AVAIL_ALERT', itemId: id })
                  toast('We’ll notify you the moment it frees up')
                }}><Icon name="bell" size={14} /> Notify me</button>
              </div>
            ) : (
              <p className="muted small" style={{ margin: '10px 0 0' }}>
                <Icon name="check-circle" size={14} /> Available · {unit === 'hour' ? `${hours}h on ${fmtDate(startDate)}` : `${days} day${days > 1 ? 's' : ''} · ${fmtDate(startDate)} to ${fmtDate(effEnd)}`} at {pickupTime}
                {unit === 'day' && (days >= 7 ? ' · weekly rate (20% off)' : days >= 3 ? ' · 3+ day rate (10% off)' : '')}
              </p>
            )}

            <label className="toggle-row" style={item.insuranceRequired ? { opacity: 0.9 } : undefined}>
              <input
                type="checkbox"
                checked={item.insuranceRequired ? true : insurance}
                disabled={item.insuranceRequired}
                onChange={(e) => setInsurance(e.target.checked)}
              />
              <span>
                <b><Icon name="shield" size={14} /> Papa Damage Protection</b> — {Math.round(INSURANCE_RATE * 100)}% of rental. Covers accidental damage up to full value.
                {item.insuranceRequired && <b style={{ color: 'var(--accent-dark)' }}> Required for this item.</b>}
              </span>
            </label>
            <label className="toggle-row">
              <input type="checkbox" checked={operator} onChange={(e) => setOperator(e.target.checked)} />
              <span>
                <b><Icon name="wrench" size={14} /> Certified tech/operator</b> — {money(OPERATOR_FEE_PER_DAY)}/day. A pro who knows this gear, on set with you.
              </span>
            </label>

            <h4 style={{ fontSize: 14, marginTop: 14 }}><Icon name="van" className="h-ico" size={14} /> Transport to set</h4>
            {TRANSPORT_OPTIONS.map((t) => (
              <div key={t.id} className={`transport-opt ${transport === t.id ? 'active' : ''}`} onClick={() => setTransport(t.id)}>
                <span className="t-emoji"><Icon name={t.icon} size={14} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14 }}>{t.name}</b> <span className="muted small">· {t.eta}</span>
                  <div className="muted small">{t.detail}</div>
                </div>
                <b style={{ fontSize: 13 }}>{t.fee === 0 ? 'Free' : money(t.fee)}</b>
              </div>
            ))}

            <div className="fare-box">
              <div className="muted small">
                Recommended fare
                {negotiated && deal && <> · <Icon name="handshake" size={14} /> your deal, expires in {fmtCountdown(deal.expiresAt - Date.now())}</>}
                {dealActive(id) && <> · <DealCountdown itemId={id} /></>}
              </div>
              <div className="fare-amount">
                {money(rate)} <span style={{ fontSize: 13, fontWeight: 600 }}>/{unit}</span>
                {negotiated && <s className="muted" style={{ fontSize: 14, marginLeft: 8 }}>{money(recRate)}</s>}
              </div>
              {item.offersAccepted ? (
                <button className="btn btn-outline btn-sm btn-block" style={{ marginTop: 10 }} onClick={() => setOfferOpen(true)}>
                  <Icon name="handshake" size={14} /> Offer your price
                </button>
              ) : (
                <div className="muted small" style={{ marginTop: 8 }}>Owner has fixed pricing on this item.</div>
              )}
            </div>

            <div className="price-summary">
              <div className="price-line"><span>{money(rate)} × {duration} {unit}{duration > 1 ? 's' : ''} × {qty}</span><b>{money(sub)}</b></div>
              {(insurance || item.insuranceRequired) && <div className="price-line"><span>Damage protection</span><b>{money(insuranceFee)}</b></div>}
              {operator && <div className="price-line"><span>Operator ({days}d)</span><b>{money(operatorFee)}</b></div>}
              <div className="price-line"><span>Transport</span>{transportFee === 0 ? <b className="free">Free</b> : <b>{money(transportFee)}</b>}</div>
              <div className="price-line"><span>Deposit (hold only — released after return)</span><b>{money(item.deposit * qty)}</b></div>
              <div className="price-line total"><span>Est. charge</span><span>{money(sub + insuranceFee + operatorFee + transportFee)}</span></div>
            </div>

            <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={addToCart} disabled={Boolean(conflict) || invalidRange}>
              {conflict ? <><Icon name="ban" size={14} /> Unavailable for these dates</> : item.instantBook ? <><Icon name="bolt" size={14} /> Add to cart — instant book</> : 'Add to cart — request booking'}
            </button>
          </div>
          )}
        </div>
      </div>

      {!item.mine && (
        <div className="cta-bar">
          <div className="cta-price">
            {negotiated && <div className="small" style={{ color: 'var(--green)', fontWeight: 700 }}><Icon name="handshake" size={14} /> Your deal locked in</div>}
            <b>{money(rate)}</b><span className="muted small"> /{unit}</span>
          </div>
          <button className="btn btn-primary" disabled={Boolean(conflict) || invalidRange} onClick={addToCart}>
            {conflict ? 'Unavailable' : <><Icon name="cart" size={14} /> Add to cart</>}
          </button>
        </div>
      )}

      {alsoRented.length > 0 && (
        <div className="section">
          <div className="section-head"><h2><Icon name="backpack" className="h-ico" size={18} /> People also rented</h2></div>
          <div className="h-scroll">
            {alsoRented.map((i) => (
              <ItemCard
                key={i.id}
                item={i}
                onOpen={() => go({ name: 'item', id: i.id })}
                wishlisted={state.wishlist.includes(i.id)}
                onToggleWish={() => dispatch({ type: 'TOGGLE_WISHLIST', itemId: i.id })}
              />
            ))}
          </div>
        </div>
      )}

      {offerOpen && <OfferModal itemId={id} unit={unit} recommended={recRate} onClose={() => setOfferOpen(false)} />}
      {chatOpen && <ChatModal ownerId={owner.id} ownerName={owner.name} itemName={item.name} onClose={() => setChatOpen(false)} />}
      {reportOpen && <ReportModal targetName={owner.name} ownerId={owner.id} onClose={() => setReportOpen(false)} />}
    </div>
  )
}

/* ---------------- owner view of their own listing ---------------- */
function ManagePanel({ itemId }: { itemId: string }) {
  const { state, dispatch } = useStore()
  const { go, toast } = useNav()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const listing = state.myListings.find((l) => l.id === itemId)
  if (!listing) return null
  const pending = Boolean(listing.pendingVerifyAt)

  return (
    <div className="panel">
      <h3 style={{ fontSize: 16 }}><Icon name="sliders" className="h-ico" size={16} /> Your listing</h3>
      <div className="status-banner" style={{ marginTop: 10 }}>
        {pending ? (
          <span className="status-banner waiting" style={{ display: 'block', margin: 0 }}><Icon name="hourglass" size={14} /> Pending verification — our team is checking the details. You'll get a notification when it goes live.</span>
        ) : listing.paused ? (
          <span className="status-banner cancelled" style={{ display: 'block', margin: 0 }}><Icon name="pause" size={14} /> Paused — hidden from renters until you resume.</span>
        ) : (
          <span className="status-banner" style={{ display: 'block', margin: 0, background: 'var(--green-soft)', color: 'var(--green)' }}><Icon name="dot" size={14} className="ic-green" /> Live & verified — visible to every filmmaker on Papa Rentals.</span>
        )}
      </div>
      <div className="price-summary" style={{ borderTop: 'none' }}>
        <div className="price-line"><span>Daily rate</span><b>{money(listing.pricePerDay)}</b></div>
        {listing.hourly && <div className="price-line"><span>Hourly rate</span><b>{money(Math.round(listing.pricePerDay / 6))}/hr</b></div>}
        <div className="price-line"><span>You earn per day (after 10% fee)</span><b style={{ color: 'var(--green)' }}>{money(Math.round(listing.pricePerDay * 0.9))}</b></div>
        <div className="price-line"><span>Bookings so far</span><b>{listing.timesRented}</b></div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {!pending && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => { dispatch({ type: 'TOGGLE_LISTING_PAUSE', itemId }); toast(listing.paused ? 'Listing resumed' : 'Listing paused') }}
          >
            {listing.paused ? <><Icon name="play" size={14} /> Resume listing</> : <><Icon name="pause" size={14} /> Pause listing</>}
          </button>
        )}
        {!confirmDelete ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={14} /> Delete</button>
        ) : (
          <button
            className="btn btn-sm" style={{ background: 'var(--red)', color: '#fff' }}
            onClick={() => {
              dispatch({ type: 'DELETE_LISTING', itemId })
              toast('Listing deleted')
              go({ name: 'profile' })
            }}
          >
            Tap again to confirm delete
          </button>
        )}
      </div>
      <p className="muted small" style={{ marginBottom: 0 }}>
        Renters see your space exactly like the preview on the left. Inquiries and booking requests arrive as notifications.
      </p>
    </div>
  )
}

function FragmentRow({ stars, count, pct }: { stars: number; count: number; pct: number }) {
  // start at 0 and grow on mount so the CSS width transition plays
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(pct))
    return () => cancelAnimationFrame(raf)
  }, [pct])
  return (
    <>
      <span>{stars}<Icon name="star" size={12} /></span>
      <div className="bar"><i style={{ width: `${width}%` }} /></div>
      <span className="muted">{count}</span>
    </>
  )
}

/* ---------------- availability strip: next 14 days at a glance ---------------- */
function AvailabilityStrip({ itemId, selectedStart, selectedEnd, onPick }: {
  itemId: string
  selectedStart: string
  selectedEnd: string
  onPick: (date: string) => void
}) {
  const { state } = useStore()
  const ranges = unavailableRanges(itemId, state.orders, state.cart)
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })
  return (
    <div className="avail-strip" aria-label="Next two weeks availability">
      {days.map((d) => {
        const iso = toISO(d)
        const busy = ranges.some((r) => rangesOverlap({ start: iso, end: iso }, r))
        const sel = iso >= selectedStart && iso <= selectedEnd
        return (
          <button
            key={iso}
            className={`avail-day ${busy ? 'busy' : ''} ${sel ? 'sel' : ''}`}
            disabled={busy}
            onClick={() => onPick(iso)}
            aria-label={`${iso} ${busy ? 'booked' : 'available'}`}
          >
            {d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2)}
            <div className="d">{d.getDate()}</div>
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- inDrive-style offer flow (store-driven, survives closing) ---------------- */
function OfferModal({ itemId, unit, recommended, onClose }: { itemId: string; unit: RentalUnit; recommended: number; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const { toast } = useNav()
  const [amount, setAmount] = useState(Math.round(recommended * 0.85 / 50) * 50)
  const [sentId, setSentId] = useState<string | null>(null)

  const sent = sentId ? state.offers.find((o) => o.id === sentId) : null

  const min = Math.round(recommended * 0.5 / 50) * 50
  const max = recommended
  const pct = Math.round((amount / recommended) * 100)

  function submit() {
    buzz()
    const offer: Offer = {
      id: uid(), itemId, unit, recommendedRate: recommended, offeredRate: amount,
      status: 'pending', createdAt: Date.now(),
      resolveAt: Date.now() + 1400 + Math.random() * 1200,
      expiresAt: Date.now() + OFFER_TTL_MS,
    }
    dispatch({ type: 'ADD_OFFER', offer })
    setSentId(offer.id)
  }

  function acceptCounter() {
    if (!sent) return
    buzz()
    dispatch({ type: 'ACCEPT_COUNTER', offerId: sent.id })
    toast('Counter accepted — price locked for 24h')
    onClose()
  }

  return (
    <Modal title="Offer your price" onClose={onClose}>
      {!sent ? (
        <>
          <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
            Recommended fare is <b>{money(recommended)}/{unit}</b>. Name your price — the owner accepts, counters or declines.
            Accepted deals stay locked for 24 hours, even if you change dates.
          </p>
          <div className="fare-box">
            <div className="fare-amount">{money(amount)} /{unit}</div>
            <div className="muted small">{pct}% of recommended {pct >= 92 ? <>· <Icon name="dot" size={12} className="ic-green" /> very likely accepted</> : pct >= 72 ? <>· <Icon name="dot" size={12} className="ic-amber" /> may get countered</> : <>· <Icon name="dot" size={12} className="ic-red" /> likely declined</>}</div>
            <input
              className="offer-slider" type="range" min={min} max={max} step={50}
              value={amount} onChange={(e) => setAmount(Number(e.target.value))}
              aria-label="Your offer amount"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }} className="muted small">
              <span>{money(min)}</span><span>{money(max)}</span>
            </div>
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={submit}>
            Send offer to owner
          </button>
          <p className="muted small" style={{ textAlign: 'center', marginBottom: 0 }}>
            You can close this — we’ll notify you when the owner responds.
          </p>
        </>
      ) : sent.status === 'pending' ? (
        <div className="empty-state" style={{ padding: '30px 10px' }}>
          <div className="big"><Icon name="hourglass" size={56} /></div>
          <p>Offer of <b>{money(sent.offeredRate)}/{unit}</b> sent.<br />The owner is looking at it…</p>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close — notify me</button>
        </div>
      ) : sent.status === 'accepted' ? (
        <>
          <div className="offer-status accepted"><Icon name="check-circle" size={14} /> Accepted! Locked at {money(sent.offeredRate)}/{unit} (was {money(recommended)}) for 24h.</div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={onClose}>Book at this price</button>
        </>
      ) : sent.status === 'countered' ? (
        <>
          <div className="offer-status countered">
            <Icon name="undo" size={14} /> Owner countered with <b>{money(sent.counterRate!)}/{unit}</b> (you offered {money(sent.offeredRate)}).
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={acceptCounter}>Accept counter</button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSentId(null)}>Try again</button>
          </div>
        </>
      ) : (
        <>
          <div className="offer-status declined"><Icon name="x-circle" size={14} /> Declined — too low. Try something closer to the recommended fare.</div>
          <button className="btn btn-outline btn-block" style={{ marginTop: 12 }} onClick={() => setSentId(null)}>Make a new offer</button>
        </>
      )}
    </Modal>
  )
}

/* ---------------- chat: typing indicator, read receipts, replies survive closing ---------------- */
function ChatModal({ ownerId, ownerName, itemName, onClose }: { ownerId: string; ownerName: string; itemName: string; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [text, setText] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const thread = state.chats[ownerId]
  const msgs = thread?.messages ?? []
  const typing = Boolean(thread?.typingUntil && thread.typingUntil > Date.now())

  useEffect(() => {
    dispatch({ type: 'READ_CHAT', ownerId })
  }, [ownerId, msgs.length, dispatch])

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight })
  }, [msgs.length, typing])

  function send() {
    const t = text.trim()
    if (!t) return
    buzz()
    dispatch({
      type: 'ADD_CHAT', ownerId,
      message: { id: uid(), from: 'me', text: t, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), at: Date.now() },
    })
    setText('')
  }

  return (
    <Modal title={ownerName} onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>Asking about: {itemName}</p>
      <div className="chat-box" ref={boxRef}>
        {msgs.length === 0 && <div className="muted small" style={{ textAlign: 'center', padding: 20 }}>Say salaam — owners reply in minutes. Replies arrive even if you close this.</div>}
        {msgs.map((m, i) => {
          const delivered = m.from === 'me' && msgs.slice(i + 1).some((x) => x.from === 'owner')
          return (
            <div key={m.id} className={`chat-msg ${m.from}`}>
              {m.text}
              {m.from === 'me' && <span className="ticks">{delivered ? <><Icon name="check" size={12} /><Icon name="check" size={12} /></> : <Icon name="check" size={12} />}</span>}
            </div>
          )
        })}
        {typing && <div className="typing">{ownerName} is typing<i>…</i></div>}
      </div>
      <div className="chat-input-row">
        <input
          value={text}
          placeholder="Type a message…"
          enterKeyHint="send"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          aria-label="Message"
        />
        <button className="btn btn-primary btn-sm" onClick={send}>Send</button>
      </div>
    </Modal>
  )
}

/* ---------------- report: case numbers + block ---------------- */
const REPORT_REASONS = ['Item not as described', 'No-show / late handover', 'Unsafe or damaged equipment', 'Inappropriate behaviour', 'Suspected scam or fraud', 'Other']

export function ReportModal({ targetName, ownerId, orderId, onClose }: { targetName: string; ownerId?: string; orderId?: string; onClose: () => void }) {
  const { dispatch } = useStore()
  const { toast } = useNav()
  const [reason, setReason] = useState(REPORT_REASONS[0])
  const [note, setNote] = useState('')
  const [block, setBlock] = useState(false)

  return (
    <Modal title={`Report ${targetName}`} onClose={onClose}>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        Reports go to Trust & Safety and get a case number you can track in your profile. Serious reports freeze payouts and suspend accounts.
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
      {ownerId && (
        <label className="toggle-row">
          <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
          <span><b>Block {targetName}</b> — hide their listings and stop messages.</span>
        </label>
      )}
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 14 }}
        onClick={() => {
          const caseNo = `TS-${Date.now().toString().slice(-6)}`
          dispatch({
            type: 'REPORT', orderId, block: block ? ownerId : undefined,
            report: { id: uid(), caseNo, targetName, reason, note, date: todayISO(), status: 'under_review' },
          })
          toast(`Report filed — case ${caseNo}`)
          onClose()
        }}
      >
        Submit report
      </button>
    </Modal>
  )
}
