import { useMemo, useState } from 'react'
import { getItem, getOwner } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { downloadReceipt, fmtDate, lineDuration, money } from '../utils'
import { Badge, ItemArt } from '../components/ui'
import { Avatar, Icon } from '../components/icons'
import { OrderCard } from './OrdersView'

/* A dedicated screen per order. The list card is deliberately compact, so the
   full money breakdown, per-line detail and vendor contacts live here — and
   wallet/points history rows can link straight to the order that moved them. */
export default function OrderDetailView({ id }: { id: string }) {
  const { go, toast } = useNav()
  const { state } = useStore()
  const order = state.orders.find((o) => o.id === id)

  const rows = useMemo(() => {
    if (!order) return []
    return [
      { label: 'Gear subtotal', value: order.subtotal },
      { label: 'Delivery', value: order.transportFee },
      { label: 'Protection', value: order.insuranceFee },
      { label: 'Operator', value: order.operatorFee },
      { label: 'Service fee', value: order.serviceFee },
      { label: order.promoCode ? `Promo ${order.promoCode}` : 'Promo', value: -order.promoDiscount },
      { label: 'Tier discount', value: -order.tierDiscount },
      { label: 'Silver free delivery', value: -order.vanPerk },
      { label: 'Wallet credit used', value: -order.walletUsed },
      { label: 'Points redeemed', value: -order.pointsUsed },
    ].filter((r) => r.value !== 0)
  }, [order])

  if (!order) {
    return (
      <div className="empty-state">
        <div className="big"><Icon name="box" size={56} /></div>
        <h3>Order not found</h3>
        <p>It may have been erased with your data.</p>
        <button className="btn btn-primary" onClick={() => go({ name: 'orders' })}>All orders</button>
      </div>
    )
  }

  const owner = getOwner(getItem(order.lines[0].itemId).ownerId)

  function calendarFile() {
    const line = order!.lines[0]
    const stamp = (d: string) => d.replace(/-/g, '')
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Papa Rentals//EN', 'BEGIN:VEVENT',
      `UID:${order!.id}@paparentals`,
      `DTSTART;VALUE=DATE:${stamp(line.startDate)}`,
      `DTEND;VALUE=DATE:${stamp(line.endDate)}`,
      `SUMMARY:Papa Rentals ${order!.id} — ${getItem(line.itemId).name}`,
      `DESCRIPTION:Pickup ${line.pickupTime}. ${order!.lines.length} item(s). Delivering to ${order!.address}`,
      `LOCATION:${order!.address}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n')
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${order!.id}.ics`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast('Added to your calendar downloads')
  }

  async function share() {
    const text = `Tracking my Papa Rentals order ${order!.id} — ${order!.status.replace('_', ' ')}.`
    if (navigator.share) {
      try { await navigator.share({ text }); return } catch { /* dismissed */ }
    }
    toast(`Order ${order!.id} · ${order!.status.replace('_', ' ')}`)
  }

  return (
    <div className="section">
      <button className="back-btn" onClick={() => go({ name: 'orders' })}>
        <Icon name="chevron-left" size={16} /> Orders
      </button>

      <OrderCard order={order} />

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 15 }}><Icon name="box" size={16} /> What you booked</h3>
        {order.lines.map((l) => {
          const item = getItem(l.itemId)
          return (
            <button
              key={l.id}
              className="list-row"
              style={{ width: '100%', cursor: 'pointer', alignItems: 'center' }}
              onClick={() => go({ name: 'item', id: item.id })}
            >
              <span style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                <ItemArt item={item} size="thumb" />
                <span style={{ minWidth: 0 }}>
                  <b>{item.name}</b>
                  <span className="muted small" style={{ display: 'block' }}>
                    {fmtDate(l.startDate)} → {fmtDate(l.endDate)} · {lineDuration(l)} {l.unit === 'hour' ? 'hr' : 'day'}
                    {lineDuration(l) > 1 ? 's' : ''} · ×{l.qty}
                  </span>
                </span>
              </span>
              <span className="muted small">{money(l.rate)}/{l.unit}{l.negotiated && <> <Badge tone="green">deal</Badge></>}</span>
            </button>
          )
        })}
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 15 }}><Icon name="receipt" size={16} /> Payment breakdown</h3>
        {rows.map((r) => (
          <div key={r.label} className="list-row">
            <span className="muted">{r.label}</span>
            <span style={{ color: r.value < 0 ? 'var(--ok, #1a7f37)' : undefined }}>
              {r.value < 0 ? `− ${money(-r.value)}` : money(r.value)}
            </span>
          </div>
        ))}
        <div className="list-row" style={{ fontWeight: 800 }}>
          <span>Total charged</span><span>{money(order.total)}</span>
        </div>
        <div className="list-row">
          <span className="muted">Deposit hold</span>
          <span className="muted">
            {money(order.depositHold)} — {order.depositReleased || order.status === 'completed' ? 'released' : 'held until return, never charged'}
          </span>
        </div>
        <div className="list-row">
          <span className="muted">Paid with</span><span className="muted">{order.paymentMethod}</span>
        </div>
        {order.pointsEarned > 0 && (
          <button className="list-row" style={{ width: '100%', cursor: 'pointer' }} onClick={() => go({ name: 'wallet' })}>
            <span><Icon name="trophy" size={16} /> Points earned</span>
            <span className="muted">+{order.pointsEarned} pts <Icon name="chevron-right" size={14} /></span>
          </button>
        )}
        <button className="btn btn-outline btn-block" style={{ marginTop: 10 }} onClick={() => downloadReceipt(order)}>
          <Icon name="scroll" size={14} /> Download invoice
        </button>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 15 }}><Icon name="truck" size={16} /> Delivery</h3>
        <div className="list-row"><span className="muted">Address</span><span style={{ textAlign: 'right' }}>{order.address}</span></div>
        <div className="list-row"><span className="muted">Pickup time</span><span>{order.lines[0].pickupTime}</span></div>
        <div className="list-row"><span className="muted">Ordered</span><span>{fmtDate(order.createdAt)}</span></div>
        {order.driver && (
          <div className="list-row">
            <span className="muted">Driver</span>
            <span>{order.driver.name} · {order.driver.vehicle} · PIN {order.driver.pin}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={calendarFile}>
            <Icon name="calendar" size={14} /> Add to calendar
          </button>
          <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={share}>
            <Icon name="send" size={14} /> Share tracking
          </button>
        </div>
      </div>

      {(order.status === 'in_use' || order.status === 'returned') && <ReturnChecklist orderId={order.id} />}

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 15 }}><Icon name="store" size={16} /> Vendor</h3>
        <div className="owner-row">
          <Avatar name={owner.name} id={owner.id} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{owner.name} {owner.verified && <Badge tone="green"><Icon name="check" size={13} /> Verified</Badge>}</b>
            <div className="muted small">{owner.area} · replies in ~{owner.responseMins} min</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => go({ name: 'inbox' })}>
            <Icon name="chat" size={14} /> Message
          </button>
          <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => go({ name: 'vendor', id: owner.id })}>
            <Icon name="store" size={14} /> Vendor page
          </button>
        </div>
      </div>

      <button className="btn btn-ghost btn-block" style={{ marginTop: 14 }} onClick={() => go({ name: 'support', orderId: order.id })}>
        <Icon name="headset" size={14} /> Get help with {order.id}
      </button>
    </div>
  )
}

