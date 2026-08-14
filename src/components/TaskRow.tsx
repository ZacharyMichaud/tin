import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { daysSince, fmtAgo, todayLocal } from '../lib/dates'
import { dueText, taskState, urgencyBadge } from '../lib/task-state'
import type { LastCompletion, TaskWithLast } from '../lib/types'
import { usePress } from '../lib/use-press'
import type { DragHandle } from './SortableList'

export function DoneButton({
  filled,
  onDone,
  onLongPress,
  label,
}: {
  filled: boolean
  onDone: () => void
  onLongPress?: () => void
  label: string
}) {
  const press = usePress(onDone, onLongPress)
  return (
    <button
      {...press}
      aria-label={label}
      className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${
        filled
          ? 'border-accent bg-accent text-white'
          : 'border-accent/50 bg-accent/5 text-accent dark:bg-accent/10'
      }`}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
    </button>
  )
}

export function DaysBadge({ task, size = 'md' }: { task: TaskWithLast; size?: 'md' | 'lg' }) {
  const s = taskState(task, task.last?.done_on ?? null)
  const dims = size === 'lg' ? 'h-20 w-20 rounded-2xl' : 'h-13 w-13 rounded-xl'
  const num = size === 'lg' ? 'text-3xl' : 'text-lg'
  return (
    <div className={`flex shrink-0 flex-col items-center justify-center ${dims} ${urgencyBadge[s.urgency]}`}>
      <span className={`${num} font-bold leading-none tabular-nums`}>{s.daysSince ?? '–'}</span>
      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-70">
        {s.daysSince === null ? 'new' : s.daysSince === 1 ? 'day' : 'days'}
      </span>
    </div>
  )
}

/** Checklist progress, standing in for the days badge on items with subtasks. */
export function ProgressRing({
  done,
  total,
  size = 'md',
}: {
  done: number
  total: number
  size?: 'md' | 'lg'
}) {
  const px = size === 'lg' ? 80 : 52
  const stroke = size === 'lg' ? 6 : 4
  const r = (px - stroke) / 2
  const circumference = 2 * Math.PI * r
  const complete = total > 0 && done >= total

  return (
    <div className="relative shrink-0" style={{ width: px, height: px }}>
      <svg width={px} height={px} className="-rotate-90" aria-hidden="true">
        <circle
          cx={px / 2} cy={px / 2} r={r} fill="none" strokeWidth={stroke}
          className="stroke-stone-200 dark:stroke-stone-700"
        />
        <circle
          cx={px / 2} cy={px / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          className="stroke-accent transition-[stroke-dashoffset] duration-300"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - (total ? done / total : 0))}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {complete ? (
          <svg
            width={size === 'lg' ? 34 : 22} height={size === 'lg' ? 34 : 22} viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            strokeLinejoin="round" className="text-accent"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <span
            className={`font-bold tabular-nums text-stone-500 dark:text-stone-400 ${
              size === 'lg' ? 'text-lg' : 'text-xs'
            }`}
          >
            {done}/{total}
          </span>
        )}
      </div>
      <span className="sr-only">
        {done} of {total} subtasks done
      </span>
    </div>
  )
}

/**
 * One checklist line. The whole 52px-tall line is the tap target rather than a
 * small tickbox, so logging a subtask stays a one-tap ≥52px action like every
 * other completion; long-press backdates.
 */
export function SubtaskRow({
  task,
  onTap,
  onLongPress,
  trailing,
}: {
  task: TaskWithLast
  onTap: () => void
  onLongPress?: () => void
  trailing?: ReactNode
}) {
  const press = usePress(onTap, onLongPress)
  const done = task.last !== null
  return (
    <li className="flex items-center gap-1">
      <button
        {...press}
        type="button"
        aria-pressed={done}
        aria-label={done ? `Un-log “${task.title}”` : `Log “${task.title}” done`}
        className="flex h-13 min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
            done
              ? 'border-accent bg-accent text-white'
              : 'border-stone-300 dark:border-stone-600'
          }`}
        >
          {done && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-sm ${
            done ? 'text-stone-400 line-through dark:text-stone-500' : ''
          }`}
        >
          {task.title}
        </span>
      </button>
      {trailing}
    </li>
  )
}

const rowShell =
  'rounded-2xl border border-stone-200 bg-white transition dark:border-stone-800 dark:bg-stone-900'
const rowMain =
  'flex cursor-pointer items-center gap-3 p-3 active:bg-stone-100 dark:active:bg-stone-800'
const rowCls = `${rowShell} ${rowMain} rounded-2xl`

export function RecurringRow({
  task,
  who,
  spaceName,
  onDone,
  onBackdate,
}: {
  task: TaskWithLast
  who: (userId: string) => string
  spaceName?: string
  onDone: () => void
  onBackdate: () => void
}) {
  const navigate = useNavigate()
  const s = taskState(task, task.last?.done_on ?? null)
  const sub = [
    task.interval_days ? `every ${task.interval_days}d` : null,
    dueText(s) || null,
    task.last ? who(task.last.done_by) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={rowCls} onClick={() => navigate(`/task/${task.id}`)}>
      <DaysBadge task={task} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{task.title}</span>
          {spaceName && (
            <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500 dark:bg-stone-800 dark:text-stone-400">
              {spaceName}
            </span>
          )}
        </div>
        <div className="truncate text-xs text-stone-500">{sub}</div>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <DoneButton
          filled={task.last?.done_on === todayLocal()}
          onDone={onDone}
          onLongPress={onBackdate}
          label={`Log “${task.title}” done`}
        />
      </div>
    </div>
  )
}

export function BacklogRow({
  task,
  who,
  spaceName,
  subtasks = [],
  doneCount = 0,
  done,
  expanded,
  onToggleExpand,
  onDone,
  onBackdate,
  onUndo,
  onSubtaskTap,
  onSubtaskLongPress,
  handle,
  dragging,
}: {
  task: TaskWithLast
  who: (userId: string) => string
  spaceName?: string
  subtasks?: TaskWithLast[]
  doneCount?: number
  /** Derived completion: own log, or the last subtask if the checklist is clear. */
  done: LastCompletion | null
  expanded?: boolean
  onToggleExpand?: () => void
  onDone: () => void
  onBackdate: () => void
  onUndo: () => void
  onSubtaskTap?: (subtask: TaskWithLast) => void
  onSubtaskLongPress?: (subtask: TaskWithLast) => void
  handle?: DragHandle
  dragging?: boolean
}) {
  const navigate = useNavigate()
  const isDone = done !== null
  const hasSubtasks = subtasks.length > 0
  const open = hasSubtasks && !!expanded

  const sub = isDone
    ? `done ${fmtAgo(daysSince(done.done_on))} · ${who(done.done_by)}`
    : hasSubtasks
      ? `${subtasks.length - doneCount} left`
      : (task.notes ?? '')

  return (
    <div className={`${rowShell} ${dragging ? 'shadow-xl ring-2 ring-accent/40' : ''}`}>
      <div
        className={`${rowMain} ${open ? 'rounded-t-2xl' : 'rounded-2xl'}`}
        onClick={() => navigate(`/task/${task.id}`)}
      >
        <div onClick={(e) => e.stopPropagation()}>
          {hasSubtasks ? (
            // no done button: the item's state is its checklist. Tapping the
            // ring expands rather than completing, so nothing is logged by
            // accident on the way to seeing what's left.
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={open}
              aria-label={`${open ? 'Hide' : 'Show'} subtasks of “${task.title}”`}
            >
              <ProgressRing done={doneCount} total={subtasks.length} />
            </button>
          ) : (
            <DoneButton
              filled={isDone}
              onDone={isDone ? onUndo : onDone}
              onLongPress={isDone ? undefined : onBackdate}
              label={isDone ? `Un-log “${task.title}”` : `Log “${task.title}” done`}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`truncate font-medium ${isDone ? 'text-stone-400 line-through dark:text-stone-500' : ''}`}>
              {task.title}
            </span>
            {spaceName && (
              <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                {spaceName}
              </span>
            )}
          </div>
          {sub && <div className="truncate text-xs text-stone-500">{sub}</div>}
        </div>

        {hasSubtasks && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand?.()
            }}
            aria-expanded={open}
            aria-label={`${open ? 'Hide' : 'Show'} subtasks of “${task.title}”`}
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
        )}

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
        <ul className="border-t border-stone-100 px-3 pb-1 pl-4 dark:border-stone-800">
          {subtasks.map((s) => (
            <SubtaskRow
              key={s.id}
              task={s}
              onTap={() => onSubtaskTap?.(s)}
              onLongPress={onSubtaskLongPress ? () => onSubtaskLongPress(s) : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
