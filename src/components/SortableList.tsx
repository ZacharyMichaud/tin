import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react'

/**
 * Vertical drag-to-reorder list. Drag starts from an explicit handle (spread
 * `handle` onto a button) — the rows themselves stay tappable, so this doesn't
 * fight the row's tap-to-open or the done button's long-press-to-backdate.
 * Pointer events cover mouse + touch; arrow keys on the focused handle move a
 * row without a pointer. Rows shift with CSS transforms only, so nothing
 * relayouts mid-drag.
 */

export interface DragHandle {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void
  onPointerMove: (e: PointerEvent<HTMLElement>) => void
  onPointerUp: (e: PointerEvent<HTMLElement>) => void
  onPointerCancel: (e: PointerEvent<HTMLElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  onClick: (e: MouseEvent<HTMLElement>) => void
  style: CSSProperties
}

const GAP = 8 // px between rows — matches the flex gap below
const EDGE = 90 // autoscroll zone at the top/bottom of the viewport
const EDGE_SPEED = 14 // px per frame at the very edge

interface Drag {
  from: number
  over: number
  dy: number
}

interface Geometry {
  heights: number[]
  startY: number
  startScroll: number
  lastY: number
  pointerId: number
}

/** Index the dragged row lands on: pass a neighbour once you're half over it. */
function targetIndex(from: number, dy: number, heights: number[]): number {
  let index = from
  let passed = 0
  if (dy > 0) {
    for (let i = from + 1; i < heights.length; i++) {
      const step = heights[i] + GAP
      if (dy <= passed + step / 2) break
      passed += step
      index = i
    }
  } else if (dy < 0) {
    for (let i = from - 1; i >= 0; i--) {
      const step = heights[i] + GAP
      if (-dy <= passed + step / 2) break
      passed += step
      index = i
    }
  }
  return index
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  children,
}: {
  items: T[]
  getId: (item: T) => string
  onReorder: (from: number, to: number) => void
  children: (item: T, handle: DragHandle, dragging: boolean) => ReactNode
}) {
  const rows = useRef<(HTMLDivElement | null)[]>([])
  const geometry = useRef<Geometry | null>(null)
  const raf = useRef(0)
  const [drag, setDrag] = useState<Drag | null>(null)

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  function update() {
    const g = geometry.current
    if (!g) return
    const dy = g.lastY - g.startY + (window.scrollY - g.startScroll)
    setDrag((d) => (d ? { ...d, dy, over: targetIndex(d.from, dy, g.heights) } : d))
  }

  // hold near an edge and the page keeps scrolling, dy following along
  function autoscroll() {
    const g = geometry.current
    if (!g) return
    raf.current = requestAnimationFrame(autoscroll)
    const fromBottom = window.innerHeight - g.lastY
    const speed =
      g.lastY < EDGE
        ? -EDGE_SPEED * (1 - g.lastY / EDGE)
        : fromBottom < EDGE
          ? EDGE_SPEED * (1 - fromBottom / EDGE)
          : 0
    if (!speed) return
    window.scrollBy(0, speed)
    update()
  }

  function start(index: number, e: PointerEvent<HTMLElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault() // no text selection / scroll chaining while dragging
    e.currentTarget.setPointerCapture(e.pointerId)
    geometry.current = {
      heights: rows.current.slice(0, items.length).map((el) => el?.offsetHeight ?? 0),
      startY: e.clientY,
      startScroll: window.scrollY,
      lastY: e.clientY,
      pointerId: e.pointerId,
    }
    setDrag({ from: index, over: index, dy: 0 })
    navigator.vibrate?.(10)
    raf.current = requestAnimationFrame(autoscroll)
  }

  function move(e: PointerEvent<HTMLElement>) {
    const g = geometry.current
    if (!g || e.pointerId !== g.pointerId) return
    g.lastY = e.clientY
    update()
  }

  function end(e: PointerEvent<HTMLElement>) {
    const g = geometry.current
    if (!g || e.pointerId !== g.pointerId) return
    cancelAnimationFrame(raf.current)
    geometry.current = null
    setDrag(null)
    if (drag && drag.over !== drag.from) {
      navigator.vibrate?.(10)
      onReorder(drag.from, drag.over)
    }
  }

  function nudge(index: number, e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    const to = index + (e.key === 'ArrowUp' ? -1 : 1)
    if (to < 0 || to >= items.length) return
    e.preventDefault()
    onReorder(index, to)
  }

  const lift = drag ? (geometry.current?.heights[drag.from] ?? 0) + GAP : 0

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => {
        const dragging = drag?.from === i
        let shift = 0
        if (drag && !dragging) {
          if (i > drag.from && i <= drag.over) shift = -lift
          else if (i < drag.from && i >= drag.over) shift = lift
        }
        const handle: DragHandle = {
          onPointerDown: (e) => start(i, e),
          onPointerMove: move,
          onPointerUp: end,
          onPointerCancel: end,
          onKeyDown: (e) => nudge(i, e),
          onClick: (e) => e.stopPropagation(), // don't open the task
          style: { touchAction: 'none' },
        }
        return (
          <div
            key={getId(item)}
            ref={(el) => {
              rows.current[i] = el
            }}
            // transitions only exist mid-drag, so the drop itself never animates
            className={dragging ? 'relative z-20' : drag ? 'transition-transform duration-150 ease-out' : ''}
            style={{
              transform: `translateY(${dragging ? drag.dy : shift}px)`,
              willChange: drag ? 'transform' : undefined,
            }}
          >
            {children(item, handle, !!dragging)}
          </div>
        )
      })}
    </div>
  )
}
