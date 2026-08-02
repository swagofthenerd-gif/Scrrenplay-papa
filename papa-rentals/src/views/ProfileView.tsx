import { useState } from 'react'
import { getItem, getOwner } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { GOLD_POINTS, SILVER_POINTS, buzz, fmtTimeAgo, money } from '../utils'
import { Badge, ItemArt, Modal, Stars, useCountUp } from '../components/ui'
import { Icon, Avatar } from '../components/icons'

const REFERRAL_CODE = 'PAPA-FRIEND-500'
const TOP_UPS = [2000, 5000, 10000, 25000]

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
  const [editOpen, setEditOpen] = useState(false)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [showOffers, setShowOffers] = useState(false)
  const [copied, setCopied] = useState(false)
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
            <b>{state.profile.name || 'Filmmaker'}{' '}
              {state.profile.idVerified
                ? <Badge tone="green"><Icon name="check" size={14} /> ID Verified</Badge>
                : <Badge tone="default"><Icon name="shield" size={14} /> Unverified</Badge>}{' '}
              <Badge tone="purple">{tier}</Badge></b>
            <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Icon name="pin" size={14} /> {state.profile.city} ·{' '}
              {completed.length === 0 ? (
                <>New renter — your first completed rental starts your score</>
              ) : (
                <>renter rating <Stars value={myRating} size={12} /> {myRating.toFixed(1)} · {completed.length} completed</>
              )}
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setEditOpen(true)}>Edit</button>
        </div>
        <p className="muted small" style={{ marginBottom: state.profile.idVerified ? 0 : 10 }}>
          Owners see your rating when you request bookings — a strong renter score unlocks instant-book on premium gear.
        </p>
        {!state.profile.idVerified && (
          <div className="list-row" style={{ alignItems: 'center', gap: 10, margin: 0 }}>
            <Icon name="shield" size={18} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 13 }}>Verify your ID</b>
              <div className="muted small" style={{ margin: 0 }}>Verified renters get faster owner approvals and instant-book access.</div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                buzz()
                dispatch({ type: 'VERIFY_ID' })
                toast('ID verified')
              }}
            >
              Verify
            </button>
          </div>
        )}
      </div>

      <div className="wallet-card">
        <div style={{ color: '#d6d3d1', fontSize: 13 }}><Icon name="wallet" size={14} /> Papa Wallet</div>
        <div className="balance">{money(shownBalance)}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setTopUpOpen(true)}>+ Top up</button>
          <button className="btn btn-outline btn-sm" onClick={() => go({ name: 'wallet' })}>History</button>
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
            <div
              className="bar"
              style={{ height: 10 }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={nextTier.at}
              aria-valuenow={state.points}
              aria-label={`${state.points} of ${nextTier.at} points towards ${nextTier.name}`}
            ><i style={{ width: `${Math.min(100, (state.points / nextTier.at) * 100)}%` }} /></div>
          </div>
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            {nextTier.at - state.points} points to go — earn 1 pt per Rs 100 spent, redeem 1 pt = Rs 1 at checkout.
          </p>
        </div>
      )}

      <button className="list-row" style={{ cursor: 'pointer', width: '100%' }} onClick={() => go({ name: 'dashboard' })}>
        <span><Icon name="chart" size={16} /> Host dashboard</span>
        <span className="muted">{pendingRequests > 0 ? <>{pendingRequests} request{pendingRequests > 1 ? 's' : ''} waiting <Icon name="arrow-right" size={14} /></> : <>Earnings &amp; requests <Icon name="arrow-right" size={14} /></>}</span>
      </button>
      <button className="list-row" style={{ cursor: 'pointer', width: '100%' }} onClick={() => go({ name: 'support' })}>
        <span><Icon name="headset" size={16} /> Help Center</span><span className="muted">24/7 support <Icon name="arrow-right" size={14} /></span>
      </button>

      <button className="list-row" style={{ cursor: 'pointer', width: '100%' }} onClick={() => go({ name: 'browse', wishlistOnly: true })}>
        <span><Icon name="heart-filled" size={16} /> Your wishlist</span><span className="muted">{state.wishlist.length} items <Icon name="arrow-right" size={14} /></span>
      </button>
      <button
        className="list-row"
        style={{ cursor: 'pointer', width: '100%' }}
        onClick={async () => {
          const text = `Rent film gear on Papa Rentals — use my code ${REFERRAL_CODE} and we both get Rs 500.`
          // the WebView blocks the clipboard, so try the share sheet first and always show the code
          if (navigator.share) {
            try {
              await navigator.share({ text })
              return
            } catch {
              /* user dismissed, or share unavailable */
            }
          }
          try {
            await navigator.clipboard?.writeText(REFERRAL_CODE)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            toast(`Your code: ${REFERRAL_CODE}`)
          }
        }}
      >
        <span><Icon name="gift" size={16} /> Refer a filmmaker — <b>{REFERRAL_CODE}</b></span>
        <span className="muted">{copied ? <>Copied <Icon name="check" size={14} /></> : <>You both get Rs 500 <Icon name="arrow-right" size={14} /></>}</span>
      </button>
      {!state.referralRedeemed && (
        <div className="panel" style={{ marginTop: 10 }}>
          <b style={{ fontSize: 14 }}>Got a referral code?</b>
          <div className="promo-row" style={{ marginTop: 8 }}>
            <input placeholder="PAPA-XXXX" value={refCode} onChange={(e) => setRefCode(e.target.value)} aria-label="Referral code" />
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                const code = refCode.trim().toUpperCase()
                if (code === REFERRAL_CODE) {
                  toast('That\u2019s your own code — share it with a friend instead')
                  return
                }
                if (!/^PAPA-[A-Z0-9]{3,12}(-\d{2,5})?$/.test(code)) {
                  toast('Codes look like PAPA-XXXX or PAPA-XXXX-500')
                  return
                }
                dispatch({ type: 'REDEEM_REFERRAL', code })
                toast('Rs 500 added to your wallet')
              }}
            >
              Redeem
            </button>
          </div>
        </div>
      )}
      <button
        className="list-row"
        style={{ width: '100%', cursor: state.offers.length ? 'pointer' : 'default' }}
        aria-expanded={showOffers}
        disabled={state.offers.length === 0}
        onClick={() => setShowOffers(!showOffers)}
      >
        <span><Icon name="handshake" size={16} /> Offers you've made</span>
        <span className="muted">
          {state.offers.length === 0 ? 'None yet' : <>{acceptedOffers}/{state.offers.length} accepted <Icon name={showOffers ? 'chevron-down' : 'chevron-right'} size={14} /></>}
        </span>
      </button>
      {showOffers && state.offers.length > 0 && (
        <div className="panel" style={{ marginTop: 8 }}>
          {[...state.offers].sort((a, b) => b.createdAt - a.createdAt).map((o) => (
            <button
              key={o.id}
              className="list-row"
              style={{ width: '100%', cursor: 'pointer' }}
              onClick={() => go({ name: 'item', id: o.itemId })}
            >
              <span style={{ minWidth: 0 }}>
                <b>{getItem(o.itemId).name}</b>
                <span className="muted small"> · {money(o.offeredRate)}/{o.unit} offered {fmtTimeAgo(o.createdAt)}</span>
              </span>
              <Badge tone={o.status === 'accepted' ? 'green' : o.status === 'declined' || o.status === 'expired' ? 'red' : 'orange'}>{o.status}</Badge>
            </button>
          ))}
        </div>
      )}
      <button className="list-row" style={{ width: '100%', cursor: 'pointer' }} onClick={() => go({ name: 'inbox' })}>
        <span><Icon name="chat" size={16} /> Messages</span>
        <span className="muted">
          {chatThreads.length === 0 ? 'None yet' : <>{chatThreads.length} thread{chatThreads.length > 1 ? 's' : ''}{unreadTotal > 0 ? ` · ${unreadTotal} unread` : ''}</>} <Icon name="chevron-right" size={14} />
        </span>
      </button>
      <button className="list-row" style={{ width: '100%', cursor: 'pointer' }} onClick={() => go({ name: 'settings' })}>
        <span><Icon name="sliders" size={16} /> Settings</span>
        <span className="muted">Notifications, payouts, privacy <Icon name="chevron-right" size={14} /></span>
      </button>

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
              {l.pendingVerifyAt ? <Badge tone="orange"><Icon name="hourglass" size={14} /> Verifying — usually live within a day</Badge> : l.paused ? <Badge tone="red"><Icon name="pause" size={14} /> Paused</Badge> : <Badge tone="green"><Icon name="dot" size={14} className="ic-green" /> Live</Badge>}
              {!l.pendingVerifyAt && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_LISTING_PAUSE', itemId: l.id }) }}
                >
                  {l.paused ? 'Resume' : 'Pause'}
                </button>
              )}
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
              <button className="btn btn-ghost btn-sm" onClick={() => { dispatch({ type: 'UNBLOCK_OWNER', ownerId: id }); toast('Unblocked — their listings are back') }}>
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 15 }}><Icon name="trophy" size={16} /> PapaPoints perks</h3>
        <p className="muted small">Earn 1 point per Rs 100 spent. Redeem anytime at checkout — 1 point = Rs 1.</p>
        <div className="list-row"><span><Icon name="medal" size={16} /> Silver — 500 pts</span><span className="muted">One free van delivery a month, applied automatically</span></div>
        <div className="list-row"><span><Icon name="crown" size={16} /> Gold — 2,000 pts</span><span className="muted">5% off everything, priority support, early access</span></div>
      </div>

      {editOpen && <EditProfileModal onClose={() => setEditOpen(false)} />}
      {topUpOpen && <TopUpModal onClose={() => setTopUpOpen(false)} />}
    </div>
  )
}

function EditProfileModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore()
  const { toast } = useNav()
  const [name, setName] = useState(state.profile.name)
  const [city, setCity] = useState(state.profile.city)

  return (
    <Modal title="Edit your profile" onClose={onClose}>
      <label className="field">
        Name
        <input value={name} placeholder="Your name" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field" style={{ marginTop: 10 }}>
        City
        <input value={city} placeholder="Your city" onChange={(e) => setCity(e.target.value)} />
      </label>
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 14 }}
        disabled={!city.trim()}
        onClick={() => {
          dispatch({ type: 'SET_PROFILE', name: name.trim(), city: city.trim() })
          toast('Profile updated')
          onClose()
        }}
      >
        Save
      </button>
    </Modal>
  )
}

function TopUpModal({ onClose }: { onClose: () => void }) {
  const { dispatch } = useStore()
  const { toast } = useNav()
  const [amount, setAmount] = useState(10000)

  return (
    <Modal title="Top up your wallet" onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Wallet credit is spent before your card at checkout. Credit from refunds and referrals can't be withdrawn to a bank.
      </p>
      <div className="filter-row">
        {TOP_UPS.map((a) => (
          <button key={a} className={`filter-chip ${amount === a ? 'active' : ''}`} onClick={() => setAmount(a)}>{money(a)}</button>
        ))}
      </div>
      <label className="field" style={{ marginTop: 10 }}>
        Or enter an amount
        <input
          type="number"
          inputMode="numeric"
          min={500}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
        />
      </label>
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 14 }}
        disabled={amount < 500}
        onClick={() => {
          buzz()
          dispatch({ type: 'ADD_WALLET', amount })
          toast(`${money(amount)} added to wallet`)
          onClose()
        }}
      >
        Add {money(amount)}
      </button>
    </Modal>
  )
}
