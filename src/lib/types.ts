// Hand-written to match supabase/migrations/0001_init.sql.
// Replace with `supabase gen types typescript` output once the project exists.

export type TaskKind = 'recurring' | 'oneoff'

export type Database = {
  public: {
    Tables: {
      spaces: {
        Row: {
          id: string
          name: string
          join_code: string
          is_personal: boolean
          created_by: string
          created_at: string
        }
        Insert: { name: string; is_personal?: boolean }
        Update: { name?: string }
        Relationships: []
      }
      space_members: {
        Row: {
          space_id: string
          user_id: string
          display_name: string
          joined_at: string
        }
        Insert: { space_id: string; user_id: string; display_name: string }
        Update: { display_name?: string }
        Relationships: [
          {
            foreignKeyName: 'space_members_space_id_fkey'
            columns: ['space_id']
            isOneToOne: false
            referencedRelation: 'spaces'
            referencedColumns: ['id']
          },
        ]
      }
      tasks: {
        Row: {
          id: string
          space_id: string
          title: string
          notes: string | null
          kind: TaskKind
          interval_days: number | null
          archived: boolean
          // fractional index for the hand-sorted backlog (see 0002 migration)
          sort_order: number
          // set on subtasks: the backlog task they hang off (0003; one level only)
          parent_id: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          space_id: string
          title: string
          notes?: string | null
          kind: TaskKind
          interval_days?: number | null
          sort_order?: number
          parent_id?: string | null
        }
        Update: {
          title?: string
          notes?: string | null
          kind?: TaskKind
          interval_days?: number | null
          archived?: boolean
          sort_order?: number
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_space_id_fkey'
            columns: ['space_id']
            isOneToOne: false
            referencedRelation: 'spaces'
            referencedColumns: ['id']
          },
        ]
      }
      task_completions: {
        Row: {
          id: string
          task_id: string
          done_by: string
          done_on: string
          created_at: string
        }
        Insert: { id?: string; task_id: string; done_on: string }
        Update: { done_on?: string }
        Relationships: [
          {
            foreignKeyName: 'task_completions_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      join_space: { Args: { code: string }; Returns: string }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type SpaceRow = Database['public']['Tables']['spaces']['Row']
export type MemberRow = Database['public']['Tables']['space_members']['Row']
export type TaskRow = Database['public']['Tables']['tasks']['Row']
export type CompletionRow = Database['public']['Tables']['task_completions']['Row']

export type LastCompletion = Pick<CompletionRow, 'id' | 'done_on' | 'done_by'>
export type TaskWithLast = TaskRow & { last: LastCompletion | null }
export type SpaceWithMembers = SpaceRow & { space_members: MemberRow[] }
