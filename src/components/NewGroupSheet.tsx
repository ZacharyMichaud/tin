import { useEffect, useState } from 'react'
import { useUid } from '../auth/useSession'
import { useAddTask, useSpaces, useTasks } from '../data/queries'
import { topSortOrder } from '../lib/order'
import { Sheet } from './Sheet'
import { inputCls, primaryBtn } from './ui'

/**
 * Creating a group. Deliberately not another mode of AddTaskSheet: a group has
 * no cadence, no deadline and nothing to log, so all it needs is a name and a
 * space. The items go in afterwards, straight from the row on the backlog.
 */
export function NewGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const uid = useUid()
  const { data: spaces } = useSpaces()
  const { data: tasks } = useTasks()
  const addTask = useAddTask()

  const [name, setName] = useState('')
  const [spaceId, setSpaceId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    const remembered = localStorage.getItem('tin-last-space')
    setSpaceId(
      (spaces?.some((s) => s.id === remembered) ? remembered : null) ??
        spaces?.find((s) => s.is_personal)?.id ??
        spaces?.[0]?.id ??
        null,
    )
  }, [open, spaces])

  function save() {
    const title = name.trim()
    if (!title || !spaceId) return
    addTask.mutate({
      id: crypto.randomUUID(),
      space_id: spaceId,
      title,
      notes: null,
      kind: 'oneoff', // the 0005 trigger keeps groups one-off and top-level
      interval_days: null,
      sort_order: topSortOrder(tasks), // new groups land on top, like new tasks
      parent_id: null,
      is_group: true,
      due_on: null,
      createdBy: uid,
    })
    localStorage.setItem('tin-last-space', spaceId)
    onClose()
  }

  const chipCls = (active: boolean) =>
    `h-10 rounded-xl border px-3 text-sm font-semibold transition ${
      active
        ? 'border-accent bg-accent/10 text-accent'
        : 'border-stone-300 text-stone-500 dark:border-stone-700'
    }`

  return (
    <Sheet open={open} onClose={onClose} title="New group">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <input
          autoFocus
          placeholder="Things to buy"
          aria-label="Group name"
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {(spaces?.length ?? 0) > 1 && (
          <div className="flex flex-col gap-2">
            <span className="px-1 text-sm text-stone-500">Space</span>
            <div className="flex flex-wrap gap-2">
              {spaces!.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={chipCls(spaceId === s.id)}
                  onClick={() => setSpaceId(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="px-1 text-xs text-stone-400">
          A group holds one-time tasks and never gets ticked off itself — buy the last thing on it
          and it stays put, ready for the next one.
        </p>

        <button className={primaryBtn} disabled={!name.trim() || !spaceId}>
          Create group
        </button>
      </form>
    </Sheet>
  )
}
