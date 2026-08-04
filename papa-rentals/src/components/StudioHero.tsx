import { useEffect, useMemo, useRef, useState } from 'react'
import { ITEMS } from '../data/catalog'
import { activePromo } from '../data/promos'
import { useNav, type View } from '../nav'
import { useStore } from '../store'
import { buzz, dealActive, money, todayISO } from '../utils'
import { Icon, type IconName } from './icons'

/*
 * StudioHero — the establishing shot, and the board things get pinned to.
 *
 * One hand-drawn wide shot of the studio fills the panel. Over it sits a snap
 * scroller: the first card is the greeting, and every card after it is one
 * piece of news — a live order, an answered offer, this season's promo, the
 * day's best discount, wallet credit, a booking request.
 *
 * It used to walk the camera across ten department stations, which made this
 * the second way into Browse on a page that already had a department row. One
 * job each now: the row routes, the hero tells you what changed.
 */

/* One fixed tagline only ever sells one thing. Rotating them means a returning
   renter eventually reads all four reasons to stay. */
const VALUE_PROPS: { icon: IconName; label: string }[] = [
  { icon: 'handshake', label: 'Offer your price' },
  { icon: 'shield', label: 'Papa Protection included' },
  { icon: 'truck', label: 'Delivered to set' },
  { icon: 'check-circle', label: 'Verified vendors only' },
]

/* Cards past this stop being news and start being a slideshow nobody reaches. */
const MAX_CARDS = 5
const AUTOPLAY_MS = 6000

/* An order in flight is the one thing here with a clock on it, so it leads —
   and it says where the gear is, not what the status enum is called. Statuses
   left out (completed, cancelled) are not news; they are history. */
const ORDER_NEWS: Partial<Record<string, { icon: IconName; title: string }>> = {
  requested: { icon: 'hourglass', title: 'Waiting on the owner' },
  confirmed: { icon: 'check-circle', title: 'Your booking is confirmed' },
  preparing: { icon: 'box', title: 'Your gear is being packed' },
  in_transit: { icon: 'van', title: 'Your gear is on the way' },
  in_use: { icon: 'clapperboard', title: 'Shoot day — gear is with you' },
  returned: { icon: 'undo', title: 'Returned, deposit releasing' },
}

/* The swipe mark is drawn, not typed: a pencil rule with a head on it, in the
   same hand as the artwork behind it. An em dash and a greater-than sign would
   read as two characters that happen to point right. */
