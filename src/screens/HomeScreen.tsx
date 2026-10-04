import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useUid } from '../auth/useSession'
import { AddTaskSheet } from '../components/AddTaskSheet'
import { BackdateSheet } from '../components/BackdateSheet'
import { GroupRow } from '../components/GroupRow'
import { NewGroupSheet } from '../components/NewGroupSheet'
import type { DragHandle } from '../components/SortableList'
import { SortableList } from '../components/SortableList'
import { OneOffRow, RecurringRow } from '../components/TaskRow'
import { EmptyState, Fab, RowSkeleton, Section, secondaryBtn } from '../components/ui'
import { useLogDone, useSpaceLabel } from '../data/helpers'
import {
  useAddTask,
  useMemberNames,
  useReorderTasks,
  useTasks,
  useUndoCompletion,
} from '../data/queries'
import { todayLocal } from '../lib/dates'
import { homeSections, nextUpLine, upNextBreakdown } from '../lib/home'
import type { HomeEntry, UpNextBreakdown } from '../lib/home'
import { reorderUpdates } from '../lib/order'
import { nextSubtaskOrder } from '../lib/subtasks'
import { urgencyDot } from '../lib/task-state'
import type { TaskWithLast } from '../lib/types'

// Which of the lower sections are folded. Remembered per device, and only a
// convenience — blocked storage just means the defaults every time.
const FOLD_KEY = 'tin-home-sections'
type Foldable = 'comingUp' | 'backlog' | 'done'
const FOLD_DEFAULTS: Record<Foldable, boolean> = { comingUp: false, backlog: false, done: true }

function readFolds(): Record<Foldable, boolean> {
  try {
    const saved = JSON.parse(localStorage.getItem(FOLD_KEY) ?? '{}')
    return { ...FOLD_DEFAULTS, ...saved }
  } catch {
    return FOLD_DEFAULTS
  }
}

// One dot per kind of reason a row is up next, in the urgency colours the rows
// use, so the line under the header adds up to the number in it.
const SEGMENTS: { key: keyof UpNextBreakdown; dot: string }[] = [
  { key: 'overdue', dot: urgencyDot.overdue },
  { key: 'today', dot: urgencyDot.due },
  { key: 'new', dot: urgencyDot.new },
  { key: 'soon', dot: urgencyDot.soon },
  { key: 'pinned', dot: 'bg-accent' },
]

function SlidersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  )
}

/**
 * The one list: chores and one-offs together, from what needs doing now down
 * to someday. Placement lives in lib/home.ts; this screen only lays it out.
 */
