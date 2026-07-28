import { useMemo, useState } from 'react'
import { KITS, getItem, getOwner } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { buzz, daysBetween, findConflict, fmtDate, money, todayISO, uid } from '../utils'
import { Badge, ItemArt } from '../components/ui'
import { SectionHeader } from '../components/primitives'
import { Icon } from '../components/icons'

/* A kit was previously three lines on the home screen and a button that put four
   bookings in your cart. That is a lot of money to commit to from a blurb. This
   page exists to answer the three questions that stop people short: what is
   actually in it, what is deliberately not, and whether the whole thing is free
   on my dates — the last one being the question a bundle makes *harder*, since
   one busy item quietly breaks the set. */
export default function KitDetail({ id }: { id: string }) {
  const { go, back, toast } = useNav()
  const { state, dispatch } = useStore()
  const [startDate, setStartDate] = useState(todayISO(2))
  const [endDate, setEndDate] = useState(todayISO(3))

  /* Found rather than indexed: a stale bookmark to a retired kit should say so,
     not silently show a different kit's contents at this kit's URL. */
  const kit = KITS.find((k) => k.id === id)

  const lines = useMemo(() => {
    if (!kit) return []
    return kit.itemIds.map((itemId) => {
      const item = getItem(itemId)
      return {
        item,
        owner: getOwner(item.ownerId),
        conflict: findConflict(itemId, { start: startDate, end: endDate }, state.orders, state.cart),
      }
    })
  }, [kit, startDate, endDate, state.orders, state.cart])

  if (!kit) {
    return (
      <div className="pad">
        <button className="back-btn" onClick={back}><Icon name="chevron-left" size={14} /> Back</button>
        <div className="empty-state">
          <h3>This kit is no longer offered</h3>
          <p className="muted">The gear may still be available on its own.</p>
          <button className="btn btn-primary" onClick={() => go({ name: 'browse' })}>Browse everything</button>
        </div>
      </div>
    )
  }

  /* Rebound after the guard: TypeScript will not carry the narrowing from the
     early return into the callback below, and a non-null assertion there would
     be a claim rather than a check. */
  const k = kit
  const days = daysBetween(startDate, endDate)
  const invalidRange = endDate < startDate
  const fullPerDay = lines.reduce((s, l) => s + l.item.pricePerDay, 0)
  const kitPerDay = Math.round(fullPerDay * (1 - kit.percentOff / 100))
  const saving = (fullPerDay - kitPerDay) * days
  const deposit = lines.reduce((s, l) => s + l.item.deposit, 0)
  const clashes = lines.filter((l) => l.conflict)
  /* Owners are counted because a four-item kit from four vendors is four
     handovers, and someone planning a call sheet needs to know that up front. */
  const ownerCount = new Set(lines.map((l) => l.owner.id)).size

  function addKit() {
    if (invalidRange) return toast('The end date is before the start date')
    if (clashes.length) return toast(`${clashes.length} item${clashes.length > 1 ? 's are' : ' is'} booked on those dates`)
    buzz()
    for (const { item } of lines) {
      dispatch({
        type: 'ADD_TO_CART',
        booking: {
          id: uid(),
          itemId: item.id,
          startDate,
          endDate,
          pickupTime: '09:00',
          qty: 1,
          unit: 'day',
          hours: 4,
          transport: 'pickup',
          operator: false,
          insurance: Boolean(item.insuranceRequired),
          /* The discount is applied to the stored rate rather than being tracked
             as a kit, because the cart lets you edit and remove lines freely.
             A kit identity would have to either forbid that or silently rescind
             the discount later, and both are worse than a rate you can see. */
          rate: Math.round(item.pricePerDay * (1 - k.percentOff / 100)),
          negotiated: false,
        },
      })
    }
    toast(`${k.name} added — ${lines.length} items`)
    go({ name: 'cart' })
  }

  return (
    <div className="pad kit-detail">
      <button className="back-btn" onClick={back}><Icon name="chevron-left" size={14} /> Back</button>

      <div className="kit-hero">
        <span className="kit-hero-ico"><Icon name={kit.icon} size={30} /></span>
        <div>
          <h1 className="kit-hero-title">{kit.name}</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>{kit.blurb}</p>
        </div>
        <Badge tone="purple">Save {kit.percentOff}%</Badge>
      </div>

      {kit.bestFor && (
        <div className="kit-note">
          <Icon name="target" size={15} />
          <div><b>Best for</b><div className="muted small">{kit.bestFor}</div></div>
        </div>
      )}

      <div className="section">
        <SectionHeader
          icon="box"
          title={`What's in it — ${lines.length} items`}
          sub={ownerCount > 1 ? `From ${ownerCount} vendors, so expect ${ownerCount} handovers` : 'All from one vendor — one handover'}
        />
        <div className="kit-lines">
          {lines.map(({ item, owner, conflict }) => (
            <button key={item.id} className="kit-line" onClick={() => go({ name: 'item', id: item.id, from: startDate, to: endDate })}>
              <ItemArt item={item} size="thumb" />
              <span className="kit-line-info">
                <span className="kit-line-name">{item.name}</span>
                <span className="muted small">{owner.name} · {owner.distanceKm} km</span>
                {conflict && (
                  <span className="kit-line-clash">
                    <Icon name="warning" size={11} /> Booked {fmtDate(conflict.start)}–{fmtDate(conflict.end)}
                  </span>
                )}
              </span>
              <span className="kit-line-price">
                <s className="muted small">{money(item.pricePerDay)}</s>
                <b>{money(Math.round(item.pricePerDay * (1 - kit.percentOff / 100)))}</b>
                <span className="muted small">/day</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {kit.notIncluded && kit.notIncluded.length > 0 && (
        <div className="section">
          <SectionHeader icon="warning" title="Not included" sub="Budget for these separately" />
          <ul className="kit-excl">
            {kit.notIncluded.map((x) => <li key={x}><Icon name="x" size={12} /> {x}</li>)}
          </ul>
        </div>
      )}

      {kit.crewNote && (
        <div className="kit-note">
          <Icon name="users" size={15} />
          <div><b>Crew</b><div className="muted small">{kit.crewNote}</div></div>
        </div>
      )}

      <div className="section kit-book">
        <SectionHeader icon="calendar" title="Your dates" />
        <div className="kit-dates">
          <label>
            <span className="muted small">From</span>
            <input type="date" value={startDate} min={todayISO(0)} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            <span className="muted small">To</span>
            <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        {invalidRange && <div className="field-error"><Icon name="warning" size={12} /> The end date is before the start date.</div>}
        {!invalidRange && clashes.length > 0 && (
          <div className="field-error">
            <Icon name="warning" size={12} /> {clashes.length} of {lines.length} items {clashes.length > 1 ? 'are' : 'is'} already booked on these dates. Pick another window, or rent the rest on their own.
          </div>
        )}

        <div className="kit-summary">
          <div className="price-line"><span>{lines.length} items × {days} day{days > 1 ? 's' : ''}</span><b>{money(fullPerDay * days)}</b></div>
          <div className="price-line"><span>Kit discount ({kit.percentOff}%)</span><b className="credit">−{money(saving)}</b></div>
          <div className="price-line"><span>Deposit (hold only — released after return)</span><b>{money(deposit)}</b></div>
          <div className="price-line total"><span>Kit total</span><span>{money(kitPerDay * days)}</span></div>
        </div>

        <button className="btn btn-primary btn-block" onClick={addKit} disabled={invalidRange || clashes.length > 0}>
          Add all {lines.length} to cart
        </button>
        <p className="muted small" style={{ textAlign: 'center', marginTop: 8 }}>
          Lines stay editable in the cart — you can drop one and keep the rest.
        </p>
      </div>
    </div>
  )
}
