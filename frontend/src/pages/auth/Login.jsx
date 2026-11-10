import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../context/AuthContext'
import { homeFor } from '../../routes/ProtectedRoute'
import { Alert, Button, Field, Input, Modal } from '../../components/ui'
import { apiError } from '../../lib/format'
import api from '../../services/api'
import AuthShell from './AuthShell'

// Seeded demo accounts (see backend seed_service); development convenience only.
const DEMO = [
  ['Customer', 'customer@marinesure.com'],
  ['Shipping', 'carrier@marinesure.com'],
  ['Surveyor', 'surveyor@marinesure.com'],
  ['Agent', 'agent@marinesure.com'],
  ['Officer', 'officer@marinesure.com'],
  ['Admin', 'admin@marinesure.com'],
]
const DEMO_PASSWORD = 'MarineSure@2026'

function ForgotPassword({ open, onClose }) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [stage, setStage] = useState('request')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ tone: '', text: '' })
  const reset = () => { setStage('request'); setToken(''); setPassword(''); setMsg({ tone: '', text: '' }); onClose() }
  const request = async (e) => {
    e.preventDefault(); setBusy(true); setMsg({ tone: '', text: '' })
    try {
      const { data } = await api.post('/auth/forgot-password', { email })
      if (data.dev_token) setToken(data.dev_token)
      setStage('reset')
      setMsg({ tone: 'info', text: data.dev_token ? 'Development mode: the reset code has been filled in for you. In production it is emailed.' : data.message })
    } catch (err) { setMsg({ tone: 'danger', text: apiError(err) }) } finally { setBusy(false) }
  }
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg({ tone: '', text: '' })
    try {
      await api.post('/auth/reset-password', { token, new_password: password })
      setStage('done'); setMsg({ tone: 'success', text: 'Password updated. You can sign in with your new password.' })
    } catch (err) { setMsg({ tone: 'danger', text: apiError(err) }) } finally { setBusy(false) }
  }
  return <Modal open={open} onClose={reset} title="Reset your password" description="We'll send a reset code to the email on your account.">
    {msg.text && <Alert tone={msg.tone} className="mb-4">{msg.text}</Alert>}
    {stage === 'request' && <form onSubmit={request} className="grid gap-4">
      <Field label="Email address" required><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Button type="submit" loading={busy}>Send reset code</Button>
    </form>}
    {stage === 'reset' && <form onSubmit={submit} className="grid gap-4">
      <Field label="Reset code" required><Input required minLength={10} value={token} onChange={(e) => setToken(e.target.value)} /></Field>
      <Field label="New password" hint="At least 8 characters." required><Input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <Button type="submit" loading={busy}>Update password</Button>
    </form>}
    {stage === 'done' && <Button onClick={reset} className="w-full">Back to sign in</Button>}
  </Modal>
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState('')
  const [forgot, setForgot] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const signIn = async (targetEmail, targetPassword, key = 'form') => {
    setError(''); setLoading(key)
    try {
      const user = await login(targetEmail, targetPassword)
      navigate(homeFor(user.roles || []))
    } catch (err) {
      setError(err.response?.status === 401 || err.response?.status === 403
        ? apiError(err, 'Email or password is incorrect.')
        : apiError(err, 'Sign-in failed. Please try again.'))
    } finally { setLoading('') }
  }

  return <AuthShell title="Sign in to MarineSure" subtitle="Welcome back. Pick up where your shipments left off.">
    {error && <Alert tone="danger" className="mb-5">{error}</Alert>}
    <form onSubmit={(e) => { e.preventDefault(); signIn(email, password) }} className="grid gap-4" noValidate={false}>
      <Field label="Email address" required>
        <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      </Field>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="login-password" className="text-sm font-medium text-navy-200">Password <span className="text-teal-300">*</span></label>
          <button type="button" onClick={() => setForgot(true)} className="text-xs font-semibold text-teal-300 hover:text-teal-200">Forgot password?</button>
        </div>
        <div className="relative">
          <Input id="login-password" type={show ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-11" />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-navy-400 hover:text-white">
            {show ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <Button type="submit" size="lg" loading={loading === 'form'} disabled={!!loading} className="mt-1 w-full">Sign in</Button>
    </form>

    <p className="mt-6 text-center text-sm text-navy-300">New to MarineSure? <Link to="/register" className="font-semibold text-teal-300 hover:text-teal-200">Create an account</Link></p>

    <div className="mt-7 border-t border-white/10 pt-5">
      <p className="text-xs font-medium text-navy-400">Demo accounts (development data)</p>
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {DEMO.map(([label, demoEmail]) => <button key={label} type="button" disabled={!!loading}
          onClick={() => { setEmail(demoEmail); setPassword(DEMO_PASSWORD); signIn(demoEmail, DEMO_PASSWORD, label) }}
          className="rounded-lg border border-navy-700 bg-navy-950/50 px-2 py-2 text-xs font-semibold text-navy-200 transition hover:border-teal-500/60 hover:text-white disabled:opacity-50">
          {loading === label ? 'Signing in…' : label}
        </button>)}
      </div>
    </div>
    <ForgotPassword open={forgot} onClose={() => setForgot(false)} />
  </AuthShell>
}
