import type { ReactNode } from 'react'

export const inputCls =
  'h-12 w-full rounded-xl border border-stone-300 bg-white px-4 outline-none focus:border-accent dark:border-stone-700 dark:bg-stone-900'

export const primaryBtn =
  'h-12 rounded-xl bg-accent px-4 font-semibold text-white transition active:scale-[0.98] disabled:opacity-40'

export const secondaryBtn =
  'h-12 rounded-xl border border-stone-300 px-4 font-semibold transition active:scale-[0.98] dark:border-stone-700'

export const cardCls =
  'rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

export function Fab({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Add task"
      onClick={onClick}
      className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition active:scale-90 sm:right-[calc(50%-13rem)]"
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

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mt-16 flex flex-col items-center gap-2 px-8 text-center">
      <img src="/icon.svg" alt="" className="h-14 w-14 opacity-80" />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-stone-500">{hint}</p>
    </div>
  )
}
