import { daysBetween, daysSince, todayLocal } from './dates'
import type { TaskRow } from './types'

export type Urgency = 'new' | 'ok' | 'soon' | 'due' | 'overdue'

export interface TaskState {
  daysSince: number | null
  dueIn: number | null
  urgency: Urgency
}

/**
 * How far ahead a deadline starts nagging. Recurring tasks scale their window
 * off the interval; a deadline has no interval, so "this week" is the window.
 */
export const DEADLINE_SOON_DAYS = 7

function urgencyFor(dueIn: number, soonWindow: number): Urgency {
  return dueIn < 0 ? 'overdue' : dueIn === 0 ? 'due' : dueIn <= soonWindow ? 'soon' : 'ok'
}

/** Countdown for a dated one-off, in the same shape the due list sorts on. */
export function deadlineState(dueOn: string): { dueIn: number; urgency: Urgency } {
  const dueIn = daysBetween(todayLocal(), dueOn)
  return { dueIn, urgency: urgencyFor(dueIn, DEADLINE_SOON_DAYS) }
}

export function taskState(
  task: Pick<TaskRow, 'kind' | 'interval_days' | 'due_on'>,
  lastDoneOn: string | null,
): TaskState {
  if (task.kind !== 'recurring') {
    const ds = lastDoneOn ? daysSince(lastDoneOn) : null
    // a finished one-off has no deadline left to miss
    if (ds !== null) return { daysSince: ds, dueIn: null, urgency: 'ok' }
    if (!task.due_on) return { daysSince: null, dueIn: null, urgency: 'new' }
    return { daysSince: null, ...deadlineState(task.due_on) }
  }
  // never logged: recurring tasks surface as due so the clock gets anchored
  if (!lastDoneOn) return { daysSince: null, dueIn: 0, urgency: 'new' }
  const ds = daysSince(lastDoneOn)
  if (!task.interval_days) return { daysSince: ds, dueIn: null, urgency: 'ok' }
  const dueIn = task.interval_days - ds
  const soonWindow = Math.min(7, Math.max(1, Math.round(task.interval_days * 0.25)))
  return { daysSince: ds, dueIn, urgency: urgencyFor(dueIn, soonWindow) }
}

export function dueText(state: TaskState): string {
  if (state.urgency === 'new') return 'not logged yet'
  if (state.dueIn === null) return ''
  if (state.dueIn < 0) return `${-state.dueIn}d late`
  if (state.dueIn === 0) return 'due today'
  return `due in ${state.dueIn}d`
}

// full literal class strings so Tailwind picks them up
export const urgencyBadge: Record<Urgency, string> = {
  new: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  ok: 'bg-stone-500/10 text-stone-500 dark:text-stone-400',
  soon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  due: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  overdue: 'bg-red-500/15 text-red-600 dark:text-red-400',
}

export const urgencyDot: Record<Urgency, string> = {
  new: 'bg-sky-500',
  ok: 'bg-stone-400',
  soon: 'bg-amber-500',
  due: 'bg-orange-500',
  overdue: 'bg-red-500',
}

/** Same scale as the badges, for a deadline sitting inline in a subtitle. */
export const urgencyText: Record<Urgency, string> = {
  new: 'text-sky-600 dark:text-sky-400',
  ok: 'text-stone-500',
  soon: 'text-amber-600 dark:text-amber-400',
  due: 'text-orange-600 dark:text-orange-400',
  overdue: 'text-red-600 dark:text-red-400',
}
