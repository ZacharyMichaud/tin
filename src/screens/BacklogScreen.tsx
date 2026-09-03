import { useState } from 'react'
import { useUid } from '../auth/useSession'
import { AddTaskSheet } from '../components/AddTaskSheet'
import { BackdateSheet } from '../components/BackdateSheet'
import { GroupRow } from '../components/GroupRow'
import { NewGroupSheet } from '../components/NewGroupSheet'
import type { DragHandle } from '../components/SortableList'
import { SortableList } from '../components/SortableList'
import { BacklogRow } from '../components/TaskRow'
import { EmptyState, Fab, RowSkeleton, Section } from '../components/ui'
import { useLogDone, useSpaceLabel } from '../data/helpers'
import {
  useAddTask,
  useMemberNames,
  useReorderTasks,
  useTasks,
  useUndoCompletion,
} from '../data/queries'
import { todayLocal } from '../lib/dates'
import { reorderUpdates } from '../lib/order'
import { backlogItems, nextSubtaskOrder, openCount } from '../lib/subtasks'
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
  const addTask = useAddTask()
  const [adding, setAdding] = useState(false)
  const [addingGroup, setAddingGroup] = useState(false)
  const [backdating, setBackdating] = useState<TaskWithLast | null>(null)
  // only the rows you've actually toggled; everything else follows the default
  const [expandOverride, setExpandOverride] = useState<Record<string, boolean>>({})

  const items = backlogItems(tasks ?? [])
  const open = items.filter((i) => !i.done)
  // a deadline is an objective order that beats a hand-arranged one, so dated
  // items lift out of the drag list into their own section, soonest first
  const dated = open
    .filter((i) => i.task.due_on && !i.isGroup)
    .sort((a, b) => (a.task.due_on! < b.task.due_on! ? -1 : 1))
  const anytime = open.filter((i) => !i.task.due_on)
  const todo = openCount(open)
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

  // straight from the row: topping a list up shouldn't cost a trip to a sheet.
  // Ordered against every child, not just the open ones, so an item added after
  // something was ticked still lands at the end.
  const addItem = (group: TaskWithLast, title: string) =>
    addTask.mutate({
      id: crypto.randomUUID(),
      space_id: group.space_id, // RLS and the 0003 trigger want the parent's space
      title,
      notes: null,
      kind: 'oneoff',
      interval_days: null,
      sort_order: nextSubtaskOrder((tasks ?? []).filter((t) => t.parent_id === group.id)),
      parent_id: group.id,
      due_on: null,
      createdBy: uid,
    })

  // A group is a different animal from a backlog item: nothing to complete, so
  // nothing to tick, and its items are always the open ones.
  const row = (i: BacklogItem, handle?: DragHandle, dragging?: boolean) =>
    i.isGroup ? (
      <GroupRow
        key={i.task.id}
        task={i.task}
        spaceName={spaceLabel(i.task.space_id)}
        items={i.subtasks}
        doneCount={i.doneCount}
        expanded={isExpanded(i)}
        onToggleExpand={() => toggleExpand(i.task.id, isExpanded(i))}
        onItemTap={(item) => logDone(item, todayLocal())}
        onItemLongPress={setBackdating}
        onAddItem={(title) => addItem(i.task, title)}
        handle={handle}
        dragging={dragging}
      />
    ) : (
      <BacklogRow
        key={i.task.id}
        task={i.task}
        who={(u) => nameFor(i.task.space_id, u)}
        spaceName={spaceLabel(i.task.space_id)}
        groupName={i.groupName}
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
      <header className="mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-widest text-accent">tin</div>
          <h1 className="text-2xl font-bold">
            {isLoading
              ? 'Loading…'
              : todo === 0
                ? 'Backlog clear'
                : todo === 1
                  ? '1 thing to do'
                  : `${todo} things to do`}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setAddingGroup(true)}
          className="mb-1 h-10 shrink-0 rounded-xl border border-stone-300 px-3 text-sm font-semibold text-stone-600 transition active:scale-[0.98] dark:border-stone-700 dark:text-stone-300"
        >
          + Group
        </button>
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

      {dated.length > 0 && <Section title="Deadlines">{dated.map((i) => row(i))}</Section>}

      {/* the undated pile only needs a name of its own once something is dated */}
      {anytime.length > 0 && (
        <Section title={dated.length > 0 ? 'Anytime' : 'To do'}>
          {anytime.length === 1 ? (
            anytime.map((i) => row(i))
          ) : (
            <SortableList
              items={anytime}
              getId={(i) => i.task.id}
              onReorder={(from, to) =>
                reorder.mutate(reorderUpdates(anytime.map((i) => i.task), from, to))
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
      <NewGroupSheet open={addingGroup} onClose={() => setAddingGroup(false)} />
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
