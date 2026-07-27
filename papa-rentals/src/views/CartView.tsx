import { useEffect, useMemo, useRef, useState } from 'react'
import { PAYMENT_METHODS, PROMO_CODES, TRANSPORT_OPTIONS, getItem, getOwner } from '../data/catalog'
import { similarItems } from '../recs'
import { useNav } from '../nav'
import { useStore } from '../store'
import {
  SERVICE_FEE_RATE,
  SILVER_POINTS,
  buzz,
  cartTotals,
  findConflict,
  fmtDate,
  lineDuration,
  lineSubtotal,
  money,
  shiftBooking,
  todayISO,
  uid,
} from '../utils'
import { Badge, ItemArt, ItemCard, Modal } from '../components/ui'
import { Icon } from '../components/icons'
import type { Booking, TransportId } from '../types'

/* Lookup maps built once — the option arrays never change at runtime. */
const TRANSPORT_BY_ID = new Map(TRANSPORT_OPTIONS.map((t) => [t.id, t]))
const PAY_BY_ID = new Map(PAYMENT_METHODS.map((p) => [p.id, p]))

/* Crews shoot the same package over and over. Saving a cart as a named kit
   turns a ten-tap rebuild into one tap, and it survives between sessions. */
const KITS_KEY = 'papa-kits-v1'
interface SavedKit { name: string; lines: Booking[] }

function loadKits(): SavedKit[] {
  try { return JSON.parse(localStorage.getItem(KITS_KEY) || '[]') } catch { return [] }
}
function storeKits(kits: SavedKit[]) {
  try { localStorage.setItem(KITS_KEY, JSON.stringify(kits)) } catch { /* storage unavailable */ }
}

