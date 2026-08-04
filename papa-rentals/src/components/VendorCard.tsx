import { useNav } from '../nav'
import { useStore } from '../store'
import type { Vendor } from '../vendors'
import { categoryName } from '../vendors'
import { money } from '../utils'
import { ItemCard, RatingCompact } from './ui'
import { Avatar, Icon } from './icons'

/*
 * Airbnb-detailed, foodpanda-structured vendor card: a tappable header that
 * opens the vendor's storefront, plus a horizontal rail of their gear you can
 * browse without leaving home.
 */
export function VendorCard({ vendor, index }: { vendor: Vendor; index?: number }) {
  const { go } = useNav()
  const { state, dispatch } = useStore()
  const { owner } = vendor
  const open = () => go({ name: 'vendor', id: owner.id })
  const stagger = index != null ? { className: 'vendor-card stagger', style: { ['--i' as string]: Math.min(index, 8) } } : { className: 'vendor-card' }

  return (
    <div {...stagger}>
      <button className="vendor-head" onClick={open} aria-label={`Open ${owner.name}`}>
        <Avatar name={owner.name} id={owner.id} size={52} />
        <div className="vendor-head-main">
          <div className="vendor-name-row">
            <b className="vendor-name">{owner.name}</b>
            {owner.superOwner && <span className="vendor-badge super"><Icon name="crown" size={12} /> Super</span>}
            {owner.verified && <span className="vendor-badge verified"><Icon name="check" size={12} /> Verified</span>}
          </div>
          <div className="vendor-meta">
            <RatingCompact rating={owner.rating} count={owner.ratingCount} />
            <span className="dot-sep">·</span>
            <span className="muted"><Icon name="clock" size={12} /> ~{owner.responseMins}m reply</span>
          </div>
          <div className="vendor-meta muted">
            <Icon name="pin" size={12} /> {owner.area} · {owner.distanceKm} km · {vendor.count} listing{vendor.count === 1 ? '' : 's'} · from {money(vendor.minPrice)}
          </div>
          <div className="vendor-cats">
            {vendor.categories.slice(0, 4).map((c) => (
              <span key={c} className="vendor-cat-tag">{categoryName(c)}</span>
            ))}
          </div>
        </div>
        <span className="vendor-chev"><Icon name="chevron-right" size={18} /></span>
      </button>

      {(vendor.hasDeal || vendor.instant || vendor.offers) && (
        <div className="vendor-ribbons">
          {vendor.hasDeal && <span className="v-ribbon deal"><Icon name="bolt" size={12} /> Flash deal on now</span>}
          {vendor.instant && <span className="v-ribbon instant"><Icon name="bolt" size={12} /> Instant book</span>}
          {vendor.offers && <span className="v-ribbon offer"><Icon name="handshake" size={12} /> Offers OK</span>}
        </div>
      )}

      <div className="h-scroll vendor-rail">
        {vendor.items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onOpen={() => go({ name: 'item', id: item.id })}
            wishlisted={state.wishlist.includes(item.id)}
            onToggleWish={() => dispatch({ type: 'TOGGLE_WISHLIST', itemId: item.id })}
          />
        ))}
        <button className="vendor-seeall" onClick={open}>
          <span className="vendor-seeall-ico"><Icon name="arrow-right" size={20} /></span>
          See all<br />{vendor.count} items
        </button>
      </div>
    </div>
  )
}

/*
 * The storefront card above carries a whole rail of a vendor's gear, which is
 * right on a page about vendors and wrong on Home: six of them ran for several
 * screens and buried everything below. This is the same door at a glanceable
 * size — identity, trust, price floor — for use in a rail.
 */
export function VendorTile({ vendor }: { vendor: Vendor }) {
  const { go } = useNav()
  const { owner } = vendor
  return (
    <button
      className="vendor-tile"
      onClick={() => go({ name: 'vendor', id: owner.id })}
      aria-label={`Open ${owner.name}, ${vendor.count} listings, from ${money(vendor.minPrice)} per day`}
    >
      <Avatar name={owner.name} id={owner.id} size={44} />
      <span className="vendor-tile-name">{owner.name}</span>
      <span className="vendor-tile-meta">
        <RatingCompact rating={owner.rating} count={owner.ratingCount} />
      </span>
      {/* The count is in the label for anyone who needs it. On a 160px tile the
          useful half of that sentence is the price floor. */}
      <span className="vendor-tile-sub muted small nowrap">from {money(vendor.minPrice)}</span>
      {(owner.superOwner || owner.verified) && (
        <span className="vendor-tile-badge">
          <Icon name={owner.superOwner ? 'crown' : 'check'} size={11} />
          {owner.superOwner ? 'Super' : 'Verified'}
        </span>
      )}
    </button>
  )
}
