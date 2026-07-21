import { useEffect, useState } from 'react'
import { useUid } from '../auth/useSession'
import { useAddTask, useSpaces, useUpdateTask } from '../data/queries'
import type { TaskKind, TaskWithLast } from '../lib/types'
import { Sheet } from './Sheet'
import { inputCls, primaryBtn } from './ui'

const PRESETS = [3, 7, 14, 30]

export function AddTaskSheet({
  open,
  onClose,
  defaultKind = 'recurring',
  task,
}: {
  open: boolean
  onClose: () => void
  defaultKind?: TaskKind
  task?: TaskWithLast // edit mode
}) {
  const uid = useUid()
  const { data: spaces } = useSpaces()
  const addTask = useAddTask()
  const updateTask = useUpdateTask()

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TaskKind>(defaultKind)
  const [interval, setInterval] = useState(7)
  const [notes, setNotes] = useState('')
  const [spaceId, setSpaceId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setKind(task?.kind ?? defaultKind)
    setInterval(task?.interval_days ?? 7)
    setNotes(task?.notes ?? '')
    const remembered = localStorage.getItem('tin-last-space')
    setSpaceId(
      task?.space_id ??
        (spaces?.some((s) => s.id === remembered) ? remembered : null) ??
        spaces?.find((s) => s.is_personal)?.id ??
        spaces?.[0]?.id ??
        null,
    )
  }, [open, task, defaultKind, spaces])

  function save() {
    const t = title.trim()
    if (!t || !spaceId) return
    const interval_days = kind === 'recurring' ? interval : null
    if (task) {
      updateTask.mutate({
        id: task.id,
        patch: { title: t, notes: notes.trim() || null, kind, interval_days },
      })
    } else {
      addTask.mutate({
        id: crypto.randomUUID(),
        space_id: spaceId,
        title: t,
        notes: notes.trim() || null,
        kind,
        interval_days,
        createdBy: uid,
      })
      localStorage.setItem('tin-last-space', spaceId)
    }
    onClose()
  }

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
          save()
        }}
      >
        <input
          autoFocus={!task}
          placeholder="What needs doing?"
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="flex gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
          <button type="button" className={segCls(kind === 'recurring')} onClick={() => setKind('recurring')}>
            Recurring
          </button>
          <button type="button" className={segCls(kind === 'oneoff')} onClick={() => setKind('oneoff')}>
            One-time
          </button>
        </div>

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
