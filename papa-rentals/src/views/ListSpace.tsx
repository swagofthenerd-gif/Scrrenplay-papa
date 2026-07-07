import { useState } from 'react'
import { AMENITY_OPTIONS, RULE_OPTIONS, SPACE_TYPES } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { buzz, money, uid } from '../utils'
import type { Item } from '../types'

export default function ListSpace() {
  const { go, back, toast } = useNav()
  const { state, dispatch } = useStore()

  const [name, setName] = useState('')
  const [type, setType] = useState(SPACE_TYPES[0])
  const [area, setArea] = useState('')
  const [sqft, setSqft] = useState(1000)
  const [capacity, setCapacity] = useState(15)
  const [price, setPrice] = useState(25000)
  const [deposit, setDeposit] = useState(20000)
  const [hourly, setHourly] = useState(true)
  const [minHours, setMinHours] = useState(4)
  const [instantBook, setInstantBook] = useState(true)
  const [offersAccepted, setOffersAccepted] = useState(true)
  const [amenities, setAmenities] = useState<string[]>(['Wifi', 'Washrooms'])
  const [rules, setRules] = useState<string[]>(['No smoking'])
  const [description, setDescription] = useState('')

  const valid = name.trim().length >= 3 && area.trim().length >= 3 && price >= 1000

  function toggle(list: string[], set: (v: string[]) => void, v: string) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  }

  function submit() {
    buzz(20)
    const id = `u-${uid()}`
    const item: Item = {
      id,
      name: name.trim(),
      category: 'studios',
      emoji: type.emoji,
      pricePerDay: price,
      deposit,
      rating: 5,
      ratingCount: 0,
      ownerId: 'me',
      specs: [
        `${type.type} · ${sqft.toLocaleString()} sqft`,
        `Up to ${capacity} crew`,
        ...amenities.slice(0, 4),
      ],
      description: description.trim() || `${type.type} in ${area.trim()} — listed by ${state.profile.name || 'you'} on Papa Rentals.`,
      tags: [type.type.toLowerCase(), area.trim().toLowerCase(), 'space', 'location'],
      timesRented: 0,
      instantBook,
      offersAccepted,
      hourly,
      space: { type: type.type, sqft, capacity, amenities, rules, minHours: hourly ? minHours : undefined },
      reviews: [],
      mine: true,
      pendingVerifyAt: Date.now() + 8000,
      inquiryAt: Date.now() + 20000,
    }
    dispatch({ type: 'ADD_LISTING', item })
    toast('Space submitted — verification usually takes minutes 📤')
    go({ name: 'item', id })
  }

  return (
    <div>
      <button className="back-btn" onClick={back}>← Back</button>
      <div className="section" style={{ marginTop: 4 }}>
        <div className="section-head"><h2>🏢 List your space</h2></div>
        <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
          Studios, rooftops, havelis, warehouses, apartments — if crews want to shoot there, it earns.
          You keep 90%; Papa handles bookings, deposits and insurance.
        </p>

        <div className="panel">
          <label className="field">
            Space name
            <input value={name} placeholder="e.g. Sunlight Loft Studio" enterKeyHint="next" onChange={(e) => setName(e.target.value)} />
          </label>

          <div className="field" style={{ marginTop: 12 }}>
            Type
            <div className="slot-row">
              {SPACE_TYPES.map((t) => (
                <button key={t.type} className={`slot-chip ${type.type === t.type ? 'active' : ''}`} onClick={() => setType(t)}>
                  {t.emoji} {t.type}
                </button>
              ))}
            </div>
          </div>

          <label className="field" style={{ marginTop: 12 }}>
            Area / neighbourhood
            <input value={area} placeholder="e.g. Gulberg III, Lahore" enterKeyHint="next" onChange={(e) => setArea(e.target.value)} />
          </label>

          <div className="form-row">
            <label className="field">
              Size (sqft)
              <input type="number" inputMode="numeric" value={sqft} min={100} onChange={(e) => setSqft(Math.max(100, Number(e.target.value) || 0))} />
            </label>
            <label className="field">
              Max crew
              <input type="number" inputMode="numeric" value={capacity} min={1} onChange={(e) => setCapacity(Math.max(1, Number(e.target.value) || 0))} />
            </label>
          </div>

          <div className="form-row">
            <label className="field">
              Price per day (Rs)
              <input type="number" inputMode="numeric" value={price} min={1000} step={500} onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="field">
              Deposit hold (Rs)
              <input type="number" inputMode="numeric" value={deposit} min={0} step={500} onChange={(e) => setDeposit(Math.max(0, Number(e.target.value) || 0))} />
            </label>
          </div>

          <label className="toggle-row">
            <input type="checkbox" checked={hourly} onChange={(e) => setHourly(e.target.checked)} />
            <span><b>⏱️ Allow hourly bookings</b> — {money(Math.round(price / 6))}/hr auto-calculated{hourly && <>, minimum <b>{minHours}h</b></>}</span>
          </label>
          {hourly && (
            <div className="slot-row" style={{ marginLeft: 30 }}>
              {[2, 3, 4, 6, 8].map((h) => (
                <button key={h} className={`slot-chip ${minHours === h ? 'active' : ''}`} onClick={() => setMinHours(h)}>{h}h min</button>
              ))}
            </div>
          )}
          <label className="toggle-row">
            <input type="checkbox" checked={instantBook} onChange={(e) => setInstantBook(e.target.checked)} />
            <span><b>⚡ Instant book</b> — renters book without waiting for your approval. Boosts ranking.</span>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={offersAccepted} onChange={(e) => setOffersAccepted(e.target.checked)} />
            <span><b>🤝 Accept price offers</b> — renters can bid below your rate; you accept, counter or decline.</span>
          </label>
        </div>

        <div className="panel">
          <div className="field">
            Amenities
            <div className="slot-row">
              {AMENITY_OPTIONS.map((a) => (
                <button key={a} className={`slot-chip ${amenities.includes(a) ? 'active' : ''}`} onClick={() => toggle(amenities, setAmenities, a)}>{a}</button>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            House rules
            <div className="slot-row">
              {RULE_OPTIONS.map((r) => (
                <button key={r} className={`slot-chip ${rules.includes(r) ? 'active' : ''}`} onClick={() => toggle(rules, setRules, r)}>{r}</button>
              ))}
            </div>
          </div>
          <label className="field" style={{ marginTop: 14 }}>
            Describe it for filmmakers (optional)
            <input value={description} placeholder="The light, the look, what's shot here before…" enterKeyHint="done" onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>

        <div className="panel">
          <div className="price-summary" style={{ borderTop: 'none', marginTop: 0 }}>
            <div className="price-line"><span>Your daily rate</span><b>{money(price)}</b></div>
            {hourly && <div className="price-line"><span>Hourly rate (auto)</span><b>{money(Math.round(price / 6))}/hr</b></div>}
            <div className="price-line"><span>Papa fee (10% per booking)</span><b>−{money(Math.round(price * 0.1))}</b></div>
            <div className="price-line total"><span>You earn per day</span><span style={{ color: 'var(--green)' }}>{money(Math.round(price * 0.9))}</span></div>
          </div>
          <p className="muted small">
            Every renter is ID-verified and rated. Deposits are held by Papa, damage claims covered by Papa Protection, and payouts land within 24h of a completed booking.
          </p>
          <button className="btn btn-primary btn-block" disabled={!valid} onClick={submit}>
            {valid ? `Publish ${name.trim()}` : 'Fill name, area & price to publish'}
          </button>
        </div>
      </div>
    </div>
  )
}