export default function CartView() {
  const { go, toast } = useNav()
  const { state, dispatch } = useStore()
  const [promoInput, setPromoInput] = useState('')
  const [promoCode, setPromoCode] = useState<string | undefined>()
  const [useWallet, setUseWallet] = useState(false)
  const [redeemPoints, setRedeemPoints] = useState(false)
  const [payMethod, setPayMethod] = useState('card')
  const [addrOpen, setAddrOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [kitOpen, setKitOpen] = useState(false)
  const [addrNote, setAddrNote] = useState('')
  const [kits, setKits] = useState<SavedKit[]>(loadKits)
  /* Removals are reversible for a few seconds instead of being a dead end.
     The undo carries its own restore closure, so anything destructive here can
     use the same bar — cart lines and saved kits both do. */
  const [undo, setUndo] = useState<{ label: string; restore: () => void } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(undoTimer.current), [])

  function offerUndo(label: string, restore: () => void) {
    setUndo({ label, restore })
    clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndo(null), 7000)
  }

  function offerLineUndo(label: string, lines: { booking: Booking; index: number }[]) {
    offerUndo(label, () => {
      // restore in original order so indices land where they were
      for (const l of [...lines].sort((a, b) => a.index - b.index)) {
        dispatch({ type: 'RESTORE_CART_LINE', booking: l.booking, index: l.index })
      }
    })
  }

  function runUndo() {
    if (!undo) return
    undo.restore()
    setUndo(null)
    buzz()
  }

  const opts = useMemo(
    () => ({
      promoCode,
      walletUsed: useWallet ? state.walletBalance : 0,
      redeemPoints,
      points: state.points,
      ordersCount: state.orders.length,
      promoCodesUsed: state.promoCodesUsed,
      freeVanPerkMonth: state.freeVanPerkMonth,
    }),
    [promoCode, useWallet, state.walletBalance, redeemPoints, state.points, state.orders.length, state.promoCodesUsed, state.freeVanPerkMonth]
  )

  const t = useMemo(() => cartTotals(state.cart, opts), [state.cart, opts])
  const address = state.addresses.find((a) => a.id === state.selectedAddressId) ?? state.addresses[0]
  const needsDelivery = state.cart.some((b) => b.transport !== 'pickup')
  const needsApproval = state.cart.some((b) => !getItem(b.itemId).instantBook)

  /* Multi-vendor carts are grouped by owner — delivery is charged once per vendor, and that should be visible. */
  const groups = useMemo(() => {
    const byOwner = new Map<string, Booking[]>()
    for (const b of state.cart) {
      const ownerId = getItem(b.itemId).ownerId
      const arr = byOwner.get(ownerId)
      if (arr) arr.push(b)
      else byOwner.set(ownerId, [b])
    }
    return [...byOwner.entries()].map(([ownerId, lines]) => ({ owner: getOwner(ownerId), lines }))
  }, [state.cart])

  /* Blend suggestions across every line, not just the last one added — a cart of
     camera + light shouldn't recommend six more lights. */
  const crossSell = useMemo(() => {
    if (state.cart.length === 0) return []
    const inCart = new Set(state.cart.map((b) => b.itemId))
    const pools = state.cart.slice(-3).map((b) => similarItems(b.itemId, state, 6).filter((i) => !inCart.has(i.id)))
    const out: typeof pools[number] = []
    const seen = new Set<string>()
    for (let i = 0; i < 6; i++) {
      for (const pool of pools) {
        const pick = pool[i]
        if (pick && !seen.has(pick.id)) { seen.add(pick.id); out.push(pick) }
      }
    }
    return out.slice(0, 6)
  }, [state])

  /* Dates can go stale between adding to cart and paying — somebody else may have
     booked the same item. Re-check right before the money moves. */
  const conflicts = useMemo(
    () =>
      state.cart
        .map((b) => {
          const others = state.cart.filter((x) => x.id !== b.id)
          const clash = findConflict(b.itemId, { start: b.startDate, end: b.endDate }, state.orders, others)
          const item = getItem(b.itemId)
          const gone = item.paused === true
          return clash || gone ? { booking: b, clash, gone } : null
        })
        .filter((c): c is { booking: Booking; clash: ReturnType<typeof findConflict>; gone: boolean } => c !== null),
    [state.cart, state.orders]
  )

  /* Don't make people guess which code is best — check every public one. */
  const bestPromo = useMemo(() => {
    if (promoCode) return null
    let best: { code: string; saves: number } | null = null
    for (const code of Object.keys(PROMO_CODES)) {
      const check = cartTotals(state.cart, { ...opts, promoCode: code })
      if (!check.promoError && check.promoDiscount > (best?.saves ?? 0)) best = { code, saves: check.promoDiscount }
    }
    return best
  }, [state.cart, opts, promoCode])

  const silverGap = state.points < SILVER_POINTS ? SILVER_POINTS - state.points : 0

  function applyPromo() {
    const code = promoInput.trim().toUpperCase()
    if (!code) return
    setPromoCode(code)
    const check = cartTotals(state.cart, { ...opts, promoCode: code })
    if (check.promoError) toast(check.promoError)
    else toast(`Promo applied: ${PROMO_CODES[code].label}`)
  }

  const shootDays = useMemo(
    () => [...new Set(state.cart.map((b) => b.startDate))].sort(),
    [state.cart]
  )

  /* Shift each line to the earliest start, keeping its own length — a 3-day
     camera stays 3 days, it just starts when everything else does. */
  function alignDates() {
    const target = shootDays[0]
    buzz()
    const before = state.cart
    for (const b of state.cart) {
      if (b.startDate === target) continue
      const { startDate, endDate } = shiftBooking(b, target)
      dispatch({ type: 'UPDATE_CART_LINE', lineId: b.id, patch: { startDate, endDate } })
    }
    // Moving every date at once is a big edit to land with no way back.
    offerUndo('Dates aligned', () => {
      for (const b of before) dispatch({ type: 'UPDATE_CART_LINE', lineId: b.id, patch: { startDate: b.startDate, endDate: b.endDate } })
    })
    toast(`All lines now start ${fmtDate(target)}`)
  }

  function removeLine(b: Booking) {
    const index = state.cart.findIndex((x) => x.id === b.id)
    buzz()
    dispatch({ type: 'REMOVE_FROM_CART', lineId: b.id })
    offerLineUndo('Item removed', [{ booking: b, index }])
  }

  function saveForLater(b: Booking) {
    const index = state.cart.findIndex((x) => x.id === b.id)
    buzz()
    if (!state.wishlist.includes(b.itemId)) dispatch({ type: 'TOGGLE_WISHLIST', itemId: b.itemId })
    dispatch({ type: 'REMOVE_FROM_CART', lineId: b.id })
    offerLineUndo('Saved to wishlist', [{ booking: b, index }])
  }

  function saveKit(name: string) {
    const next = [{ name, lines: state.cart }, ...kits.filter((k) => k.name !== name)].slice(0, 12)
    setKits(next)
    storeKits(next)
    setKitOpen(false)
    toast(`Saved “${name}” — load it any time from an empty cart`)
  }

  /* A kit is a dozen taps of work behind one word. Deleting it sat next to
     "Load" with no confirm and no way back — the undo bar costs nothing. */
  function removeKit(name: string) {
    const index = kits.findIndex((k) => k.name === name)
    const gone = kits[index]
    if (!gone) return
    const next = kits.filter((k) => k.name !== name)
    setKits(next)
    storeKits(next)
    offerUndo(`Deleted “${name}”`, () => {
      const restored = [...next]
      restored.splice(index, 0, gone)
      setKits(restored)
      storeKits(restored)
    })
  }

  /* Dates from a kit saved weeks ago are stale, so every line comes back on a
     fresh two-days-out start and the crew adjusts once in the cart. */
  function loadKit(kit: SavedKit) {
    buzz()
    const start = todayISO(2)
    for (const l of kit.lines) {
      dispatch({ type: 'ADD_TO_CART', booking: { ...shiftBooking(l, start), id: uid(), negotiated: false } })
    }
    toast(`${kit.name} loaded — check the dates before paying`)
  }

  function clearAll() {
    const snapshot = state.cart.map((booking, index) => ({ booking, index }))
    dispatch({ type: 'CLEAR_CART' })
    setConfirmClear(false)
    offerLineUndo('Cart cleared', snapshot)
  }

  function placeOrder() {
    if (t.promoError) {
      toast(t.promoError)
      return
    }
    setReviewOpen(false)
    buzz(20)
    dispatch({
      type: 'PLACE_ORDER',
      opts: {
        ...opts,
        paymentMethod: PAY_BY_ID.get(payMethod)?.name ?? 'Card',
        address: needsDelivery && address
          ? `${address.label} — ${address.detail}${addrNote.trim() ? ` (${addrNote.trim()})` : ''}`
          : 'Self pickup',
      },
    })
    toast(needsApproval ? 'Booking requested — owner usually approves in minutes' : 'Order confirmed! Track it in Orders')
    go({ name: 'orders' })
  }

  if (state.cart.length === 0) {
    const saved = state.wishlist.map((id) => getItem(id)).filter(Boolean).slice(0, 6)
    return (
      <div className="section">
        <div className="empty-state">
          <div className="big"><Icon name="cart" size={56} /></div>
          <h3>Your cart is empty</h3>
          <p>Gear up for your next shoot — deals are waiting.</p>
          <button className="btn btn-primary" onClick={() => go({ name: 'browse' })}>Browse gear</button>
        </div>
        {kits.length > 0 && (
          <div className="panel">
            <h3 style={{ fontSize: 15 }}><Icon name="backpack" size={16} /> Your saved kits</h3>
            {kits.map((k) => (
              <div key={k.name} className="list-row">
                <span><b>{k.name}</b><span className="muted small" style={{ display: 'block' }}>{k.lines.length} item{k.lines.length > 1 ? 's' : ''}</span></span>
                <span style={{ display: 'flex', gap: 10 }}>
                  <button className="link-btn" onClick={() => loadKit(k)}>Load</button>
                  <button className="link-btn" onClick={() => removeKit(k.name)}>Delete</button>
                </span>
              </div>
            ))}
          </div>
        )}
        {undo && <UndoBar label={undo.label} onUndo={runUndo} />}
        {saved.length > 0 && (
          <div className="section">
            <div className="section-head"><h2><Icon name="heart" className="h-ico" size={18} /> Saved for later</h2></div>
            <div className="h-scroll">
              {saved.map((i) => (
                <ItemCard
                  key={i.id}
                  item={i}
                  onOpen={() => go({ name: 'item', id: i.id })}
                  wishlisted
                  onToggleWish={() => dispatch({ type: 'TOGGLE_WISHLIST', itemId: i.id })}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="section">
      <div className="section-head">
        <h2><Icon name="cart" className="h-ico" size={18} /> Your cart</h2>
        <span style={{ display: 'flex', gap: 10 }}>
          <button className="link-btn" onClick={() => setKitOpen(true)}>Save as kit</button>
          <button className="link-btn" onClick={() => setConfirmClear(true)}>Clear all</button>
        </span>
      </div>

      {shootDays.length > 1 && (
        <p className="muted small" style={{ margin: '0 0 8px' }}>
          <Icon name="calendar" size={13} /> {shootDays.length} shoot days in this cart: {shootDays.map((d) => fmtDate(d)).join(' · ')}
          {/* Mismatched start dates are almost always an accident of when each
              item was added, not a plan — and they split one shoot into two
              deliveries. One tap to put the whole cart on the same morning. */}
          {' · '}
          <button className="link-btn" onClick={alignDates}>Put them all on {fmtDate(shootDays[0])}</button>
        </p>
      )}

      {conflicts.length > 0 && (
        <div className="conflict-note" role="alert" style={{ marginBottom: 10 }}>
          <Icon name="warning" size={14} />{' '}
          {conflicts.map((c) => getItem(c.booking.itemId).name).join(', ')}{' '}
          {conflicts.length > 1 ? 'are' : 'is'} no longer free on those dates. Edit the line to pick new dates before paying.
        </div>
      )}

      <div className="detail-grid">
        <div>
          {groups.map(({ owner, lines }) => (
            <div className="panel" key={owner.id}>
              {groups.length > 1 && (
                <div className="muted small" style={{ fontWeight: 700, marginBottom: 8 }}>
                  <Icon name="store" size={14} /> {owner.name}
                  {owner.verified && <> · <Icon name="check-circle" size={13} /> Verified</>}
                  {' · '}delivery charged once for this vendor
                  {' · '}{lines.every((l) => l.transport === 'pickup')
                    ? `you collect from ${owner.area}`
                    : `arrives in ${TRANSPORT_BY_ID.get(lines[0].transport)?.eta ?? 'a few hours'}`}
                </div>
              )}
              {lines.map((b) => {
                const item = getItem(b.itemId)
                const dur = lineDuration(b)
                const transport = TRANSPORT_BY_ID.get(b.transport)
                const open = editing === b.id
                return (
                  <div className="cart-line" key={b.id}>
                    <ItemArt item={item} size="thumb" />
                    <div className="cart-line-info">
                      <b style={{ fontSize: 14, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>{item.name}</b>
                      {b.negotiated && <Badge tone="purple"><Icon name="handshake" size={14} /> Negotiated</Badge>}
                      {!item.instantBook && <Badge tone="orange"><Icon name="hourglass" size={14} /> Needs approval</Badge>}
                      <div className="muted small">
                        {b.unit === 'hour'
                          ? `${fmtDate(b.startDate)} · ${b.hours}h from ${b.pickupTime}`
                          : `${fmtDate(b.startDate)} to ${fmtDate(b.endDate)} at ${b.pickupTime}`} · ×{b.qty}
                        {transport && <> · <Icon name={transport.icon} size={14} /> {transport.name}</>}
                      </div>
                      <div className="muted small">
                        {b.insurance && <><Icon name="shield" size={14} /> Damage protection · </>}
                        {b.operator && <><Icon name="wrench" size={14} /> Operator · </>}
                        {money(b.rate)}/{b.unit} × {dur}
                      </div>
                    </div>
                    <div className="cart-line-actions">
                      <b style={{ fontSize: 14 }}>{money(lineSubtotal(b))}</b>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <button className="link-btn" aria-expanded={open} onClick={() => setEditing(open ? null : b.id)}>
                          {open ? 'Done' : 'Edit'}
                        </button>
                        <button className="link-btn" onClick={() => saveForLater(b)}>Save for later</button>
                        <button className="link-btn" onClick={() => removeLine(b)}>Remove</button>
                      </div>
                    </div>
                    {item.timesRented > 40 && (
                      <div className="muted small" style={{ flexBasis: '100%' }}>
                        <Icon name="flame" size={13} /> Booked {item.timesRented} times — dates like these usually go within a day.
                      </div>
                    )}
                    {open && <LineEditor booking={b} insuranceLocked={Boolean(item.insuranceRequired)} />}
                  </div>
                )
              })}
            </div>
          ))}

          <div className="panel">
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
            {promoCode && t.promoError && <p className="promo-error"><Icon name="warning" size={14} /> {t.promoError} <button className="link-btn" onClick={() => setPromoCode(undefined)}>remove</button></p>}
            {promoCode && !t.promoError && t.promoDiscount > 0 && (
              <p className="small" style={{ color: 'var(--green)', fontWeight: 700 }}>
                <Icon name="ticket" size={14} /> {promoCode}: {PROMO_CODES[promoCode].label}{' '}
                <button className="link-btn" onClick={() => setPromoCode(undefined)}>remove</button>
              </p>
            )}

            {bestPromo && (
              <p className="small" style={{ color: 'var(--green)', fontWeight: 700 }}>
                <Icon name="ticket" size={14} /> Code <b>{bestPromo.code}</b> would save you {money(bestPromo.saves)}{' '}
                <button className="link-btn" onClick={() => { setPromoInput(bestPromo.code); setPromoCode(bestPromo.code) }}>apply it</button>
              </p>
            )}

            <label className="toggle-row">
              <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} />
              <span>
                <b><Icon name="wallet" size={14} /> Use wallet balance</b> — {money(state.walletBalance)} available
                {useWallet && t.walletUsed < state.walletBalance && (
                  <span className="muted small" style={{ display: 'block' }}>
                    Only {money(t.walletUsed)} is needed for this order — the rest stays in your wallet.
                  </span>
                )}
              </span>
            </label>
            <label className="toggle-row">
              <input type="checkbox" checked={redeemPoints} onChange={(e) => setRedeemPoints(e.target.checked)} />
              <span>
                <b><Icon name="trophy" size={14} /> Redeem PapaPoints</b> — {state.points} pts = {money(state.points)}
                {redeemPoints && t.pointsUsed < state.points && (
                  <span className="muted small" style={{ display: 'block' }}>
                    {t.pointsUsed} pts covers this bill — you keep {state.points - t.pointsUsed}.
                  </span>
                )}
              </span>
            </label>
            {silverGap > 0 && (
              <p className="muted small" style={{ marginBottom: 0 }}>
                <Icon name="medal" size={14} /> {silverGap} points to Silver — you'll earn {Math.floor(t.total / 100)} from this
                order, and Silver adds a free van delivery every month.
              </p>
            )}
          </div>

          {needsDelivery && (
            <div className="panel">
              <h3 style={{ fontSize: 15 }} id="addr-head"><Icon name="pin" className="h-ico" size={15} /> Deliver to</h3>
              <div role="radiogroup" aria-labelledby="addr-head">
                {state.addresses.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={a.id === state.selectedAddressId}
                    className={`addr-row ${a.id === state.selectedAddressId ? 'active' : ''}`}
                    style={{ width: '100%', textAlign: 'left' }}
                    onClick={() => dispatch({ type: 'SELECT_ADDRESS', id: a.id })}
                  >
                    <b style={{ flex: 'none' }}>{a.label}</b>
                    <span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detail}</span>
                  </button>
                ))}
              </div>
              <label className="field" style={{ marginTop: 10 }}>
                Landmark or gate instructions
                <input
                  value={addrNote}
                  placeholder="e.g. Gate 3, ask for the AD — parking behind the block"
                  onChange={(e) => setAddrNote(e.target.value)}
                />
              </label>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                Drivers use this instead of a map pin — most late deliveries are a gate they couldn't find.
              </p>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setAddrOpen(true)}>+ Add address</button>
            </div>
          )}

          <div className="panel">
            <h3 style={{ fontSize: 15 }} id="pay-head"><Icon name="card" className="h-ico" size={15} /> Pay with</h3>
            <div role="radiogroup" aria-labelledby="pay-head">
              {PAYMENT_METHODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={payMethod === p.id}
                  className={`pay-method ${payMethod === p.id ? 'active' : ''}`}
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => setPayMethod(p.id)}
                >
                  <span style={{ fontSize: 20 }}><Icon name={p.icon} size={14} /></span>
                  <b>{p.name}</b>
                  {p.id === 'cod' && <span className="muted small" style={{ marginLeft: 'auto' }}>rental paid in cash, deposit held on your card</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="panel">
            <h3 style={{ fontSize: 16 }}>Payment summary</h3>
            <div className="price-summary" style={{ borderTop: 'none', marginTop: 4 }}>
              <div className="price-line"><span>Rental subtotal</span><b>{money(t.subtotal)}</b></div>
              <div className="price-line"><span>Delivery (charged once per vendor)</span>{t.transportFee === 0 ? <b className="free">Free</b> : <b>{money(t.transportFee)}</b>}</div>
              {t.insuranceFee > 0 && <div className="price-line"><span>Damage protection</span><b>{money(t.insuranceFee)}</b></div>}
              {t.operatorFee > 0 && <div className="price-line"><span>Operators</span><b>{money(t.operatorFee)}</b></div>}
              <div className="price-line"><span title="Covers payment processing, verification and GST.">Service fee ({Math.round(SERVICE_FEE_RATE * 100)}%, incl. GST)</span><b>{money(t.serviceFee)}</b></div>
              {(t.promoDiscount > 0 || t.tierDiscount > 0 || t.vanPerk > 0 || t.pointsUsed > 0 || t.walletUsed > 0) && (
                <div className="price-line"><span className="muted small" style={{ fontWeight: 800 }}>Discounts</span><span /></div>
              )}
              {t.promoDiscount > 0 && <div className="price-line"><span>Promo discount</span><b className="credit">−{money(t.promoDiscount)}</b></div>}
              {t.tierDiscount > 0 && <div className="price-line"><span><Icon name="medal" size={14} /> Gold perk (5% off)</span><b className="credit">−{money(t.tierDiscount)}</b></div>}
              {t.vanPerk > 0 && <div className="price-line"><span><Icon name="medal" size={14} /> Free van delivery perk</span><b className="credit">−{money(t.vanPerk)}</b></div>}
              {t.pointsUsed > 0 && <div className="price-line"><span>PapaPoints</span><b className="credit">−{money(t.pointsUsed)}</b></div>}
              {t.walletUsed > 0 && <div className="price-line"><span>Wallet credit</span><b className="credit">−{money(t.walletUsed)}</b></div>}
              <div className="price-line total" aria-live="polite"><span>Charged now</span><span>{money(t.total)}</span></div>
              <div className="price-line">
                <span className="muted" title="An authorization hold on your card — no money leaves your account.">Deposit hold (not charged)</span>
                <span className="muted">{money(t.depositHold)}</span>
              </div>
            </div>
            <p className="muted small">
              The deposit is an authorization hold — released automatically within 24h of a damage-free return.
              Free cancellation up to 48h before your start date; 10% fee inside 48h.
            </p>
            <button
              className="btn btn-primary btn-block"
              onClick={() => setReviewOpen(true)}
              disabled={Boolean(t.promoError) || conflicts.length > 0}
            >
              {needsApproval ? `Review & request · ${money(t.total)}` : `Review & pay ${money(t.total)}`}
            </button>
            {t.promoError && <p className="muted small" style={{ textAlign: 'center' }}>Remove or fix the promo code to continue.</p>}
            {conflicts.length === 0 && state.cart.length > 1 && (
              <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setQuoteOpen(true)}>
                <Icon name="scroll" size={14} /> Request a quote instead
              </button>
            )}
            <p className="muted small" style={{ textAlign: 'center' }}>
              You'll earn <b>+{Math.floor(t.total / 100)}</b> PapaPoints <Icon name="trophy" size={14} /> — worth {money(Math.floor(t.total / 100))} off next time
            </p>
          </div>
        </div>
      </div>

      {crossSell.length > 0 && (
        <div className="section">
          <div className="section-head"><h2><Icon name="puzzle" className="h-ico" size={18} /> Complete your setup</h2></div>
          <div className="h-scroll">
            {crossSell.map((i) => (
              <ItemCard
                key={i.id}
                item={i}
                onOpen={() => go({ name: 'item', id: i.id })}
                wishlisted={state.wishlist.includes(i.id)}
                onToggleWish={() => dispatch({ type: 'TOGGLE_WISHLIST', itemId: i.id })}
              />
            ))}
          </div>
        </div>
      )}

      <div className="pay-bar">
        <div style={{ minWidth: 0 }}>
          <b>{money(t.total)}</b>
          <span className="muted small" style={{ display: 'block' }}>
            {state.cart.length} line{state.cart.length > 1 ? 's' : ''} · {money(t.depositHold)} hold
          </span>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setReviewOpen(true)}
          disabled={Boolean(t.promoError) || conflicts.length > 0}
        >
          {needsApproval ? 'Review & request' : 'Review & pay'}
        </button>
      </div>

      {undo && <UndoBar label={undo.label} onUndo={runUndo} />}
      {addrOpen && <AddAddressModal onClose={() => setAddrOpen(false)} />}
      {kitOpen && <SaveKitModal count={state.cart.length} onClose={() => setKitOpen(false)} onSave={saveKit} />}
      {confirmClear && (
        <Modal title="Clear your cart?" onClose={() => setConfirmClear(false)}>
          <p className="muted">This removes all {state.cart.length} line{state.cart.length > 1 ? 's' : ''}. You'll get a few seconds to undo.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn btn-outline btn-block" onClick={() => setConfirmClear(false)}>Keep them</button>
            <button className="btn btn-primary btn-block" onClick={clearAll}>Clear cart</button>
          </div>
        </Modal>
      )}
      {quoteOpen && (
        <Modal title="Request a quote" onClose={() => setQuoteOpen(false)}>
          <p className="muted small" style={{ marginTop: 0 }}>
            For multi-day or multi-vendor shoots we'll send a single itemised quote you can forward to production. Nothing is
            booked and nothing is charged until you accept it.
          </p>
          {groups.map(({ owner, lines }) => (
            <div key={owner.id} className="price-line">
              <span>{owner.name} <span className="muted small">· {lines.length} line{lines.length > 1 ? 's' : ''}</span></span>
              <b>{money(lines.reduce((sum, l) => sum + lineSubtotal(l), 0))}</b>
            </div>
          ))}
          <div className="price-line total"><span>Indicative total</span><span>{money(t.total)}</span></div>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              setQuoteOpen(false)
              toast('Quote requested — vendors reply within the hour')
            }}
          >
            Send request to {groups.length} vendor{groups.length > 1 ? 's' : ''}
          </button>
        </Modal>
      )}
      {reviewOpen && (
        <Modal title="Review your booking" onClose={() => setReviewOpen(false)}>
          {state.cart.map((b) => (
            <div key={b.id} className="price-line">
              <span>{getItem(b.itemId).name} <span className="muted small">×{b.qty} · {lineDuration(b)} {b.unit}{lineDuration(b) > 1 ? 's' : ''}</span></span>
              <b>{money(lineSubtotal(b))}</b>
            </div>
          ))}
          <div className="price-line total"><span>Charged now</span><span>{money(t.total)}</span></div>
          <div className="price-line"><span className="muted">Deposit hold</span><span className="muted">{money(t.depositHold)}</span></div>
          <p className="muted small">
            {needsDelivery && address ? `Delivering to ${address.label} — ${address.detail}. ` : 'Self pickup from the vendor. '}
            Paying by {PAY_BY_ID.get(payMethod)?.name ?? 'Card'}.
          </p>
          <p className="muted small">
            By continuing you accept the cancellation policy: free until 48h before your start date, 10% fee inside 48h.
          </p>
          <button className="btn btn-primary btn-block" onClick={placeOrder}>
            {needsApproval ? `Request booking · ${money(t.total)}` : `Confirm & pay ${money(t.total)}`}
          </button>
        </Modal>
      )}
    </div>
  )
}

