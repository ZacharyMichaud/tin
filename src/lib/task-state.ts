import { daysSince } from './dates'
import type { TaskRow } from './types'

export type Urgency = 'new' | 'ok' | 'soon' | 'due' | 'overdue'

export interface TaskState {
  daysSince: number | null
  dueIn: number | null
  urgency: Urgency
}

export function taskState(
  task: Pick<TaskRow, 'kind' | 'interval_days'>,
  lastDoneOn: string | null,
): TaskState {
  if (!lastDoneOn) {
    // never logged: recurring tasks surface as due so the clock gets anchored
    return { daysSince: null, dueIn: task.kind === 'recurring' ? 0 : null, urgency: 'new' }
  }
  const ds = daysSince(lastDoneOn)
  if (task.kind !== 'recurring' || !task.interval_days) {
    return { daysSince: ds, dueIn: null, urgency: 'ok' }
  }
  const dueIn = task.interval_days - ds
  const soonWindow = Math.min(7, Math.max(1, Math.round(task.interval_days * 0.25)))
  const urgency: Urgency =
    dueIn < 0 ? 'overdue' : dueIn === 0 ? 'due' : dueIn <= soonWindow ? 'soon' : 'ok'
  return { daysSince: ds, dueIn, urgency }
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
