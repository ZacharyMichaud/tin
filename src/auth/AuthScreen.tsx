import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { inputCls, primaryBtn } from '../components/ui'

export function AuthScreen() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendCode() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setStep('code')
    setCode('')
    setCooldown(30)
  }

  async function verify() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    // success: onAuthStateChange flips the app to the shell
    if (error) setError(error.message)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-2">
        <img src="/icon.svg" alt="" className="h-16 w-16" />
        <h1 className="text-3xl font-bold tracking-tight">tin</h1>
        <p className="text-sm text-stone-500">when did I last…?</p>
      </div>

      {step === 'email' ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void sendCode()
          }}
        >
          <input
            type="email"
            required
            autoFocus
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className={primaryBtn} disabled={busy || !email.includes('@')}>
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void verify()
          }}
        >
          <p className="text-center text-sm text-stone-500">
            Code sent to <b>{email}</b>
          </p>
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className={`${inputCls} text-center text-2xl tracking-[0.4em]`}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button className={primaryBtn} disabled={busy || code.length < 6}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <div className="flex justify-center gap-6 text-sm text-stone-500">
            <button
              type="button"
              disabled={cooldown > 0 || busy}
              className="disabled:opacity-40"
              onClick={() => void sendCode()}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
            <button type="button" onClick={() => setStep('email')}>
              Different email
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  )
}