function SwipeArrow() {
  return (
    <svg className="swipe-arrow" width="46" height="10" viewBox="0 0 46 10" fill="none" aria-hidden="true">
      <path d="M1.2 5.4c10-.9 22-1 39-.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M34.6 1.5 41.4 4.9l-6.6 3.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type HeroCard = {
  id: string
  icon: IconName
  tag: string
  title: string
  cta: string
  view: View
  /** Grease-pencil orange, for the two cards that are money on the table. */
  hot?: boolean
}

export default function StudioHero() {
  const { go } = useNav()
  const { state } = useStore()
  const trackRef = useRef<HTMLDivElement>(null)
  const wideRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState(0)
  const [prop, setProp] = useState(0)
  /* One touch and the carousel is yours: nothing should slide out from under a
     thumb that has already started reading. */
  const [taken, setTaken] = useState(false)

  /* Rotation pauses under prefers-reduced-motion — a tagline swapping itself out
     mid-read is exactly the kind of motion that setting exists to stop. */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setProp((p) => (p + 1) % VALUE_PROPS.length), 4000)
    return () => clearInterval(t)
  }, [])

  /* Recomputed per render off today's date: the app can sit open past midnight
     on a phone that never gets closed, and a promo whose season ended overnight
     should stop claiming it's on. */
  const promo = activePromo(todayISO(0))

  const bestOff = useMemo(
    () =>
      ITEMS.filter((i) => dealActive(i.id) && !state.blockedOwners.includes(i.ownerId)).reduce(
        (m, i) => Math.max(m, i.flashDeal?.percentOff ?? 0),
        0
      ),
    [state.blockedOwners]
  )

  const cards = useMemo<HeroCard[]>(() => {
    const out: HeroCard[] = []

    const live = state.orders.find((o) => ORDER_NEWS[o.status])
    if (live) {
      const news = ORDER_NEWS[live.status]!
      out.push({ id: 'order', icon: news.icon, tag: 'Your order', title: news.title, cta: 'Track it', view: { name: 'order', id: live.id } })
    }

    /* Only offers the owner has moved on. A pending one is news to nobody — it
       is a thing the renter did, and it is already on their offers list. */
    const offer = state.offers.find((o) => o.status === 'accepted' || o.status === 'countered')
    if (offer) {
      out.push({
        id: 'offer',
        icon: 'handshake',
        tag: 'Your offer',
        title: offer.status === 'accepted' ? 'Your price was accepted' : `Countered at ${money(offer.counterRate ?? offer.offeredRate)}`,
        cta: 'Open the deal',
        view: { name: 'item', id: offer.itemId },
        hot: offer.status === 'accepted',
      })
    }

    if (bestOff > 0) {
      out.push({ id: 'deals', icon: 'bolt', tag: 'Today', title: `Up to ${bestOff}% off`, cta: 'See flash deals', view: { name: 'browse', dealsOnly: true }, hot: true })
    }

    if (promo) {
      out.push({ id: promo.id, icon: promo.icon, tag: 'This season', title: promo.title, cta: promo.cta, view: { name: 'browse', ...promo.target } })
    }

    if (state.walletBalance > 0) {
      out.push({ id: 'wallet', icon: 'wallet', tag: 'Wallet', title: `${money(state.walletBalance)} credit`, cta: 'Spend it at checkout', view: { name: 'wallet' } })
    }

    const pending = state.ownerBookings.filter((b) => b.status === 'pending').length
    if (pending > 0) {
      out.push({
        id: 'host',
        icon: 'store',
        tag: 'Your listings',
        title: `${pending} booking request${pending > 1 ? 's' : ''}`,
        cta: 'Answer them',
        view: { name: 'dashboard' },
      })
    }

    /* The tail, and the reason there is always something to swipe to: someone
       with no orders, no offers and no credit still has a card behind the hint. */
    if (state.myListings.length === 0) {
      out.push({ id: 'list', icon: 'truck', tag: 'Earn', title: 'Rent out your own gear', cta: 'Keep 90% — start listing', view: { name: 'post' } })
    }

    return out.slice(0, MAX_CARDS)
  }, [state.orders, state.offers, state.walletBalance, state.ownerBookings, state.myListings, promo, bestOff])

  const total = cards.length + 1

  /* Scroll drives two things: which card the caption is describing, and a slow
     drift across the drawing, so a swipe moves the world and not just the words. */
  useEffect(() => {
    const track = trackRef.current
    const wide = wideRef.current
    if (!track || !wide) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0

    const render = () => {
      raf = 0
      const W = track.clientWidth
      if (!W) return
      const f = Math.max(0, track.scrollLeft / W)
      wide.style.transform = reduced ? 'none' : `translate3d(${-f * 16}px, 0, 0) scale(1.07)`
      const active = Math.round(f)
      setFrame((prev) => (prev === active ? prev : active))
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(render)
    }
    render()
    track.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      track.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  /* Autoplay exists so news gets seen without a tap, not so the page fidgets:
     it stops for good at the first touch, sits out reduced-motion, and never
     advances a hero on a screen nobody is looking at. */
  useEffect(() => {
    if (taken || cards.length === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => {
      const track = trackRef.current
      if (!track || document.hidden) return
      const W = track.clientWidth
      if (!W) return
      const next = (Math.round(track.scrollLeft / W) + 1) % total
      track.scrollTo({ left: next * W, behavior: 'smooth' })
    }, AUTOPLAY_MS)
    return () => clearInterval(t)
  }, [taken, cards.length, total])

  function jumpTo(i: number) {
    const track = trackRef.current
    if (!track) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    track.scrollTo({ left: i * track.clientWidth, behavior: reduced ? 'auto' : 'smooth' })
  }

  const card = cards[frame - 1] // undefined on the establishing shot

  return (
    <div className="studio-hero">
      <div className="studio-stage">
        <div className="studio-art">
          <div
            ref={wideRef}
            className="studio-wide"
            aria-hidden="true"
            style={{ backgroundImage: `url(${import.meta.env.BASE_URL}scene/wide.webp)` }}
          />
          <div className="studio-spot" aria-hidden="true" />
          <div className="studio-panel" aria-hidden="true">
            <i /><i /><i /><i />
          </div>
        </div>

        {/* snap track: the greeting, then one card per piece of news */}
        <div className="studio-track" ref={trackRef} onPointerDown={() => setTaken(true)}>
          <div className="studio-slide" role="group" aria-label="Papa Rentals">
            {/* Tapping the establishing shot goes to the news rather than into
                Browse — the department row below owns that route now. */}
            <button className="studio-tap" onClick={() => { buzz(); setTaken(true); jumpTo(1) }} aria-label="See what's new">
              <div className="studio-title">
                <h1>
                  {state.profile.name ? `Salaam, ${state.profile.name}.` : 'Rent everything'}<br />
                  {state.profile.name ? 'What are we shooting?' : 'for your next shoot.'}
                </h1>
                <div className="studio-offers">
                  <span className="studio-tag"><Icon name={VALUE_PROPS[prop].icon} size={12} /> {VALUE_PROPS[prop].label}</span>
                </div>
              </div>
            </button>
          </div>

          {cards.map((c) => (
            <div key={c.id} className="studio-slide" role="group" aria-label={c.title}>
              <button className="studio-tap" onClick={() => { buzz(); go(c.view) }} aria-label={`${c.title} — ${c.cta}`}>
                {/* h2, not h1: the greeting slide is the page's one heading, and
                    six h1s in a carousel would flatten the outline for a screen
                    reader that never asked for a slideshow. */}
                <div className="studio-title studio-card">
                  <span className={`studio-tag${c.hot ? ' deal' : ''}`}><Icon name={c.icon} size={12} /> {c.tag}</span>
                  <h2>{c.title}</h2>
                </div>
              </button>
            </div>
          ))}
        </div>

        {/*
          Written on the drawing, bottom-left, the way a storyboard artist writes
          on the panel itself rather than on a strip bolted underneath it. On the
          establishing shot it says the only thing worth saying there: this moves.
        */}
        <div className="studio-slug" aria-hidden="true">
          {card ? (
            <span className="studio-caption-cta">{card.cta} <Icon name="arrow-right" size={12} /></span>
          ) : (
            <span className="studio-swipe">swipe<SwipeArrow /></span>
          )}
        </div>

        {total > 1 && (
          <div className="studio-dots" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`studio-dot${i === frame ? ' on' : ''}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
