import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useUid } from '../auth/useSession'
import { AddTaskSheet } from '../components/AddTaskSheet'
import { BackdateSheet } from '../components/BackdateSheet'
import { DaysBadge, ProgressRing, SubtaskRow } from '../components/TaskRow'
import { cardCls, inputCls, primaryBtn, secondaryBtn, Section } from '../components/ui'
import { useLogDone } from '../data/helpers'
import {
  useAddTask,
  useDeleteTask,
  useHistory,
  useMemberNames,
  useTasks,
  useUndoCompletion,
  useUpdateTask,
} from '../data/queries'
import { daysBetween, daysSince, fmtAgo, fmtDay, todayLocal } from '../lib/dates'
import { itemDone, nextSubtaskOrder } from '../lib/subtasks'
import { dueText, taskState } from '../lib/task-state'
import type { TaskWithLast } from '../lib/types'

export function TaskDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const uid = useUid()
  const { data: tasks, isLoading } = useTasks()
  const { data: history } = useHistory(id ?? '')
  const nameFor = useMemberNames(uid)
  const logDone = useLogDone()
  const addTask = useAddTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const undo = useUndoCompletion()
  const [editing, setEditing] = useState(false)
  const [backdating, setBackdating] = useState<TaskWithLast | null>(null)
  const [newSubtask, setNewSubtask] = useState('')

  const task = tasks?.find((t) => t.id === id)

  const subtasks = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.parent_id === id && !t.archived)
        .sort((a, b) => a.sort_order - b.sort_order || (a.created_at < b.created_at ? -1 : 1)),
    [tasks, id],
  )
  const parent = tasks?.find((t) => t.id === task?.parent_id)

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
  const done = itemDone(task, subtasks)
  const doneCount = subtasks.filter((t) => t.last).length
  // recurring tasks and subtasks themselves stay flat — one level only
  const canHaveSubtasks = task.kind === 'oneoff' && !task.parent_id

  function del() {
    if (!task) return
    const extra = subtasks.length ? `, its ${subtasks.length} subtasks` : ''
    if (!window.confirm(`Delete “${task.title}”${extra} and the whole history?`)) return
    deleteTask.mutate({ id: task.id })
    navigate('/')
  }

  function addSubtask(e: FormEvent) {
    e.preventDefault()
    const title = newSubtask.trim()
    if (!title || !task) return
    addTask.mutate({
      id: crypto.randomUUID(),
      space_id: task.space_id, // RLS and the 0003 trigger both require the parent's space
      title,
      notes: null,
      kind: 'oneoff',
      interval_days: null,
      sort_order: nextSubtaskOrder(subtasks),
      parent_id: task.id,
      createdBy: uid,
    })
    setNewSubtask('') // input keeps focus so a whole checklist goes in one go
  }

  function toggleSubtask(sub: TaskWithLast) {
    if (sub.last) undo.mutate({ completionId: sub.last.id, taskId: sub.id })
    else logDone(sub, todayLocal())
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

      {parent && (
        <button
          className="mb-3 flex max-w-full items-center gap-1.5 text-sm text-stone-500"
          onClick={() => navigate(`/task/${parent.id}`)}
        >
          <span className="shrink-0 text-stone-400">part of</span>
          <span className="truncate font-medium text-accent">{parent.title}</span>
        </button>
      )}

      <div className={`${cardCls} mb-4 flex items-center gap-4 p-4`}>
        {subtasks.length > 0 ? (
          <ProgressRing done={doneCount} total={subtasks.length} size="lg" />
        ) : (
          <DaysBadge task={task} size="lg" />
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">{task.title}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {task.kind === 'recurring' ? `every ${task.interval_days}d` : 'one-time'}
            {subtasks.length > 0 && ` · ${doneCount} of ${subtasks.length} done`}
            {dueText(s) && ` · ${dueText(s)}`}
          </p>
          {done && (
            <p className="text-sm text-stone-500">
              done {fmtAgo(daysSince(done.done_on))} by {who(done.done_by)}
            </p>
          )}
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

      {canHaveSubtasks && (
        <Section title="Subtasks">
          {subtasks.length > 0 && (
            <ul className={`${cardCls} px-3 pb-1`}>
              {subtasks.map((sub) => (
                <SubtaskRow
                  key={sub.id}
                  task={sub}
                  onTap={() => toggleSubtask(sub)}
                  onLongPress={() => setBackdating(sub)}
                  trailing={
                    <>
                      <button
                        aria-label={`Open “${sub.title}”`}
                        className="flex h-13 w-8 shrink-0 items-center justify-center text-stone-300 dark:text-stone-600"
                        onClick={() => navigate(`/task/${sub.id}`)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                      <button
                        aria-label={`Delete “${sub.title}”`}
                        className="flex h-13 w-8 shrink-0 items-center justify-center text-stone-300 dark:text-stone-600"
                        onClick={() => {
                          if (sub.last && !window.confirm(`Delete “${sub.title}” and its history?`))
                            return
                          deleteTask.mutate({ id: sub.id })
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </>
                  }
                />
              ))}
            </ul>
          )}
          <form className="flex gap-2" onSubmit={addSubtask}>
            <input
              className={`${inputCls} flex-1`}
              placeholder="Add a subtask"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
            />
            <button className={primaryBtn} disabled={!newSubtask.trim()}>
              Add
            </button>
          </form>
          {subtasks.length > 0 && (
            <p className="px-1 text-xs text-stone-400">
              {doneCount === subtasks.length
                ? 'All done — this is off the backlog.'
                : 'Ticking the last one takes this off the backlog.'}
            </p>
          )}
        </Section>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2">
        <button className={primaryBtn} onClick={() => logDone(task, todayLocal())}>
          {subtasks.length > 0 ? 'Done anyway' : 'Done today'}
        </button>
        <button className={secondaryBtn} onClick={() => setBackdating(task)}>
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

      <AddTaskSheet
        open={editing}
        onClose={() => setEditing(false)}
        task={task}
        lockKind={!!task.parent_id || subtasks.length > 0}
      />
      <BackdateSheet
        open={backdating !== null}
        onClose={() => setBackdating(null)}
        onPick={(d) => {
          if (backdating) logDone(backdating, d)
        }}
      />
    </div>
  )
}
