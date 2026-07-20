import type { ButtonHTMLAttributes, ReactNode } from 'react'

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

export function SectionHeader({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {sub && <div className="section-sub">{sub}</div>}
      </div>
      {action}
    </div>
  )
}
