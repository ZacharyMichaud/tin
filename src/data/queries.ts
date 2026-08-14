import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { DEMO } from '../lib/demo'
import type { SortUpdate } from '../lib/order'
import { supabase } from '../lib/supabase'
import type {
  CompletionRow,
  Database,
  LastCompletion,
  SpaceWithMembers,
  TaskKind,
  TaskRow,
  TaskWithLast,
} from '../lib/types'

export const keys = {
  spaces: ['spaces'] as const,
  tasks: ['tasks'] as const,
  history: (taskId: string) => ['history', taskId] as const,
}

// In demo mode every query is disabled and the caches are pre-seeded;
// mutations skip the network and only run their optimistic cache updates.

export function useSpaces() {
  return useQuery({
    queryKey: keys.spaces,
    enabled: !DEMO,
    queryFn: async (): Promise<SpaceWithMembers[]> => {
      const { data, error } = await supabase
        .from('spaces')
        .select('*, space_members(*)')
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as SpaceWithMembers[]
    },
  })
}

type RawTask = TaskRow & { task_completions: LastCompletion[] }

/** All tasks (archived included — screens filter) with their latest completion. */
export function useTasks() {
  return useQuery({
    queryKey: keys.tasks,
    enabled: !DEMO,
    queryFn: async (): Promise<TaskWithLast[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_completions(id, done_on, done_by)')
        // hand-sorted order (backlog); created_at breaks ties for everything else
        .order('sort_order')
        .order('created_at', { ascending: false })
        .order('done_on', { referencedTable: 'task_completions', ascending: false })
        .limit(1, { referencedTable: 'task_completions' })
      if (error) throw error
      return ((data ?? []) as unknown as RawTask[]).map(({ task_completions, ...t }) => ({
        ...t,
        last: task_completions[0] ?? null,
      }))
    },
  })
}

export function useHistory(taskId: string) {
  return useQuery({
    queryKey: keys.history(taskId),
    enabled: !DEMO,
    queryFn: async (): Promise<CompletionRow[]> => {
      const { data, error } = await supabase
        .from('task_completions')
        .select('*')
        .eq('task_id', taskId)
        .order('done_on', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

/** "who did it" labels: (spaceId, userId) → display name, 'you' for self. */
export function useMemberNames(uid: string) {
  const { data: spaces } = useSpaces()
  return useMemo(() => {
    const names = new Map<string, string>()
    for (const s of spaces ?? [])
      for (const m of s.space_members) names.set(`${s.id}:${m.user_id}`, m.display_name)
    return (spaceId: string, userId: string) =>
      userId === uid ? 'you' : (names.get(`${spaceId}:${userId}`) ?? 'someone')
  }, [spaces, uid])
}

// ── completions ─────────────────────────────────────────────────────────

export interface CompleteVars {
  id: string // client-generated uuid so undo works before the server replies
  taskId: string
  doneOn: string
  doneBy: string
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: CompleteVars) => {
      if (DEMO) return
      const { error } = await supabase
        .from('task_completions')
        .insert({ id: v.id, task_id: v.taskId, done_on: v.doneOn })
      if (error) throw error
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: keys.tasks })
      await qc.cancelQueries({ queryKey: keys.history(v.taskId) })
      const prevTasks = qc.getQueryData<TaskWithLast[]>(keys.tasks)
      const prevHistory = qc.getQueryData<CompletionRow[]>(keys.history(v.taskId))
      const entry: LastCompletion = { id: v.id, done_on: v.doneOn, done_by: v.doneBy }
      qc.setQueryData<TaskWithLast[]>(keys.tasks, (old) =>
        old?.map((t) =>
          t.id === v.taskId && (!t.last || v.doneOn >= t.last.done_on) ? { ...t, last: entry } : t,
        ),
      )
      qc.setQueryData<CompletionRow[]>(keys.history(v.taskId), (old) =>
        old
          ? [{ ...entry, task_id: v.taskId, created_at: new Date().toISOString() }, ...old].sort(
              (a, b) => (a.done_on < b.done_on ? 1 : -1),
            )
          : old,
      )
      return { prevTasks, prevHistory }
    },
    onError: (_e, v, ctx) => {
      qc.setQueryData(keys.tasks, ctx?.prevTasks)
      qc.setQueryData(keys.history(v.taskId), ctx?.prevHistory)
    },
    onSettled: (_d, _e, v) => {
      if (DEMO) return
      void qc.invalidateQueries({ queryKey: keys.tasks })
      void qc.invalidateQueries({ queryKey: keys.history(v.taskId) })
    },
  })
}

