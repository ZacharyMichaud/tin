// Fractional indexing for the hand-sorted backlog. A drop normally rewrites
// only the moved row's sort_order (the midpoint of its new neighbours), so
// reordering is one UPDATE instead of renumbering the list.

export interface SortUpdate {
  id: string
  sort_order: number
}

interface Sortable {
  id: string
  sort_order: number
}

export function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * sort_order writes for moving `from` → `to` within the visible list.
 * Falls back to renumbering the whole list when doubles run out of room
 * between two neighbours (~50 drops into the same gap).
 */
export function reorderUpdates<T extends Sortable>(
  list: T[],
  from: number,
  to: number,
): SortUpdate[] {
  if (from === to) return []
  const next = arrayMove(list, from, to)
  const before = next[to - 1]?.sort_order
  const after = next[to + 1]?.sort_order

  let value: number
  if (before === undefined && after === undefined) value = 0
  else if (before === undefined) value = after! - 1
  else if (after === undefined) value = before + 1
  else value = (before + after) / 2

  const squeezed = before !== undefined && after !== undefined && (value <= before || value >= after)
  if (squeezed) return next.map((t, i) => ({ id: t.id, sort_order: i }))
  return [{ id: next[to].id, sort_order: value }]
}

/** New tasks land at the top of the list. */
export function topSortOrder(tasks: Pick<Sortable, 'sort_order'>[] | undefined): number {
  if (!tasks?.length) return 0
  return Math.min(...tasks.map((t) => t.sort_order)) - 1
}
