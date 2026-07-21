import { useUid } from '../auth/useSession'
import { useSnackbar } from '../components/Snackbar'
import type { TaskWithLast } from '../lib/types'
import { useCompleteTask, useSpaces, useUndoCompletion } from './queries'

/** One-tap logging with haptic + undo snackbar; shared by every screen. */
export function useLogDone() {
  const uid = useUid()
  const complete = useCompleteTask()
  const undo = useUndoCompletion()
  const snackbar = useSnackbar()

  return (task: TaskWithLast, doneOn: string) => {
    const id = crypto.randomUUID()
    navigator.vibrate?.(15)
    complete.mutate(
      { id, taskId: task.id, doneOn, doneBy: uid },
      { onError: () => snackbar('Couldn’t save — check your connection') },
    )
    snackbar(`Logged “${task.title}”`, {
      label: 'Undo',
      onClick: () => undo.mutate({ completionId: id, taskId: task.id }),
    })
  }
}

/** Space chip label: only for shared spaces, and only when there's >1 space. */
export function useSpaceLabel() {
  const { data: spaces } = useSpaces()
  return (spaceId: string): string | undefined => {
    if (!spaces || spaces.length <= 1) return undefined
    const sp = spaces.find((s) => s.id === spaceId)
    return sp && !sp.is_personal ? sp.name : undefined
  }
}