export function useUndoCompletion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { completionId: string; taskId: string }) => {
      if (DEMO) return
      const { error } = await supabase.from('task_completions').delete().eq('id', v.completionId)
      if (error) throw error
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: keys.tasks })
      await qc.cancelQueries({ queryKey: keys.history(v.taskId) })
      const prevTasks = qc.getQueryData<TaskWithLast[]>(keys.tasks)
      const prevHistory = qc.getQueryData<CompletionRow[]>(keys.history(v.taskId))
      const nextHistory = prevHistory?.filter((c) => c.id !== v.completionId)
      if (nextHistory) qc.setQueryData(keys.history(v.taskId), nextHistory)
      qc.setQueryData<TaskWithLast[]>(keys.tasks, (old) =>
        old?.map((t) => {
          if (t.id !== v.taskId || t.last?.id !== v.completionId) return t
          const next = nextHistory?.[0]
          return {
            ...t,
            last: next ? { id: next.id, done_on: next.done_on, done_by: next.done_by } : null,
          }
        }),
      )
      return { prevTasks, prevHistory }
    },
    onError: (_e, v, ctx) => {
      qc.setQueryData(keys.tasks, ctx?.prevTasks)
      qc.setQueryData(keys.history(v.taskId), ctx?.prevHistory)
    },
    onSettled: (_d, _e, v) => {
      if (DEMO) return
      void qc.invalidateQueries({ queryKey: keys.tasks })
      void qc.invalidateQueries({ queryKey: keys.history(v.taskId) })
    },
  })
}

// ── tasks ───────────────────────────────────────────────────────────────

export interface AddTaskVars {
  id: string
  space_id: string
  title: string
  notes: string | null
  kind: TaskKind
  interval_days: number | null
  sort_order: number
  parent_id: string | null
  createdBy: string
}

export function useAddTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: AddTaskVars) => {
      if (DEMO) return
      const { error } = await supabase.from('tasks').insert({
        id: v.id,
        space_id: v.space_id,
        title: v.title,
        notes: v.notes,
        kind: v.kind,
        interval_days: v.interval_days,
        sort_order: v.sort_order,
        parent_id: v.parent_id,
      })
      if (error) throw error
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: keys.tasks })
      const prevTasks = qc.getQueryData<TaskWithLast[]>(keys.tasks)
      const row: TaskWithLast = {
        id: v.id, space_id: v.space_id, title: v.title, notes: v.notes, kind: v.kind,
        interval_days: v.interval_days, archived: false, sort_order: v.sort_order,
        parent_id: v.parent_id, created_by: v.createdBy,
        created_at: new Date().toISOString(), last: null,
      }
      qc.setQueryData<TaskWithLast[]>(keys.tasks, (old) => [row, ...(old ?? [])])
      if (DEMO) qc.setQueryData(keys.history(v.id), [])
      return { prevTasks }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(keys.tasks, ctx?.prevTasks),
    onSettled: () => {
      if (!DEMO) void qc.invalidateQueries({ queryKey: keys.tasks })
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; patch: Database['public']['Tables']['tasks']['Update'] }) => {
      if (DEMO) return
      const { error } = await supabase.from('tasks').update(v.patch).eq('id', v.id)
      if (error) throw error
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: keys.tasks })
      const prevTasks = qc.getQueryData<TaskWithLast[]>(keys.tasks)
      qc.setQueryData<TaskWithLast[]>(keys.tasks, (old) =>
        old?.map((t) => (t.id === v.id ? { ...t, ...v.patch } : t)),
      )
      return { prevTasks }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(keys.tasks, ctx?.prevTasks),
    onSettled: () => {
      if (!DEMO) void qc.invalidateQueries({ queryKey: keys.tasks })
    },
  })
}

