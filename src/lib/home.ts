// The home list: every live task placed in exactly one section, running from
// "now" to "someday".
//
//   Up next   — late, due today, never logged, or due within UP_NEXT_DAYS on
//               its own clock (chores and deadlines alike), plus every one-off
//               you've pinned
//   Coming up — every other chore, and deadlines further out, soonest first
//   Backlog   — undated one-offs and groups, in your own order
//   Done      — one-offs the log says are finished
//
// Placement is one decision per row (place() below) rather than a filter per
// section, so a row can't fall between two filters and vanish — the way
// not-yet-due chores once dropped off the Due tab (348a591). Like everything
// else it's recomputed from the log and the user-set attributes on every
// render; nothing about where a row sits is stored except the pin.

import { addDays, fmtDue, todayLocal } from './dates'
import { backlogItems } from './subtasks'
import type { BacklogItem } from './subtasks'
import { deadlineState, isPressing, taskState, UP_NEXT_DAYS } from './task-state'
import type { TaskState } from './task-state'
import type { TaskRow, TaskWithLast } from './types'

export interface HomeEntry {
  task: TaskWithLast
  /** A one-off's roll-up (checklist, group, done); null for a chore. */
  item: BacklogItem | null
  s: TaskState
}

export interface HomeSections {
  upNext: HomeEntry[]
  comingUp: HomeEntry[]
  backlog: HomeEntry[]
  done: HomeEntry[]
}

export type Place = keyof HomeSections

/**
 * Where an open one-off sits. A pin puts it up next whatever its date; without
 * one, a deadline places it by how close it is, and no deadline means backlog.
 * Also names the destination after an add or an unpin.
 */
export function oneoffPlace(t: Pick<TaskRow, 'due_on' | 'pinned_at'>): Exclude<Place, 'done'> {
  if (t.pinned_at) return 'upNext'
  if (!t.due_on) return 'backlog'
  return isPressing({ daysSince: null, ...deadlineState(t.due_on) }) ? 'upNext' : 'comingUp'
}

function place(e: HomeEntry): Place {
  // a chore always has a clock, so it's either pressing or coming up
  if (!e.item) return isPressing(e.s) ? 'upNext' : 'comingUp'
  if (e.item.done) return 'done'
  // a bucket never finishes and has no date to come due on
  if (e.item.isGroup) return 'backlog'
  return oneoffPlace(e.task)
}

const time = (iso: string | null) => (iso ? Date.parse(iso) : 0)

const byHandOrder = (a: HomeEntry, b: HomeEntry) =>
  a.task.sort_order - b.task.sort_order || (a.task.created_at < b.task.created_at ? 1 : -1)

const choresFirst = (a: HomeEntry, b: HomeEntry) => Number(!!a.item) - Number(!!b.item)

/** Same-day order in Up next: dated rows, then never-logged chores, then undated pins. */
function tier(e: HomeEntry): number {
  if (e.s.dueIn === null) return 2
  return e.s.urgency === 'new' ? 1 : 0
}

// Most urgent first. A pinned row with a date sorts by that date — the pin
// decides that it's up next, never how high — and an undated pin counts as
// today, oldest pin first, so a stale one doesn't sink out of sight.
function upNextOrder(a: HomeEntry, b: HomeEntry): number {
  return (
    (a.s.dueIn ?? 0) - (b.s.dueIn ?? 0) ||
    tier(a) - tier(b) ||
    choresFirst(a, b) ||
    time(a.task.pinned_at) - time(b.task.pinned_at) ||
    byHandOrder(a, b)
  )
}

function comingUpOrder(a: HomeEntry, b: HomeEntry): number {
  // a legacy chore with no interval has no next date; it goes last
  const da = a.s.dueIn ?? Infinity
  const db = b.s.dueIn ?? Infinity
  if (da !== db) return da - db
  return choresFirst(a, b) || byHandOrder(a, b)
}

const doneOrder = (a: HomeEntry, b: HomeEntry) =>
  b.item!.done!.done_on.localeCompare(a.item!.done!.done_on) ||
  (a.task.created_at < b.task.created_at ? 1 : -1)

export function homeSections(tasks: TaskWithLast[]): HomeSections {
  const entries: HomeEntry[] = [
    ...tasks
      .filter((t) => t.kind === 'recurring' && !t.archived)
      .map((t) => ({ task: t, item: null, s: taskState(t, t.last?.done_on ?? null) })),
    // an open one-off has no log of its own, so its state is just its deadline
    ...backlogItems(tasks).map((i) => ({ task: i.task, item: i, s: taskState(i.task, null) })),
  ]

  const out: HomeSections = { upNext: [], comingUp: [], backlog: [], done: [] }
  for (const e of entries) out[place(e)].push(e)
  out.upNext.sort(upNextOrder)
  out.comingUp.sort(comingUpOrder)
  out.backlog.sort(byHandOrder)
  out.done.sort(doneOrder)
  return out
}

export interface UpNextBreakdown {
  overdue: number
  today: number
  new: number
  soon: number
  pinned: number
}

/** The header's split of Up next. Every row lands in exactly one bucket, so they sum to the count. */
export function upNextBreakdown(upNext: HomeEntry[]): UpNextBreakdown {
  const b: UpNextBreakdown = { overdue: 0, today: 0, new: 0, soon: 0, pinned: 0 }
  for (const { task, s } of upNext) {
    if (task.kind === 'recurring' && s.urgency === 'new') b.new++
    // up next only because of the pin: no date, or one that isn't close yet
    else if (s.dueIn === null || s.dueIn > UP_NEXT_DAYS) b.pinned++
    else if (s.dueIn < 0) b.overdue++
    else if (s.dueIn === 0) b.today++
    else b.soon++
  }
  return b
}

/** "Next: Vacuum living room, due Friday" — what's coming once Up next is clear. */
export function nextUpLine(comingUp: HomeEntry[]): string | null {
  const first = comingUp[0]
  if (!first || first.s.dueIn === null) return null
  const on = first.task.due_on ?? addDays(todayLocal(), first.s.dueIn)
  return `Next: ${first.task.title}, due ${fmtDue(on)}`
}
