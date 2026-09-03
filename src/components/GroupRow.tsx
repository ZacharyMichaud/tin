import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TaskWithLast } from '../lib/types'
import type { DragHandle } from './SortableList'
import { SubtaskRow } from './TaskRow'

/**
 * Open-item count, standing in for the days badge on a group. Deliberately not
 * a ProgressRing: a ring reads as progress towards finishing, and a bucket
 * never finishes — the honest number is how much is still in it.
 */
export function GroupBadge({ open, size = 'md' }: { open: number; size?: 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'h-20 w-20 rounded-2xl' : 'h-13 w-13 rounded-xl'
  const num = size === 'lg' ? 'text-3xl' : 'text-lg'
  return (
    <div
      className={`flex shrink-0 flex-col items-center justify-center bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 ${dims}`}
    >
      <span className={`${num} font-bold leading-none tabular-nums`}>{open}</span>
      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-70">
        open
      </span>
    </div>
  )
}

/**
 * A group on the backlog: a bucket of one-off tasks that never completes.
 *
 * There is no done button anywhere on the row — the only thing you can finish
 * is an item — and ticking an item takes it straight out of the list, so what
 * you see is always just what's left. Adding is inline, because the whole point
 * of a shopping list is that you top it up in a couple of seconds.
 */
export function GroupRow({
  task,
  spaceName,
  items,
  doneCount,
  expanded,
  onToggleExpand,
  onItemTap,
  onItemLongPress,
  onAddItem,
  handle,
  dragging,
}: {
  task: TaskWithLast
  spaceName?: string
  /** Still-open items only; ticked ones have left for the Done section. */
  items: TaskWithLast[]
  /** Items ticked off, for the "nothing left" wording. */
  doneCount: number
  expanded?: boolean
  onToggleExpand?: () => void
  onItemTap: (item: TaskWithLast) => void
  onItemLongPress?: (item: TaskWithLast) => void
  onAddItem: (title: string) => void
  handle?: DragHandle
  dragging?: boolean
}) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const open = !!expanded

  function add(e: FormEvent) {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    onAddItem(title)
    setDraft('') // input keeps focus so a whole list goes in one go
  }

  // collapsed, the row is worth more as a peek at what's in it than as a count
  // repeated from the badge; expanded, the items are right there already
  const sub = open
    ? (task.notes ?? '')
    : items.length > 0
      ? items.map((i) => i.title).join(', ')
      : doneCount > 0
        ? 'nothing left'
        : 'no items yet'

  return (
    <div
      className={`rounded-2xl border border-stone-200 bg-white transition dark:border-stone-800 dark:bg-stone-900 ${
        dragging ? 'shadow-xl ring-2 ring-accent/40' : ''
      }`}
    >
      <div
        className={`flex cursor-pointer items-center gap-3 p-3 active:bg-stone-100 dark:active:bg-stone-800 ${
          open ? 'rounded-t-2xl' : 'rounded-2xl'
        }`}
        onClick={() => navigate(`/task/${task.id}`)}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand?.()
          }}
          aria-expanded={open}
          aria-label={`${open ? 'Hide' : 'Show'} the items in “${task.title}”`}
        >
          <GroupBadge open={items.length} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{task.title}</span>
            {spaceName && (
              <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                {spaceName}
              </span>
            )}
          </div>
          {sub && <div className="truncate text-xs text-stone-500">{sub}</div>}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand?.()
          }}
          aria-expanded={open}
          aria-label={`${open ? 'Hide' : 'Show'} the items in “${task.title}”`}
          className="flex h-13 w-9 shrink-0 items-center justify-center text-stone-400"
        >
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {handle && (
          <button
            type="button"
            {...handle}
            aria-label={`Reorder “${task.title}” — hold and drag, or use the arrow keys`}
            className="-mr-2 flex h-13 w-11 shrink-0 cursor-grab items-center justify-center rounded-lg text-stone-300 active:cursor-grabbing dark:text-stone-600"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <circle cx="6.5" cy="4" r="1.4" />
              <circle cx="11.5" cy="4" r="1.4" />
              <circle cx="6.5" cy="9" r="1.4" />
              <circle cx="11.5" cy="9" r="1.4" />
              <circle cx="6.5" cy="14" r="1.4" />
              <circle cx="11.5" cy="14" r="1.4" />
            </svg>
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-stone-100 px-3 pb-2 pl-4 dark:border-stone-800">
          <ul>
            {items.map((item) => (
              <SubtaskRow
                key={item.id}
                task={item}
                onTap={() => onItemTap(item)}
                onLongPress={onItemLongPress ? () => onItemLongPress(item) : undefined}
              />
            ))}
          </ul>
          <form className="flex items-center gap-2 pr-1" onSubmit={add}>
            <input
              className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
              placeholder="Add an item"
              aria-label={`Add an item to “${task.title}”`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              className="h-9 shrink-0 rounded-lg px-3 text-sm font-semibold text-accent disabled:opacity-40"
              disabled={!draft.trim()}
            >
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
