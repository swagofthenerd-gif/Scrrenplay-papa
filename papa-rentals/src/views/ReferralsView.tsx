import { useMemo, useState } from 'react'
import { useNav } from '../nav'
import { REFERRAL_BONUS, useStore } from '../store'
import { money } from '../utils'
import { Badge } from '../components/ui'
import { Avatar, Icon } from '../components/icons'

export const REFERRAL_CODE = 'PAPA-FRIEND-500'

/* Referring and redeeming were two unrelated strips halfway down Profile: a row
   that copied your code, and — several screens of unrelated rows later — a box
   that took someone else's. Both are the same subject, and neither ever told you
   whether any of it had worked. This is one screen for the whole loop: give your
   code, use someone's, and see what came of it. */
export default function ReferralsView() {
  const { go, toast } = useNav()
  const { state, dispatch } = useStore()
  const [refCode, setRefCode] = useState('')
  const [copied, setCopied] = useState(false)

  const joined = state.referrals.length
  const rented = state.referrals.filter((f) => f.status === 'rented').length
  const earned = useMemo(() => state.referrals.reduce((s, f) => s + f.earned, 0), [state.referrals])

  async function share() {
    dispatch({ type: 'SHARE_REFERRAL' })
    const text = `Rent film gear on Papa Rentals — use my code ${REFERRAL_CODE} and we both get ${money(REFERRAL_BONUS)}.`
    /* Three routes, because two of them are missing on the phones that matter.
       The share sheet is absent outside a secure context, and the clipboard is
       commonly blocked inside the Android WebView — which is why the code is
       printed on the screen as well. Copy is a convenience here, never the only
       way to get the code out. */
    try {
      if (navigator.share) { await navigator.share({ text }); return }
      await navigator.clipboard.writeText(REFERRAL_CODE)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast(`Your code is ${REFERRAL_CODE} — it's on screen above`)
    }
  }

  return (
    <div className="section">
      <button className="back-btn" onClick={() => go({ name: 'profile' })}>
        <Icon name="chevron-left" size={16} /> Profile
      </button>
      <div className="section-head"><h2><Icon name="gift" className="h-ico" size={18} /> Referrals</h2></div>

      <div className="panel">
        <p className="muted small" style={{ marginTop: 0 }}>
          Give a filmmaker {money(REFERRAL_BONUS)} off their first rental. You get the same once it completes.
        </p>
        {/* The code is text on the screen before it is anything else. A referral
            flow whose only output is a clipboard write is a dead end on a device
            where the clipboard is blocked. */}
        <div className="ref-code" aria-label={`Your referral code is ${REFERRAL_CODE.split('').join(' ')}`}>
          {REFERRAL_CODE}
        </div>
        <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={share}>
          <Icon name={copied ? 'check' : 'gift'} size={15} /> {copied ? 'Copied' : 'Share your code'}
        </button>
      </div>

      <div className="stat-row">
        <div className="stat-tile"><b>{joined}</b><span className="muted small">joined</span></div>
        <div className="stat-tile"><b>{rented}</b><span className="muted small">rented</span></div>
        <div className="stat-tile"><b>{money(earned)}</b><span className="muted small">earned</span></div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 15 }}><Icon name="users" size={16} /> Who used your code</h3>
        {state.referrals.length === 0 ? (
          <p className="muted small" style={{ marginBottom: 0 }}>
            {state.referralSharedAt
              ? 'Nobody yet. They show up here the moment someone signs up with your code.'
              : 'Share your code and everyone who uses it appears here, with what you earned from each.'}
          </p>
        ) : (
          state.referrals.map((f) => (
            <div key={f.id} className="list-row" style={{ cursor: 'default', gap: 10 }}>
              <Avatar name={f.name} id={f.id} size={34} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{f.name}</b>
                <span className="muted small" style={{ display: 'block' }}>
                  {f.status === 'rented' ? 'Completed their first rental' : 'Signed up — bonus pays on their first rental'}
                </span>
              </span>
              {f.status === 'rented'
                ? <Badge tone="green">+{money(f.earned)}</Badge>
                : <Badge tone="orange">Pending</Badge>}
            </div>
          ))
        )}
      </div>

      {!state.referralRedeemed && (
        <div className="panel" style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 15 }}><Icon name="ticket" size={16} /> Got someone's code?</h3>
          <div className="promo-row" style={{ marginTop: 8 }}>
            <input placeholder="PAPA-XXXX" value={refCode} onChange={(e) => setRefCode(e.target.value)} aria-label="Referral code" />
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                const code = refCode.trim().toUpperCase()
                if (code === REFERRAL_CODE) {
                  toast('That’s your own code — share it with a friend instead')
                  return
                }
                if (!/^PAPA-[A-Z0-9]{3,12}(-\d{2,5})?$/.test(code)) {
                  toast('Codes look like PAPA-XXXX or PAPA-XXXX-500')
                  return
                }
                dispatch({ type: 'REDEEM_REFERRAL', code })
                toast(`${money(REFERRAL_BONUS)} pending — credited after your first rental`)
              }}
            >
              Redeem
            </button>
          </div>
        </div>
      )}

      {state.referralPending && (
        <div className="list-row" style={{ width: '100%', gap: 10, cursor: 'default', marginTop: 10 }}>
          <Icon name="hourglass" size={16} />
          <span style={{ flex: 1, minWidth: 0 }}>Your referral bonus is pending</span>
          <span className="muted small">{money(REFERRAL_BONUS)} · unlocks on your first completed rental</span>
        </div>
      )}

      <p className="muted small" style={{ marginTop: 12 }}>
        Referral credit is spend-only — it comes off your next booking and can't be withdrawn to a bank.
      </p>
    </div>
  )
}
