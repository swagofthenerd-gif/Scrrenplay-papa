import { CATEGORIES, deptFromPrice } from '../data/catalog'
import { money } from '../utils'
import { DeptMark, Icon } from './icons'
import type { CategoryId } from '../types'

/* The department row appears on Home and at the top of Browse. They were two
   copies of the same markup, which is why one of them had picked up price hints
   and the other hadn't. The behaviours genuinely differ — Home navigates into a
   department, Browse toggles a filter and needs an "All" escape — so those stay
   props rather than being flattened into one behaviour that suits neither. */
export function DeptRow({
  active,
  onPick,
  onClear,
  showFrom,
  style,
}: {
  /** Highlighted department. Undefined on Home, where nothing is "current". */
  active?: CategoryId
  onPick: (id: CategoryId) => void
  /** Supplying this adds the "All" chip. Filters need it; navigation doesn't. */
  onClear?: () => void
  /** Entry prices under each name. Home only: they're catalogue-wide, and next
      to Browse's other filters they'd read as the price of what's on screen. */
  showFrom?: boolean
  style?: React.CSSProperties
}) {
  // Only a filter row has a current selection, so only it should announce one.
  const pressed = (on: boolean) => (onClear ? { 'aria-pressed': on } : {})
  return (
    <div className="cat-row" style={style}>
      {onClear && (
        <button className={`cat-chip ${!active ? 'active' : ''}`} {...pressed(!active)} onClick={onClear}>
          <span className="cat-ico" aria-hidden="true"><Icon name="sliders" size={26} /></span>
          All
        </button>
      )}
      {CATEGORIES.map((c) => {
        const from = showFrom ? deptFromPrice(c.id) : undefined
        return (
          <button
            key={c.id}
            className={`cat-chip ${active === c.id ? 'active' : ''}`}
            {...pressed(active === c.id)}
            onClick={() => onPick(c.id)}
          >
            <span className="cat-ico" aria-hidden="true"><DeptMark id={c.id} size={44} /></span>
            {c.name}
            {from !== undefined && <span className="cat-from">from {money(from)}</span>}
          </button>
        )
      })}
    </div>
  )
}
