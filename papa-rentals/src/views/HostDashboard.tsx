import { getItem } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { buzz, fmtDate, fmtTimeAgo, money } from '../utils'
import { Badge, ItemArt, Stars } from '../components/ui'
import { Icon } from '../components/icons'
import type { OwnerBooking } from '../types'

export default function HostDashboard() {
  const { go, back, toast } = useNav()
  const { state, dispatch } = useStore()

  const pending = state.ownerBookings.filter((b) => b.status === 'pending')
  const active = state.ownerBookings.filter((b) => ['accepted', 'completed'].includes(b.status))
  const history = state.ownerBookings.filter((b) => ['paid_out', 'declined'].includes(b.status))
  const paidOut = state.ownerBookings.filter((b) => b.status === 'paid_out')
  const totalEarned = paidOut.reduce((s, b) => s + Math.round(b.total * 0.9), 0)
  const pendingPayout = active.reduce((s, b) => s + Math.round(b.total * 0.9), 0)
  const liveListings = state.myListings.filter((l) => l.listingVerified && !l.paused).length

  if (state.myListings.length === 0) {
    return (
      <div className="empty-state">
        <div className="big"><Icon name="home" size={56} /></div>
        <h3>No listings yet</h3>
        <p>Post a studio, rooftop or any space crews would shoot at — booking requests land here.</p>
        <button className="btn btn-primary" onClick={() => go({ name: 'post' })}>List your space</button>
      </div>
    )
  }

  return (
    <div className="section">
      <button className="back-btn" onClick={back}><Icon name="chevron-left" size={16} /> Back</button>
      <div className="section-head" style={{ marginTop: 4 }}>
        <h2><Icon name="chart" className="h-ico" /> Host dashboard</h2>
        <button className="link-btn" onClick={() => go({ name: 'post' })}>+ New listing</button>
      </div>

      <div className="wallet-card" style={{ marginTop: 4 }}>
        <div style={{ color: '#d6d3d1', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="coins" size={14} /> Total earned as host</div>
        <div className="balance">{money(totalEarned)}</div>
        <div style={{ color: '#d6d3d1', fontSize: 13, marginTop: 6 }}>
          {money(pendingPayout)} pending payout · {liveListings} live listing{liveListings === 1 ? '' : 's'} · payouts land in your wallet within 24h
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile"><div className="stat-num"><Icon name="mail" size={16} /> {pending.length}</div><div className="muted small">Requests</div></div>
        <div className="stat-tile"><div className="stat-num"><Icon name="clapperboard" size={16} /> {active.length}</div><div className="muted small">Active</div></div>
        <div className="stat-tile"><div className="stat-num"><Icon name="flag-checkered" size={16} /> {paidOut.length}</div><div className="muted small">Paid out</div></div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 15 }}><Icon name="mail" className="h-ico" size={15} /> Booking requests</h3>
        {pending.length === 0 ? (
          <p className="muted small" style={{ marginBottom: 0 }}>
            No open requests. Renters are browsing — verified listings usually get their first request within minutes.
          </p>
        ) : (
          pending.map((b) => <RequestCard key={b.id} booking={b} onAct={(accepted) => {
            buzz()
            dispatch({ type: accepted ? 'ACCEPT_OWNER_BOOKING' : 'DECLINE_OWNER_BOOKING', id: b.id })
            toast(accepted ? `Accepted — ${b.renterName} is booked` : 'Request declined')
          }} />)
        )}
      </div>

      {active.length > 0 && (
        <div className="panel">
          <h3 style={{ fontSize: 15 }}><Icon name="clapperboard" className="h-ico" size={15} /> Active bookings</h3>
          {active.map((b) => (
            <BookingRow key={b.id} booking={b} badge={
              b.status === 'accepted'
                ? <Badge tone="green">Booked</Badge>
                : <Badge tone="purple"><Icon name="coins" size={12} /> Payout processing</Badge>
            } />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="panel">
          <h3 style={{ fontSize: 15 }}><Icon name="scroll" className="h-ico" size={15} /> History</h3>
          {history.map((b) => (
            <BookingRow key={b.id} booking={b} badge={
              b.status === 'paid_out'
                ? <Badge tone="green">Paid {money(Math.round(b.total * 0.9))}</Badge>
                : <Badge tone="red">Declined</Badge>
            } />
          ))}
        </div>
      )}
    </div>
  )
}

function RequestCard({ booking: b, onAct }: { booking: OwnerBooking; onAct: (accepted: boolean) => void }) {
  const listing = getItem(b.listingId)
  const dur = b.unit === 'hour' ? b.hours : undefined
  const baseRate = b.unit === 'hour' ? Math.round(listing.pricePerDay / 6) : listing.pricePerDay
  const isOffer = b.rate < baseRate
  return (
    <div style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <ItemArt item={listing} size="thumb" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 14 }}>{b.renterName}</b> <Stars value={b.renterRating} size={11} /> <span className="muted small">{b.renterRating}</span>
          <div className="muted small">
            {listing.name} · {b.unit === 'hour' ? `${dur}h on ${fmtDate(b.startDate)}` : `${fmtDate(b.startDate)} to ${fmtDate(b.endDate)}`} · {fmtTimeAgo(b.requestedAt)}
          </div>
          <div style={{ fontSize: 13, marginTop: 2 }}>
            {isOffer ? (
              <span><Icon name="handshake" size={13} /> Offered <b>{money(b.rate)}/{b.unit}</b> <s className="muted small">{money(baseRate)}</s> · total <b>{money(b.total)}</b></span>
            ) : (
              <span>At your rate · total <b>{money(b.total)}</b></span>
            )}
            <span className="muted small"> · you get {money(Math.round(b.total * 0.9))}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => onAct(true)}><Icon name="check" size={14} /> Accept</button>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => onAct(false)}><Icon name="x" size={14} /> Decline</button>
      </div>
    </div>
  )
}

function BookingRow({ booking: b, badge }: { booking: OwnerBooking; badge: React.ReactNode }) {
  const listing = getItem(b.listingId)
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', borderTop: '1px solid var(--line)', padding: '10px 0', fontSize: 13 }}>
      <ItemArt item={listing} size="thumb" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{b.renterName}</b> · {listing.name}
        <div className="muted small">
          {b.unit === 'hour' ? `${b.hours}h on ${fmtDate(b.startDate)}` : `${fmtDate(b.startDate)} to ${fmtDate(b.endDate)}`} · {money(b.total)}
        </div>
      </div>
      {badge}
    </div>
  )
}
