import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState } from 'react'
import { DEMO, demoSession } from '../lib/demo'
import { supabase } from '../lib/supabase'

export function useSessionState() {
  const [state, setState] = useState<{ loading: boolean; session: Session | null }>({
    loading: !DEMO,
    session: DEMO ? demoSession : null,
  })
  useEffect(() => {
    if (DEMO) return
    void supabase.auth
      .getSession()
      .then(({ data }) => setState({ loading: false, session: data.session }))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setState({ loading: false, session }),
    )
    return () => sub.subscription.unsubscribe()
  }, [])
  return state
}

const SessionCtx = createContext<Session | null>(null)
export const SessionProvider = SessionCtx.Provider

export function useSession(): Session {
  const s = useContext(SessionCtx)
  if (!s) throw new Error('useSession outside SessionProvider')
  return s
}

export function useUid(): string {
  return useSession().user.id
}
