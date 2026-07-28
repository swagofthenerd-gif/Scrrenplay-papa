import { useEffect, useRef, useState } from 'react'

/* Home renders a dozen rails, every card in every one of them, on first paint —
   and most are three or four screens down. On the low-end Android WebView this
   app ships inside, that's the difference between a home screen that appears and
   one that hitches for a beat first.

   This mounts its children only once they're about to come into view, and holds
   the space with a plain reserved block until then. Two things it deliberately
   does NOT do: it never unmounts once mounted (a rail that re-mounted would lose
   its horizontal scroll position and re-run its impression counter), and the
   placeholder keeps the section's `id` so the jump bar can still scroll to a
   section that hasn't rendered yet — the scroll lands on the placeholder, which
   brings it into view, which mounts the real thing. */
export function Deferred({
  id,
  minHeight = 260,
  children,
}: {
  id?: string
  /** Roughly the height of what's coming. Wrong-but-close is fine; being absent
      is not — a zero-height placeholder lets everything below jump upward and
      then snap back the moment it mounts. */
  minHeight?: number
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || shown) return
    /* No IntersectionObserver (very old WebViews) means the choice is between a
       blank section forever and rendering everything. Render everything. */
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { io.disconnect(); setShown(true) } },
      /* One screen of lead time, so a normal-speed scroll never actually catches
         the placeholder — you only ever see the finished section. */
      { rootMargin: '100% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])

  if (shown) return <>{children}</>
  return <div ref={ref} id={id} style={{ minHeight }} aria-hidden="true" />
}
