import { useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'

/**
 * Tap + optional long-press (450ms) on one element. Pointer events give
 * instant response and movement-cancel (scrolling); a click fallback keeps
 * keyboards, screen readers, and other non-pointer activations working —
 * completed pointer sequences suppress their trailing click so taps never
 * fire twice.
 */
export function usePress(onTap: () => void, onLongPress?: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const longFired = useRef(false)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const suppressClick = useRef(false)

  function clear() {
    clearTimeout(timer.current)
    timer.current = undefined
  }

  return {
    onPointerDown: (e: PointerEvent) => {
      longFired.current = false
      suppressClick.current = false
      origin.current = { x: e.clientX, y: e.clientY }
      if (onLongPress) {
        timer.current = setTimeout(() => {
          longFired.current = true
          navigator.vibrate?.(10)
          onLongPress()
        }, 450)
      }
    },
    onPointerMove: (e: PointerEvent) => {
      if (!origin.current) return
      if (Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 12) {
        clear()
        origin.current = null
        suppressClick.current = true
      }
    },
    onPointerUp: () => {
      clear()
      if (origin.current) {
        suppressClick.current = true
        if (!longFired.current) onTap()
      }
      origin.current = null
    },
    onPointerCancel: () => {
      clear()
      origin.current = null
      suppressClick.current = true
    },
    onPointerLeave: () => {
      clear()
      origin.current = null
    },
    onClick: () => {
      if (suppressClick.current) {
        suppressClick.current = false
        return
      }
      onTap()
    },
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  }
}
