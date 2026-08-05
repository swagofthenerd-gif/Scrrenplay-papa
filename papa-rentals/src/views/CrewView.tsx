import { useState } from 'react'
import { useNav } from '../nav'
import { useStore } from '../store'
import { buzz, money, uid } from '../utils'
import { Badge } from '../components/ui'
import { Avatar, Icon } from '../components/icons'
import type { CrewMember } from '../types'

/* A shoot is not one person. A producer books gear the AD picked and the
   accountant pays for, and with a single account the answer was to pass a phone
   around — which means the wallet, the saved card and every past order travel
   with it. This names the people instead, and says what each of them can do. */

const ROLES = ['Producer', 'Director', '1st AD', 'DOP', 'Gaffer', 'Production manager', 'Accountant']

export default function CrewView() {
  const { go, toast } = useNav()
  const { state, dispatch } = useStore()
  const [name, setName] = useState('')
  const [role, setRole] = useState(ROLES[0])

  function add() {
    const clean = name.trim()
    if (!clean) return
    if (state.crew.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      toast(`${clean} is already on your crew`)
      return
    }
    buzz()
    /* Everyone starts on browse. Spending access is a decision, not a default —
       the whole point of naming people separately is that they are not all you. */
    const member: CrewMember = { id: uid(), name: clean, role, access: 'browse', addedAt: Date.now() }
    dispatch({ type: 'ADD_CREW', member })
    setName('')
    toast(`${clean} added — they can browse and build carts`)
  }

  return (
    <div className="section">
      <button className="back-btn" onClick={() => go({ name: 'profile' })}>
        <Icon name="chevron-left" size={16} /> Profile
      </button>
      <div className="section-head"><h2><Icon name="users" className="h-ico" size={18} /> Your crew</h2></div>

      <p className="muted small" style={{ marginTop: 0 }}>
        People who can work on your account. Anyone with booking access spends from your wallet
        ({money(state.walletBalance)}) and the card on file, so give it deliberately.
      </p>

      <div className="panel">
        <label className="field">
          Name
          <input value={name} placeholder="Who's joining?" enterKeyHint="done" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        </label>
        <label className="field" style={{ marginTop: 10 }}>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={!name.trim()} onClick={add}>
          <Icon name="users" size={15} /> Add to crew
        </button>
      </div>

      {state.crew.length === 0 ? (
        <div className="empty-state" style={{ padding: '26px 10px' }}>
          <div className="big"><Icon name="users" size={44} /></div>
          <p>Nobody on your crew yet. Add the people who book gear with you and each gets their own access.</p>
        </div>
      ) : (
        <div className="panel" style={{ marginTop: 14 }}>
          {state.crew.map((c, i) => (
            <div key={c.id} className="crew-row" style={{ borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
              <Avatar name={c.name} id={c.id} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b className="ellipsis" style={{ maxWidth: '100%' }}>{c.name}</b>
                <div className="muted small">{c.role}</div>
              </div>
              <div className="crew-actions">
                {/* A select rather than a toggle: "book" and "browse" are both
                    named states, and a switch would leave you guessing which way
                    is which. */}
                <label className="sr-only" htmlFor={`acc-${c.id}`}>Access for {c.name}</label>
                <select
                  id={`acc-${c.id}`}
                  value={c.access}
                  onChange={(e) => dispatch({ type: 'SET_CREW_ACCESS', id: c.id, access: e.target.value as CrewMember['access'] })}
                >
                  <option value="browse">Can browse</option>
                  <option value="book">Can book</option>
                </select>
                <button
                  className="btn btn-ghost btn-sm"
                  aria-label={`Remove ${c.name} from your crew`}
                  onClick={() => { buzz(); dispatch({ type: 'REMOVE_CREW', id: c.id }); toast(`${c.name} removed`) }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
              {c.access === 'book' && (
                <Badge tone="orange"><Icon name="wallet" size={13} /> Spends your wallet</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="muted small" style={{ marginTop: 14 }}>
        This demo has one login, so crew is a saved list rather than separate sign-ins — nothing here grants anyone
        real access to your device.
      </p>
    </div>
  )
}
