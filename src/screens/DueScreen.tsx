import { useState } from 'react'
import { useUid } from '../auth/useSession'
import { AddTaskSheet } from '../components/AddTaskSheet'
import { BackdateSheet } from '../components/BackdateSheet'
import { BacklogRow, RecurringRow } from '../components/TaskRow'
import { EmptyState, Fab, RowSkeleton, Section } from '../components/ui'
import { useLogDone, useSpaceLabel } from '../data/helpers'
import { useMemberNames, useTasks, useUndoCompletion } from '../data/queries'
import { todayLocal } from '../lib/dates'
import { backlogItems } from '../lib/subtasks'
import type { BacklogItem } from '../lib/subtasks'
import { taskState } from '../lib/task-state'
import type { TaskState } from '../lib/task-state'
import type { TaskWithLast } from '../lib/types'

/** A recurring chore, or a backlog item whose deadline has come into view. */
interface Entry {
  task: TaskWithLast
  item: BacklogItem | null
  s: TaskState
}

export function DueScreen() {
  const uid = useUid()
  const { data: tasks, isLoading } = useTasks()
  const nameFor = useMemberNames(uid)
  const spaceLabel = useSpaceLabel()
  const logDone = useLogDone()
  const undo = useUndoCompletion()
  const [adding, setAdding] = useState(false)
  const [backdating, setBackdating] = useState<TaskWithLast | null>(null)
  const [expandOverride, setExpandOverride] = useState<Record<string, boolean>>({})

  const recurring = (tasks ?? []).filter((t) => t.kind === 'recurring' && !t.archived)
  const entries: Entry[] = [
    ...recurring.map((t) => ({ task: t, item: null, s: taskState(t, t.last?.done_on ?? null) })),
    // Dated backlog items graduate onto this screen once the deadline is inside
    // the soon window; anything further out stays in the backlog, where it isn't
    // yet asking anything of you. Done items (own log or a finished checklist)
    // drop out entirely.
    ...backlogItems(tasks ?? [])
      // a group is never finished, so a deadline on one could never be met
      .filter((i) => !i.done && i.task.due_on && !i.isGroup)
      .map((i) => ({ task: i.task, item: i, s: taskState(i.task, null) }))
      .filter((e) => e.s.urgency !== 'ok'),
  ]

  const bySoonest = (a: Entry, b: Entry) => (a.s.dueIn ?? 0) - (b.s.dueIn ?? 0)
  const dueNow = entries
    .filter((e) => e.s.urgency === 'new' || e.s.urgency === 'due' || e.s.urgency === 'overdue')
    .sort(bySoonest)
  const upcoming = entries.filter((e) => e.s.urgency === 'soon').sort(bySoonest)

  const isExpanded = (i: BacklogItem) => expandOverride[i.task.id] ?? true
  const toggleSubtask = (s: TaskWithLast) =>
    s.last ? undo.mutate({ completionId: s.last.id, taskId: s.id }) : logDone(s, todayLocal())

  const rows = (list: Entry[]) =>
    list.map(({ task: t, item }) =>
      item ? (
        <BacklogRow
          key={t.id}
          task={t}
          who={(u) => nameFor(t.space_id, u)}
          spaceName={spaceLabel(t.space_id)}
          subtasks={item.subtasks}
          doneCount={item.doneCount}
          done={null}
          expanded={isExpanded(item)}
          onToggleExpand={() =>
            setExpandOverride((prev) => ({ ...prev, [t.id]: !isExpanded(item) }))
          }
          onDone={() => logDone(t, todayLocal())}
          onBackdate={() => setBackdating(t)}
          onUndo={() => undo.mutate({ completionId: t.last!.id, taskId: t.id })}
          onSubtaskTap={toggleSubtask}
          onSubtaskLongPress={setBackdating}
        />
      ) : (
        <RecurringRow
          key={t.id}
          task={t}
          who={(u) => nameFor(t.space_id, u)}
          spaceName={spaceLabel(t.space_id)}
          onDone={() => logDone(t, todayLocal())}
          onBackdate={() => setBackdating(t)}
        />
      ),
    )

  return (
    <div className="px-4 pb-36 pt-6">
      <header className="mb-5">
        <div className="text-xs font-bold uppercase tracking-widest text-accent">tin</div>
        <h1 className="text-2xl font-bold">
          {isLoading
            ? 'Loading…'
            : dueNow.length === 0
              ? 'All caught up'
              : dueNow.length === 1
                ? '1 thing due'
                : `${dueNow.length} things due`}
        </h1>
      </header>

      {isLoading && (
        <div className="flex flex-col gap-2">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      )}

      {!isLoading && entries.length === 0 && (
        <EmptyState
          title="No recurring tasks yet"
          hint="Add the stuff you always lose track of — sheets, filters, plants, vacuuming."
        />
      )}

      {dueNow.length > 0 && <Section title="Due now">{rows(dueNow)}</Section>}
      {upcoming.length > 0 && <Section title="Coming up">{rows(upcoming)}</Section>}

      <Fab onClick={() => setAdding(true)} />
      <AddTaskSheet open={adding} onClose={() => setAdding(false)} defaultKind="recurring" />
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
