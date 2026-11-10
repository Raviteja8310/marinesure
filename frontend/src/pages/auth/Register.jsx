import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BriefcaseIcon, CheckCircleIcon, ClipboardDocumentCheckIcon, CubeIcon, TruckIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../context/AuthContext'
import { Alert, Button, Field, Input, Select, cx } from '../../components/ui'
import { apiError } from '../../lib/format'
import api from '../../services/api'
import AuthShell from './AuthShell'

// Only self-service roles. Officers and administrators are appointed by an administrator.
const ROLES = [
  { value: 'customer', label: 'Importer / exporter', text: 'Insure your shipments and manage claims.', icon: CubeIcon },
  { value: 'shipping_company', label: 'Shipping company', text: 'Update milestones on assigned shipments.', icon: TruckIcon },
  { value: 'surveyor', label: 'Marine surveyor', text: 'Inspect cargo and file survey reports.', icon: ClipboardDocumentCheckIcon },
  { value: 'agent', label: 'Insurance agent', text: 'Assist customers and track commissions.', icon: BriefcaseIcon },
]

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer', customer_type: 'importer', company_name: '', country: 'India', registration_number: '', agency_name: '', qualification: '', phone: '' })
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res = await register(form)
      setDone({ message: res.data.message, token: res.data.dev_token })
    } catch (err) { setError(apiError(err, 'Registration failed. Please check your details.')) } finally { setLoading(false) }
  }
  const verify = async () => {
    setVerifying(true); setError('')
    try { await api.post('/auth/verify-email', { token: done.token }); navigate('/login') } catch (err) { setError(apiError(err, 'Verification failed.')) } finally { setVerifying(false) }
  }

  if (done) return <AuthShell title="Check your email" subtitle="One more step before you can sign in.">
    <div className="grid gap-5">
      <Alert tone="success" title="Account created">{done.message}</Alert>
      {error && <Alert tone="danger">{error}</Alert>}
      {done.token ? <>
        <p className="text-sm leading-relaxed text-navy-300">This server is running in development mode, so the verification link wasn't emailed. Verify the address here instead.</p>
        <Button onClick={verify} loading={verifying} size="lg" icon={CheckCircleIcon}>Verify email and continue</Button>
      </> : <Button to="/login" size="lg">Go to sign in</Button>}
    </div>
  </AuthShell>

  return <AuthShell title="Create your account" subtitle="Choose how you'll use MarineSure." wide>
    {error && <Alert tone="danger" className="mb-5">{error}</Alert>}
    <form onSubmit={submit} className="grid gap-6">
      <fieldset>
        <legend className="mb-2.5 text-sm font-medium text-navy-200">I am a…</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {ROLES.map((r) => {
            const active = form.role === r.value
            return <label key={r.value} className={cx('flex cursor-pointer gap-3 rounded-xl border p-3.5 transition', active ? 'border-teal-500 bg-teal-400/10' : 'border-navy-700 bg-navy-950/40 hover:border-navy-600')}>
              <input type="radio" name="role" value={r.value} checked={active} onChange={set('role')} className="sr-only" />
              <r.icon className={cx('mt-0.5 h-5 w-5 shrink-0', active ? 'text-teal-300' : 'text-navy-400')} aria-hidden />
              <span><span className="block text-sm font-semibold text-white">{r.label}</span><span className="mt-0.5 block text-xs text-navy-400">{r.text}</span></span>
            </label>
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required><Input required minLength={2} autoComplete="name" value={form.name} onChange={set('name')} /></Field>
        <Field label="Email address" required><Input type="email" required autoComplete="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="Password" hint="At least 8 characters." required><Input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} /></Field>
        <Field label="Phone"><Input type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} /></Field>
      </div>

      {form.role === 'customer' && <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Trade"><Select value={form.customer_type} onChange={set('customer_type')}><option value="importer">Importer</option><option value="exporter">Exporter</option><option value="both">Importer and exporter</option></Select></Field>
        <Field label="Country"><Input autoComplete="country-name" value={form.country} onChange={set('country')} /></Field>
        <Field label="Company name" className="sm:col-span-2"><Input autoComplete="organization" value={form.company_name} onChange={set('company_name')} /></Field>
      </div>}
      {form.role === 'shipping_company' && <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" required><Input required autoComplete="organization" value={form.company_name} onChange={set('company_name')} /></Field>
        <Field label="Registration number"><Input value={form.registration_number} onChange={set('registration_number')} /></Field>
      </div>}
      {form.role === 'surveyor' && <Field label="Qualifications" hint="For example: Master Mariner, IIISLA licence."><Input value={form.qualification} onChange={set('qualification')} /></Field>}
      {form.role === 'agent' && <Field label="Agency name" required><Input required autoComplete="organization" value={form.agency_name} onChange={set('agency_name')} /></Field>}

      <Button type="submit" size="lg" loading={loading} className="w-full">Create account</Button>
      <p className="text-center text-sm text-navy-300">Already registered? <Link to="/login" className="font-semibold text-teal-300 hover:text-teal-200">Sign in</Link></p>
    </form>
  </AuthShell>
}
