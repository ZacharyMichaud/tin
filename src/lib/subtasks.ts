// Backlog items and their checklists.
//
// A subtask is a one-off task carrying parent_id. Nothing about "done" is
// stored: an item counts as done when it has its own completion (you finished
// the whole thing in one go), or when every subtask has one. Untick a subtask
// and the item comes straight back out of Done, because the answer is recomputed
// rather than remembered.

import type { LastCompletion, TaskWithLast } from './types'

export interface BacklogItem {
  task: TaskWithLast
  subtasks: TaskWithLast[]
  /** The completion that makes this item done — null while it's still open. */
  done: LastCompletion | null
  doneCount: number
}

/** Own completion first; otherwise the last subtask finished, if none are left. */
export function itemDone(
  task: TaskWithLast,
  subtasks: TaskWithLast[],
): LastCompletion | null {
  if (task.last) return task.last
  if (subtasks.length === 0) return null
  let latest: LastCompletion | null = null
  for (const s of subtasks) {
    if (!s.last) return null
    if (!latest || s.last.done_on > latest.done_on) latest = s.last
  }
  return latest
}

/**
 * Top-level backlog items with their checklists attached, keeping the
 * hand-sorted order useTasks returns. Archived tasks drop out on both levels,
 * so archiving a subtask stops it blocking its parent.
 */
export function backlogItems(tasks: TaskWithLast[]): BacklogItem[] {
  const live = tasks.filter((t) => t.kind === 'oneoff' && !t.archived)

  const children = new Map<string, TaskWithLast[]>()
  for (const t of live) {
    if (!t.parent_id) continue
    const siblings = children.get(t.parent_id)
    if (siblings) siblings.push(t)
    else children.set(t.parent_id, [t])
  }
  // checklists read top-down in the order they were added; an optimistic insert
  // lands at the head of the cache, so sort rather than trust arrival order
  for (const siblings of children.values())
    siblings.sort((a, b) => a.sort_order - b.sort_order || (a.created_at < b.created_at ? -1 : 1))

  return live
    .filter((t) => !t.parent_id)
    .map((task) => {
      const subtasks = children.get(task.id) ?? []
      return {
        task,
        subtasks,
        done: itemDone(task, subtasks),
        doneCount: subtasks.filter((s) => s.last).length,
      }
    })
}

/** Where a new subtask goes: the end of its parent's checklist. */
export function nextSubtaskOrder(subtasks: TaskWithLast[]): number {
  if (subtasks.length === 0) return 0
  return Math.max(...subtasks.map((s) => s.sort_order)) + 1
}
