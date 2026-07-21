import { useState } from 'react'
import { useUid } from '../auth/useSession'
import { AddTaskSheet } from '../components/AddTaskSheet'
import { BackdateSheet } from '../components/BackdateSheet'
import { BacklogRow } from '../components/TaskRow'
import { EmptyState, Fab, RowSkeleton, Section } from '../components/ui'
import { useLogDone, useSpaceLabel } from '../data/helpers'
import { useMemberNames, useTasks, useUndoCompletion } from '../data/queries'
import { todayLocal } from '../lib/dates'
import type { TaskWithLast } from '../lib/types'

export function BacklogScreen() {
  const uid = useUid()
  const { data: tasks, isLoading } = useTasks()
  const nameFor = useMemberNames(uid)
  const spaceLabel = useSpaceLabel()
  const logDone = useLogDone()
  const undo = useUndoCompletion()
  const [adding, setAdding] = useState(false)
  const [backdating, setBackdating] = useState<TaskWithLast | null>(null)

  const oneoffs = (tasks ?? []).filter((t) => t.kind === 'oneoff' && !t.archived)
  const open = oneoffs.filter((t) => !t.last)
  const done = oneoffs
    .filter((t) => t.last)
    .sort((a, b) => (a.last!.done_on < b.last!.done_on ? 1 : -1))

  const row = (t: TaskWithLast) => (
    <BacklogRow
      key={t.id}
      task={t}
      who={(u) => nameFor(t.space_id, u)}
      spaceName={spaceLabel(t.space_id)}
      onDone={() => logDone(t, todayLocal())}
      onBackdate={() => setBackdating(t)}
      onUndo={() => undo.mutate({ completionId: t.last!.id, taskId: t.id })}
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

      {!isLoading && oneoffs.length === 0 && (
        <EmptyState
          title="Nothing in the backlog"
          hint="One-time stuff lives here: things to buy, fix, book, or email."
        />
      )}

      {open.length > 0 && <Section title="To do">{open.map(row)}</Section>}
      {done.length > 0 && <Section title="Done">{done.map(row)}</Section>}

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
