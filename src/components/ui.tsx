import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export const inputCls =
  'h-12 w-full rounded-xl border border-stone-300 bg-white px-4 outline-none focus:border-accent dark:border-stone-700 dark:bg-stone-900'

export const primaryBtn =
  'h-12 rounded-xl bg-accent px-4 font-semibold text-white transition active:scale-[0.98] disabled:opacity-40'

export const secondaryBtn =
  'h-12 rounded-xl border border-stone-300 px-4 font-semibold transition active:scale-[0.98] dark:border-stone-700'

export const cardCls =
  'rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900'

const sectionLabel = 'text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500'

export function Chevron({ open, size = 18 }: { open: boolean; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/**
 * A titled list. Give it `onToggle` and the whole header becomes a fold button
 * ("COMING UP · 3 ⌄"); the count stays visible while folded so a folded section
 * still says what's in it.
 */
export function Section({
  title,
  count,
  collapsed = false,
  onToggle,
  children,
}: {
  title: string
  count?: number
  collapsed?: boolean
  onToggle?: () => void
  children: ReactNode
}) {
  const label = count === undefined ? title : `${title} · ${count}`
  return (
    <section className="mb-5">
      {onToggle ? (
        <h2 className="-mt-3 mb-0.5">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            className={`flex h-11 w-full items-center justify-between px-1 ${sectionLabel}`}
          >
            {label}
            <Chevron open={!collapsed} size={16} />
          </button>
        </h2>
      ) : (
        <h2 className={`mb-2 px-1 ${sectionLabel}`}>{label}</h2>
      )}
      {!collapsed && <div className="flex flex-col gap-2">{children}</div>}
    </section>
  )
}

/** Pushpin (Lucide's, ISC). Filled when something is pinned. */
export function PinIcon({
  size = 16,
  filled = false,
  className = '',
}: {
  size?: number
  filled?: boolean
  className?: string
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className={className}
    >
      <path d="M12 17v5" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  )
}

/**
 * Back to wherever you came from — or home, when there's nowhere to go back to
 * (a deep link, or an installed app opened straight onto this page). With no
 * tab bar, that's the only way out of a page you landed on directly.
 */
export function BackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <button
      className="-mt-2 mb-2 flex h-11 items-center gap-1 pr-3 text-sm text-stone-500"
      onClick={() => (location.key === 'default' ? navigate('/', { replace: true }) : navigate(-1))}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Back
    </button>
  )
}

export function Fab({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Add task"
      onClick={onClick}
      className="fixed bottom-6 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition active:scale-90 sm:right-[calc(50%-13rem)]"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}

export function RowSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
      <div className="h-13 w-13 rounded-xl bg-stone-200 dark:bg-stone-800" />
      <div className="flex-1">
        <div className="mb-2 h-3.5 w-2/3 rounded bg-stone-200 dark:bg-stone-800" />
        <div className="h-2.5 w-1/2 rounded bg-stone-100 dark:bg-stone-800/60" />
      </div>
      <div className="h-13 w-13 rounded-full bg-stone-100 dark:bg-stone-800/60" />
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children?: ReactNode
}) {
  return (
    <div className="mt-16 flex flex-col items-center gap-2 px-8 text-center">
      <img src="/icon.svg" alt="" className="h-14 w-14 opacity-80" />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-stone-500">{hint}</p>
      {children}
    </div>
  )
}
