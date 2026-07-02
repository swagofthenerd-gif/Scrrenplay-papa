import { useNav } from '../nav'
import { useStore } from '../store'
import { money } from '../utils'
import { Badge, Stars } from '../components/ui'

export default function ProfileView() {
  const { go, toast } = useNav()
  const { state, dispatch } = useStore()

  const completed = state.orders.filter((o) => o.status === 'completed')
  const ownerRatings = completed.map((o) => o.ownerRatingOfMe ?? 5)
  const myRating = ownerRatings.length ? ownerRatings.reduce((a, b) => a + b, 0) / ownerRatings.length : 5
  const tier = state.points >= 2000 ? '🥇 Gold Papa' : state.points >= 500 ? '🥈 Silver Papa' : '🥉 Bronze Papa'

  return (
    <div className="section">
      <div className="section-head"><h2>👤 Your profile</h2></div>

      <div className="panel">
        <div className="owner-row">
          <div className="owner-avatar">🎬</div>
          <div style={{ flex: 1 }}>
            <b>Filmmaker <Badge tone="green">✔︎ ID Verified</Badge> <Badge tone="purple">{tier}</Badge></b>
            <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Your renter rating: <Stars value={myRating} /> {myRating.toFixed(1)} · {completed.length} completed rental{completed.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Owners see your rating when you request bookings — a strong renter score unlocks instant-book on premium gear.
        </p>
      </div>

      <div className="wallet-card">
        <div className="muted" style={{ color: '#d6d3d1', fontSize: 13 }}>👛 Papa Wallet</div>
        <div className="balance">{money(state.walletBalance)}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={() => { dispatch({ type: 'ADD_WALLET', amount: 10000 }); toast('Rs 10,000 added to wallet 👛') }}>
            + Top up Rs 10,000
          </button>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile"><div className="stat-num">🏆 {state.points}</div><div className="muted small">PapaPoints</div></div>
        <div className="stat-tile"><div className="stat-num">📦 {state.orders.length}</div><div className="muted small">Orders</div></div>
        <div className="stat-tile"><div className="stat-num">♥ {state.wishlist.length}</div><div className="muted small">Wishlist</div></div>
      </div>

      <div className="list-row" style={{ cursor: 'pointer' }} onClick={() => go({ name: 'browse', wishlistOnly: true })}>
        <span>♥ Your wishlist</span><span className="muted">{state.wishlist.length} items →</span>
      </div>
      <div
        className="list-row"
        style={{ cursor: 'pointer' }}
        onClick={() => { navigator.clipboard?.writeText('PAPA-FRIEND-500').catch(() => {}); toast('Referral code copied: PAPA-FRIEND-500 🎁') }}
      >
        <span>🎁 Refer a filmmaker</span><span className="muted">You both get Rs 500 →</span>
      </div>
      <div className="list-row">
        <span>🤝 Offers you've made</span>
        <span className="muted">
          {state.offers.length === 0 ? 'None yet' : `${state.offers.filter((o) => o.status === 'accepted').length}/${state.offers.length} accepted`}
        </span>
      </div>
      <div className="list-row">
        <span>🚩 Reports filed</span><span className="muted">{state.reports.length}</span>
      </div>
      <div className="list-row">
        <span>🛡️ Trust & Safety</span><span className="muted">24/7 on-set support</span>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 15 }}>🏆 PapaPoints perks</h3>
        <p className="muted small">
          Earn 1 point per Rs 100 spent. <b>Silver (500)</b>: free van delivery once a month. <b>Gold (2000)</b>: 5% off everything + priority support + early access to hero gear.
        </p>
      </div>
    </div>
  )
}
