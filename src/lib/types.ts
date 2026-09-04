// The curated layer over ./database.types.ts (generated — `npm run types:gen`).
//
// Column shapes are no longer hand-maintained: they come from the live schema,
// so a migration that lands without a matching type edit stops compiling. What
// stays by hand is the two things `gen types` genuinely cannot see:
//
//   1. `kind` is `text` + a CHECK constraint rather than a Postgres enum, so it
//      generates as plain `string`. Narrowed back to a union here — taking the
//      generated type as-is would quietly lose that safety.
//   2. Column-level grants decide what a client may write. The generated
//      Insert/Update types list every column, including server-controlled ones
//      (`created_by`, `done_by`), because grants aren't part of the schema it
//      introspects. The writable shapes below match the grants in the
//      migrations, so writing an ungranted column is a type error here rather
//      than a runtime failure.

import type { Database } from './database.types'

export type { Database }

export type TaskKind = 'recurring' | 'oneoff'

type Tables = Database['public']['Tables']

export type SpaceRow = Tables['spaces']['Row']
export type MemberRow = Tables['space_members']['Row']
export type CompletionRow = Tables['task_completions']['Row']

export type TaskRow = Omit<Tables['tasks']['Row'], 'kind'> & { kind: TaskKind }

/** Columns a client is granted on insert (0001, plus the additive grants since). */
export type TaskInsert = Pick<
  Tables['tasks']['Insert'],
  'id' | 'space_id' | 'title' | 'notes' | 'interval_days' | 'sort_order' | 'parent_id' | 'due_on' | 'is_group'
> & { kind: TaskKind }

/** Columns a client is granted on update. */
export type TaskUpdate = Partial<
  Pick<
    Tables['tasks']['Update'],
    'title' | 'notes' | 'interval_days' | 'archived' | 'sort_order' | 'parent_id' | 'due_on' | 'is_group'
  > & { kind: TaskKind }
>

export type LastCompletion = Pick<CompletionRow, 'id' | 'done_on' | 'done_by'>
export type TaskWithLast = TaskRow & { last: LastCompletion | null }
export type SpaceWithMembers = SpaceRow & { space_members: MemberRow[] }
