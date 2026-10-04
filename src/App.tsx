import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthScreen } from './auth/AuthScreen'
import { SessionProvider, useSessionState } from './auth/useSession'
import { SnackbarProvider } from './components/Snackbar'
import { primaryBtn } from './components/ui'
import { useEnsurePersonalSpace } from './data/queries'
import { useRealtimeSync } from './data/realtime'
import { DEMO, seedDemo } from './lib/demo'
import { configured } from './lib/supabase'
import { HomeScreen } from './screens/HomeScreen'
import { ManageScreen } from './screens/ManageScreen'
import { TaskDetailScreen } from './screens/TaskDetailScreen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})
if (DEMO) seedDemo(queryClient)

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SnackbarProvider>
        <BrowserRouter>
          <Root />
        </BrowserRouter>
      </SnackbarProvider>
    </QueryClientProvider>
  )
}

function Root() {
  const { session, loading } = useSessionState()
  if (!configured && !DEMO) return <SetupNotice />
  if (loading) return <Splash />
  if (!session) return <AuthScreen />
  return (
    <SessionProvider value={session}>
      <Shell />
    </SessionProvider>
  )
}

function Shell() {
  useRealtimeSync()
  useEnsurePersonalSpace()
  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        {/* Due and Backlog were merged into the home list */}
        <Route path="/backlog" element={<Navigate to="/" replace />} />
        <Route path="/manage" element={<ManageScreen />} />
        <Route path="/task/:id" element={<TaskDetailScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <img src="/icon.svg" alt="" className="h-16 w-16 animate-pulse" />
    </div>
  )
}

function SetupNotice() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <img src="/icon.svg" alt="" className="h-14 w-14" />
      <h1 className="text-2xl font-bold">tin isn’t connected yet</h1>
      <p className="text-stone-500">
        Copy <code>.env.example</code> to <code>.env.local</code>, fill in your Supabase URL and
        anon key, and restart the dev server. Full setup steps are in the README.
      </p>
      <button
        className={primaryBtn}
        onClick={() => {
          sessionStorage.setItem('tin-demo', '1')
          window.location.reload()
        }}
      >
        Browse the demo instead
      </button>
    </div>
  )
}
