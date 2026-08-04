import { memo, useEffect, useMemo, useState } from 'react'
import { getItem, getOwner } from '../data/catalog'
import { useNav } from '../nav'
import { driverThreadId, orderThreadId, useStore } from '../store'
import type { Order, OrderStatus } from '../types'
import { buzz, downloadReceipt, fmtCountdown, fmtDate, money, shiftBooking, todayISO, uid } from '../utils'
import { Badge, ItemArt, Modal, Stars } from '../components/ui'
import { Icon, type IconName } from '../components/icons'
import { ReportModal } from './ItemDetail'
import { TransitMap } from '../components/TransitMap'

const STEPS: { id: OrderStatus; label: string; icon: IconName }[] = [
  { id: 'confirmed', label: 'Confirmed', icon: 'check' },
  { id: 'preparing', label: 'Preparing', icon: 'box' },
  { id: 'in_transit', label: 'On the way', icon: 'van' },
  { id: 'in_use', label: 'On set', icon: 'clapperboard' },
  { id: 'returned', label: 'Returned', icon: 'undo' },
  { id: 'completed', label: 'Done', icon: 'flag-checkered' },
]

/* "Returned — owner is inspecting; deposit hold release is queued" is the line
   the rest of these are measured against: it names who is doing what, and what
   happens next. A status that only names itself makes people refresh. */
const STATUS_HINT: Record<OrderStatus, string> = {
  requested: 'With the owner for approval — they have your dates and your rate. Most reply inside ten minutes.',
  confirmed: 'Owner has accepted. Your dates are held against this gear and nobody else can book them.',
  preparing: 'Being tested, charged and packed — batteries topped up, media formatted, case checked off.',
  in_transit: 'Your gear is on the way — share the PIN at handover.',
  in_use: 'Shoot day! Gear is with you. Support is one tap away.',
  returned: 'Gear returned. Owner is inspecting; deposit hold release is queued.',
  completed: 'All done — deposit hold released. Rate your experience!',
  cancelled: 'This order was cancelled.',
}

type OrdersTab = 'active' | 'completed' | 'cancelled'

