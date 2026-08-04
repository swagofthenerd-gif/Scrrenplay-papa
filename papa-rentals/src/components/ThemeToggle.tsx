import { useStore } from '../store'
import { buzz } from '../utils'
import { Icon } from './icons'

/* Light / dark, and the one honest way to ask which is on.
 *
 * Read from the DOM rather than from state, because on first launch state has
 * no theme at all — the boot script in index.html has already resolved the
 * system preference into the attribute, and that is the only place the real
 * current answer lives until someone presses this. */
export function useDarkMode(): boolean {
  const { state } = useStore()
  return state.theme
    ? state.theme === 'dark'
    : typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
}

/* This used to be the third 44px circle in the top bar, on a row that also
   holds the logo, notifications and the cart. On a 390px phone that left the
   search field about ninety pixels — enough to render "S…". A theme is a
   preference someone sets once, so it lives in Settings now and search gets
   the room back. */
export function ThemeRow() {
  const { dispatch } = useStore()
  const dark = useDarkMode()
  return (
    <div className="list-row">
      <span><Icon name={dark ? 'moon' : 'sun'} size={16} /> Appearance</span>
      <span className="seg">
        {(['light', 'dark'] as const).map((mode) => (
          <button
            key={mode}
            className={`seg-btn${dark === (mode === 'dark') ? ' on' : ''}`}
            aria-pressed={dark === (mode === 'dark')}
            onClick={() => { buzz(); dispatch({ type: 'SET_THEME', theme: mode }) }}
          >
            <Icon name={mode === 'dark' ? 'moon' : 'sun'} size={14} /> {mode === 'dark' ? 'Dark' : 'Light'}
          </button>
        ))}
      </span>
    </div>
  )
}
