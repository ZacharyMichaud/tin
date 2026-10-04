import { useUid } from '../auth/useSession'
import { useSnackbar } from '../components/Snackbar'
import { fmtDue } from '../lib/dates'
import { oneoffPlace } from '../lib/home'
import type { TaskWithLast } from '../lib/types'
import { useCompleteTask, useSpaces, useUndoCompletion, useUpdateTask } from './queries'

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

type Pinnable = Pick<TaskWithLast, 'id' | 'title' | 'due_on' | 'pinned_at'>

/**
 * Pin a one-off to Up next, or unpin it, with the same haptic + undo snackbar
 * as logging. The snackbar names where the row went, since unpinning can send
 * it to either half of the list (or nowhere, if its deadline keeps it up next).
 * Undo writes the previous value back rather than toggling, so two quick taps
 * and two undos can't leave it the wrong way round.
 */
export function usePin() {
  const update = useUpdateTask()
  const snackbar = useSnackbar()

  return (task: Pinnable, pin: boolean) => {
    const prev = task.pinned_at ?? null
    navigator.vibrate?.(10)
    update.mutate(
      { id: task.id, patch: { pinned_at: pin ? new Date().toISOString() : null } },
      { onError: () => snackbar('Couldn’t save — check your connection') },
    )
    const place = oneoffPlace({ due_on: task.due_on, pinned_at: null })
    snackbar(
      pin
        ? `Pinned “${task.title}” to Up next`
        : place === 'upNext'
          ? `Unpinned — still up next, due ${fmtDue(task.due_on!)}`
          : `Moved “${task.title}” to ${place === 'comingUp' ? 'Coming up' : 'Backlog'}`,
      {
        label: 'Undo',
        onClick: () => update.mutate({ id: task.id, patch: { pinned_at: prev } }),
      },
    )
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
