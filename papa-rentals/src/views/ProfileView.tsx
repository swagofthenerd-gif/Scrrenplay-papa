import { useState } from 'react'
import { getOwner } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { GOLD_POINTS, SILVER_POINTS, buzz, money } from '../utils'
import { Badge, ItemArt, Stars, useCountUp } from '../components/ui'
import { Icon, Avatar } from '../components/icons'

export default function ProfileView() {
  const { go, toast } = useNav()
  const { state, dispatch } = useStore()

  const completed = state.orders.filter((o) => o.status === 'completed')
  const ownerRatings = completed.map((o) => o.ownerRatingOfMe).filter((r): r is number => r != null)
  const myRating = ownerRatings.length ? ownerRatings.reduce((a, b) => a + b, 0) / ownerRatings.length : 5
  const tier = state.points >= GOLD_POINTS ? 'Gold Papa' : state.points >= SILVER_POINTS ? 'Silver Papa' : 'Bronze Papa'
  const nextTier = state.points >= GOLD_POINTS ? null : state.points >= SILVER_POINTS
    ? { name: 'Gold', at: GOLD_POINTS }
    : { name: 'Silver', at: SILVER_POINTS }
  const acceptedOffers = state.offers.filter((o) => o.status === 'accepted').length
  const [refCode, setRefCode] = useState('')
  const pendingRequests = state.ownerBookings.filter((b) => b.status === 'pending').length
  const chatThreads = Object.entries(state.chats).filter(([, t]) => t.messages.length > 0)
  const unreadTotal = chatThreads.reduce((s, [, t]) => s + t.unread, 0)
  const shownBalance = useCountUp(state.walletBalance)
  const shownPoints = useCountUp(state.points)

  return (
    <div className="section">
      <div className="section-head"><h2><Icon name="user" className="h-ico" size={18} /> Your profile</h2></div>

      <div className="panel">
        <div className="owner-row">
          <Avatar name={state.profile.name || 'You'} id="me" size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{state.profile.name || 'Filmmaker'} <Badge tone="green"><Icon name="check" size={14} /> ID Verified</Badge> <Badge tone="purple">{tier}</Badge></b>
            <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Icon name="pin" size={14} /> {state.profile.city} · renter rating <Stars value={myRating} size={12} /> {myRating.toFixed(1)} · {completed.length} completed
            </div>
          </div>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Owners see your rating when you request bookings — a strong renter score unlocks instant-book on premium gear.
        </p>
      </div>

      <div className="wallet-card">
        <div style={{ color: '#d6d3d1', fontSize: 13 }}><Icon name="wallet" size={14} /> Papa Wallet</div>
        <div className="balance">{money(shownBalance)}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={() => { buzz(); dispatch({ type: 'ADD_WALLET', amount: 10000 }); toast('Rs 10,000 added to wallet') }}>
            + Top up Rs 10,000
          </button>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile"><div className="stat-num"><Icon name="trophy" size={16} /> {shownPoints}</div><div className="muted small">PapaPoints</div></div>
        <div className="stat-tile"><div className="stat-num"><Icon name="box" size={16} /> {state.orders.length}</div><div className="muted small">Orders</div></div>
        <div className="stat-tile"><div className="stat-num"><Icon name="heart-filled" size={16} /> {state.wishlist.length}</div><div className="muted small">Wishlist</div></div>
      </div>

      {nextTier && (
        <div className="panel" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
            <span>{tier}</span><span className="muted">{nextTier.name} at {nextTier.at} pts</span>
          </div>
          <div className="histo" style={{ gridTemplateColumns: '1fr', margin: '8px 0 0' }}>
            <div className="bar" style={{ height: 10 }}><i style={{ width: `${Math.min(100, (state.points / nextTier.at) * 100)}%` }} /></div>
          </div>
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            {nextTier.at - state.points} points to go — earn 1 pt per Rs 100 spent, redeem 1 pt = Rs 1 at checkout.
          </p>
        </div>
      )}

      <div className="list-row" style={{ cursor: 'pointer' }} onClick={() => go({ name: 'dashboard' })}>
        <span><Icon name="chart" size={16} /> Host dashboard</span>
        <span className="muted">{pendingRequests > 0 ? <>{pendingRequests} request{pendingRequests > 1 ? 's' : ''} waiting <Icon name="arrow-right" size={14} /></> : <>Earnings &amp; requests <Icon name="arrow-right" size={14} /></>}</span>
      </div>
      <div className="list-row" style={{ cursor: 'pointer' }} onClick={() => go({ name: 'support' })}>
        <span><Icon name="headset" size={16} /> Help Center</span><span className="muted">24/7 support <Icon name="arrow-right" size={14} /></span>
      </div>

      <div className="list-row" style={{ cursor: 'pointer' }} onClick={() => go({ name: 'browse', wishlistOnly: true })}>
        <span><Icon name="heart-filled" size={16} /> Your wishlist</span><span className="muted">{state.wishlist.length} items <Icon name="arrow-right" size={14} /></span>
      </div>
      <div
        className="list-row"
        style={{ cursor: 'pointer' }}
        onClick={() => { navigator.clipboard?.writeText('PAPA-FRIEND-500').catch(() => {}); toast('Your code copied: PAPA-FRIEND-500') }}
      >
        <span><Icon name="gift" size={16} /> Refer a filmmaker</span><span className="muted">You both get Rs 500 <Icon name="arrow-right" size={14} /></span>
      </div>
      {!state.referralRedeemed && (
        <div className="panel" style={{ marginTop: 10 }}>
          <b style={{ fontSize: 14 }}>Got a referral code?</b>
          <div className="promo-row" style={{ marginTop: 8 }}>
            <input placeholder="PAPA-XXXX" value={refCode} onChange={(e) => setRefCode(e.target.value)} aria-label="Referral code" />
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                if (/^PAPA-/i.test(refCode.trim())) {
                  dispatch({ type: 'REDEEM_REFERRAL', code: refCode.trim() })
                  toast('Rs 500 added to your wallet')
                } else {
                  toast('Codes look like PAPA-XXXX')
                }
              }}
            >
              Redeem
            </button>
          </div>
        </div>
      )}
      <div className="list-row">
        <span><Icon name="handshake" size={16} /> Offers you've made</span>
        <span className="muted">
          {state.offers.length === 0 ? 'None yet' : `${acceptedOffers}/${state.offers.length} accepted`}
        </span>
      </div>
      <div className="list-row">
        <span><Icon name="chat" size={16} /> Chats</span>
        <span className="muted">
          {chatThreads.length === 0 ? 'None yet' : `${chatThreads.length} thread${chatThreads.length > 1 ? 's' : ''}${unreadTotal > 0 ? ` · ${unreadTotal} unread` : ''}`}
        </span>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15 }}><Icon name="home" size={16} /> Your listings</h3>
          <button className="btn btn-outline btn-sm" onClick={() => go({ name: 'post' })}>+ List a space</button>
        </div>
        {state.myListings.length === 0 ? (
          <p className="muted small" style={{ marginBottom: 0 }}>
            Studios, rooftops, havelis, warehouses — post any space crews would shoot at and keep 90% of every booking.
          </p>
        ) : (
          state.myListings.map((l) => (
            <div
              key={l.id}
              style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--line)', cursor: 'pointer' }}
              onClick={() => go({ name: 'item', id: l.id })}
            >
              <ItemArt item={l} size="thumb" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>{l.name}</b>
                <div className="muted small">{money(l.pricePerDay)}/day · {l.space?.type}</div>
              </div>
              {l.pendingVerifyAt ? <Badge tone="orange"><Icon name="hourglass" size={14} /> Verifying</Badge> : l.paused ? <Badge tone="red"><Icon name="pause" size={14} /> Paused</Badge> : <Badge tone="green"><Icon name="dot" size={14} className="ic-green" /> Live</Badge>}
            </div>
          ))
        )}
      </div>

      {state.reports.length > 0 && (
        <div className="panel" style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 15 }}><Icon name="flag" size={16} /> Your reports</h3>
          {state.reports.map((r) => (
            <div key={r.id} className="review">
              <div className="review-head">
                <b>{r.caseNo} · {r.targetName}</b>
                <Badge tone={r.status === 'under_review' ? 'orange' : 'green'}>{r.status === 'under_review' ? 'Under review' : 'Resolved'}</Badge>
              </div>
              <div className="muted small">{r.reason} · filed {r.date}</div>
            </div>
          ))}
        </div>
      )}

      {state.blockedOwners.length > 0 && (
        <div className="panel" style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 15 }}><Icon name="ban" size={16} /> Blocked</h3>
          {state.blockedOwners.map((id) => (
            <div key={id} className="review" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={getOwner(id).name} id={id} size={40} /> {getOwner(id).name}</span>
              <span className="muted small">listings hidden</span>
            </div>
          ))}
        </div>
      )}

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 15 }}><Icon name="trophy" size={16} /> PapaPoints perks</h3>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Earn 1 point per Rs 100 spent, redeem anytime at checkout. <b>Silver (500)</b>: one free van delivery every month — applied automatically.
          <b> Gold (2000)</b>: 5% off everything, automatically, plus priority support and early access to hero gear.
        </p>
      </div>

    </div>
  )
}