const TABS: { id: OrdersTab; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

function tabOf(o: Order): OrdersTab {
  if (o.status === 'cancelled') return 'cancelled'
  if (o.status === 'completed') return 'completed'
  return 'active'
}

/* Accountants ask for "everything I spent last quarter", not one PDF at a time.
   CSV opens in every spreadsheet and needs no extra dependency. */
function exportStatement(months: { label: string; orders: Order[] }[], tab: OrdersTab) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const rows = [['Order', 'Date', 'Month', 'Status', 'Items', 'Subtotal', 'Fees', 'Discounts', 'Total paid'].join(',')]
  for (const m of months) {
    for (const o of m.orders) {
      const fees = o.transportFee + o.insuranceFee + o.operatorFee + o.serviceFee
      const discounts = o.promoDiscount + o.tierDiscount + o.vanPerk + o.walletUsed + o.pointsUsed
      rows.push([
        esc(o.id), esc(o.createdAt), esc(m.label), esc(o.status),
        esc(o.lines.map((l) => getItem(l.itemId).name).join(' + ')),
        o.subtotal, fees, discounts, o.total,
      ].join(','))
    }
  }
  const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `papa-rentals-${tab}-statement.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export default function OrdersView() {
  const { go } = useNav()
  const { state } = useStore()
  const [tab, setTab] = useState<OrdersTab>('active')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'amount'>('newest')

  const counts = useMemo(() => {
    const c: Record<OrdersTab, number> = { active: 0, completed: 0, cancelled: 0 }
    for (const o of state.orders) c[tabOf(o)]++
    return c
  }, [state.orders])

  /* Months are built off the filtered list so an empty month never renders a stray heading. */
  const months = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = state.orders.filter((o) => tabOf(o) === tab)
    if (q) {
      list = list.filter(
        (o) => o.id.toLowerCase().includes(q) || o.lines.some((l) => getItem(l.itemId).name.toLowerCase().includes(q))
      )
    }
    const sorted = [...list].sort((a, b) => {
      if (sort === 'amount') return b.total - a.total
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sort === 'oldest' ? diff : -diff
    })
    const out: { label: string; orders: Order[] }[] = []
    for (const o of sorted) {
      const label = monthLabel(o.createdAt)
      const last = out[out.length - 1]
      if (last && last.label === label) last.orders.push(o)
      else out.push({ label, orders: [o] })
    }
    return out
  }, [state.orders, tab, query, sort])

  if (state.orders.length === 0) {
    return (
      <div className="empty-state">
        <div className="big"><Icon name="box" size={56} /></div>
        <h3>No orders yet</h3>
        <p>Your bookings and their live status will appear here.</p>
        <button className="btn btn-primary" onClick={() => go({ name: 'browse' })}>Find gear</button>
      </div>
    )
  }

  return (
    <div className="section">
      <div className="section-head"><h2><Icon name="box" className="h-ico" size={18} /> Your orders</h2></div>

      <div className="filter-row" role="tablist" aria-label="Order status">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`filter-chip ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label} {counts[t.id] > 0 && <b>({counts[t.id]})</b>}
          </button>
        ))}
      </div>

      <div className="promo-row" style={{ marginTop: 10 }}>
        <input
          value={query}
          placeholder="Search by order ID or gear"
          aria-label="Search orders"
          enterKeyHint="search"
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort orders">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="amount">Highest amount</option>
        </select>
      </div>

      {months.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => exportStatement(months, tab)}>
            <Icon name="scroll" size={14} /> Export statement (CSV)
          </button>
        </div>
      )}

      {months.length === 0 ? (
        <div className="empty-state" style={{ padding: '30px 10px' }}>
          <div className="big"><Icon name="search" size={44} /></div>
          <p>{query ? `No ${tab} orders match “${query}”.` : `No ${tab} orders yet.`}</p>
          {query && <button className="btn btn-outline btn-sm" onClick={() => setQuery('')}>Clear search</button>}
        </div>
      ) : (
        months.map((m) => (
          <div key={m.label}>
            <h3 className="muted small" style={{ margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>{m.label}</h3>
            {m.orders.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        ))
      )}
    </div>
  )
}

export const OrderCard = memo(function OrderCard({ order }: { order: Order }) {
  const { state, dispatch } = useStore()
  const { toast, go } = useNav()
  const [rateOpen, setRateOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)
  const [claimOpen, setClaimOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const stepIdx = STEPS.findIndex((s) => s.id === order.status)
  /* getItem/getOwner scan the catalog — do it once per order, not once per render row. */
  const lines = useMemo(() => order.lines.map((b) => ({ booking: b, item: getItem(b.itemId) })), [order.lines])
  const firstItem = lines[0].item
  const owner = getOwner(firstItem.ownerId)
  const vendors = useMemo(
    () => [...new Map(lines.map(({ item }) => { const o = getOwner(item.ownerId); return [o.id, o] as const })).values()],
    [lines]
  )
  const driverUnread = state.chats[driverThreadId(order.id)]?.unread ?? 0
  const done = order.status === 'completed'
  const orderClaims = state.claims.filter((c) => c.orderId === order.id)
  const hasClaim = orderClaims.length > 0
  /* A three-item order can have two broken items. Blocking the whole order after
     one claim meant the second one had to go through support as a message. */
  const claimableLeft = order.lines.filter(
    (l) => l.insurance && !orderClaims.some((c) => c.itemName === getItem(l.itemId).name)
  ).length
  const cancelled = order.status === 'cancelled'
  const cancellable = ['requested', 'confirmed', 'preparing'].includes(order.status)

  function bookAgain() {
    buzz()
    let added = 0
    for (const l of order.lines) {
      dispatch({ type: 'ADD_TO_CART', booking: { ...shiftBooking(l, todayISO(2)), id: uid(), negotiated: false } })
      added++
    }
    const lostDeal = order.lines.some((l) => l.negotiated)
    toast(
      lostDeal
        ? `${added} item${added > 1 ? 's' : ''} re-added at list price — your negotiated rate doesn't carry over`
        : `${added} item${added > 1 ? 's' : ''} re-added — fresh dates set, adjust in cart`
    )
    go({ name: 'cart' })
  }

  type Action = { label: string; icon: IconName; run: () => void }

  const actions: Action[] = []
  if (done && !order.myRatingOfOwner) actions.push({ label: 'Rate this rental', icon: 'star', run: () => setRateOpen(true) })
  else if (done) actions.push({ label: 'Edit your rating', icon: 'star', run: () => setRateOpen(true) })
  if (hasClaim) actions.push({ label: 'Track your claim', icon: 'shield', run: () => go({ name: 'support', orderId: order.id }) })
  if (order.status === 'in_use') actions.push({ label: 'Extend rental', icon: 'calendar', run: () => setExtendOpen(true) })
  actions.push({ label: 'Track this order', icon: 'box', run: () => go({ name: 'order', id: order.id }) })
  if (done || cancelled) actions.push({ label: 'Book again', icon: 'repeat', run: bookAgain })
  /* One row per vendor: a cart can span several, and a single "message the vendor"
     silently picked whoever owned the first line. */
  for (const o of vendors) {
    actions.push({ label: `Message ${o.name} about ${order.id}`, icon: 'chat', run: () => go({ name: 'inbox', ownerId: orderThreadId(order.id, o.id) }) })
  }
  if ((done || order.status === 'returned' || order.status === 'in_use') && claimableLeft > 0) {
    actions.push({
      label: hasClaim ? 'File another damage claim' : 'File a damage claim',
      icon: 'shield',
      run: () => setClaimOpen(true),
    })
  }
  actions.push({ label: `Get help with ${order.id}`, icon: 'headset', run: () => go({ name: 'support', orderId: order.id }) })
  actions.push({ label: cancelled ? 'Download cancellation receipt' : 'Download receipt', icon: 'receipt', run: () => downloadReceipt(order) })
  if (cancellable) actions.push({ label: 'Cancel order', icon: 'undo', run: () => setCancelOpen(true) })
  /* Report = the vendor or the gear was wrong. Claim = something broke and money
     is owed. Two different teams read them, so the labels have to say so. */
  if (!order.reported && !cancelled) actions.push({ label: 'Report a problem with the vendor', icon: 'flag', run: () => setReportOpen(true) })
  if (import.meta.env.DEV && !done && !cancelled) {
    actions.push({ label: 'Skip ahead (demo)', icon: 'skip', run: () => { buzz(); dispatch({ type: 'ADVANCE_ORDER', orderId: order.id }) } })
  }

  const [primary, ...more] = actions

  return (
    <div className="order-card">
      <div className="order-head">
        <div>
          <button
            onClick={() => go({ name: 'order', id: order.id })}
            style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 800, color: 'var(--accent)', cursor: 'pointer' }}
            aria-label={`Open order ${order.id}`}
          >
            {order.id} <Icon name="chevron-right" size={13} />
          </button>{' '}
          <span className="muted small">{new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {order.paymentMethod}</span>
          {order.reported && <Badge tone="red"><Icon name="flag" size={14} /> Reported</Badge>}
          {order.extendedDays ? <Badge tone="purple">+{order.extendedDays}d extended</Badge> : null}
        </div>
        <b>{money(order.total)}</b>
      </div>

      {order.status === 'requested' && (
        <div className="status-banner waiting"><Icon name="hourglass" size={16} /> {STATUS_HINT.requested}</div>
      )}
      {cancelled && (
        <div className="status-banner cancelled">
          <Icon name="undo" size={16} /> Cancelled {order.cancelledAt && `on ${new Date(order.cancelledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
          {order.refundedToWallet ? ` · ${money(order.refundedToWallet)} refunded to wallet` : ''}
          {order.cancellationFee ? ` (10% late fee: ${money(order.cancellationFee)})` : ''}
        </div>
      )}

      {!cancelled && (
        <>
          <div className="timeline" style={order.status === 'requested' ? { opacity: 0.45 } : undefined}>
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`step ${i < stepIdx ? 'done' : i === stepIdx ? 'current' : ''}`}
                aria-current={i === stepIdx ? 'step' : undefined}
                aria-label={`Step ${i + 1} of ${STEPS.length}: ${s.label}${i === stepIdx ? ' (current)' : i < stepIdx ? ' (done)' : ''}`}
              >
                <div className="bubble"><Icon name={i < stepIdx ? 'check' : s.icon} size={14} /></div>
                {s.label}
              </div>
            ))}
          </div>
          <p className="muted small" style={{ margin: '4px 0 10px' }}>
            {STATUS_HINT[order.status]}
            {/* A stage with a start time reads as somebody working on it; the same
                stage with no time reads as a progress bar that might be stuck. */}
            {order.statusAt && order.status !== 'completed' && (
              <> · {STEPS.find((s) => s.id === order.status)?.label ?? 'In progress'} since{' '}
                {new Date(order.statusAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</>
            )}
            {' · '}Ordered {new Date(order.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
          {/* ORDERS-25: nobody should feel they have to keep this screen open. */}
          {['requested', 'confirmed', 'preparing'].includes(order.status) && (
            <p className="muted small" style={{ margin: '-6px 0 10px' }}>
              <Icon name="bell" size={13} /> You'll get a notification the moment it's on the way — no need to watch this page.
            </p>
          )}
        </>
      )}

      {order.status === 'in_transit' && order.driver && (
        <>
          {/* A multi-vendor order is one van doing a round, so naming only the
              first pickup would be wrong. The distance is the longest leg — the
              run isn't done until the furthest vendor has been collected. */}
          <TransitMap
            from={vendors.length > 1 ? `${vendors.length} pickups · ${vendors.map((v) => v.area).join(', ')}` : owner.area}
            to={order.address}
            distanceKm={Math.max(...vendors.map((v) => v.distanceKm))}
            startedAt={order.statusAt}
            arrivesAt={order.autoAdvanceAt}
          />
          <div className="driver-card">
            <Icon name="driver" size={26} />
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 14 }}>{order.driver.name}</b>
              <div className="muted small">{order.driver.vehicle}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="muted small">Handover PIN</div>
              <button
                className="pin"
                aria-label={`Handover PIN ${String(order.driver.pin).split('').join(' ')} — tap to copy`}
                title="Tap to copy — read it out to the driver at handover"
                style={{ border: 0, cursor: 'pointer' }}
                onClick={async () => {
                  const pin = order.driver?.pin ?? ''
                  buzz()
                  try {
                    await navigator.clipboard.writeText(pin)
                    toast(`PIN ${pin} copied`)
                  } catch {
                    /* clipboard is blocked inside the Android WebView — showing it is enough */
                    toast(`Handover PIN: ${pin}`)
                  }
                }}
              >
                {order.driver.pin}
              </button>
            </div>
            {/* Calling was the only way to reach the driver, which is the wrong
                default on a shoot: you are often somewhere too loud to talk, and
                "gate code is 4417, come to the back" is a thing you want written
                down rather than shouted once. Call stays for when it's urgent. */}
            <div className="driver-contact">
              <button className="btn btn-outline btn-sm" onClick={() => go({ name: 'inbox', ownerId: driverThreadId(order.id) })}>
                <Icon name="chat" size={14} /> Message {order.driver.name.split(' ')[0]}
                {driverUnread > 0 && <Badge tone="orange">{driverUnread}</Badge>}
              </button>
              <a className="btn btn-outline btn-sm" href={`tel:${order.driver.phone.replace(/\s/g, '')}`}>
                <Icon name="phone" size={14} /> Call
              </a>
            </div>
          </div>
          {order.autoAdvanceAt && <Eta at={order.autoAdvanceAt} />}
          <p className="muted small" style={{ margin: '0 0 8px' }}>Share the PIN with {order.driver.name.split(' ')[0]} to confirm handover — that's your proof of delivery.</p>
        </>
      )}

      {lines.map(({ booking: b, item }, i) => {
        return (
          <div key={b.id ?? i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', fontSize: 13 }}>
            <ItemArt item={item} size="thumb" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{item.name}</b> {b.negotiated && <Badge tone="purple"><Icon name="handshake" size={14} /></Badge>}
              <div className="muted small">
                {b.unit === 'hour' ? `${fmtDate(b.startDate)} · ${b.hours}h` : <>{fmtDate(b.startDate)} <Icon name="arrow-right" size={14} /> {fmtDate(b.endDate)}</>} · ×{b.qty}
              </div>
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {done && order.lineRatings?.[i] != null && <Stars value={order.lineRatings[i]} size={11} />}
              {money(b.rate)}/{b.unit === 'hour' ? 'hr' : 'd'}
            </span>
          </div>
        )
      })}

      {done && order.myRatingOfOwner && (
        <p style={{ fontSize: 13, margin: '10px 0 0' }}>
          You rated: <Stars value={order.myRatingOfOwner} size={12} /> · {order.ownerRatingOfMe != null ? <>Owner rated you: <Stars value={order.ownerRatingOfMe} size={12} /></> : <span className="muted">Owner rating pending</span>} <Badge tone="green">Published together <Icon name="check" size={14} /></Badge>
        </p>
      )}

      {/* One obvious next step, everything else behind "More" — the row used to
          render up to eight equal-weight buttons with no hierarchy at all. */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }} role="group" aria-label={`Actions for order ${order.id}`}>
        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={primary.run}>
          <Icon name={primary.icon} size={14} /> {primary.label}
        </button>
        <button
          className="btn btn-outline btn-sm"
          aria-expanded={menuOpen}
          aria-label={`More actions for order ${order.id}`}
          onClick={() => setMenuOpen((v) => !v)}
        >
          More <Icon name={menuOpen ? 'chevron-down' : 'chevron-right'} size={14} />
        </button>
      </div>

      {menuOpen && (
        <div style={{ marginTop: 6 }}>
          {more.map((a) => (
            <button
              key={a.label}
              className="list-row"
              style={{ width: '100%', cursor: 'pointer' }}
              onClick={() => { setMenuOpen(false); a.run() }}
            >
              <span><Icon name={a.icon} size={16} /> {a.label}</span>
              <span className="muted"><Icon name="chevron-right" size={14} /></span>
            </button>
          ))}
        </div>
      )}

      {done && (
        <p className="small" style={{ color: 'var(--green)', fontWeight: 700, margin: '10px 0 0' }}>
          <Icon name="trophy" size={14} />{' '}
          <button className="link-btn" style={{ padding: 0, minHeight: 0 }} onClick={() => go({ name: 'wallet' })}>
            +{order.pointsEarned} PapaPoints earned
          </button>{' '}
          · deposit hold of {money(order.depositHold)} released back to your card <Icon name="check" size={14} />
        </p>
      )}

      {rateOpen && (
        <RateModal
          order={order}
          ownerName={owner.name}
          onClose={() => setRateOpen(false)}
          onDone={() => toast('Both ratings published together — no retaliation possible')}
        />
      )}
      {reportOpen && <ReportModal targetName={owner.name} ownerId={owner.id} orderId={order.id} onClose={() => setReportOpen(false)} />}
      {cancelOpen && <CancelModal order={order} onClose={() => setCancelOpen(false)} />}
      {extendOpen && <ExtendModal order={order} onClose={() => setExtendOpen(false)} />}
      {claimOpen && <ClaimModal order={order} onClose={() => setClaimOpen(false)} />}
    </div>
  )
})

/* A live "arriving in" beats a static status line — it's the one number people
   reload the screen for. Ticks once a second only while a delivery is moving. */
function Eta({ at }: { at: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const left = at - now
  return (
    <p className="small" style={{ margin: '0 0 8px', fontWeight: 700 }}>
      <Icon name="clock" size={14} /> {left > 0 ? <>Arriving in {fmtCountdown(left)}</> : 'Arriving any moment — keep your phone handy'}
    </p>
  )
}

/* ---------------- cancel with clear policy ---------------- */
function CancelModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { dispatch } = useStore()
  const { toast } = useNav()
  /* Counting calendar days made "inside 48h" mean anything from 24 to 72,
     depending on the hour you cancelled — and the fee is real money. Pickup
     time is on every line, so the window can be the window. */
  const hoursToStart = Math.min(
    ...order.lines.map((l) => (new Date(`${l.startDate}T${l.pickupTime || '09:00'}`).getTime() - Date.now()) / 3600000)
  )
  const startsSoon = hoursToStart < 48
  const fee = order.status === 'requested' || !startsSoon ? 0 : Math.round(order.total * 0.1)
  const refund = order.total - fee + order.walletUsed

  return (
    <Modal title="Cancel this order?" onClose={onClose}>
      <div className="price-summary" style={{ borderTop: 'none' }}>
        <div className="price-line"><span>Amount paid</span><b>{money(order.total + order.walletUsed)}</b></div>
        {fee > 0 && <div className="price-line"><span>Late cancellation fee (inside 48h)</span><b style={{ color: 'var(--red)' }}>−{money(fee)}</b></div>}
        <div className="price-line total"><span>Refund to wallet</span><span style={{ color: 'var(--green)' }}>{money(refund)}</span></div>
        <div className="price-line"><span className="muted">Deposit hold</span><span className="muted">released immediately</span></div>
      </div>
      <p className="muted small">{fee === 0 ? 'You’re outside the 48-hour window — this cancellation is free.' : 'Your rental starts within 48 hours, so a 10% fee applies.'}</p>
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
  const { go, toast } = useNav()
  const [days, setDays] = useState(1)
  const dayLines = order.lines.filter((l) => l.unit === 'day')
  const cost = dayLines.reduce((s, l) => s + l.rate * l.qty * days, 0)
  const fromWallet = Math.min(state.walletBalance, cost)

  /* An hourly booking genuinely can't be stretched — the slot after yours may
     belong to somebody else. But "make a fresh booking instead" was a dead end
     that handed the work back: the same gear, the same dates to re-pick, found
     again by hand. The one thing this sheet can still do is put it in the cart. */
  if (dayLines.length === 0) {
    const hourly = order.lines.filter((l) => l.unit === 'hour')
    return (
      <Modal title="Book another block" onClose={onClose}>
        <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
          Hourly slots can't be stretched — the block after yours may already belong to another crew. Same gear, fresh
          hours, and your dates are yours to set in the cart.
        </p>
        {hourly.map((l) => (
          <div key={l.id} className="price-line">
            <span>{getItem(l.itemId).name} <span className="muted small">· {l.hours}h × {l.qty}</span></span>
            <b>{money(l.rate)}/hr</b>
          </div>
        ))}
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 12 }}
          onClick={() => {
            buzz()
            for (const l of hourly) {
              dispatch({ type: 'ADD_TO_CART', booking: { ...shiftBooking(l, todayISO(0)), id: uid(), negotiated: false } })
            }
            toast(`${hourly.length} item${hourly.length > 1 ? 's' : ''} in your cart — pick the hours before paying`)
            onClose()
            go({ name: 'cart' })
          }}
        >
          Add {hourly.length > 1 ? `all ${hourly.length}` : 'it'} to cart again
        </button>
      </Modal>
    )
  }

  return (
    <Modal title="Shoot ran over? Extend it." onClose={onClose}>
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
          toast(`Extended by ${days} day${days > 1 ? 's' : ''}`)
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
  const { state, dispatch } = useStore()
  const { toast } = useNav()
  /* Insured lines that haven't already been claimed. Offering one that has been
     is offering a form that will be rejected. */
  const filed = state.claims.filter((c) => c.orderId === order.id).map((c) => c.itemName)
  const insuredLines = order.lines.filter((l) => l.insurance && !filed.includes(getItem(l.itemId).name))
  const [lineIdx, setLineIdx] = useState(0)
  const [reason, setReason] = useState(CLAIM_REASONS[0])
  const line = insuredLines[lineIdx]
  const item = getItem(line.itemId)
  const maxAmount = item.deposit * line.qty
  /* Most approved claims are a repair, not a write-off, so the field opens on a
     repair-shaped number rather than on a round ten thousand that means nothing. */
  const typical = Math.round((maxAmount * 0.25) / 500) * 500
  const [amount, setAmount] = useState(Math.min(typical || 5000, maxAmount))
  const [photos, setPhotos] = useState(0)

  return (
    <Modal title="File a damage claim" onClose={onClose}>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        Papa Protection covers accidental damage up to full value. Approved claims are credited to your Papa Wallet within 24 hours, and withdrawable to your bank from there. Damaged more than one item? File this one, then open another claim for the next.
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
        Photos of the damage
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setPhotos(e.target.files ? e.target.files.length : 0)}
        />
      </label>
      <p className="muted small" style={{ margin: '4px 0 0' }}>
        {photos > 0
          ? `${photos} photo${photos > 1 ? 's' : ''} attached — claims with photos are approved about twice as fast.`
          : 'Optional, but claims with photos are approved about twice as fast.'}
      </p>
      <label className="field" style={{ marginTop: 10 }}>
        Claim amount (up to {money(maxAmount)})
        <input
          type="number" inputMode="numeric" value={amount} min={500} max={maxAmount}
          onChange={(e) => setAmount(Math.min(maxAmount, Math.max(0, Number(e.target.value) || 0)))}
        />
      </label>
      {/* The ceiling is the deposit, which is the write-off price. Naming the
          shape of a normal claim is what stops people either lowballing a real
          repair or asking for the whole deposit over a scratched lens hood. */}
      <p className="muted small" style={{ margin: '4px 0 0' }}>
        Most claims are repairs — around {money(typical)} for this item. Ask for the full {money(maxAmount)} only if it can't be repaired.
        Assessors settle on the repair quote, so an honest number is approved faster.
      </p>
      <button
        className="btn btn-primary btn-block" style={{ marginTop: 14 }}
        disabled={amount < 500}
        onClick={() => {
          buzz()
          dispatch({ type: 'FILE_CLAIM', orderId: order.id, itemName: item.name, reason, amount })
          toast('Claim filed — track it in Help Center')
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
  const [ratings, setRatings] = useState<number[]>(order.lines.map((_, i) => order.lineRatings?.[i] ?? 5))
  const [texts, setTexts] = useState<string[]>(order.lines.map((_, i) => order.lineReviews?.[i] ?? ''))
  const multi = order.lines.length > 1

  return (
    <Modal title={`Rate ${ownerName}`} onClose={onClose}>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        Ratings are two-way and blind: the owner has already rated you, and both publish the moment you submit — nobody can retaliate.
      </p>
      {/* The note used to be one field labelled "applies to each item", and it did
          — the same sentence was published as a review of the camera and of the
          tripod. A note belongs to the thing it was written about, so each line
          gets its own and blank lines publish nothing. */}
      {order.lines.map((l, i) => {
        const item = getItem(l.itemId)
        return (
          <div key={i} style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, minWidth: 0 }}>
                <ItemArt item={item} size="thumb" /> <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</b>
              </span>
              <Stars value={ratings[i]} size={13} onChange={(v) => setRatings(ratings.map((r, j) => (j === i ? v : r)))} />
            </div>
            <label className="field" style={{ marginTop: 6 }}>
              <span className="sr-only">Review of {item.name} (optional)</span>
              <input
                value={texts[i]}
                placeholder={multi ? `How was the ${item.name}?` : 'How was the gear and the handover?'}
                enterKeyHint="done"
                onChange={(e) => setTexts(texts.map((t, j) => (j === i ? e.target.value : t)))}
              />
            </label>
          </div>
        )
      })}
      <button
        className="btn btn-primary btn-block" style={{ marginTop: 14 }}
        onClick={() => {
          buzz()
          dispatch({ type: 'RATE_ORDER', orderId: order.id, ratings, texts })
          onDone()
          onClose()
        }}
      >
        Publish ratings
      </button>
    </Modal>
  )
}
