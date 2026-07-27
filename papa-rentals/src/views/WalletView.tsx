import { useMemo, useState } from 'react'
import { useNav } from '../nav'
import { useStore } from '../store'
import { GOLD_POINTS, SILVER_POINTS, buzz, fmtTimeAgo, money } from '../utils'
import { Icon } from '../components/icons'
import { Modal } from '../components/ui'
import type { LedgerEntry } from '../types'

const TOP_UPS = [2000, 5000, 10000, 25000]

/* Full wallet + points history. A balance you can't audit is a balance you
   can't dispute, and "where did my Rs 500 go" is the top support question. */
export default function WalletView() {
  const { go, toast } = useNav()
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState<'wallet' | 'points'>('wallet')
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  const rows = useMemo(
    () => state.ledger.filter((e) => e.kind === tab).sort((a, b) => b.at - a.at),
    [state.ledger, tab]
  )

  /* Promo and referral credit is spend-only. Splitting it out here stops people
     discovering the restriction at the withdraw screen. */
  const cashable = useMemo(
    () =>
      Math.max(
        0,
        Math.min(
          state.walletBalance,
          state.ledger.filter((e) => e.kind === 'wallet' && e.cash).reduce((s, e) => s + e.amount, 0)
        )
      ),
    [state.ledger, state.walletBalance]
  )
  const promoOnly = Math.max(0, state.walletBalance - cashable)

  const nextTier = state.points >= GOLD_POINTS ? null : state.points >= SILVER_POINTS ? GOLD_POINTS : SILVER_POINTS

  return (
    <div>
      <button className="back-btn" onClick={() => go({ name: 'profile' })}>
        <Icon name="chevron-left" size={16} /> Profile
      </button>

      <div className="section" style={{ marginTop: 4 }}>
        <div className="panel">
          <div className="muted small">Papa Wallet</div>
          <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.2 }}>{money(state.walletBalance)}</div>
          <div className="muted small">
            {money(cashable)} withdrawable · {money(promoOnly)} promo credit (spend only)
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setTopUpOpen(true)}>
              <Icon name="wallet" size={14} /> Top up
            </button>
            <button className="btn btn-outline btn-sm" disabled={cashable <= 0} onClick={() => setWithdrawOpen(true)}>
              <Icon name="card" size={14} /> Withdraw
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="muted small">Loyalty points</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{state.points.toLocaleString('en-GB')}</div>
          <div className="muted small">
            {nextTier
              ? `${(nextTier - state.points).toLocaleString('en-GB')} more to ${nextTier === GOLD_POINTS ? 'Gold' : 'Silver'}`
              : 'Gold tier — top rate, unlocked'}
          </div>
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            Earn 1 point per Rs 100 spent. Points come off your next bill at checkout — no expiry.
          </p>
        </div>

        <div className="filter-row" role="tablist" aria-label="History type" style={{ margin: '10px 0' }}>
          {(['wallet', 'points'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`filter-chip ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'wallet' ? 'Wallet history' : 'Points history'}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">
            <div className="big"><Icon name="receipt" size={48} /></div>
            <p>No {tab} movements yet.</p>
          </div>
        ) : (
          rows.map((e) => <LedgerRow key={e.id} entry={e} onOpenOrder={(id) => go({ name: 'order', id })} />)
        )}
      </div>

      {topUpOpen && (
        <TopUpModal
          onClose={() => setTopUpOpen(false)}
          onConfirm={(amount) => {
            dispatch({ type: 'ADD_WALLET', amount })
            setTopUpOpen(false)
            buzz()
            toast(`${money(amount)} added to your wallet`)
          }}
        />
      )}

      {withdrawOpen && (
        <Modal title="Withdraw to bank" onClose={() => setWithdrawOpen(false)}>
          <p className="muted small">
            {money(cashable)} is withdrawable. Promo and referral credit stays in the wallet and comes off your next booking.
          </p>
          <p className="muted small">
            Withdrawals go to the account on file and settle in 1–2 working days. We never ask for your bank details in
            chat — add them in Settings.
          </p>
          <button className="btn btn-outline btn-block" onClick={() => { setWithdrawOpen(false); go({ name: 'settings' }) }}>
            Add a payout account
          </button>
        </Modal>
      )}
    </div>
  )
}

function LedgerRow({ entry, onOpenOrder }: { entry: LedgerEntry; onOpenOrder: (id: string) => void }) {
  const credit = entry.amount > 0
  const body = (
    <>
      <span className="n-ico"><Icon name={credit ? 'coins' : 'receipt'} size={18} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{entry.label}</b>
        <div className="muted small">
          {fmtTimeAgo(entry.at)}
          {entry.kind === 'wallet' && entry.cash === false && ' · promo credit'}
        </div>
      </div>
      <b style={{ color: credit ? 'var(--ok, #1a7f37)' : 'var(--ink)' }}>
        {credit ? '+' : '−'}
        {entry.kind === 'wallet' ? money(Math.abs(entry.amount)) : `${Math.abs(entry.amount)} pts`}
      </b>
    </>
  )

  if (!entry.orderId) return <div className="notif-row">{body}</div>
  return (
    <button className="notif-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpenOrder(entry.orderId as string)}>
      {body}
    </button>
  )
}

function TopUpModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (amount: number) => void }) {
  const [amount, setAmount] = useState(5000)
  const [custom, setCustom] = useState('')
  const value = custom ? Number(custom) : amount
  const valid = Number.isFinite(value) && value >= 500

  return (
    <Modal title="Top up wallet" onClose={onClose}>
      <div className="filter-row">
        {TOP_UPS.map((a) => (
          <button
            key={a}
            className={`filter-chip ${!custom && amount === a ? 'active' : ''}`}
            aria-pressed={!custom && amount === a}
            onClick={() => { setAmount(a); setCustom('') }}
          >
            {money(a)}
          </button>
        ))}
      </div>
      <label className="field" style={{ marginTop: 10 }}>
        Or enter an amount (minimum Rs 500)
        <input
          type="number"
          min={500}
          value={custom}
          placeholder="e.g. 7500"
          onChange={(e) => setCustom(e.target.value)}
        />
      </label>
      <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={!valid} onClick={() => onConfirm(value)}>
        Add {valid ? money(value) : '—'}
      </button>
    </Modal>
  )
}
