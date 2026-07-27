import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { getOwner } from '../data/catalog'
import { useNav } from '../nav'
import { useStore } from '../store'
import { buzz, fmtTimeAgo, uid } from '../utils'
import { Badge } from '../components/ui'
import { Avatar, Icon } from '../components/icons'

/* A real inbox. Chats used to live in an expandable strip on Profile where you
   could read the last line but never reply — every conversation dead-ended. */
export default function InboxView({ ownerId }: { ownerId?: string }) {
  const { go } = useNav()
  const { state } = useStore()
  /* The thread lives in the URL so anything that already knows which vendor you
     mean — an order, a notification, a listing — can open the conversation
     itself instead of dropping you on the list to go find it. */
  const [open, setOpen] = useState<string | null>(ownerId ?? null)
  useEffect(() => { setOpen(ownerId ?? null) }, [ownerId])

  const threads = useMemo(
    () =>
      Object.entries(state.chats)
        .filter(([, t]) => t.messages.length > 0)
        .sort((a, b) => (b[1].messages[b[1].messages.length - 1]?.at ?? 0) - (a[1].messages[a[1].messages.length - 1]?.at ?? 0)),
    [state.chats]
  )

  if (open) return <Thread ownerId={open} onBack={() => (ownerId ? go({ name: 'inbox' }) : setOpen(null))} />

  return (
    <div className="section">
      <button className="back-btn" onClick={() => go({ name: 'profile' })}>
        <Icon name="chevron-left" size={16} /> Profile
      </button>
      <div className="section-head"><h2><Icon name="chat" className="h-ico" size={18} /> Messages</h2></div>

      {threads.length === 0 ? (
        <div className="empty-state">
          <div className="big"><Icon name="chat" size={48} /></div>
          <p>No messages yet. Ask a vendor about availability from any listing and the thread lands here.</p>
          <button className="btn btn-primary btn-sm" onClick={() => go({ name: 'browse' })}>Browse gear</button>
        </div>
      ) : (
        threads.map(([ownerId, thread]) => {
          const last = thread.messages[thread.messages.length - 1]
          const name = ownerId === 'support' ? 'Papa Support' : getOwner(ownerId).name
          return (
            <button key={ownerId} className="list-row" style={{ width: '100%', cursor: 'pointer' }} onClick={() => setOpen(ownerId)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Avatar name={name} id={ownerId} size={38} />
                <span style={{ minWidth: 0 }}>
                  <b>{name}</b>
                  <span className="muted small" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '52vw' }}>
                    {last?.from === 'me' ? 'You: ' : ''}{last?.text}
                  </span>
                </span>
              </span>
              <span className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {thread.unread > 0 && <Badge tone="orange">{thread.unread}</Badge>}
                {last && fmtTimeAgo(last.at)}
              </span>
            </button>
          )
        })
      )}
    </div>
  )
}

function dayHeading(at: number): string {
  const d = new Date(at)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86400000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function Thread({ ownerId, onBack }: { ownerId: string; onBack: () => void }) {
  const { go } = useNav()
  const { state, dispatch } = useStore()
  const [text, setText] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const thread = state.chats[ownerId]
  const msgs = thread?.messages ?? []
  const typing = Boolean(thread?.typingUntil && thread.typingUntil > Date.now())
  const isSupport = ownerId === 'support'
  const name = isSupport ? 'Papa Support' : getOwner(ownerId).name

  useEffect(() => {
    dispatch({ type: 'READ_CHAT', ownerId })
  }, [ownerId, msgs.length, dispatch])

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight })
  }, [msgs.length, typing])

  function send() {
    const t = text.trim()
    if (!t) return
    buzz()
    dispatch({
      type: 'ADD_CHAT',
      ownerId,
      message: { id: uid(), from: 'me', text: t, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), at: Date.now() },
    })
    setText('')
  }

  return (
    <div className="section">
      <button className="back-btn" onClick={onBack}>
        <Icon name="chevron-left" size={16} /> Messages
      </button>
      <div className="owner-row" style={{ marginBottom: 8 }}>
        <Avatar name={name} id={ownerId} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{name}</b>
          <div className="muted small">
            {isSupport ? 'Replies 24/7' : `Usually replies in ${getOwner(ownerId).responseMins} min`}
          </div>
        </div>
        {!isSupport && (
          <button className="btn btn-outline btn-sm" onClick={() => go({ name: 'vendor', id: ownerId })}>View vendor</button>
        )}
      </div>

      <div className="chat-box" ref={boxRef} style={{ maxHeight: '58vh' }}>
        {msgs.map((m, i) => {
          const delivered = m.from === 'me' && msgs.slice(i + 1).some((x) => x.from === 'owner')
          /* Every message already carried a time and nothing ever showed it, so a
             reply from three weeks ago read exactly like one from a minute ago —
             which matters when you're deciding whether to wait or call. */
          const prev = msgs[i - 1]
          const dayLabel = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString() ? dayHeading(m.at) : null
          return (
            <Fragment key={m.id}>
              {dayLabel && <div className="chat-day">{dayLabel}</div>}
              <div className={`chat-msg ${m.from}`}>
                {m.text}
                <span className="stamp">{m.time}</span>
                {m.from === 'me' && <span className="ticks">{delivered ? <><Icon name="check" size={12} /><Icon name="check" size={12} /></> : <Icon name="check" size={12} />}</span>}
              </div>
            </Fragment>
          )
        })}
        {typing && <div className="typing">{name} is typing<i>…</i></div>}
      </div>

      <div className="chat-input-row">
        <input
          value={text}
          placeholder="Type a message…"
          enterKeyHint="send"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          aria-label="Message"
        />
        <button className="btn btn-primary btn-sm" onClick={send}>Send</button>
      </div>
      <p className="muted small">
        Keep payments on Papa Rentals. Anyone asking you to pay outside the app is a scam — report them from the vendor page.
      </p>
    </div>
  )
}
