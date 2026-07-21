import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useUid } from '../auth/useSession'
import { AddTaskSheet } from '../components/AddTaskSheet'
import { BackdateSheet } from '../components/BackdateSheet'
import { DaysBadge } from '../components/TaskRow'
import { cardCls, primaryBtn, secondaryBtn, Section } from '../components/ui'
import { useLogDone } from '../data/helpers'
import {
  useDeleteTask,
  useHistory,
  useMemberNames,
  useTasks,
  useUndoCompletion,
  useUpdateTask,
} from '../data/queries'
import { daysBetween, daysSince, fmtAgo, fmtDay, todayLocal } from '../lib/dates'
import { dueText, taskState } from '../lib/task-state'

export function TaskDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const uid = useUid()
  const { data: tasks, isLoading } = useTasks()
  const { data: history } = useHistory(id ?? '')
  const nameFor = useMemberNames(uid)
  const logDone = useLogDone()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const undo = useUndoCompletion()
  const [editing, setEditing] = useState(false)
  const [backdating, setBackdating] = useState(false)

  const task = tasks?.find((t) => t.id === id)

  const cadence = useMemo(() => {
    if (!history || history.length < 3) return null
    const days = history.map((h) => h.done_on).sort()
    const gaps: number[] = []
    for (let i = 1; i < days.length; i++) gaps.push(daysBetween(days[i - 1], days[i]))
    gaps.sort((a, b) => a - b)
    return { median: gaps[Math.floor(gaps.length / 2)], count: history.length }
  }, [history])

  if (!task) {
    return (
      <div className="px-4 pt-6">
        <p className="text-stone-500">{isLoading ? 'Loading…' : 'Task not found.'}</p>
        <button className="mt-3 font-semibold text-accent" onClick={() => navigate('/')}>
          Back home
        </button>
      </div>
    )
  }

  const s = taskState(task, task.last?.done_on ?? null)
  const who = (u: string) => nameFor(task.space_id, u)

  function del() {
    if (!task) return
    if (!window.confirm(`Delete “${task.title}” and its whole history?`)) return
    deleteTask.mutate({ id: task.id })
    navigate('/')
  }

  return (
    <div className="px-4 pb-32 pt-4">
      <button
        className="mb-4 flex items-center gap-1 text-sm text-stone-500"
        onClick={() => navigate(-1)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </button>

      <div className={`${cardCls} mb-4 flex items-center gap-4 p-4`}>
        <DaysBadge task={task} size="lg" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">{task.title}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {task.kind === 'recurring' ? `every ${task.interval_days}d` : 'one-time'}
            {dueText(s) && ` · ${dueText(s)}`}
          </p>
          {task.last && <p className="text-sm text-stone-500">last by {who(task.last.done_by)}</p>}
          {task.archived && (
            <span className="mt-1 inline-block rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500 dark:bg-stone-800">
              archived
            </span>
          )}
        </div>
      </div>

      {task.notes && (
        <p className="mb-4 whitespace-pre-wrap px-1 text-sm text-stone-500">{task.notes}</p>
      )}
      {cadence && (
        <p className="mb-4 px-1 text-sm text-stone-400">
          logged {cadence.count}× · usually every ~{cadence.median}d
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2">
        <button className={primaryBtn} onClick={() => logDone(task, todayLocal())}>
          Done today
        </button>
        <button className={secondaryBtn} onClick={() => setBackdating(true)}>
          Another day…
        </button>
        <button className={secondaryBtn} onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          className={secondaryBtn}
          onClick={() => updateTask.mutate({ id: task.id, patch: { archived: !task.archived } })}
        >
          {task.archived ? 'Restore' : 'Archive'}
        </button>
        <button
          className="col-span-2 h-12 rounded-xl border border-red-200 font-semibold text-red-600 transition active:scale-[0.98] dark:border-red-950"
          onClick={del}
        >
          Delete task
        </button>
      </div>

      <Section title="History">
        {(history ?? []).length === 0 && <p className="px-1 text-sm text-stone-400">No logs yet.</p>}
        {(history ?? []).map((h) => (
          <div key={h.id} className={`${cardCls} flex items-center justify-between p-3 text-sm`}>
            <span className="min-w-0 truncate">
              {fmtDay(h.done_on)}{' '}
              <span className="text-stone-400">
                · {fmtAgo(daysSince(h.done_on))} · {who(h.done_by)}
              </span>
            </span>
            {h.done_by === uid && (
              <button
                aria-label="Remove this log"
                className="shrink-0 p-1 text-stone-400"
                onClick={() => undo.mutate({ completionId: h.id, taskId: task.id })}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </Section>

      <AddTaskSheet open={editing} onClose={() => setEditing(false)} task={task} />
      <BackdateSheet
        open={backdating}
        onClose={() => setBackdating(false)}
        onPick={(d) => logDone(task, d)}
      />
    </div>
  )
}
