import { useEffect, useState } from 'react'
import { useUid } from '../auth/useSession'
import { useAddTask, useSpaces, useTasks, useUpdateTask } from '../data/queries'
import { addDays, todayLocal } from '../lib/dates'
import { topSortOrder } from '../lib/order'
import type { TaskKind, TaskWithLast } from '../lib/types'
import { Sheet } from './Sheet'
import { cardCls, inputCls, primaryBtn, secondaryBtn } from './ui'

const PRESETS = [3, 7, 14, 30]
const DUE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: '1 week', days: 7 },
  { label: '1 month', days: 30 },
]

export function AddTaskSheet({
  open,
  onClose,
  defaultKind = 'recurring',
  task,
  lockKind = false,
}: {
  open: boolean
  onClose: () => void
  defaultKind?: TaskKind
  task?: TaskWithLast // edit mode
  /** Subtasks and their parents must stay one-offs (enforced by the 0003 trigger). */
  lockKind?: boolean
}) {
  const uid = useUid()
  const { data: spaces } = useSpaces()
  const { data: tasks } = useTasks()
  const addTask = useAddTask()
  const updateTask = useUpdateTask()

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TaskKind>(defaultKind)
  const [interval, setInterval] = useState(7)
  const [notes, setNotes] = useState('')
  const [spaceId, setSpaceId] = useState<string | null>(null)
  // stays folded away until asked for: most one-offs never get a date, and the
  // add flow has to stay a ten-second job
  const [dueOn, setDueOn] = useState<string | null>(null)
  const [showDue, setShowDue] = useState(false)
  // Checklist typed up front. These stay local rows until save, then become
  // one-off tasks pointing at the new parent — same shape the detail screen makes.
  const [checklist, setChecklist] = useState<{ id: string; title: string }[]>([])
  const [subtaskDraft, setSubtaskDraft] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setKind(task?.kind ?? defaultKind)
    setInterval(task?.interval_days ?? 7)
    setNotes(task?.notes ?? '')
    setDueOn(task?.due_on ?? null)
    setShowDue(!!task?.due_on)
    setChecklist([])
    setSubtaskDraft('')
    const remembered = localStorage.getItem('tin-last-space')
    setSpaceId(
      task?.space_id ??
        (spaces?.some((s) => s.id === remembered) ? remembered : null) ??
        spaces?.find((s) => s.is_personal)?.id ??
        spaces?.[0]?.id ??
        null,
    )
  }, [open, task, defaultKind, spaces])

  function addChecklistItem() {
    const t = subtaskDraft.trim()
    if (!t) return
    setChecklist((c) => [...c, { id: crypto.randomUUID(), title: t }])
    setSubtaskDraft('') // input keeps focus so a whole checklist goes in one go
  }

  async function save() {
    const t = title.trim()
    if (!t || !spaceId) return
    const interval_days = kind === 'recurring' ? interval : null
    // recurring tasks answer "how long since", not "by when", and subtasks
    // borrow their parent's urgency — 0004 rejects a deadline on either
    const due_on = kind === 'oneoff' && !task?.parent_id ? dueOn : null
    if (task) {
      updateTask.mutate({
        id: task.id,
        patch: { title: t, notes: notes.trim() || null, kind, interval_days, due_on },
      })
      onClose()
      return
    }

    const id = crypto.randomUUID()
    const pending = subtaskDraft.trim()
    // a line still sitting in the input counts too — nobody expects it to
    // vanish because they hit “Add task” instead of Enter
    const subtasks =
      kind === 'oneoff'
        ? [...checklist, ...(pending ? [{ id: crypto.randomUUID(), title: pending }] : [])]
        : []
    localStorage.setItem('tin-last-space', spaceId)
    onClose() // the sheet doesn't wait on the network; the rows are optimistic

    try {
      await addTask.mutateAsync({
        id,
        space_id: spaceId,
        title: t,
        notes: notes.trim() || null,
        kind,
        interval_days,
        sort_order: topSortOrder(tasks), // new tasks land on top
        parent_id: null,
        due_on,
        createdBy: uid,
      })
    } catch {
      return // parent rolled back — don't strand a checklist under an id that isn't there
    }
    // children only once the parent has landed: the FK and the 0003 trigger
    // both look it up, so these can't go out alongside the insert above
    subtasks.forEach((sub, i) =>
      addTask.mutate({
        id: sub.id,
        space_id: spaceId, // RLS and the trigger both require the parent's space
        title: sub.title,
        notes: null,
        kind: 'oneoff',
        interval_days: null,
        sort_order: i,
        parent_id: id,
        due_on: null,
        createdBy: uid,
      }),
    )
  }

  const today = todayLocal()
  const canHaveDeadline = kind === 'oneoff' && !task?.parent_id && !task?.is_group

  const segCls = (active: boolean) =>
    `h-10 flex-1 rounded-lg text-sm font-semibold transition ${
      active ? 'bg-white shadow dark:bg-stone-700' : 'text-stone-500'
    }`
  const chipCls = (active: boolean) =>
    `h-10 rounded-xl border px-3 text-sm font-semibold transition ${
      active
        ? 'border-accent bg-accent/10 text-accent'
        : 'border-stone-300 text-stone-500 dark:border-stone-700'
    }`

  return (
    <Sheet open={open} onClose={onClose} title={task ? 'Edit task' : 'New task'}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <input
          autoFocus={!task}
          placeholder="What needs doing?"
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {!lockKind && (
          <div className="flex gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
            <button type="button" className={segCls(kind === 'recurring')} onClick={() => setKind('recurring')}>
              Recurring
            </button>
            <button type="button" className={segCls(kind === 'oneoff')} onClick={() => setKind('oneoff')}>
              One-time
            </button>
          </div>
        )}

        {kind === 'recurring' && (
          <div className="flex flex-col gap-2">
            <span className="px-1 text-sm text-stone-500">Repeat every</span>
            <div className="flex items-center gap-2">
              {PRESETS.map((p) => (
                <button key={p} type="button" className={chipCls(interval === p)} onClick={() => setInterval(p)}>
                  {p}d
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Fewer days"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-300 text-lg dark:border-stone-700"
                  onClick={() => setInterval((v) => Math.max(1, v - 1))}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  className="h-10 w-14 rounded-xl border border-stone-300 bg-white text-center dark:border-stone-700 dark:bg-stone-900"
                  value={interval}
                  onChange={(e) => setInterval(Math.max(1, Number(e.target.value) || 1))}
                />
                <button
                  type="button"
                  aria-label="More days"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-300 text-lg dark:border-stone-700"
                  onClick={() => setInterval((v) => v + 1)}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}

        {canHaveDeadline &&
          (showDue ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm text-stone-500">Due by</span>
                <button
                  type="button"
                  className="text-sm font-semibold text-stone-400"
                  onClick={() => {
                    setShowDue(false)
                    setDueOn(null)
                  }}
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {DUE_PRESETS.map((p) => (
                  <button
                    key={p.days}
                    type="button"
                    className={chipCls(dueOn === addDays(today, p.days))}
                    onClick={() => setDueOn(addDays(today, p.days))}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {/* the picker is the source of truth; the chips just fill it in */}
              <input
                type="date"
                className={inputCls}
                value={dueOn ?? ''}
                onChange={(e) => setDueOn(e.target.value || null)}
              />
            </div>
          ) : (
            <button
              type="button"
              className="self-start px-1 text-sm font-semibold text-accent"
              onClick={() => setShowDue(true)}
            >
              + Add a deadline
            </button>
          ))}

        {!task && kind === 'oneoff' && (
          <div className="flex flex-col gap-2">
            <span className="px-1 text-sm text-stone-500">
              Checklist{checklist.length > 0 && ` · ${checklist.length}`}
            </span>
            {checklist.length > 0 && (
              <ul className={`${cardCls} px-3`}>
                {checklist.map((sub, i) => (
                  <li key={sub.id} className="flex items-center gap-2 py-1">
                    <span className="h-5 w-5 shrink-0 rounded-md border-2 border-stone-300 dark:border-stone-600" />
                    <span className="min-w-0 flex-1 truncate text-sm">{sub.title}</span>
                    <button
                      type="button"
                      aria-label={`Remove “${sub.title}”`}
                      className="flex h-11 w-8 shrink-0 items-center justify-center text-stone-300 dark:text-stone-600"
                      onClick={() => setChecklist((c) => c.filter((_, j) => j !== i))}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                className={`${inputCls} flex-1`}
                placeholder={checklist.length ? 'Add another step' : 'Break it into steps (optional)'}
                value={subtaskDraft}
                onChange={(e) => setSubtaskDraft(e.target.value)}
                // one <form> per sheet, so this can't be a nested form: Enter
                // adds a step instead of saving the task
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  addChecklistItem()
                }}
              />
              <button
                type="button"
                className={secondaryBtn}
                disabled={!subtaskDraft.trim()}
                onClick={addChecklistItem}
              >
                Add
              </button>
            </div>
          </div>
        )}

        {!task && (spaces?.length ?? 0) > 1 && (
          <div className="flex flex-col gap-2">
            <span className="px-1 text-sm text-stone-500">Space</span>
            <div className="flex flex-wrap gap-2">
              {spaces!.map((s) => (
                <button key={s.id} type="button" className={chipCls(spaceId === s.id)} onClick={() => setSpaceId(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          rows={2}
          placeholder="Notes (optional)"
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-accent dark:border-stone-700 dark:bg-stone-900"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <button className={primaryBtn} disabled={!title.trim() || !spaceId}>
          {task ? 'Save changes' : 'Add task'}
        </button>
      </form>
    </Sheet>
  )
}
