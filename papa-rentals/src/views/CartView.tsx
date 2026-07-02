import { useState } from 'react'
import { PAYMENT_METHODS, PROMO_CODES, TRANSPORT_OPTIONS, getItem } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { buzz, cartTotals, fmtDate, lineDuration, lineSubtotal, money, uid } from '../utils'
import { Badge, ItemArt, Modal } from '../components/ui'

export default function CartView() {
  const { go, toast } = useNav()
  const { state, dispatch } = useStore()
  const [promoInput, setPromoInput] = useState('')
  const [promoCode, setPromoCode] = useState<string | undefined>()
  const [useWallet, setUseWallet] = useState(false)
  const [redeemPoints, setRedeemPoints] = useState(false)
  const [payMethod, setPayMethod] = useState('card')
  const [addrOpen, setAddrOpen] = useState(false)

  const opts = {
    promoCode,
    walletUsed: useWallet ? state.walletBalance : 0,
    redeemPoints,
    points: state.points,
    ordersCount: state.orders.length,
    promoCodesUsed: state.promoCodesUsed,
    freeVanPerkMonth: state.freeVanPerkMonth,
  }
  const t = cartTotals(state.cart, opts)
  const address = state.addresses.find((a) => a.id === state.selectedAddressId) ?? state.addresses[0]
  const needsDelivery = state.cart.some((b) => b.transport !== 'pickup')
  const needsApproval = state.cart.some((b) => !getItem(b.itemId).instantBook)

  function applyPromo() {
    const code = promoInput.trim().toUpperCase()
    if (!code) return
    setPromoCode(code)
    const check = cartTotals(state.cart, { ...opts, promoCode: code })
    if (check.promoError) toast(check.promoError)
    else toast(`Promo applied: ${PROMO_CODES[code].label} 🎟️`)
  }

  function placeOrder() {
    if (t.promoError) {
      toast(t.promoError)
      return
    }
    buzz(20)
    dispatch({
      type: 'PLACE_ORDER',
      opts: { ...opts, paymentMethod: PAYMENT_METHODS.find((p) => p.id === payMethod)?.name ?? 'Card', address: address ? `${address.label} — ${address.detail}` : 'Self pickup' },
    })
    toast(needsApproval ? 'Booking requested — owner usually approves in minutes ⏳' : 'Order confirmed! Track it in Orders 🎉')
    go({ name: 'orders' })
  }

  if (state.cart.length === 0) {
    return (
      <div className="empty-state">
        <div className="big">🛒</div>
        <h3>Your cart is empty</h3>
        <p>Gear up for your next shoot — deals are waiting.</p>
        <button className="btn btn-primary" onClick={() => go({ name: 'browse' })}>Browse gear</button>
      </div>
    )
  }

  return (
    <div className="section">
      <div className="section-head">
        <h2>🛒 Your cart</h2>
        <button className="link-btn" onClick={() => dispatch({ type: 'CLEAR_CART' })}>Clear all</button>
      </div>

      <div className="detail-grid">
        <div>
          <div className="panel">
            {state.cart.map((b, i) => {
              const item = getItem(b.itemId)
              const dur = lineDuration(b)
              const transport = TRANSPORT_OPTIONS.find((x) => x.id === b.transport)!
              return (
                <div className="cart-line" key={i}>
                  <ItemArt item={item} size="thumb" />
                  <div className="cart-line-info">
                    <b style={{ fontSize: 14 }}>{item.name}</b>
                    {b.negotiated && <Badge tone="purple">🤝 Negotiated</Badge>}
                    {!item.instantBook && <Badge tone="orange">⏳ Needs approval</Badge>}
                    <div className="muted small">
                      {b.unit === 'hour'
                        ? `${fmtDate(b.startDate)} · ${b.hours}h from ${b.pickupTime}`
                        : `${fmtDate(b.startDate)} → ${fmtDate(b.endDate)} at ${b.pickupTime}`} · ×{b.qty} · {transport.emoji} {transport.name}
                    </div>
                    <div className="muted small">
                      {b.insurance && '🛡️ Protection · '}
                      {b.operator && '🧑‍🔧 Operator · '}
                      {money(b.rate)}/{b.unit} × {dur}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <b style={{ fontSize: 14 }}>{money(lineSubtotal(b))}</b>
                    <div>
                      <button className="link-btn" onClick={() => dispatch({ type: 'REMOVE_FROM_CART', index: i })}>Remove</button>
                    </div>
                  </div>
                </div>
              )
            })}

            <div className="promo-row">
              <input
                placeholder="Promo code (try PAPA10)"
                value={promoInput}
                enterKeyHint="done"
                onChange={(e) => setPromoInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                aria-label="Promo code"
              />
              <button className="btn btn-outline btn-sm" onClick={applyPromo}>Apply</button>
            </div>
            {promoCode && t.promoError && <p className="promo-error">⚠️ {t.promoError} <button className="link-btn" onClick={() => setPromoCode(undefined)}>remove</button></p>}
            {promoCode && !t.promoError && t.promoDiscount > 0 && (
              <p className="small" style={{ color: 'var(--green)', fontWeight: 700 }}>
                🎟️ {promoCode}: {PROMO_CODES[promoCode].label}{' '}
                <button className="link-btn" onClick={() => setPromoCode(undefined)}>remove</button>
              </p>
            )}

            <label className="toggle-row">
              <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} />
              <span><b>👛 Use wallet balance</b> — {money(state.walletBalance)} available</span>
            </label>
            <label className="toggle-row">
              <input type="checkbox" checked={redeemPoints} onChange={(e) => setRedeemPoints(e.target.checked)} />
              <span><b>🏆 Redeem PapaPoints</b> — {state.points} pts = {money(state.points)}</span>
            </label>
          </div>

          {needsDelivery && (
            <div className="panel">
              <h3 style={{ fontSize: 15 }}>📍 Deliver to</h3>
              {state.addresses.map((a) => (
                <div key={a.id} className={`addr-row ${a.id === state.selectedAddressId ? 'active' : ''}`} onClick={() => dispatch({ type: 'SELECT_ADDRESS', id: a.id })}>
                  <b style={{ flex: 'none' }}>{a.label}</b>
                  <span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detail}</span>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setAddrOpen(true)}>+ Add address</button>
            </div>
          )}

          <div className="panel">
            <h3 style={{ fontSize: 15 }}>💳 Pay with</h3>
            {PAYMENT_METHODS.map((p) => (
              <div key={p.id} className={`pay-method ${payMethod === p.id ? 'active' : ''}`} onClick={() => setPayMethod(p.id)}>
                <span style={{ fontSize: 20 }}>{p.emoji}</span>
                <b>{p.name}</b>
                {p.id === 'cod' && <span className="muted small" style={{ marginLeft: 'auto' }}>deposit still held on card</span>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="panel">
            <h3 style={{ fontSize: 16 }}>Payment summary</h3>
            <div className="price-summary" style={{ borderTop: 'none', marginTop: 4 }}>
              <div className="price-line"><span>Rental subtotal</span><b>{money(t.subtotal)}</b></div>
              <div className="price-line"><span>Transport (per owner)</span>{t.transportFee === 0 ? <b className="free">Free</b> : <b>{money(t.transportFee)}</b>}</div>
              {t.insuranceFee > 0 && <div className="price-line"><span>Damage protection</span><b>{money(t.insuranceFee)}</b></div>}
              {t.operatorFee > 0 && <div className="price-line"><span>Operators</span><b>{money(t.operatorFee)}</b></div>}
              <div className="price-line"><span>Service fee (5%)</span><b>{money(t.serviceFee)}</b></div>
              {t.promoDiscount > 0 && <div className="price-line"><span>Promo discount</span><b className="credit">−{money(t.promoDiscount)}</b></div>}
              {t.tierDiscount > 0 && <div className="price-line"><span>🥇 Gold perk (5% off)</span><b className="credit">−{money(t.tierDiscount)}</b></div>}
              {t.vanPerk > 0 && <div className="price-line"><span>🥈 Free van delivery perk</span><b className="credit">−{money(t.vanPerk)}</b></div>}
              {t.pointsUsed > 0 && <div className="price-line"><span>PapaPoints</span><b className="credit">−{money(t.pointsUsed)}</b></div>}
              {t.walletUsed > 0 && <div className="price-line"><span>Wallet credit</span><b className="credit">−{money(t.walletUsed)}</b></div>}
              <div className="price-line total"><span>Charged now</span><span>{money(t.total)}</span></div>
              <div className="price-line"><span className="muted">Deposit hold (not charged)</span><span className="muted">{money(t.depositHold)}</span></div>
            </div>
            <p className="muted small">
              The deposit is an authorization hold — released automatically within 24h of a damage-free return.
              Free cancellation up to 48h before your start date; 10% fee inside 48h.
            </p>
            <button className="btn btn-primary btn-block" onClick={placeOrder} disabled={Boolean(t.promoError)}>
              {needsApproval ? `Request booking · ${money(t.total)}` : `Confirm & pay ${money(t.total)}`}
            </button>
            <p className="muted small" style={{ textAlign: 'center' }}>
              You'll earn <b>+{Math.floor(t.total / 100)}</b> PapaPoints 🏆
            </p>
          </div>
        </div>
      </div>

      {addrOpen && <AddAddressModal onClose={() => setAddrOpen(false)} />}
    </div>
  )
}

function AddAddressModal({ onClose }: { onClose: () => void }) {
  const { dispatch } = useStore()
  const { toast } = useNav()
  const [label, setLabel] = useState('')
  const [detail, setDetail] = useState('')

  return (
    <Modal title="📍 New address" onClose={onClose}>
      <label className="field">
        Label
        <input value={label} placeholder="e.g. 📽️ Location shoot" onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label className="field" style={{ marginTop: 10 }}>
        Full address
        <input value={detail} placeholder="Street, area, city" onChange={(e) => setDetail(e.target.value)} />
      </label>
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 14 }}
        disabled={!label.trim() || !detail.trim()}
        onClick={() => {
          dispatch({ type: 'ADD_ADDRESS', address: { id: uid(), label: label.trim(), detail: detail.trim() } })
          toast('Address saved 📍')
          onClose()
        }}
      >
        Save address
      </button>
    </Modal>
  )
}
