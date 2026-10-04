import { useEffect, useState } from 'react'
import { useUid } from '../auth/useSession'
import { useAddTask, useSpaces, useTasks } from '../data/queries'
import { topSortOrder } from '../lib/order'
import { Sheet } from './Sheet'
import { useSnackbar } from './Snackbar'
import { inputCls, primaryBtn } from './ui'

/**
 * Creating a group. Deliberately not another mode of AddTaskSheet: a group has
 * no cadence, no deadline and nothing to log, so all it needs is a name and a
 * space. The items go in afterwards, straight from the group's row.
 */
export function NewGroupSheet({
  open,
  onClose,
  initialName = '',
  initialSpaceId = null,
}: {
  open: boolean
  onClose: () => void
  /** What the new-task sheet held before "Make a group instead". */
  initialName?: string
  initialSpaceId?: string | null
}) {
  const uid = useUid()
  const { data: spaces } = useSpaces()
  const { data: tasks } = useTasks()
  const addTask = useAddTask()
  const snackbar = useSnackbar()

  const [name, setName] = useState('')
  const [spaceId, setSpaceId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(initialName)
    const remembered = localStorage.getItem('tin-last-space')
    const known = (id: string | null) => (spaces?.some((s) => s.id === id) ? id : null)
    setSpaceId(
      // a space picked in the new-task sheet wins: a shared shopping list made
      // there shouldn't quietly land in the personal space instead
      known(initialSpaceId) ??
        known(remembered) ??
        spaces?.find((s) => s.is_personal)?.id ??
        spaces?.[0]?.id ??
        null,
    )
  }, [open, spaces, initialName, initialSpaceId])

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
    // it lands at the top of the backlog, which may be folded or off screen
    snackbar(`Added “${title}” to Backlog`)
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