const RETURN_STEPS = [
  'Batteries and chargers back in the case',
  'Lens caps, hoods and filters accounted for',
  'Cables, plates and mounting hardware packed',
  'Memory cards emptied and returned',
  'Photos taken of the gear before handover',
  'Case sealed and labelled with the order ID',
]

/* Missing accessories are the single biggest source of deposit disputes. A
   checklist you tick before handover is cheaper than a claim afterwards. */
function ReturnChecklist({ orderId }: { orderId: string }) {
  const key = `papa-return-${orderId}`
  const [ticked, setTicked] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
  })

  function toggle(step: string) {
    const next = ticked.includes(step) ? ticked.filter((s) => s !== step) : [...ticked, step]
    setTicked(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* storage unavailable */ }
  }

  return (
    <div className="panel" style={{ marginTop: 14 }}>
      <h3 style={{ fontSize: 15 }}><Icon name="check-circle" size={16} /> Return checklist</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        {ticked.length}/{RETURN_STEPS.length} done. Anything missing at inspection comes out of your deposit hold.
      </p>
      {RETURN_STEPS.map((s) => (
        <label key={s} className="toggle-row">
          <input type="checkbox" checked={ticked.includes(s)} onChange={() => toggle(s)} />
          <span>{s}</span>
        </label>
      ))}
    </div>
  )
}