/** Writes the sort_order(s) a drag produced (usually exactly one row). */
export function useReorderTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (updates: SortUpdate[]) => {
      if (DEMO) return
      for (const u of updates) {
        const { error } = await supabase
          .from('tasks')
          .update({ sort_order: u.sort_order })
          .eq('id', u.id)
        if (error) throw error
      }
    },
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: keys.tasks })
      const prevTasks = qc.getQueryData<TaskWithLast[]>(keys.tasks)
      const next = new Map(updates.map((u) => [u.id, u.sort_order]))
      qc.setQueryData<TaskWithLast[]>(keys.tasks, (old) =>
        old
          ?.map((t) => (next.has(t.id) ? { ...t, sort_order: next.get(t.id)! } : t))
          .sort((a, b) => a.sort_order - b.sort_order || (a.created_at < b.created_at ? 1 : -1)),
      )
      return { prevTasks }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(keys.tasks, ctx?.prevTasks),
    onSettled: () => {
      if (!DEMO) void qc.invalidateQueries({ queryKey: keys.tasks })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string }) => {
      if (DEMO) return
      const { error } = await supabase.from('tasks').delete().eq('id', v.id)
      if (error) throw error
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: keys.tasks })
      const prevTasks = qc.getQueryData<TaskWithLast[]>(keys.tasks)
      // the FK cascades to subtasks server-side; drop them here too
      qc.setQueryData<TaskWithLast[]>(keys.tasks, (old) =>
        old?.filter((t) => t.id !== v.id && t.parent_id !== v.id),
      )
      return { prevTasks }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(keys.tasks, ctx?.prevTasks),
    onSettled: () => {
      if (!DEMO) void qc.invalidateQueries({ queryKey: keys.tasks })
    },
  })
}

// ── spaces (rare ops, no optimism; blocked in demo) ─────────────────────

function demoBlock(): never {
  throw new Error('Not available in the demo')
}

export function useCreateSpace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { name: string; is_personal?: boolean }) => {
      if (DEMO) demoBlock()
      const { data, error } = await supabase.from('spaces').insert(v).select().single()
      if (error) throw error
      return data
    },
    onSettled: () => {
      if (!DEMO) void qc.invalidateQueries({ queryKey: keys.spaces })
    },
  })
}

export function useJoinSpace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { code: string }) => {
      if (DEMO) demoBlock()
      const { data, error } = await supabase.rpc('join_space', { code: v.code })
      if (error) throw error
      return data
    },
    onSettled: () => {
      if (DEMO) return
      void qc.invalidateQueries({ queryKey: keys.spaces })
      void qc.invalidateQueries({ queryKey: keys.tasks })
    },
  })
}

export function useLeaveSpace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { spaceId: string; uid: string }) => {
      if (DEMO) demoBlock()
      const { error } = await supabase
        .from('space_members')
        .delete()
        .eq('space_id', v.spaceId)
        .eq('user_id', v.uid)
      if (error) throw error
    },
    onSettled: () => {
      if (DEMO) return
      void qc.invalidateQueries({ queryKey: keys.spaces })
      void qc.invalidateQueries({ queryKey: keys.tasks })
    },
  })
}

export function useDeleteSpace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { spaceId: string }) => {
      if (DEMO) demoBlock()
      const { error } = await supabase.from('spaces').delete().eq('id', v.spaceId)
      if (error) throw error
    },
    onSettled: () => {
      if (DEMO) return
      void qc.invalidateQueries({ queryKey: keys.spaces })
      void qc.invalidateQueries({ queryKey: keys.tasks })
    },
  })
}

export function useRenameSpace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { spaceId: string; name: string }) => {
      if (DEMO) demoBlock()
      const { error } = await supabase.from('spaces').update({ name: v.name }).eq('id', v.spaceId)
      if (error) throw error
    },
    onSettled: () => {
      if (!DEMO) void qc.invalidateQueries({ queryKey: keys.spaces })
    },
  })
}

export function useSetDisplayName() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { spaceId: string; uid: string; name: string }) => {
      if (DEMO) demoBlock()
      const { error } = await supabase
        .from('space_members')
        .update({ display_name: v.name })
        .eq('space_id', v.spaceId)
        .eq('user_id', v.uid)
      if (error) throw error
    },
    onSettled: () => {
      if (!DEMO) void qc.invalidateQueries({ queryKey: keys.spaces })
    },
  })
}

/** Auto-creates the personal space on first login. */
export function useEnsurePersonalSpace() {
  const { data: spaces } = useSpaces()
  const create = useCreateSpace()
  const ran = useRef(false)
  useEffect(() => {
    if (DEMO || !spaces || ran.current) return
    if (!spaces.some((s) => s.is_personal)) {
      ran.current = true
      // unique index makes a two-device race fail the second insert; ignore it
      create.mutate({ name: 'Personal', is_personal: true }, { onError: () => {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaces])
}
