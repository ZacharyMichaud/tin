import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Counted so a sheet opened over another (backdate from task detail) doesn't
// unlock the page when the inner one closes.
let locks = 0
let savedY = 0

// iOS ignores overflow:hidden on body for touch scrolling, so pin the body in
// place instead and put the scroll position back afterwards.
function lockScroll() {
  if (locks++ > 0) return
  savedY = window.scrollY
  Object.assign(document.body.style, { position: 'fixed', top: `-${savedY}px`, left: '0', right: '0' })
}

function unlockScroll() {
  if (--locks > 0) return
  const s = document.body.style
  s.position = s.top = s.left = s.right = ''
  window.scrollTo(0, savedY)
}

/**
 * The part of the screen the user can actually see. The iOS keyboard doesn't
 * resize the layout viewport (or dvh) — it covers the bottom and pans the page
 * up to reveal the focused field, which scrolled a tall sheet's top, title
 * input included, off the screen. Sizing the overlay to the visual viewport
 * sits the sheet on top of the keyboard instead.
 */
function useVisualViewport(active: boolean) {
  const [vp, setVp] = useState<{ top: number; height: number } | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) return
    const sync = () => setVp({ top: vv.offsetTop, height: vv.height })
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [active])
  return active ? vp : null
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  const vp = useVisualViewport(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    lockScroll()
    return unlockScroll
  }, [open])

  if (!open) return null
  return createPortal(
    <div
      className="fixed inset-0 z-50"
      style={vp ? { top: vp.top, height: vp.height, bottom: 'auto' } : undefined}
    >
      <div
        // touch-action stops a drag on the backdrop panning the page behind
        className="absolute inset-0 touch-none bg-black/40 animate-fade-in"
        onClick={onClose}
      />
      <div
        // a sheet's content can outgrow a short phone (a long checklist in the
        // new-task sheet) or the space left above the keyboard, so cap it to
        // the visible area and scroll inside rather than pushing the top of
        // the form off the screen where nothing can reach it
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[92%] max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-4 shadow-xl animate-slide-up dark:bg-stone-900"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300 dark:bg-stone-700" />
        {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  )
}
