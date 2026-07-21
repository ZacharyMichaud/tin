import { useState } from 'react'
import { useUid } from '../auth/useSession'
import { AddTaskSheet } from '../components/AddTaskSheet'
import { BackdateSheet } from '../components/BackdateSheet'
import { RecurringRow } from '../components/TaskRow'
import { EmptyState, Fab, RowSkeleton, Section } from '../components/ui'
import { useLogDone, useSpaceLabel } from '../data/helpers'
import { useMemberNames, useTasks } from '../data/queries'
import { todayLocal } from '../lib/dates'
import { taskState } from '../lib/task-state'
import type { TaskWithLast } from '../lib/types'

export function DueScreen() {
  const uid = useUid()
  const { data: tasks, isLoading } = useTasks()
  const nameFor = useMemberNames(uid)
  const spaceLabel = useSpaceLabel()
  const logDone = useLogDone()
  const [adding, setAdding] = useState(false)
  const [backdating, setBackdating] = useState<TaskWithLast | null>(null)

  const recurring = (tasks ?? []).filter((t) => t.kind === 'recurring' && !t.archived)
  const withState = recurring.map((t) => ({ t, s: taskState(t, t.last?.done_on ?? null) }))
  const dueNow = withState
    .filter(({ s }) => s.urgency === 'new' || s.urgency === 'due' || s.urgency === 'overdue')
    .sort((a, b) => (a.s.dueIn ?? 0) - (b.s.dueIn ?? 0))
  const upcoming = withState
    .filter(({ s }) => s.urgency === 'ok' || s.urgency === 'soon')
    .sort((a, b) => (a.s.dueIn ?? 0) - (b.s.dueIn ?? 0))

  const rows = (list: typeof withState) =>
    list.map(({ t }) => (
      <RecurringRow
        key={t.id}
        task={t}
        who={(u) => nameFor(t.space_id, u)}
        spaceName={spaceLabel(t.space_id)}
        onDone={() => logDone(t, todayLocal())}
        onBackdate={() => setBackdating(t)}
      />
    ))

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

      {!isLoading && recurring.length === 0 && (
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
