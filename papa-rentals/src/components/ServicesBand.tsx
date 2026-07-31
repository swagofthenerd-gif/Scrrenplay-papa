import { useNav } from '../nav'
import { getServices } from '../data/services'
import { Icon } from './icons'

/*
 * Collapsed teaser for the service list. The home page shouldn't spend a
 * dozen cards of scroll on this, so it shows a single row — the count and a
 * strip of the icons — and the full list lives on its own page.
 */
export default function ServicesBand() {
  const { go } = useNav()
  const services = getServices()
  const open = () => go({ name: 'services' })

  return (
    <div className="section">
      <div
        className="svc-collapsed tappable"
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
        aria-label={`Everything we do — see all ${services.length} services`}
      >
        <span className="svc-ico"><Icon name="sparkles" size={22} /></span>
        <div style={{ minWidth: 0 }}>
          <b className="svc-title">Everything we do</b>
          <div className="svc-body muted">
            Rentals, logistics, cover and crew — all {services.length} services
          </div>
          {/* a glimpse of what's inside, so the row isn't a blind link */}
          <div className="svc-peek" aria-hidden="true">
            {services.slice(0, 6).map((s) => (
              <span key={s.title}><Icon name={s.icon} size={15} /></span>
            ))}
            <span className="svc-peek-more">+{services.length - 6}</span>
          </div>
        </div>
        <span className="svc-chev"><Icon name="chevron-right" size={16} /></span>
      </div>
    </div>
  )
}
