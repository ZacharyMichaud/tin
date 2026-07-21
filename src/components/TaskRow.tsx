import { useNavigate } from 'react-router-dom'
import { daysSince, fmtAgo, todayLocal } from '../lib/dates'
import { dueText, taskState, urgencyBadge } from '../lib/task-state'
import type { TaskWithLast } from '../lib/types'
import { usePress } from '../lib/use-press'

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

const rowCls =
  'flex cursor-pointer items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 transition active:bg-stone-100 dark:border-stone-800 dark:bg-stone-900 dark:active:bg-stone-800'

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
  onDone,
  onBackdate,
  onUndo,
}: {
  task: TaskWithLast
  who: (userId: string) => string
  spaceName?: string
  onDone: () => void
  onBackdate: () => void
  onUndo: () => void
}) {
  const navigate = useNavigate()
  const done = task.last !== null
  const sub = done
    ? `done ${fmtAgo(daysSince(task.last!.done_on))} · ${who(task.last!.done_by)}`
    : (task.notes ?? '')

  return (
    <div className={rowCls} onClick={() => navigate(`/task/${task.id}`)}>
      <div onClick={(e) => e.stopPropagation()}>
        <DoneButton
          filled={done}
          onDone={done ? onUndo : onDone}
          onLongPress={done ? undefined : onBackdate}
          label={done ? `Un-log “${task.title}”` : `Log “${task.title}” done`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`truncate font-medium ${done ? 'text-stone-400 line-through dark:text-stone-500' : ''}`}>
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
    </div>
  )
}
