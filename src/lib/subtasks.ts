// Backlog items: checklists and groups.
//
// A subtask is a one-off task carrying parent_id. Nothing about "done" is
// stored: an item counts as done when it has its own completion (you finished
// the whole thing in one go), or when every subtask has one. Untick a subtask
// and the item comes straight back out of Done, because the answer is recomputed
// rather than remembered.
//
// A group (is_group, see 0005) reuses that parent/child shape but rolls up the
// opposite way. It's a bucket you keep refilling — "things to buy" — so it
// never counts as done however much of it you tick off, and never leaves the
// list. Its items aren't steps of one job, they're ordinary tasks filed
// together: tick one and it leaves the group to stand on its own in Done, where
// undo puts it back where it was.

import type { LastCompletion, TaskWithLast } from './types'

export interface BacklogItem {
  task: TaskWithLast
  /** A group's still-open items; a checklist parent's subtasks, ticked or not. */
  subtasks: TaskWithLast[]
  /** The completion that makes this done — always null for a group. */
  done: LastCompletion | null
  /** Ticked children. For a group these have already left `subtasks`. */
  doneCount: number
  isGroup: boolean
  /** Set on a ticked item lifted out of a group: the group it came from. */
  groupName?: string
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
 * Everything the Backlog screen shows as a row of its own, keeping the
 * hand-sorted order useTasks returns: top-level items, groups, and the ticked
 * items that have left a group. Archived tasks drop out at both levels, so
 * archiving a subtask stops it blocking its parent.
 */
export function backlogItems(tasks: TaskWithLast[]): BacklogItem[] {
  const live = tasks.filter((t) => t.kind === 'oneoff' && !t.archived)
  const byId = new Map(live.map((t) => [t.id, t]))

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

  const items: BacklogItem[] = []
  for (const task of live) {
    if (task.parent_id) {
      // A ticked group item leaves the group and stands on its own in Done —
      // that's where undo lives once the snackbar is gone. A checklist subtask
      // never does: ticked or not it belongs to its parent's row.
      const parent = byId.get(task.parent_id)
      if (parent?.is_group && task.last)
        items.push({
          task,
          subtasks: [],
          done: task.last,
          doneCount: 0,
          isGroup: false,
          groupName: parent.title,
        })
      continue
    }

    const kids = children.get(task.id) ?? []
    const doneCount = kids.filter((k) => k.last).length
    items.push(
      task.is_group
        ? {
            task,
            subtasks: kids.filter((k) => !k.last), // the ticked ones have left
            done: null, // a bucket is never finished, however empty it gets
            doneCount,
            isGroup: true,
          }
        : { task, subtasks: kids, done: itemDone(task, kids), doneCount, isGroup: false },
    )
  }
  return items
}

/**
 * What the header counts. A checklist parent is one thing to do however many
 * steps it breaks into; a group is none of its own, because it's a container —
 * its open items are the real tasks, so they count one apiece.
 */
export function openCount(open: BacklogItem[]): number {
  return open.reduce((n, i) => n + (i.isGroup ? i.subtasks.length : 1), 0)
}

/** Where a new subtask goes: the end of its parent's checklist. */
export function nextSubtaskOrder(subtasks: TaskWithLast[]): number {
  if (subtasks.length === 0) return 0
  return Math.max(...subtasks.map((s) => s.sort_order)) + 1
}
