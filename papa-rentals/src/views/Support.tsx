import { useEffect, useRef, useState } from 'react'
import { useNav } from '../nav'
import { useStore } from '../store'
import { buzz, money, uid } from '../utils'
import { Badge } from '../components/ui'

const FAQS: [string, string][] = [
  ['How do deposits work?', 'Deposits are authorization holds, never charges. They release automatically within 24 hours of a damage-free return — you can watch the release status on each order card.'],
  ['What if I need to cancel?', 'Free cancellation up to 48 hours before your start date. Inside 48 hours a 10% fee applies. Refunds land in your Papa Wallet instantly.'],
  ['What does Papa Damage Protection cover?', 'Accidental damage up to the item’s full value, for 8% of the rental. File a claim from the order — most claims resolve within a day, credited to your wallet.'],
  ['How does “Offer your price” work?', 'On any listing with 💰 Offers OK, slide to your price. Offers at 92%+ of the recommended fare are usually accepted instantly. Accepted deals stay locked for 24 hours, even if you change dates.'],
  ['How do host payouts work?', 'You keep 90% of every booking. Payouts land in your wallet within 24 hours of a completed booking — track them in your Host dashboard.'],
  ['My delivery is late — what now?', 'The courier card on your order has a call button and your handover PIN. If the courier is 15+ minutes late, your delivery fee is auto-credited.'],
]

export default function Support() {
  const { back } = useNav()
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState<number | null>(null)
  const [text, setText] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  const thread = state.chats['support']
  const msgs = thread?.messages ?? []
  const typing = Boolean(thread?.typingUntil && thread.typingUntil > Date.now())

  useEffect(() => {
    dispatch({ type: 'READ_CHAT', ownerId: 'support' })
  }, [msgs.length, dispatch])

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight })
  }, [msgs.length, typing])

  function send(preset?: string) {
    const t = (preset ?? text).trim()
    if (!t) return
    buzz()
    dispatch({
      type: 'ADD_CHAT', ownerId: 'support',
      message: { id: uid(), from: 'me', text: t, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), at: Date.now() },
    })
    setText('')
  }

  return (
    <div className="section">
      <button className="back-btn" onClick={back}>← Back</button>
      <div className="section-head" style={{ marginTop: 4 }}>
        <h2>🎧 Help Center</h2>
        <span className="muted small">24/7 · avg reply 1 min</span>
      </div>

      <div className="panel">
        <h3 style={{ fontSize: 15 }}>💬 Chat with Papa Support</h3>
        <div className="chat-box" ref={boxRef} style={{ maxHeight: '38dvh' }}>
          {msgs.length === 0 && (
            <div className="muted small" style={{ textAlign: 'center', padding: 16 }}>
              Ask anything — refunds, deposits, late couriers, claims, payouts.
            </div>
          )}
          {msgs.map((m) => (
            <div key={m.id} className={`chat-msg ${m.from}`}>{m.text}</div>
          ))}
          {typing && <div className="typing">Papa Support is typing<i>…</i></div>}
        </div>
        <div className="slot-row" style={{ marginTop: 8 }}>
          {['Where is my refund?', 'My delivery is late', 'How do claims work?'].map((q) => (
            <button key={q} className="slot-chip" onClick={() => send(q)}>{q}</button>
          ))}
        </div>
        <div className="chat-input-row">
          <input
            value={text}
            placeholder="Type your question…"
            enterKeyHint="send"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            aria-label="Support message"
          />
          <button className="btn btn-primary btn-sm" onClick={() => send()}>Send</button>
        </div>
      </div>

      {state.claims.length > 0 && (
        <div className="panel">
          <h3 style={{ fontSize: 15 }}>🛡️ Your claims</h3>
          {state.claims.map((c) => (
            <div key={c.id} className="review" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>{c.itemName}</b> <span className="muted small">· {c.orderId}</span>
                <div className="muted small">{c.reason} · {money(c.amount)}</div>
              </div>
              {c.status === 'filed' && <Badge tone="orange">📨 Filed</Badge>}
              {c.status === 'reviewing' && <Badge tone="purple">🔍 Reviewing</Badge>}
              {c.status === 'approved' && <Badge tone="green">✅ Paid to wallet</Badge>}
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <h3 style={{ fontSize: 15 }}>❓ Frequently asked</h3>
        {FAQS.map(([q, a], i) => (
          <div key={q} style={{ borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
            <button
              className="faq-q"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
            >
              {q} <span style={{ marginLeft: 'auto' }}>{open === i ? '−' : '+'}</span>
            </button>
            {open === i && <p className="muted" style={{ fontSize: 14, margin: '0 0 12px' }}>{a}</p>}
          </div>
        ))}
      </div>

      <div className="list-row">
        <span>🚨 On-set emergency line</span>
        <a href="tel:+924211122333" style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>📞 Call now</a>
      </div>
    </div>
  )
}
