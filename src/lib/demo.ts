// Demo mode (?demo=1 or VITE_DEMO=1): fake session + seeded local data so the
// UI is browsable with no Supabase project. Mutations become cache-only.

import type { QueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { addDays, todayLocal } from './dates'
import type { CompletionRow, SpaceWithMembers, TaskWithLast } from './types'

const qs = new URLSearchParams(window.location.search)
if (qs.get('demo') === '0') sessionStorage.removeItem('tin-demo')
else if (qs.has('demo')) sessionStorage.setItem('tin-demo', '1')

export const DEMO =
  import.meta.env.VITE_DEMO === '1' || sessionStorage.getItem('tin-demo') === '1'

export const DEMO_ME = 'demo-zach'
const SAM = 'demo-sam'

export const demoSession = {
  user: { id: DEMO_ME, email: 'you@demo.tin' },
} as unknown as Session

export function exitDemo(): void {
  sessionStorage.removeItem('tin-demo')
  window.location.replace('/?demo=0')
}

export function seedDemo(qc: QueryClient): void {
  const now = new Date().toISOString()
  const today = todayLocal()

  const spaces: SpaceWithMembers[] = [
    {
      id: 'sp-personal', name: 'Personal', join_code: 'PERSNL', is_personal: true,
      created_by: DEMO_ME, created_at: now,
      space_members: [
        { space_id: 'sp-personal', user_id: DEMO_ME, display_name: 'zach', joined_at: now },
      ],
    },
    {
      id: 'sp-apt', name: 'Apartment', join_code: 'K4T3AU', is_personal: false,
      created_by: DEMO_ME, created_at: now,
      space_members: [
        { space_id: 'sp-apt', user_id: DEMO_ME, display_name: 'zach', joined_at: now },
        { space_id: 'sp-apt', user_id: SAM, display_name: 'sam', joined_at: now },
      ],
    },
  ]

  // parent: the backlog item a subtask hangs off (see 0003_subtasks.sql)
  // GROUPS: buckets rather than tasks — is_group in 0005
  const GROUPS = new Set<string>(['tk-shop'])
  const defs = [
    { id: 'tk-fountain', space: 'sp-apt', title: 'Cat fountain filter', kind: 'recurring', interval: 14, notes: 'Wash the pump too', parent: null, due: null, history: [[16, SAM], [31, DEMO_ME], [44, DEMO_ME]] },
    { id: 'tk-plants', space: 'sp-apt', title: 'Water the plants', kind: 'recurring', interval: 3, notes: null, parent: null, due: null, history: [[3, DEMO_ME], [6, SAM], [10, DEMO_ME]] },
    { id: 'tk-vacuum', space: 'sp-apt', title: 'Vacuum living room', kind: 'recurring', interval: 7, notes: null, parent: null, due: null, history: [[2, SAM], [8, DEMO_ME]] },
    { id: 'tk-sheets', space: 'sp-personal', title: 'Wash sheets', kind: 'recurring', interval: 30, notes: null, parent: null, due: null, history: [[12, DEMO_ME], [41, DEMO_ME]] },
    { id: 'tk-litter', space: 'sp-apt', title: 'Deep-clean litter box', kind: 'recurring', interval: 7, notes: null, parent: null, due: null, history: [] },
    { id: 'tk-pillow', space: 'sp-personal', title: 'Buy a new pillow', kind: 'oneoff', interval: null, notes: 'Side-sleeper, medium-firm', parent: null, due: null, history: [] },
    { id: 'tk-trip', space: 'sp-personal', title: 'Plan the Montreal trip', kind: 'oneoff', interval: null, notes: null, parent: null, due: 5, history: [] },
    { id: 'tk-trip-hotel', space: 'sp-personal', title: 'Book the hotel', kind: 'oneoff', interval: null, notes: null, parent: 'tk-trip', due: null, history: [[4, DEMO_ME]] },
    { id: 'tk-trip-train', space: 'sp-personal', title: 'Buy train tickets', kind: 'oneoff', interval: null, notes: null, parent: 'tk-trip', due: null, history: [[2, DEMO_ME]] },
    { id: 'tk-trip-sitter', space: 'sp-personal', title: 'Ask Marie about the cat', kind: 'oneoff', interval: null, notes: null, parent: 'tk-trip', due: null, history: [] },
    { id: 'tk-trip-resto', space: 'sp-personal', title: 'Pick a restaurant for Saturday', kind: 'oneoff', interval: null, notes: null, parent: 'tk-trip', due: null, history: [] },
    { id: 'tk-hydro', space: 'sp-apt', title: 'Send Sam the hydro bill', kind: 'oneoff', interval: null, notes: null, parent: null, due: -2, history: [] },
    { id: 'tk-curtain', space: 'sp-apt', title: 'Replace shower curtain liner', kind: 'oneoff', interval: null, notes: null, parent: null, due: 45, history: [] },
    { id: 'tk-catfood', space: 'sp-apt', title: 'Order cat food', kind: 'oneoff', interval: null, notes: null, parent: null, due: null, history: [[3, SAM]] },
    // a group: a bucket that never completes, so it stays put however much
    // gets ticked off it (see 0005_task_groups.sql)
    { id: 'tk-shop', space: 'sp-apt', title: 'Things to buy', kind: 'oneoff', interval: null, notes: null, parent: null, due: null, history: [] },
    { id: 'tk-shop-filters', space: 'sp-apt', title: 'Cat fountain filters', kind: 'oneoff', interval: null, notes: null, parent: 'tk-shop', due: null, history: [] },
    { id: 'tk-shop-soap', space: 'sp-apt', title: 'Dish soap', kind: 'oneoff', interval: null, notes: null, parent: 'tk-shop', due: null, history: [] },
    { id: 'tk-shop-bulbs', space: 'sp-apt', title: 'Lightbulbs for the kitchen', kind: 'oneoff', interval: null, notes: null, parent: 'tk-shop', due: null, history: [] },
    // bought yesterday, so it has left the group for the Done section
    { id: 'tk-shop-coffee', space: 'sp-apt', title: 'Coffee beans', kind: 'oneoff', interval: null, notes: null, parent: 'tk-shop', due: null, history: [[1, SAM]] },
    // every subtask done, so the item sits in Done without a log of its own
    { id: 'tk-bike', space: 'sp-apt', title: 'Get the bike road-ready', kind: 'oneoff', interval: null, notes: null, parent: null, due: null, history: [] },
    { id: 'tk-bike-tube', space: 'sp-apt', title: 'Patch the back tube', kind: 'oneoff', interval: null, notes: null, parent: 'tk-bike', due: null, history: [[6, DEMO_ME]] },
    { id: 'tk-bike-brakes', space: 'sp-apt', title: 'New brake pads', kind: 'oneoff', interval: null, notes: null, parent: 'tk-bike', due: null, history: [[5, SAM]] },
  ] as const

  let n = 0
  const tasks: TaskWithLast[] = []
  for (const d of defs) {
    const history: CompletionRow[] = d.history.map(([ago, by]) => ({
      id: `demo-comp-${++n}`,
      task_id: d.id,
      done_by: by,
      done_on: addDays(today, -ago),
      created_at: now,
    }))
    qc.setQueryData(['history', d.id], history)
    tasks.push({
      id: d.id, space_id: d.space, title: d.title, notes: d.notes, kind: d.kind,
      interval_days: d.interval, archived: false, sort_order: tasks.length,
      parent_id: d.parent, is_group: GROUPS.has(d.id),
      due_on: d.due === null ? null : addDays(today, d.due),
      created_by: DEMO_ME, created_at: now,
      last: history[0]
        ? { id: history[0].id, done_on: history[0].done_on, done_by: history[0].done_by }
        : null,
    })
  }

  qc.setQueryData(['spaces'], spaces)
  qc.setQueryData(['tasks'], tasks)
}
