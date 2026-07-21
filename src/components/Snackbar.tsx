import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface SnackAction {
  label: string
  onClick: () => void
}
type Show = (msg: string, action?: SnackAction) => void

const Ctx = createContext<Show>(() => {})

export function useSnackbar() {
  return useContext(Ctx)
}

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snack, setSnack] = useState<{ msg: string; action?: SnackAction; key: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = useCallback<Show>((msg, action) => {
    clearTimeout(timer.current)
    setSnack({ msg, action, key: Date.now() })
    timer.current = setTimeout(() => setSnack(null), 5000)
  }, [])

  return (
    <Ctx.Provider value={show}>
      {children}
      {snack && (
        <div
          key={snack.key}
          className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="pointer-events-auto flex max-w-md items-center gap-4 rounded-full bg-stone-900 py-3 pl-5 pr-4 text-sm text-white shadow-lg animate-pop-in dark:bg-stone-100 dark:text-stone-900">
            <span className="truncate">{snack.msg}</span>
            {snack.action && (
              <button
                className="shrink-0 text-xs font-bold uppercase tracking-wider text-emerald-400 dark:text-emerald-700"
                onClick={() => {
                  clearTimeout(timer.current)
                  setSnack(null)
                  snack.action?.onClick()
                }}
              >
                {snack.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
