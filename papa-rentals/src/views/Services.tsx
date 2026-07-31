import { useNav } from '../nav'
import { getServices } from '../data/services'
import { Icon } from '../components/icons'

/*
 * The full service list. The home page only carries a one-line summary of
 * this — twelve cards was more than the home page could justify spending its
 * scroll on, so the whole list lives here and the band links in.
 */
export default function Services() {
  const { go, back } = useNav()
  const services = getServices()

  return (
    <div className="section">
      <button className="back-btn" onClick={back}><Icon name="chevron-left" size={16} /> Back</button>
      <div className="section-head" style={{ marginTop: 4 }}>
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
