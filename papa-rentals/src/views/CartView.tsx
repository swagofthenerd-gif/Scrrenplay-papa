import { useState } from 'react'
import { PROMO_CODES, TRANSPORT_OPTIONS, getItem } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { cartTotals, fmtDate, lineDays, lineSubtotal, money } from '../utils'
import { Badge, ItemArt } from '../components/ui'

export default function CartView() {
  const { go, toast } = useNav()
  const { state, dispatch } = useStore()
  const [promoInput, setPromoInput] = useState('')
  const [promoCode, setPromoCode] = useState<string | undefined>()
  const [useWallet, setUseWallet] = useState(false)

  const walletRequested = useWallet ? state.walletBalance : 0
  const t = cartTotals(state.cart, promoCode, walletRequested)

  function applyPromo() {
    const code = promoInput.trim().toUpperCase()
    if (PROMO_CODES[code]) {
      setPromoCode(code)
      toast(`Promo applied: ${PROMO_CODES[code].label} 🎟️`)
    } else {
      toast('That code isn’t valid — try PAPA10')
    }
  }

  function placeOrder() {
    dispatch({ type: 'PLACE_ORDER', promoCode, walletUsed: walletRequested })
    toast('Order confirmed! Track it in Orders 🎉')
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
        <div className="panel">
          {state.cart.map((b, i) => {
            const item = getItem(b.itemId)
            const days = lineDays(b)
            const transport = TRANSPORT_OPTIONS.find((x) => x.id === b.transport)!
            return (
              <div className="cart-line" key={i}>
                <ItemArt item={item} size="thumb" />
                <div className="cart-line-info">
                  <b style={{ fontSize: 14 }}>{item.name}</b>
                  {b.negotiated && <Badge tone="purple">🤝 Negotiated</Badge>}
                  <div className="muted small">
                    {fmtDate(b.startDate)} → {fmtDate(b.endDate)} at {b.pickupTime} · {days}d × {b.qty} · {transport.emoji} {transport.name}
                  </div>
                  <div className="muted small">
                    {b.insurance && '🛡️ Protection · '}
                    {b.operator && '🧑‍🔧 Operator · '}
                    {money(b.agreedPricePerDay)}/day
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
            <input placeholder="Promo code (try PAPA10)" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} />
            <button className="btn btn-outline btn-sm" onClick={applyPromo}>Apply</button>
          </div>
          {promoCode && (
            <p className="small" style={{ color: 'var(--green)', fontWeight: 700 }}>
              🎟️ {promoCode}: {PROMO_CODES[promoCode].label}{' '}
              <button className="link-btn" onClick={() => setPromoCode(undefined)}>remove</button>
            </p>
          )}

          <label className="toggle-row">
            <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} />
            <span><b>👛 Use wallet balance</b> — {money(state.walletBalance)} available</span>
          </label>
        </div>

        <div>
          <div className="panel">
            <h3 style={{ fontSize: 16 }}>Payment summary</h3>
            <div className="price-summary" style={{ borderTop: 'none', marginTop: 4 }}>
              <div className="price-line"><span>Rental subtotal</span><b>{money(t.subtotal)}</b></div>
              <div className="price-line"><span>Transport</span>{t.transportFee === 0 ? <b className="free">Free</b> : <b>{money(t.transportFee)}</b>}</div>
              {t.insuranceFee > 0 && <div className="price-line"><span>Damage protection</span><b>{money(t.insuranceFee)}</b></div>}
              {t.operatorFee > 0 && <div className="price-line"><span>Operators</span><b>{money(t.operatorFee)}</b></div>}
              <div className="price-line"><span>Service fee (5%)</span><b>{money(t.serviceFee)}</b></div>
              {t.discount > 0 && <div className="price-line"><span>Promo discount</span><b style={{ color: 'var(--green)' }}>−{money(t.discount)}</b></div>}
              {t.walletUsed > 0 && <div className="price-line"><span>Wallet credit</span><b style={{ color: 'var(--green)' }}>−{money(t.walletUsed)}</b></div>}
              <div className="price-line"><span>Refundable deposit</span><b>{money(t.deposit)}</b></div>
              <div className="price-line total"><span>Total due now</span><span>{money(t.total)}</span></div>
            </div>
            <p className="muted small">
              Deposit is held securely and auto-refunded within 24h of a damage-free return. Free cancellation up to 48h before your start date.
            </p>
            <button className="btn btn-primary btn-block" onClick={placeOrder}>Confirm & pay {money(t.total)}</button>
            <p className="muted small" style={{ textAlign: 'center' }}>
              You'll earn <b>+{Math.floor((t.total - t.deposit) / 100)}</b> PapaPoints 🏆
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
