import { TRANSPORT_OPTIONS } from '../data/catalog'
import { useNav } from '../nav'
import type { View } from '../nav'
import { INSURANCE_RATE, OPERATOR_FEE_PER_DAY, SILVER_POINTS, money } from '../utils'
import { Icon } from './icons'
import type { IconName } from './icons'

/*
 * Everything Papa does, in one readable band — not just the rental
 * departments but the services wrapped around them. Figures are pulled from
 * the same constants the checkout maths uses, so the copy can't drift.
 */
export default function ServicesBand() {
  const { go } = useNav()
  const van = TRANSPORT_OPTIONS.find((t) => t.id === 'van')
  const truck = TRANSPORT_OPTIONS.find((t) => t.id === 'truck')

  const services: { icon: IconName; title: string; body: string; to?: View }[] = [
    {
      icon: 'bolt',
      title: 'Instant booking',
      body: 'Book instant-book gear straight away — no waiting on approval.',
      to: { name: 'browse' },
    },
    {
      icon: 'handshake',
      title: 'Offer your price',
      body: 'See the recommended rate, then name yours. Owners accept, counter or decline.',
      to: { name: 'browse' },
    },
    {
      icon: 'van',
      title: 'Delivery to set',
      body: `Insured van delivery for ${money(van?.fee ?? 0)} — ${van?.eta ?? ''}, tracked to your location.`,
    },
    {
      icon: 'truck',
      title: 'Grip truck + crew',
      body: `${money(truck?.fee ?? 0)} brings a truck and a two-person crew who load, deliver and help you rig.`,
    },
    {
      icon: 'shield',
      title: 'Damage protection',
      body: `Optional cover at ${Math.round(INSURANCE_RATE * 100)}% of the rental. File a claim in-app and get paid to your wallet.`,
      to: { name: 'support' },
    },
    {
      icon: 'wrench',
      title: 'Certified operators',
      body: `Add a trained tech or licensed pilot for ${money(OPERATOR_FEE_PER_DAY)}/day on gear that needs one.`,
    },
    {
      icon: 'backpack',
      title: 'Production kits',
      body: 'Pre-bundled packages — camera, glass, key light and sound — at a package price.',
    },
    {
      icon: 'clock',
      title: 'Hourly studio hire',
      body: 'Spaces bookable by the hour as well as the day, with minimum-hour rules shown upfront.',
      to: { name: 'browse', category: 'studios' },
    },
    {
      icon: 'building',
      title: 'List your space or gear',
      body: 'Become a vendor in two minutes and keep 90% of every booking.',
      to: { name: 'post' },
    },
    {
      icon: 'chart',
      title: 'Host dashboard',
      body: 'Accept requests, track bookings and take automatic payouts to your wallet.',
      to: { name: 'dashboard' },
    },
    {
      icon: 'trophy',
      title: 'PapaPoints & perks',
      body: `Earn a point per Rs 100. ${SILVER_POINTS}+ unlocks free delivery; Gold takes 5% off every order.`,
      to: { name: 'profile' },
    },
    {
      icon: 'headset',
      title: '24/7 support',
      body: 'Help Centre, live chat and an emergency line for when a shoot goes sideways.',
      to: { name: 'support' },
    },
  ]

  return (
    <div className="section">
      <div className="section-head">
        <div>
          <h2><Icon name="sparkles" className="h-ico" /> Everything we do</h2>
          <div className="section-sub">Rentals, logistics, cover and crew — the whole service</div>
        </div>
      </div>
      <div className="svc-grid">
        {services.map((s, i) => {
          const clickable = Boolean(s.to)
          return (
            <div
              key={s.title}
              className={`svc-card stagger ${clickable ? 'tappable' : ''}`}
              style={{ ['--i' as string]: Math.min(i, 8) }}
              onClick={s.to ? () => go(s.to!) : undefined}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={clickable ? (e) => { if (e.key === 'Enter') go(s.to!) } : undefined}
            >
              <span className="svc-ico"><Icon name={s.icon} size={22} /></span>
              <div style={{ minWidth: 0 }}>
                <b className="svc-title">{s.title}</b>
                <div className="svc-body muted">{s.body}</div>
              </div>
              {clickable && <span className="svc-chev"><Icon name="chevron-right" size={16} /></span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
