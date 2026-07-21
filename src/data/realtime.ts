import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { DEMO } from '../lib/demo'
import { supabase } from '../lib/supabase'
import { keys } from './queries'

/** Refreshes local data when anyone in a shared space logs/edits. RLS scopes events. */
export function useRealtimeSync() {
  const qc = useQueryClient()
  useEffect(() => {
    if (DEMO) return
    const tasksChanged = () => {
      void qc.invalidateQueries({ queryKey: keys.tasks })
      void qc.invalidateQueries({ queryKey: ['history'] })
    }
    const spacesChanged = () => void qc.invalidateQueries({ queryKey: keys.spaces })
    const channel = supabase
      .channel('tin-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, tasksChanged)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions' }, tasksChanged)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spaces' }, spacesChanged)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'space_members' }, spacesChanged)
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc])
}
