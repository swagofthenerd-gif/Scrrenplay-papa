import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './icons'

/* Thin wrappers over the design-system CSS so views stop hand-rolling
   class strings and inline styles. */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?: 'md' | 'sm'
  block?: boolean
}

export function Button({ variant = 'primary', size = 'md', block, className = '', ...rest }: ButtonProps) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', block && 'btn-block', className].filter(Boolean).join(' ')
  return <button className={cls} {...rest} />
}

export function Chip({ active, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button className={`filter-chip ${active ? 'active' : ''} ${className}`} {...rest} />
}

export function IconButton({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`icon-btn ${className}`} {...rest} />
}

export function SkeletonBlock({ height, radius, style }: { height: number | string; radius?: number | string; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ height, borderRadius: radius ?? 'var(--r-md)', ...style }} aria-hidden="true" />
}

/* One shape for every section header: accent icon, title, optional subtitle,
   optional action on the right. Hand-rolled headers had already drifted — two of
   Home's were the only ones on the page with no icon at all, and the title was
   sometimes wrapped in a div and sometimes not, which changes where the subtitle
   lands once there is one. Taking `icon` as a name rather than a node is what
   stops the next header from passing a differently-sized glyph. */
export function SectionHeader({
  icon,
  title,
  sub,
  action,
  style,
}: {
  icon?: IconName
  title: ReactNode
  sub?: ReactNode
  action?: ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div className="section-head" style={style}>
      <div>
        <h2>{icon && <Icon name={icon} className="h-ico" />}{title}</h2>
        {sub && <div className="section-sub">{sub}</div>}
      </div>
      {action}
    </div>
  )
}
