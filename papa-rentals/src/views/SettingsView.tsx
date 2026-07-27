import { useEffect, useState } from 'react'
import { useNav } from '../nav'
import { useStore } from '../store'
import { money } from '../utils'
import { Badge, Modal } from '../components/ui'
import { Icon } from '../components/icons'

const PREFS_KEY = 'papa-settings-v1'

interface Prefs {
  notifyOrders: boolean
  notifyOffers: boolean
  notifyChat: boolean
  notifyDeals: boolean
  notifyEmail: boolean
  reduceMotion: boolean
  payoutBank: string
  payoutAccount: string
}

const DEFAULTS: Prefs = {
  notifyOrders: true,
  notifyOffers: true,
  notifyChat: true,
  notifyDeals: false,
  notifyEmail: false,
  reduceMotion: false,
  payoutBank: '',
  payoutAccount: '',
}

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }
  } catch {
    return DEFAULTS
  }
}

/* Everything account-level lives here so Profile can stay a dashboard rather
   than a settings dump. Preferences persist separately from app state — wiping
   your data shouldn't silently re-enable notifications you turned off. */
export default function SettingsView() {
  const { go, toast } = useNav()
  const { state, dispatch } = useStore()
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* storage unavailable */ }
  }, [prefs])

  function set<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs((p) => ({ ...p, [key]: value }))
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'papa-rentals-data.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast('Your data is downloading')
  }

  const masked = prefs.payoutAccount ? `${prefs.payoutBank} ••••${prefs.payoutAccount.slice(-4)}` : null

  return (
    <div className="section">
      <button className="back-btn" onClick={() => go({ name: 'profile' })}>
        <Icon name="chevron-left" size={16} /> Profile
      </button>
      <div className="section-head"><h2><Icon name="sliders" className="h-ico" size={18} /> Settings</h2></div>

      <div className="panel">
        <h3 style={{ fontSize: 15 }}><Icon name="user" size={16} /> Account</h3>
        <div className="list-row">
          <span>Name</span><span className="muted">{state.profile.name || 'Not set'}</span>
        </div>
        <div className="list-row">
          <span>City</span><span className="muted">{state.profile.city}</span>
        </div>
        <button className="list-row" style={{ width: '100%', cursor: 'pointer' }} onClick={() => setVerifyOpen(true)}>
          <span><Icon name="shield" size={16} /> Verification</span>
          <span className="muted"><Badge tone="green"><Icon name="check" size={13} /> ID verified</Badge> <Icon name="chevron-right" size={14} /></span>
        </button>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 15 }}><Icon name="bell" size={16} /> Notifications</h3>
        <p className="muted small" style={{ marginTop: 0 }}>Order and safety alerts can't be turned off — they're how you find your driver.</p>
        <Toggle label="Order updates" hint="Confirmations, driver on the way, returns due" checked={prefs.notifyOrders} onChange={(v) => set('notifyOrders', v)} />
        <Toggle label="Offers &amp; counters" hint="When a vendor accepts, counters or declines" checked={prefs.notifyOffers} onChange={(v) => set('notifyOffers', v)} />
        <Toggle label="Messages" hint="Vendor and support replies" checked={prefs.notifyChat} onChange={(v) => set('notifyChat', v)} />
        <Toggle label="Deals &amp; price drops" hint="Flash deals on gear you've viewed or wishlisted" checked={prefs.notifyDeals} onChange={(v) => set('notifyDeals', v)} />
        <Toggle label="Email receipts" hint="A copy of every invoice by email" checked={prefs.notifyEmail} onChange={(v) => set('notifyEmail', v)} />
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 15 }}><Icon name="wallet" size={16} /> Money</h3>
        <button className="list-row" style={{ width: '100%', cursor: 'pointer' }} onClick={() => go({ name: 'wallet' })}>
          <span><Icon name="coins" size={16} /> Wallet &amp; points</span>
          <span className="muted">{money(state.walletBalance)} · {state.points} pts <Icon name="chevron-right" size={14} /></span>
        </button>
        <button className="list-row" style={{ width: '100%', cursor: 'pointer' }} onClick={() => setPayoutOpen(true)}>
          <span><Icon name="card" size={16} /> Payout account</span>
          <span className="muted">{masked ?? 'Not added'} <Icon name="chevron-right" size={14} /></span>
        </button>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Payouts for your listings and wallet withdrawals go to this account. We never ask for it in chat.
        </p>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 15 }}><Icon name="shield" size={16} /> Privacy &amp; data</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          Everything you do here is stored on this device only — nothing leaves your phone.
        </p>
        <button className="list-row" style={{ width: '100%', cursor: 'pointer' }} onClick={exportData}>
          <span><Icon name="scroll" size={16} /> Download my data</span><span className="muted">JSON <Icon name="chevron-right" size={14} /></span>
        </button>
        <button className="list-row" style={{ width: '100%', cursor: 'pointer' }} onClick={() => setResetOpen(true)}>
          <span style={{ color: 'var(--danger, #b42318)' }}><Icon name="trash" size={16} /> Erase all my data</span>
          <span className="muted">Can't be undone <Icon name="chevron-right" size={14} /></span>
        </button>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 15 }}><Icon name="question" size={16} /> About</h3>
        <div className="list-row"><span>Version</span><span className="muted">Papa Rentals 2.0</span></div>
        <button className="list-row" style={{ width: '100%', cursor: 'pointer' }} onClick={() => go({ name: 'support' })}>
          <span><Icon name="headset" size={16} /> Help Center</span><span className="muted"><Icon name="chevron-right" size={14} /></span>
        </button>
      </div>

      <button
        className="btn btn-outline btn-block"
        style={{ marginTop: 14 }}
        onClick={() => {
          dispatch({ type: 'SET_PROFILE', name: state.profile.name, city: state.profile.city, onboarded: false })
          go({ name: 'home' })
          toast('Signed out')
        }}
      >
        <Icon name="undo" size={14} /> Sign out
      </button>

      {payoutOpen && (
        <PayoutModal
          bank={prefs.payoutBank}
          account={prefs.payoutAccount}
          onClose={() => setPayoutOpen(false)}
          onSave={(bank, account) => {
            setPrefs((p) => ({ ...p, payoutBank: bank, payoutAccount: account }))
            setPayoutOpen(false)
            toast('Payout account saved')
          }}
        />
      )}

      {verifyOpen && (
        <Modal title="Verification" onClose={() => setVerifyOpen(false)}>
          <div className="list-row"><span><Icon name="check-circle" size={16} /> Phone number</span><Badge tone="green">Verified</Badge></div>
          <div className="list-row"><span><Icon name="check-circle" size={16} /> Government ID</span><Badge tone="green">Verified</Badge></div>
          <div className="list-row"><span><Icon name="card" size={16} /> Payment method</span><Badge tone="green">Verified</Badge></div>
          <p className="muted small">
            Verified renters get instant-book on premium gear and skip deposit holds on items under {money(50000)}.
          </p>
        </Modal>
      )}

      {resetOpen && (
        <Modal title="Erase all my data" onClose={() => setResetOpen(false)}>
          <p className="muted small" style={{ marginTop: 0 }}>
            This deletes your cart, orders, wallet balance, points, listings and messages from this device. It cannot be
            undone, and there is no server copy to restore from.
          </p>
          <button className="btn btn-outline btn-block" style={{ marginBottom: 8 }} onClick={exportData}>
            Download a copy first
          </button>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              try { localStorage.clear() } catch { /* storage unavailable */ }
              location.hash = '#/home'
              location.reload()
            }}
          >
            Erase everything
          </button>
        </Modal>
      )}
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span><b>{label}</b><span className="muted small" style={{ display: 'block' }}>{hint}</span></span>
    </label>
  )
}

function PayoutModal({ bank, account, onClose, onSave }: {
  bank: string; account: string; onClose: () => void; onSave: (bank: string, account: string) => void
}) {
  const [b, setB] = useState(bank)
  const [a, setA] = useState(account)
  const valid = b.trim().length >= 2 && /^\d{6,20}$/.test(a.trim())

  return (
    <Modal title="Payout account" onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Stored on this device only. Withdrawals settle in 1–2 working days.
      </p>
      <label className="field">
        Bank
        <input value={b} placeholder="e.g. Meezan Bank" onChange={(e) => setB(e.target.value)} />
      </label>
      <label className="field" style={{ marginTop: 10 }}>
        Account number
        <input value={a} inputMode="numeric" placeholder="Digits only" onChange={(e) => setA(e.target.value.replace(/\D/g, ''))} />
      </label>
      <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={!valid} onClick={() => onSave(b.trim(), a.trim())}>
        Save account
      </button>
    </Modal>
  )
}
