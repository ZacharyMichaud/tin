import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSession, useUid } from '../auth/useSession'
import { useSnackbar } from '../components/Snackbar'
import { cardCls, inputCls, primaryBtn, Section, secondaryBtn } from '../components/ui'
import {
  useCreateSpace,
  useDeleteSpace,
  useDeleteTask,
  useJoinSpace,
  useLeaveSpace,
  useRenameSpace,
  useSetDisplayName,
  useSpaces,
  useTasks,
  useUpdateTask,
} from '../data/queries'
import { DEMO, exitDemo } from '../lib/demo'
import { supabase } from '../lib/supabase'

export function ManageScreen() {
  const session = useSession()
  const uid = useUid()
  const { data: spaces } = useSpaces()
  const { data: tasks } = useTasks()
  const snackbar = useSnackbar()

  const createSpace = useCreateSpace()
  const joinSpace = useJoinSpace()
  const leaveSpace = useLeaveSpace()
  const deleteSpace = useDeleteSpace()
  const renameSpace = useRenameSpace()
  const setDisplayName = useSetDisplayName()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const [mode, setMode] = useState<'idle' | 'newSpace' | 'joinSpace'>('idle')
  const [text, setText] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [namingIn, setNamingIn] = useState<string | null>(null)

  const archived = (tasks ?? []).filter((t) => t.archived)

  function demoGuard(): boolean {
    if (DEMO) snackbar('Not available in the demo')
    return DEMO
  }

  function copyCode(code: string) {
    void navigator.clipboard
      .writeText(code)
      .then(() => snackbar('Code copied — send it to your roommate'))
  }

  function submitNewSpace(e: FormEvent) {
    e.preventDefault()
    if (demoGuard() || !text.trim()) return
    createSpace.mutate(
      { name: text.trim() },
      {
        onSuccess: (s) => {
          snackbar(`“${s.name}” created — share its code from below`)
          setMode('idle')
        },
        onError: () => snackbar('Couldn’t create the space'),
      },
    )
  }

  function submitJoin(e: FormEvent) {
    e.preventDefault()
    if (demoGuard() || !text.trim()) return
    joinSpace.mutate(
      { code: text.trim() },
      {
        onSuccess: () => {
          snackbar('Joined!')
          setMode('idle')
        },
        onError: () => snackbar('No space with that code'),
      },
    )
  }

  return (
    <div className="px-4 pb-36 pt-6">
      <header className="mb-5">
        <div className="text-xs font-bold uppercase tracking-widest text-accent">tin</div>
        <h1 className="text-2xl font-bold">Manage</h1>
      </header>

      {DEMO && (
        <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-500/10 p-4 text-sm dark:border-sky-900">
          Demo mode — everything here is fake and local.{' '}
          <button className="font-semibold text-accent" onClick={exitDemo}>
            Exit demo
          </button>
        </div>
      )}

      <Section title="Spaces">
        {(spaces ?? []).map((s) => (
          <div key={s.id} className={`${cardCls} flex flex-col gap-3 p-4`}>
            {renaming === s.id ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (demoGuard() || !text.trim()) return
                  renameSpace.mutate({ spaceId: s.id, name: text.trim() })
                  setRenaming(null)
                }}
              >
                <input
                  className={`${inputCls} h-10 flex-1`}
                  value={text}
                  autoFocus
                  onChange={(e) => setText(e.target.value)}
                />
                <button className="text-sm font-semibold text-accent">Save</button>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {s.name}
                  {s.is_personal && (
                    <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-normal text-stone-500 dark:bg-stone-800">
                      personal
                    </span>
                  )}
                </span>
                <button
                  className="text-sm text-stone-400"
                  onClick={() => {
                    setText(s.name)
                    setRenaming(s.id)
                  }}
                >
                  Rename
                </button>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              {s.space_members.map((m) =>
                namingIn === s.id && m.user_id === uid ? (
                  <form
                    key={m.user_id}
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (demoGuard() || !text.trim()) return
                      setDisplayName.mutate({ spaceId: s.id, uid, name: text.trim() })
                      setNamingIn(null)
                    }}
                  >
                    <input
                      className={`${inputCls} h-10 flex-1`}
                      value={text}
                      autoFocus
                      onChange={(e) => setText(e.target.value)}
                    />
                    <button className="text-sm font-semibold text-accent">Save</button>
                  </form>
                ) : (
                  <div key={m.user_id} className="flex items-center justify-between text-sm">
                    <span className="text-stone-600 dark:text-stone-300">
                      {m.display_name}
                      {m.user_id === uid && <span className="text-stone-400"> (you)</span>}
                    </span>
                    {m.user_id === uid && (
                      <button
                        className="text-stone-400"
                        onClick={() => {
                          setText(m.display_name)
                          setNamingIn(s.id)
                        }}
                      >
                        Edit name
                      </button>
                    )}
                  </div>
                ),
              )}
            </div>

            {!s.is_personal && (
              <button
                className="flex items-center justify-between rounded-xl bg-stone-100 px-3 py-2.5 text-sm dark:bg-stone-800"
                onClick={() => copyCode(s.join_code)}
              >
                <span className="text-stone-500">Invite code (tap to copy)</span>
                <span className="font-mono font-bold tracking-widest">{s.join_code}</span>
              </button>
            )}

            {!s.is_personal && (
              <div className="flex gap-4 text-sm">
                <button
                  className="text-stone-400"
                  onClick={() => {
                    if (demoGuard()) return
                    if (!window.confirm(`Leave “${s.name}”?`)) return
                    leaveSpace.mutate({ spaceId: s.id, uid })
                  }}
                >
                  Leave
                </button>
                {s.created_by === uid && (
                  <button
                    className="text-red-600"
                    onClick={() => {
                      if (demoGuard()) return
                      if (!window.confirm(`Delete “${s.name}” and all its tasks for everyone?`))
                        return
                      deleteSpace.mutate({ spaceId: s.id })
                    }}
                  >
                    Delete space
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {mode === 'idle' && (
          <div className="flex gap-2">
            <button
              className={`${secondaryBtn} flex-1 text-sm`}
              onClick={() => {
                setText('')
                setMode('newSpace')
              }}
            >
              New shared space
            </button>
            <button
              className={`${secondaryBtn} flex-1 text-sm`}
              onClick={() => {
                setText('')
                setMode('joinSpace')
              }}
            >
              Join with code
            </button>
          </div>
        )}
        {mode === 'newSpace' && (
          <form className="flex gap-2" onSubmit={submitNewSpace}>
            <input
              className={`${inputCls} flex-1`}
              placeholder="Space name (e.g. Apartment)"
              value={text}
              autoFocus
              onChange={(e) => setText(e.target.value)}
            />
            <button className={primaryBtn}>Create</button>
          </form>
        )}
        {mode === 'joinSpace' && (
          <form className="flex gap-2" onSubmit={submitJoin}>
            <input
              className={`${inputCls} flex-1 font-mono uppercase tracking-widest`}
              placeholder="ABC123"
              value={text}
              autoFocus
              onChange={(e) => setText(e.target.value)}
            />
            <button className={primaryBtn}>Join</button>
          </form>
        )}
      </Section>

      {archived.length > 0 && (
        <Section title="Archived tasks">
          {archived.map((t) => (
            <div key={t.id} className={`${cardCls} flex items-center justify-between gap-3 p-3 text-sm`}>
              <span className="min-w-0 truncate">{t.title}</span>
              <div className="flex shrink-0 gap-3">
                <button
                  className="font-semibold text-accent"
                  onClick={() => updateTask.mutate({ id: t.id, patch: { archived: false } })}
                >
                  Restore
                </button>
                <button
                  className="font-semibold text-red-600"
                  onClick={() => {
                    if (!window.confirm(`Delete “${t.title}” and its history?`)) return
                    deleteTask.mutate({ id: t.id })
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </Section>
      )}

      <Section title="Account">
        <div className={`${cardCls} flex items-center justify-between gap-3 p-4 text-sm`}>
          <span className="min-w-0 truncate text-stone-500">{session.user.email}</span>
          <button
            className="shrink-0 font-semibold text-red-600"
            onClick={() => {
              if (DEMO) exitDemo()
              else void supabase.auth.signOut()
            }}
          >
            Sign out
          </button>
        </div>
      </Section>
    </div>
  )
}
