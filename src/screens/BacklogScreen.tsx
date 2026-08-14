import { useState } from 'react'
import { useUid } from '../auth/useSession'
import { AddTaskSheet } from '../components/AddTaskSheet'
import { BackdateSheet } from '../components/BackdateSheet'
import type { DragHandle } from '../components/SortableList'
import { SortableList } from '../components/SortableList'
import { BacklogRow } from '../components/TaskRow'
import { EmptyState, Fab, RowSkeleton, Section } from '../components/ui'
import { useLogDone, useSpaceLabel } from '../data/helpers'
import { useMemberNames, useReorderTasks, useTasks, useUndoCompletion } from '../data/queries'
import { todayLocal } from '../lib/dates'
import { reorderUpdates } from '../lib/order'
import { backlogItems } from '../lib/subtasks'
import type { BacklogItem } from '../lib/subtasks'
import type { TaskWithLast } from '../lib/types'

export function BacklogScreen() {
  const uid = useUid()
  const { data: tasks, isLoading } = useTasks()
  const nameFor = useMemberNames(uid)
  const spaceLabel = useSpaceLabel()
  const logDone = useLogDone()
  const undo = useUndoCompletion()
  const reorder = useReorderTasks()
  const [adding, setAdding] = useState(false)
  const [backdating, setBackdating] = useState<TaskWithLast | null>(null)
  // only the rows you've actually toggled; everything else follows the default
  const [expandOverride, setExpandOverride] = useState<Record<string, boolean>>({})

  const items = backlogItems(tasks ?? [])
  const open = items.filter((i) => !i.done)
  const done = items
    .filter((i) => i.done)
    .sort((a, b) => (a.done!.done_on < b.done!.done_on ? 1 : -1))

  // unfinished checklists are worth seeing; finished ones are just noise
  const isExpanded = (i: BacklogItem) => expandOverride[i.task.id] ?? !i.done
  const toggleExpand = (id: string, now: boolean) =>
    setExpandOverride((prev) => ({ ...prev, [id]: !now }))

  const toggleSubtask = (s: TaskWithLast) =>
    s.last
      ? undo.mutate({ completionId: s.last.id, taskId: s.id })
      : logDone(s, todayLocal())

  const row = (i: BacklogItem, handle?: DragHandle, dragging?: boolean) => (
    <BacklogRow
      key={i.task.id}
      task={i.task}
      who={(u) => nameFor(i.task.space_id, u)}
      spaceName={spaceLabel(i.task.space_id)}
      subtasks={i.subtasks}
      doneCount={i.doneCount}
      done={i.done}
      expanded={isExpanded(i)}
      onToggleExpand={() => toggleExpand(i.task.id, isExpanded(i))}
      onDone={() => logDone(i.task, todayLocal())}
      onBackdate={() => setBackdating(i.task)}
      onUndo={() => undo.mutate({ completionId: i.task.last!.id, taskId: i.task.id })}
      onSubtaskTap={toggleSubtask}
      onSubtaskLongPress={setBackdating}
      handle={handle}
      dragging={dragging}
    />
  )

  return (
    <div className="px-4 pb-36 pt-6">
      <header className="mb-5">
        <div className="text-xs font-bold uppercase tracking-widest text-accent">tin</div>
        <h1 className="text-2xl font-bold">
          {isLoading
            ? 'Loading…'
            : open.length === 0
              ? 'Backlog clear'
              : open.length === 1
                ? '1 thing to do'
                : `${open.length} things to do`}
        </h1>
      </header>

      {isLoading && (
        <div className="flex flex-col gap-2">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <EmptyState
          title="Nothing in the backlog"
          hint="One-time stuff lives here: things to buy, fix, book, or email."
        />
      )}

      {open.length > 0 && (
        <Section title="To do">
          {open.length === 1 ? (
            open.map((i) => row(i))
          ) : (
            <SortableList
              items={open}
              getId={(i) => i.task.id}
              onReorder={(from, to) =>
                reorder.mutate(reorderUpdates(open.map((i) => i.task), from, to))
              }
            >
              {row}
            </SortableList>
          )}
        </Section>
      )}
      {done.length > 0 && <Section title="Done">{done.map((i) => row(i))}</Section>}

      <Fab onClick={() => setAdding(true)} />
      <AddTaskSheet open={adding} onClose={() => setAdding(false)} defaultKind="oneoff" />
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
