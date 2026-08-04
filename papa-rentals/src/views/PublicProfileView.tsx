import { useMemo } from 'react'
import { getItem, getOwner } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { VERIFY_STEPS, displayName, fmtDate, verifiedCount } from '../utils'
import { Badge, Stars } from '../components/ui'
import { Avatar, Icon } from '../components/icons'

/* Ratings here have always been two-way and blind — the owner rates you at the
   same moment you rate them — and yet the renter's half went nowhere anybody
   could look. An owner deciding whether to hand over a Rs 150,000 camera saw a
   number on a booking request and no way to see what it was made of.

   This is that page, shown to its owner as a preview. It deliberately renders
   only what an owner would actually be given: no wallet, no points, no contact
   details, no order history. If it showed more it would stop being useful as a
   preview, which is the one thing it is for. */
export default function PublicProfileView() {
  const { go } = useNav()
  const { state } = useStore()

  const completed = state.orders.filter((o) => o.status === 'completed')
  const rated = completed.filter((o) => o.ownerRatingOfMe != null)
  const rating = rated.length
    ? rated.reduce((s, o) => s + (o.ownerRatingOfMe ?? 0), 0) / rated.length
    : null

  /* Which vendors this renter has actually worked with, newest first. A repeat
     booking is the strongest signal a profile like this can carry, so it is
     counted rather than flattened into a vendor list. */
  const vendors = useMemo(() => {
    const seen = new Map<string, { name: string; times: number; last: string }>()
    for (const o of completed) {
      for (const l of o.lines) {
        const v = getOwner(getItem(l.itemId).ownerId)
        const prev = seen.get(v.id)
        seen.set(v.id, { name: v.name, times: (prev?.times ?? 0) + 1, last: prev?.last ?? o.createdAt })
      }
    }
    return [...seen.values()].sort((a, b) => b.times - a.times)
  }, [completed])

  const verified = verifiedCount(state.profile)
  const cancelled = state.orders.filter((o) => o.status === 'cancelled').length
  /* Shown as a rate, not a raw count: "2 cancelled" reads as damning next to a
     hidden 40 completed, and as ordinary next to a visible one. */
  const reliability = state.orders.length
    ? Math.round((completed.length / state.orders.length) * 100)
    : null

  return (
    <div className="section">
      <button className="back-btn" onClick={() => go({ name: 'profile' })}>
        <Icon name="chevron-left" size={16} /> Profile
      </button>

      <div className="panel pub-note">
        <Icon name="user" size={16} />
        <span>This is your renter profile exactly as an owner sees it when you request a booking.</span>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="owner-row">
          <Avatar name={displayName(state.profile.name)} id="me" size={54} src={state.profile.avatar} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: 16 }}>{displayName(state.profile.name)}</b>
            <div className="muted small">
              <span className="ellipsis" style={{ maxWidth: '100%' }}><Icon name="pin" size={13} /> {state.profile.city}</span>
            </div>
            <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {verified === VERIFY_STEPS.length
                ? <Badge tone="green"><Icon name="check" size={13} /> Verified renter</Badge>
                : <Badge tone="default"><Icon name="shield" size={13} /> {verified}/{VERIFY_STEPS.length} verified</Badge>}
              {completed.length >= 5 && <Badge tone="purple"><Icon name="medal" size={13} /> Regular</Badge>}
            </div>
          </div>
        </div>
      </div>

      <div className="ref-stats">
        <div className="ref-stat">
          <b>{rating ? rating.toFixed(1) : '—'}</b>
          <span className="muted small">{rated.length ? `from ${rated.length}` : 'no ratings'}</span>
        </div>
        <div className="ref-stat"><b>{completed.length}</b><span className="muted small">completed</span></div>
        <div className="ref-stat">
          <b>{reliability == null ? '—' : `${reliability}%`}</b>
          <span className="muted small">completed of booked</span>
        </div>
      </div>

      {rating != null && (
        <div className="panel" style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 15 }}><Icon name="star" size={16} /> How owners rated this renter</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stars value={rating} size={16} /> <b>{rating.toFixed(1)}</b>
            <span className="muted small">across {rated.length} {rated.length === 1 ? 'rental' : 'rentals'}</span>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ fontSize: 15 }}><Icon name="store" size={16} /> Vendors worked with</h3>
        {vendors.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            No completed rentals yet. Owners will see this as a new renter — most still approve, it just isn't instant.
          </p>
        ) : (
          vendors.map((v) => (
            <div key={v.name} className="list-row" style={{ cursor: 'default', gap: 10 }}>
              <span style={{ flex: 1, minWidth: 0 }} className="ellipsis">{v.name}</span>
              <span className="muted small">
                {v.times > 1 ? `${v.times} rentals` : '1 rental'} · since {fmtDate(v.last)}
              </span>
            </div>
          ))
        )}
      </div>

      {cancelled > 0 && (
        <p className="muted small" style={{ marginTop: 12 }}>
          {cancelled} cancelled {cancelled === 1 ? 'booking' : 'bookings'} is included in the rate above — owners see it
          either way, so it is shown here rather than quietly left out.
        </p>
      )}

      <button className="btn btn-outline btn-block" style={{ marginTop: 14 }} onClick={() => go({ name: 'profile' })}>
        Back to your profile
      </button>
    </div>
  )
}