export function HomeScreen() {
  const uid = useUid()
  const { data: tasks, isLoading, isError, refetch } = useTasks()
  const nameFor = useMemberNames(uid)
  const spaceLabel = useSpaceLabel()
  const logDone = useLogDone()
  const undo = useUndoCompletion()
  const reorder = useReorderTasks()
  const addTask = useAddTask()
  const [adding, setAdding] = useState(false)
  // what a new group starts with; null while the sheet is closed
  const [newGroup, setNewGroup] = useState<{ title: string; spaceId: string | null } | null>(null)
  const [backdating, setBackdating] = useState<TaskWithLast | null>(null)
  // only the rows you've actually toggled; everything else follows its section
  const [expandOverride, setExpandOverride] = useState<Record<string, boolean>>({})
  const [folds, setFolds] = useState(readFolds)

  const { upNext, comingUp, backlog, done } = homeSections(tasks ?? [])
  const total = upNext.length + comingUp.length + backlog.length + done.length
  const failed = isError && !tasks

  function toggleFold(k: Foldable) {
    const next = { ...folds, [k]: !folds[k] }
    setFolds(next)
    try {
      localStorage.setItem(FOLD_KEY, JSON.stringify(next))
    } catch {
      // private mode: it just won't be remembered
    }
  }

  const toggleSubtask = (s: TaskWithLast) =>
    s.last ? undo.mutate({ completionId: s.last.id, taskId: s.id }) : logDone(s, todayLocal())

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

  // Checklists open by default only up next, where what's left is the point;
  // lower down a ring and a "2 left" say enough. A group always starts open:
  // its inline "add an item" row is the reason it's a card at all.
  const row = (e: HomeEntry, openByDefault: boolean, handle?: DragHandle, dragging?: boolean) => {
    const { task: t, item: i } = e
    const who = (u: string) => nameFor(t.space_id, u)
    if (!i)
      return (
        <RecurringRow
          key={t.id}
          task={t}
          who={who}
          spaceName={spaceLabel(t.space_id)}
          onDone={() => logDone(t, todayLocal())}
          onBackdate={() => setBackdating(t)}
        />
      )
    const expanded = expandOverride[t.id] ?? (openByDefault || i.isGroup)
    const onToggleExpand = () => setExpandOverride((prev) => ({ ...prev, [t.id]: !expanded }))
    // A group is a different animal: nothing to complete, so nothing to tick,
    // and its items are always the open ones.
    return i.isGroup ? (
      <GroupRow
        key={t.id}
        task={t}
        spaceName={spaceLabel(t.space_id)}
        items={i.subtasks}
        doneCount={i.doneCount}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        onItemTap={(item) => logDone(item, todayLocal())}
        onItemLongPress={setBackdating}
        onAddItem={(title) => addItem(t, title)}
        handle={handle}
        dragging={dragging}
      />
    ) : (
      <OneOffRow
        key={t.id}
        task={t}
        who={who}
        spaceName={spaceLabel(t.space_id)}
        groupName={i.groupName}
        subtasks={i.subtasks}
        doneCount={i.doneCount}
        done={i.done}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        onDone={() => logDone(t, todayLocal())}
        onBackdate={() => setBackdating(t)}
        onUndo={() => undo.mutate({ completionId: t.last!.id, taskId: t.id })}
        onSubtaskTap={toggleSubtask}
        onSubtaskLongPress={setBackdating}
        handle={handle}
        dragging={dragging}
      />
    )
  }

  const heading = isLoading
    ? 'Loading…'
    : failed
      ? 'Couldn’t load your tasks'
      : total === 0
        ? 'Nothing yet'
        : upNext.length === 0
          ? 'All caught up'
          : upNext.length === 1
            ? '1 thing up next'
            : `${upNext.length} things up next`

  const breakdown = upNextBreakdown(upNext)
  const next = upNext.length === 0 ? nextUpLine(comingUp) : null

  return (
    // the bottom padding clears the snackbar (which sits above the FAB) and the
    // home indicator, so the last row's done button is never under an Undo
    <div className="px-4 pt-6 pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-widest text-accent">tin</div>
          <h1 className="text-2xl font-bold">{heading}</h1>
          {upNext.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-stone-500">
              {SEGMENTS.filter((g) => breakdown[g.key] > 0).map((g) => (
                <span key={g.key} className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${g.dot}`} />
                  {breakdown[g.key]} {g.key}
                </span>
              ))}
            </div>
          )}
          {next && <p className="mt-1 truncate text-sm text-stone-500">{next}</p>}
          {failed && (
            <button className={`${secondaryBtn} mt-3`} onClick={() => void refetch()}>
              Try again
            </button>
          )}
        </div>
        <Link
          to="/manage"
          aria-label="Spaces & account"
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-400 active:bg-stone-100 dark:text-stone-500 dark:active:bg-stone-800"
        >
          <SlidersIcon />
        </Link>
      </header>

      {isLoading && (
        <div className="flex flex-col gap-2">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      )}

      {!isLoading && !failed && total === 0 && (
        <EmptyState
          title="Nothing to track yet"
          hint="Add a chore you keep losing track of — sheets, filters, plants — or a one-time thing to get done."
        >
          <button
            className="h-11 px-3 text-sm font-semibold text-accent"
            onClick={() => setNewGroup({ title: '', spaceId: null })}
          >
            or start a group, like things to buy
          </button>
        </EmptyState>
      )}

      {/* no label: the heading above is this section's title */}
      {upNext.length > 0 && (
        <div className="mb-8 flex flex-col gap-2">{upNext.map((e) => row(e, true))}</div>
      )}

      {comingUp.length > 0 && (
        <Section
          title="Coming up"
          count={comingUp.length}
          collapsed={folds.comingUp}
          onToggle={() => toggleFold('comingUp')}
        >
          {comingUp.map((e) => row(e, false))}
        </Section>
      )}

      {backlog.length > 0 && (
        <Section
          title="Backlog"
          count={backlog.length}
          collapsed={folds.backlog}
          onToggle={() => toggleFold('backlog')}
        >
          {backlog.length === 1 ? (
            row(backlog[0], false)
          ) : (
            <SortableList
              items={backlog}
              getId={(e) => e.task.id}
              onReorder={(from, to) =>
                reorder.mutate(reorderUpdates(backlog.map((e) => e.task), from, to))
              }
            >
              {(e, handle, dragging) => row(e, false, handle, dragging)}
            </SortableList>
          )}
        </Section>
      )}

      {done.length > 0 && (
        <Section
          title="Done"
          count={done.length}
          collapsed={folds.done}
          onToggle={() => toggleFold('done')}
        >
          {done.map((e) => row(e, false))}
        </Section>
      )}

      <Fab onClick={() => setAdding(true)} />
      <AddTaskSheet
        open={adding}
        onClose={() => setAdding(false)}
        defaultKind="oneoff"
        onMakeGroup={setNewGroup}
      />
      <NewGroupSheet
        open={newGroup !== null}
        onClose={() => setNewGroup(null)}
        initialName={newGroup?.title}
        initialSpaceId={newGroup?.spaceId}
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
