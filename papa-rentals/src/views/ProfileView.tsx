import { useState } from 'react'
import { getItem, getOwner } from '../data/catalog'
import { useNav } from '../nav'
import { REFERRAL_BONUS, useStore } from '../store'
import { GOLD_POINTS, SILVER_POINTS, NAME_FALLBACK, buzz, fmtTimeAgo, money, displayName, toAvatarDataUrl } from '../utils'
import { Badge, ItemArt, Modal, Stars, useCountUp } from '../components/ui'
import { Icon, Avatar, type IconName } from '../components/icons'
import type { UserReport } from '../types'


/* One source for what each tier buys you, read by both the perk list and the
   progress line. Written out twice, they drifted the moment one changed. */
const TIER_PERKS: { at: number; label: string }[] = [
  { at: 0, label: 'Redeem points against any booking' },
  { at: SILVER_POINTS, label: 'A free van delivery every month' },
  { at: GOLD_POINTS, label: '5% off every rental' },
  { at: GOLD_POINTS, label: 'Priority support and early access to new gear' },
]
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
  /* A countered offer is a question waiting on the renter — the dashboard gives
     that kind of number a pill, and it should mean the same thing here. */
  const waitingOffers = state.offers.filter((o) => o.status === 'countered').length
  const [editOpen, setEditOpen] = useState(false)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [openCase, setOpenCase] = useState<string | null>(null)
  /* The toast said "+Rs 10,000" in the corner while the balance counted up on
     its own on the other side of the screen, and nothing connected the two. The
     amount now rises out of the balance it just joined. */
  const [credited, setCredited] = useState(0)
  const [showOffers, setShowOffers] = useState(false)
  const referralsEarned = state.referrals.reduce((n, f) => n + f.earned, 0)
  const pendingRequests = state.ownerBookings.filter((b) => b.status === 'pending').length
  /* Hosting had a door to the dashboard and no number beside it, so the one
     question a host opens this screen with — did it make anything — needed a
     tap to answer. Counted from the bookings that actually completed or paid
     out this calendar month; anything still pending is not money. */
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const earnedThisMonth = state.ownerBookings
    .filter((b) => ['completed', 'paid_out'].includes(b.status) && (b.payoutAt ?? b.completesAt ?? b.requestedAt) >= monthStart)
    .reduce((sum, b) => sum + Math.round(b.total * 0.9), 0)
  const chatThreads = Object.entries(state.chats).filter(([, t]) => t.messages.length > 0)
  const unreadTotal = chatThreads.reduce((s, [, t]) => s + t.unread, 0)
  /* A brand-new renter met three tiles reading zero and four rows reading
     "None yet" — a profile that describes an absence. The same screen can hand
     them the four things worth doing instead, ticking off as they do them. */
  const firstRun: { label: string; hint: string; icon: IconName; done: boolean; run: () => void }[] = [
    { label: 'Verify your ID', hint: 'Faster approvals, instant-book access', icon: 'shield', done: Boolean(state.profile.idVerified), run: () => setEditOpen(true) },
    { label: 'Save something you like', hint: 'Tap the heart on any listing', icon: 'heart', done: state.wishlist.length > 0, run: () => go({ name: 'browse' }) },
    { label: 'Book your first rental', hint: 'Or offer your own price for it', icon: 'cart', done: state.orders.length > 0, run: () => go({ name: 'browse' }) },
    { label: 'Rent out your own gear', hint: 'Keep 90% of every booking', icon: 'truck', done: state.myListings.length > 0, run: () => go({ name: 'post' }) },
  ]
  const settingIn = firstRun.filter((t) => t.done).length < 2

  /* Ordered by what is actually left to do: a prompt to write a review is noise
     if you have never rented, and one to refer is noise once three friends have
     joined. */
  const earnFaster: { label: string; icon: IconName; run: () => void }[] = [
    ...(state.referrals.length < 3 ? [{ label: `Refer a friend · +${REFERRAL_BONUS}`, icon: 'gift' as IconName, run: () => go({ name: 'referrals' }) }] : []),
    ...(state.profile.idVerified ? [] : [{ label: 'Verify your ID', icon: 'shield' as IconName, run: () => setEditOpen(true) }]),
    ...(completed.some((o) => !o.myRatingOfOwner) ? [{ label: 'Review a rental', icon: 'star' as IconName, run: () => go({ name: 'orders' }) }] : []),
    { label: 'Book something', icon: 'cart' as IconName, run: () => go({ name: 'browse' }) },
  ].slice(0, 3)

  const shownBalance = useCountUp(state.walletBalance)
  const shownPoints = useCountUp(state.points)

  return (
    <div className="section">
      <div className="section-head"><h2><Icon name="user" className="h-ico" size={18} /> Your profile</h2></div>

      <div className="panel">
        <div className="owner-row">
          <Avatar name={displayName(state.profile.name)} id="me" size={46} src={state.profile.avatar} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{displayName(state.profile.name)}{' '}
              {state.profile.idVerified
                ? <Badge tone="green"><Icon name="check" size={14} /> ID Verified</Badge>
                : <Badge tone="default"><Icon name="shield" size={14} /> Unverified</Badge>}{' '}
              <Badge tone="purple">{tier}</Badge></b>
            <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="ellipsis" style={{ maxWidth: '40%' }}><Icon name="pin" size={14} /> {state.profile.city}</span> ·{' '}
              {completed.length === 0 ? (
                <>New renter — your first completed rental starts your score</>
              ) : (
                /* The explanation used to be a paragraph below the whole panel, with
                   the phone and email rows between it and the stars it referred to —
                   so the score read as a mark you were being given rather than the
                   one owners are shown when you ask to book. */
                <>
                  what owners see: <Stars value={myRating} size={12} /> {myRating.toFixed(1)} · {completed.length} completed
                </>
              )}
            </div>
            {(state.profile.phone || state.profile.email) && (
              <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                {state.profile.phone && <span><Icon name="phone" size={13} /> {state.profile.phone}</span>}
                {state.profile.email && <span><Icon name="mail" size={13} /> {state.profile.email}</span>}
              </div>
            )}
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setEditOpen(true)}>Edit</button>
        </div>
        <p className="muted small" style={{ marginBottom: state.profile.idVerified ? 0 : 10 }}>
          A strong renter score unlocks instant-book on premium gear.
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

      {/* Crossing a threshold used to be silent — the badge just read differently
          the next time you looked. Shown once, then cleared, because a permanent
          banner is not a celebration. */}
      {state.tierReached && (
        <div className="panel tier-up" role="status">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="trophy" size={22} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>You reached {state.tierReached}</b>
              <div className="muted small">
                {state.tierReached === 'Gold Papa'
                  ? '5% off every rental, priority support and early access to new gear.'
                  : 'A free van delivery every month is now yours.'}
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => dispatch({ type: 'CLEAR_TIER_UP' })}>Nice</button>
          </div>
        </div>
      )}

      {settingIn && (
        <div className="panel" style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 15 }}><Icon name="sparkles" size={16} /> Get set up</h3>
          <p className="muted small" style={{ marginTop: 0 }}>Four things, and the app starts working for you.</p>
          <ul className="perk-list">
            {firstRun.map((t) => (
              <li key={t.label} className={t.done ? 'held' : ''}>
                <Icon name={t.done ? 'check-circle' : 'dot'} size={15} />
                <span className="perk-text">
                  {t.done
                    ? <b>{t.label}</b>
                    : <button className="link-btn first-run-go" onClick={() => { buzz(); t.run() }}>{t.label} <Icon name="arrow-right" size={12} /></button>}
                  <span className="muted small">{t.done ? 'Done' : t.hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Everything below used to be one flat stack of rows and panels, mixing
          navigation with data with forms — a wallet card, then a link, then a
          form, then a link. Five headings, and each row sits with the rows that
          answer the same question. */}
      <h3 className="profile-group"><Icon name="user" size={14} /> You</h3>
      <button className="list-row" style={{ cursor: 'pointer', width: '100%' }} onClick={() => go({ name: 'browse', wishlistOnly: true })}>
        <span><Icon name="heart-filled" size={16} /> Your wishlist</span><span className="muted">{state.wishlist.length} items <Icon name="arrow-right" size={14} /></span>
      </button>
      <button className="list-row" style={{ width: '100%', cursor: 'pointer' }} onClick={() => go({ name: 'settings' })}>
        <span><Icon name="sliders" size={16} /> Settings</span>
        <span className="muted">Notifications, payouts, privacy <Icon name="chevron-right" size={14} /></span>
      </button>


      <h3 className="profile-group"><Icon name="wallet" size={14} /> Money</h3>
      <div className="wallet-card">
        <div style={{ color: '#d6d3d1', fontSize: 13 }}><Icon name="wallet" size={14} /> Papa Wallet</div>
        <div className="balance">
          {money(shownBalance)}
          {credited > 0 && (
            <span className="balance-delta" aria-hidden="true" onAnimationEnd={() => setCredited(0)}>
              +{money(credited)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setTopUpOpen(true)}>+ Top up</button>
          <button className="btn btn-outline btn-sm" onClick={() => go({ name: 'wallet' })}>History</button>
        </div>
      </div>

      {/* role=group with a label ties the number to its noun. Read as three
          loose nodes, a screen reader gives you "800", "PapaPoints" — and the
          count-up animation means the first one is often mid-flight. */}
      <div className="stat-row">
        <div className="stat-tile" role="group" aria-label={`${state.points} PapaPoints`}>
          <div className="stat-num" aria-hidden="true"><Icon name="trophy" size={16} /> {shownPoints}</div>
          <div className="muted small" aria-hidden="true">PapaPoints</div>
        </div>
        <div className="stat-tile" role="group" aria-label={`${state.orders.length} orders`}>
          <div className="stat-num" aria-hidden="true"><Icon name="box" size={16} /> {state.orders.length}</div>
          <div className="muted small" aria-hidden="true">Orders</div>
        </div>
        <div className="stat-tile" role="group" aria-label={`${state.wishlist.length} items wishlisted`}>
          <div className="stat-num" aria-hidden="true"><Icon name="heart-filled" size={16} /> {state.wishlist.length}</div>
          <div className="muted small" aria-hidden="true">Wishlist</div>
        </div>
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
          {/* "540 points to go" with no way to close the gap is a number, not a
              goal. These are the three things that actually move it, each a tap
              rather than a description of one. */}
          <div className="earn-row">
            {earnFaster.map((e) => (
              <button key={e.label} className="earn-chip" onClick={e.run}>
                <Icon name={e.icon} size={14} /> {e.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Perks were a paragraph of bolded fragments, and the two thresholds were
          written out again after the progress panel above had already said them.
          One list, ticked against the points actually held, with the numbers
          coming from the same constants the checkout maths uses. */}
      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 15 }}><Icon name="trophy" size={16} /> Your perks</h3>
        <p className="muted small" style={{ marginTop: 0 }}>1 point per Rs 100 spent · 1 point = Rs 1 at checkout.</p>
        <ul className="perk-list">
          {TIER_PERKS.map((perk) => {
            const held = state.points >= perk.at
            return (
              <li key={perk.label} className={held ? 'held' : ''}>
                <Icon name={held ? 'check-circle' : 'ban'} size={15} />
                <span className="perk-text">
                  <b>{perk.label}</b>
                  <span className="muted small">{held ? 'Yours now' : `at ${perk.at.toLocaleString('en-GB')} pts`}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
      {/* Refer and redeem used to be two unrelated strips separated by half the
          screen, neither of which said whether any of it had worked. One row,
          one screen, and a count you can act on. */}
      <button className="list-row" style={{ cursor: 'pointer', width: '100%' }} onClick={() => go({ name: 'referrals' })}>
        <span><Icon name="gift" size={16} /> Refer a filmmaker</span>
        <span className="muted">
          {referralsEarned > 0
            ? <><span className="count-pill">{money(referralsEarned)} earned</span> <Icon name="arrow-right" size={14} /></>
            : <>You both get {money(REFERRAL_BONUS)} <Icon name="arrow-right" size={14} /></>}
        </span>
      </button>

      <h3 className="profile-group"><Icon name="store" size={14} /> Hosting</h3>
      <button className="list-row" style={{ cursor: 'pointer', width: '100%' }} onClick={() => go({ name: 'dashboard' })}>
        <span><Icon name="chart" size={16} /> Host dashboard</span>
        <span className="muted">
          {pendingRequests > 0 && <span className="count-pill">{pendingRequests} waiting</span>}
          {earnedThisMonth > 0 ? <>{money(earnedThisMonth)} this month</> : <>Earnings &amp; requests</>}{' '}
          <Icon name="chevron-right" size={14} />
        </span>
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


      <h3 className="profile-group"><Icon name="clock" size={14} /> Activity</h3>
      <button
        className="list-row"
        style={{ width: '100%', cursor: state.offers.length ? 'pointer' : 'default' }}
        aria-expanded={showOffers}
        disabled={state.offers.length === 0}
        onClick={() => setShowOffers(!showOffers)}
      >
        <span><Icon name="handshake" size={16} /> Offers you've made</span>
        <span className="muted">
          {state.offers.length === 0
            ? 'None yet'
            : <>{waitingOffers > 0 && <span className="count-pill">{waitingOffers} to answer</span>}{acceptedOffers}/{state.offers.length} accepted</>}{' '}
          <Icon name={showOffers ? 'chevron-down' : 'chevron-right'} size={14} />
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
          {chatThreads.length === 0
            ? 'None yet'
            : <>{unreadTotal > 0 && <span className="count-pill">{unreadTotal} unread</span>}{chatThreads.length} thread{chatThreads.length > 1 ? 's' : ''}</>}{' '}
          <Icon name="chevron-right" size={14} />
        </span>
      </button>
      {state.reports.length > 0 && (
        <div className="panel" style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 15 }}><Icon name="flag" size={16} /> Your reports</h3>
          {/* The case was a read-only row: a number, a colour and a date. Mediation
              explicitly asks for your side of it, so there had to be somewhere to
              put it — and somewhere to see what you had already said. */}
          {state.reports.map((r) => (
            <button
              key={r.id}
              className="review"
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none', border: 0, borderTop: '1px solid var(--line)' }}
              onClick={() => setOpenCase(r.id)}
            >
              <div className="review-head">
                <b>{r.caseNo} · {r.targetName}</b>
                <Badge tone={r.status === 'resolved' ? 'green' : r.status === 'mediation' ? 'purple' : 'orange'}>
                  {r.status === 'under_review' ? 'Under review' : r.status === 'mediation' ? 'In mediation' : 'Resolved'}
                </Badge>
              </div>
              <div className="muted small">{r.reason} · filed {r.date}</div>
              <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ flex: 1 }}>
                  {r.evidence?.length
                    ? `${r.evidence.length} ${r.evidence.length === 1 ? 'note' : 'notes'} added`
                    : r.status === 'resolved' ? 'View the decision' : 'View case and add evidence'}
                </span>
                <Icon name="chevron-right" size={14} />
              </div>
            </button>
          ))}
        </div>
      )}


      <h3 className="profile-group"><Icon name="headset" size={14} /> Support</h3>
      <button className="list-row" style={{ cursor: 'pointer', width: '100%' }} onClick={() => go({ name: 'support' })}>
        <span><Icon name="headset" size={16} /> Help Center</span><span className="muted">24/7 support <Icon name="arrow-right" size={14} /></span>
      </button>

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



      {editOpen && <EditProfileModal onClose={() => setEditOpen(false)} />}
      {openCase && (
        <CaseModal report={state.reports.find((r) => r.id === openCase)!} onClose={() => setOpenCase(null)} />
      )}
      {topUpOpen && <TopUpModal onClose={() => setTopUpOpen(false)} onCredited={setCredited} />}
    </div>
  )
}

function EditProfileModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore()
  const { toast } = useNav()
  const [name, setName] = useState(state.profile.name)
  const [city, setCity] = useState(state.profile.city)
  const [phone, setPhone] = useState(state.profile.phone ?? '')
  const [email, setEmail] = useState(state.profile.email ?? '')
  const [avatar, setAvatar] = useState<string | null>(state.profile.avatar ?? null)
  const emailValid = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  return (
    <Modal title="Edit your profile" onClose={onClose}>
      {/* Everyone got a generated monogram and no way past it. There is no file
          host here, so the picture is downscaled and stored with the rest of the
          state — see toAvatarDataUrl for why it cannot be kept as picked. */}
      <div className="avatar-edit">
        <Avatar name={displayName(name)} id="me" size={64} src={avatar ?? undefined} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
            <Icon name="camera" size={14} /> {avatar ? 'Change photo' : 'Add a photo'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = '' // so picking the same file twice still fires
                if (!file) return
                try {
                  setAvatar(await toAvatarDataUrl(file))
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Could not use that image.')
                }
              }}
            />
          </label>
          {avatar && (
            <button className="btn btn-ghost btn-sm" onClick={() => setAvatar(null)}>Remove</button>
          )}
        </div>
      </div>
      <label className="field" style={{ marginTop: 10 }}>
        Name
        <input value={name} placeholder={NAME_FALLBACK} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field" style={{ marginTop: 10 }}>
        City
        <input value={city} placeholder="Your city" onChange={(e) => setCity(e.target.value)} />
      </label>
      <label className="field" style={{ marginTop: 10 }}>
        Phone <span className="muted small">— so vendors and couriers can reach you</span>
        <input type="tel" inputMode="tel" value={phone} placeholder="03xx xxxxxxx" onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className="field" style={{ marginTop: 10 }}>
        Email <span className="muted small">— for booking receipts</span>
        <input type="email" inputMode="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
      </label>
      {!emailValid && <p className="muted small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>That email doesn’t look right.</p>}
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 14 }}
        disabled={!city.trim() || !emailValid}
        onClick={() => {
          dispatch({
            type: 'SET_PROFILE',
            name: name.trim(),
            city: city.trim(),
            phone: phone.trim(),
            email: email.trim(),
            avatar,
          })
          toast('Profile updated')
          onClose()
        }}
      >
        Save
      </button>
    </Modal>
  )
}

/* A case you can only watch is a case you cannot influence, and mediation
   explicitly asks for your account of what happened. This is where it goes —
   plus the history, so what you already said is visible rather than something
   you have to remember having sent. */
function CaseModal({ report, onClose }: { report: UserReport; onClose: () => void }) {
  const { dispatch } = useStore()
  const { toast } = useNav()
  const [note, setNote] = useState('')
  const closed = report.status === 'resolved'

  const stages: { key: UserReport['status']; label: string; hint: string }[] = [
    { key: 'under_review', label: 'Filed and read', hint: 'Trust & Safety have your report.' },
    { key: 'mediation', label: 'Both sides heard', hint: `We asked ${report.targetName} for their account.` },
    { key: 'resolved', label: 'Decided', hint: 'The case is closed.' },
  ]
  const at = stages.findIndex((x) => x.key === report.status)

  return (
    <Modal title={`Case ${report.caseNo}`} onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>
        {report.targetName} · {report.reason} · filed {report.date}
      </p>

      <ol className="case-steps">
        {stages.map((st, i) => (
          <li key={st.key} className={i < at ? 'done' : i === at ? 'now' : ''}>
            <b>{st.label}</b>
            <span className="muted small">{st.hint}</span>
          </li>
        ))}
      </ol>

      {report.note && (
        <div className="panel" style={{ marginTop: 12 }}>
          <b style={{ fontSize: 13 }}>What you reported</b>
          <p className="muted small" style={{ margin: '4px 0 0' }}>{report.note}</p>
        </div>
      )}

      <h3 style={{ fontSize: 14, marginBottom: 4 }}>Evidence you've added</h3>
      {report.evidence?.length ? (
        report.evidence.map((e) => (
          <div key={e.id} className="review" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="muted small">{new Date(e.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
            <div style={{ fontSize: 14 }}>{e.text}</div>
          </div>
        ))
      ) : (
        <p className="muted small" style={{ marginTop: 0 }}>Nothing yet.</p>
      )}

      {closed ? (
        <p className="muted small">This case is closed, so nothing more can be added to it.</p>
      ) : (
        <div className="promo-row" style={{ marginTop: 10 }}>
          <input
            value={note}
            placeholder="Serial numbers, what was said, what's missing…"
            aria-label="Add evidence"
            enterKeyHint="done"
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            className="btn btn-outline btn-sm"
            disabled={!note.trim()}
            onClick={() => {
              buzz()
              dispatch({ type: 'ADD_EVIDENCE', reportId: report.id, text: note })
              setNote('')
              toast('Added to the case')
            }}
          >
            Add
          </button>
        </div>
      )}
    </Modal>
  )
}

function TopUpModal({ onClose, onCredited }: { onClose: () => void; onCredited: (n: number) => void }) {
  const { state, dispatch } = useStore()
  const { toast } = useNav()
  const [amount, setAmount] = useState(10000)
  const card = state.cards.find((c) => c.id === state.selectedCardId) ?? state.cards[0]

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
      {card ? (
        <div className="list-row" style={{ margin: '12px 0 0', gap: 10, cursor: 'default' }}>
          <Icon name="card" size={16} />
          <span style={{ flex: 1, minWidth: 0 }}>Charged to {card.brand} ···{card.last4}</span>
          <span className="muted small">exp {card.expiry}</span>
        </div>
      ) : (
        <p className="muted small" style={{ margin: '12px 0 0' }}>
          Add a card at checkout to top up — top-ups move money from your card, not thin air.
        </p>
      )}
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 14 }}
        disabled={amount < 500 || !card}
        onClick={() => {
          if (!card) return
          buzz()
          dispatch({ type: 'ADD_WALLET', amount })
          onCredited(amount)
          toast(`Charged to ${card.brand} ···${card.last4}`)
          onClose()
        }}
      >
        {card ? `Pay ${money(amount)} with ${card.brand} ···${card.last4}` : `Add ${money(amount)}`}
      </button>
    </Modal>
  )
}