/* A removal you can take back — safer than a confirm dialog on every tap. */
function UndoBar({ label, onUndo }: { label: string; onUndo: () => void }) {
  return (
    <div className="toast" role="status">
      {label} <button className="link-btn" style={{ marginLeft: 10 }} onClick={onUndo}>Undo</button>
    </div>
  )
}

/* Crews think in call times, not clock precision. Slots also let vendors batch
   deliveries, which is why free delivery is possible at all. */
const SLOTS = [
  { value: '06:00', label: 'Early call · 6–8 am' },
  { value: '08:00', label: 'Morning · 8–10 am' },
  { value: '10:00', label: 'Late morning · 10 am–12 pm' },
  { value: '13:00', label: 'Afternoon · 1–3 pm' },
  { value: '16:00', label: 'Evening · 4–6 pm' },
  { value: '19:00', label: 'Night shoot · 7–9 pm' },
]

/** Existing bookings hold arbitrary times; snap them to the closest slot. */
function nearestSlot(time: string): string {
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  const target = mins(time)
  return SLOTS.reduce((best, sl) => (Math.abs(mins(sl.value) - target) < Math.abs(mins(best) - target) ? sl.value : best), SLOTS[0].value)
}

/* Editing in place beats deleting the line and rebuilding the whole booking. */
function LineEditor({ booking, insuranceLocked }: { booking: Booking; insuranceLocked: boolean }) {
  const { dispatch } = useStore()
  const patch = (p: Partial<Booking>) => dispatch({ type: 'UPDATE_CART_LINE', lineId: booking.id, patch: p })
  const min = todayISO(0)

  return (
    <div style={{ flexBasis: '100%', borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 10, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="muted small" style={{ fontWeight: 700 }}>Quantity</span>
        <button className="btn btn-outline btn-sm" aria-label="Decrease quantity" disabled={booking.qty <= 1} onClick={() => patch({ qty: booking.qty - 1 })}>−</button>
        <b aria-live="polite">{booking.qty}</b>
        <button className="btn btn-outline btn-sm" aria-label="Increase quantity" onClick={() => patch({ qty: booking.qty + 1 })}>+</button>
      </div>

      {booking.unit === 'hour' ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <label className="field" style={{ flex: 1 }}>
            Date
            <input type="date" min={min} value={booking.startDate} onChange={(e) => patch({ startDate: e.target.value, endDate: e.target.value })} />
          </label>
          <label className="field" style={{ flex: 1 }}>
            Hours
            <input type="number" min={3} value={booking.hours} onChange={(e) => patch({ hours: Math.max(3, Number(e.target.value) || 3) })} />
          </label>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <label className="field" style={{ flex: 1 }}>
            Start
            <input
              type="date"
              min={min}
              value={booking.startDate}
              onChange={(e) => {
                const startDate = e.target.value
                // keep the range valid: an earlier start never leaves the end behind
                patch({ startDate, endDate: booking.endDate < startDate ? startDate : booking.endDate })
              }}
            />
          </label>
          <label className="field" style={{ flex: 1 }}>
            End
            <input type="date" min={booking.startDate} value={booking.endDate} onChange={(e) => patch({ endDate: e.target.value })} />
          </label>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <label className="field" style={{ flex: 1 }}>
          {booking.transport === 'pickup' ? 'Pickup time' : 'Delivery slot'}
          <select value={nearestSlot(booking.pickupTime)} onChange={(e) => patch({ pickupTime: e.target.value })}>
            {SLOTS.map((sl) => <option key={sl.value} value={sl.value}>{sl.label}</option>)}
          </select>
        </label>
        <label className="field" style={{ flex: 1 }}>
          Delivery
          <select value={booking.transport} onChange={(e) => patch({ transport: e.target.value as TransportId })}>
            {TRANSPORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.name} — {o.fee === 0 ? 'free' : money(o.fee)}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={booking.insurance}
          disabled={insuranceLocked}
          onChange={(e) => patch({ insurance: e.target.checked })}
        />
        <span>
          <b><Icon name="shield" size={14} /> Damage protection</b>
          {insuranceLocked && <span className="muted small"> — required on high-deposit gear</span>}
        </span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={booking.operator} onChange={(e) => patch({ operator: e.target.checked })} />
        <span><b><Icon name="wrench" size={14} /> Add a trained operator</b></span>
      </label>
    </div>
  )
}

function SaveKitModal({ count, onClose, onSave }: { count: number; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <Modal title="Save this cart as a kit" onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Stores {count} line{count > 1 ? 's' : ''} — gear, quantities, protection and operator choices. Dates reset when you load it.
      </p>
      <label className="field">
        Kit name
        <input value={name} placeholder="e.g. Two-camera interview day" enterKeyHint="done" onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={name.trim().length < 2} onClick={() => onSave(name.trim())}>
        Save kit
      </button>
    </Modal>
  )
}

function AddAddressModal({ onClose }: { onClose: () => void }) {
  const { dispatch } = useStore()
  const { toast } = useNav()
  const [label, setLabel] = useState('')
  const [detail, setDetail] = useState('')

  return (
    <Modal title="New address" onClose={onClose}>
      <label className="field">
        Label
        <input value={label} placeholder="e.g. Location shoot" onChange={(e) => setLabel(e.target.value)} />
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
          toast('Address saved')
          onClose()
        }}
      >
        Save address
      </button>
    </Modal>
  )
}
