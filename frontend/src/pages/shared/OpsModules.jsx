import React, { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import { DataTable, ErrorNotice, Shell } from './OperationalPages'

// ── Small UI primitives ──────────────────────────────────────────

const inr = (v) => (v === null || v === undefined || v === '' ? '—' : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const when = (v) => (v ? new Date(v.endsWith?.('Z') || v.includes?.('+') ? v : `${v}Z`).toLocaleString() : '—')
const errText = (e, fallback) => {
  const d = e?.response?.data?.detail
  if (Array.isArray(d)) return d.map((x) => `${(x.loc || []).slice(-1)[0]}: ${x.msg}`).join('; ')
  return d || fallback
}

const PILL = {
  paid: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', matched: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', resolved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', scheduled: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  open: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', in_progress: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  created: 'bg-amber-500/15 text-amber-300 border-amber-500/30', inactive: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  closed: 'bg-slate-500/15 text-slate-300 border-slate-500/30', cancelled: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  failed: 'bg-rose-500/15 text-rose-300 border-rose-500/30', mismatched: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  rejected: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
}
export const Pill = ({ value }) => <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${PILL[value] || 'border-slate-600 text-slate-300'}`}>{String(value || '—').replaceAll('_', ' ')}</span>
const Card = ({ title, actions, children, className = '' }) => <section className={`rounded-xl border border-slate-800 bg-slate-900/70 p-5 ${className}`}>{(title || actions) && <div className="mb-4 flex flex-wrap items-center justify-between gap-2">{title && <h2 className="text-base font-semibold text-white">{title}</h2>}<div className="flex gap-2">{actions}</div></div>}{children}</section>
const Btn = ({ kind = 'primary', className = '', ...p }) => <button {...p} className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${kind === 'primary' ? 'bg-cyan-700 text-white hover:bg-cyan-600' : kind === 'danger' ? 'border border-rose-700 text-rose-300 hover:bg-rose-900/30' : 'border border-slate-700 text-slate-200 hover:bg-slate-800'} ${className}`} />
const Input = (p) => <input {...p} className={`w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 ${p.className || ''}`} />
const Select = ({ children, ...p }) => <select {...p} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500">{children}</select>
const TextArea = (p) => <textarea {...p} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
const Field = ({ label, children, className = '' }) => <label className={`grid gap-1 text-sm text-slate-300 ${className}`}>{label}{children}</label>
const Success = ({ message }) => (message ? <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</div> : null)
const Empty = ({ children }) => <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">{children}</div>
const Table = ({ head, children }) => <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="min-w-full text-left text-sm"><thead className="bg-slate-900 text-slate-400"><tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}</tr></thead><tbody className="text-slate-200">{children}</tbody></table></div>
const Td = ({ children, className = '' }) => <td className={`border-t border-slate-800 px-4 py-3 align-top ${className}`}>{children}</td>

function useLoad(path, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => {
    if (!path) return
    setLoading(true); setError('')
    api.get(path).then((r) => setData(r.data)).catch((e) => setError(errText(e, 'Unable to load data.'))).finally(() => setLoading(false))
  }, [path])
  useEffect(reload, [reload, ...deps])
  return { data, error, loading, reload, setError }
}

// ── Customer: payments ───────────────────────────────────────────

export function PaymentsPage() {
  const { data, error, loading } = useLoad('/payments')
  const rows = data || []
  const paid = rows.filter((r) => r.status === 'paid')
  return <Shell title="Payment History" role="customer">
    <p className="mb-5 text-sm text-slate-400">Premium payments made from your account, with gateway receipts.</p>
    <ErrorNotice message={error} />
    <div className="mb-5 grid gap-4 sm:grid-cols-3">
      <Card><p className="text-xs uppercase text-slate-400">Payments</p><p className="mt-1 text-2xl font-bold text-white">{rows.length}</p></Card>
      <Card><p className="text-xs uppercase text-slate-400">Total paid</p><p className="mt-1 text-2xl font-bold text-white">{inr(paid.reduce((s, r) => s + Number(r.amount), 0))}</p></Card>
      <Card><p className="text-xs uppercase text-slate-400">Awaiting payment</p><p className="mt-1 text-2xl font-bold text-white">{rows.filter((r) => r.status !== 'paid').length}</p></Card>
    </div>
    {loading ? <Empty>Loading payments…</Empty> : !rows.length ? <Empty>No payments yet.</Empty> :
      <Table head={['Order', 'Policy', 'Amount', 'Status', 'Receipt', 'Paid at']}>
        {rows.map((r) => <tr key={r.id}><Td>{r.order_reference}<div className="text-xs text-slate-500">{r.gateway_order_id}</div></Td><Td>{r.policy_number || '—'}</Td><Td>{inr(r.amount)}</Td><Td><Pill value={r.status} /></Td><Td className="font-mono text-xs">{r.receipt_reference || '—'}</Td><Td>{when(r.paid_at)}</Td></tr>)}
      </Table>}
  </Shell>
}

// ── Settlements (customer view and officer management) ───────────

export function SettlementsPage({ staff = false }) {
  const { data, error, loading, reload, setError } = useLoad(staff ? '/settlements' : '/settlements/me')
  const [busy, setBusy] = useState('')
  const [ok, setOk] = useState('')
  const act = async (s, action) => {
    let body
    if (action === 'mark-failed') {
      const reason = window.prompt(`Why did the payout for ${s.settlement_number} fail?`)
      if (!reason) return
      body = { reason }
    } else {
      const ref = window.prompt(`New bank/UTR reference for re-sent payout of ${inr(s.net_amount)}:`)
      if (!ref) return
      body = { payout_reference: ref }
    }
    setBusy(s.id); setError(''); setOk('')
    try { await api.post(`/settlements/${s.id}/${action}`, body); setOk(action === 'retry' ? 'Payout re-sent and posted to the ledger.' : 'Payout marked failed; ledger entry reversed.'); reload() } catch (e) { setError(errText(e, 'Action failed.')) } finally { setBusy('') }
  }
  const rows = data || []
  return <Shell title={staff ? 'Settlement Management' : 'My Settlements'} role={staff ? 'officer' : 'customer'}>
    <p className="mb-5 text-sm text-slate-400">{staff ? 'Claim payouts. Marking a payout failed reverses its ledger entry; retrying posts a new one.' : 'Payouts for your approved claims.'}</p>
    <ErrorNotice message={error} /><Success message={ok} />
    {loading ? <Empty>Loading settlements…</Empty> : !rows.length ? <Empty>No settlements yet. Settlements appear once an approved claim is paid out.</Empty> :
      <Table head={['Settlement', 'Claim', 'Approved', 'Deductible', 'Net paid', 'Status', 'Reference', 'Reconciled', ...(staff ? ['Actions'] : [])]}>
        {rows.map((s) => <tr key={s.id}>
          <Td>{s.settlement_number}<div className="text-xs text-slate-500">{when(s.paid_at)}</div></Td><Td>{s.claim_number}</Td><Td>{inr(s.approved_amount)}</Td><Td>{inr(s.deductible_amount)}</Td><Td className="font-semibold">{inr(s.net_amount)}</Td>
          <Td><Pill value={s.status} />{s.failure_reason && <div className="mt-1 max-w-[14rem] text-xs text-rose-300">{s.failure_reason}</div>}</Td>
          <Td className="font-mono text-xs">{s.payout_reference || '—'}</Td><Td>{s.reconciled ? '✓' : '—'}</Td>
          {staff && <Td className="whitespace-nowrap">{s.status === 'paid' ? <Btn kind="danger" disabled={busy === s.id} onClick={() => act(s, 'mark-failed')}>Mark failed</Btn> : <Btn disabled={busy === s.id} onClick={() => act(s, 'retry')}>Retry payout</Btn>}</Td>}
        </tr>)}
      </Table>}
  </Shell>
}

// ── Grievances ───────────────────────────────────────────────────

const CATEGORIES = ['claim_dispute', 'policy_service', 'payment_issue', 'settlement_delay', 'surveyor_conduct', 'other']
const NEXT_STATUS = { open: ['in_progress', 'rejected'], in_progress: ['resolved', 'rejected', 'open'], resolved: ['closed', 'in_progress'], rejected: ['closed', 'in_progress'], closed: [] }

export function GrievancesPage({ staff = false }) {
  const { data, error, loading, reload, setError } = useLoad('/grievances')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ category: 'claim_dispute', priority: 'medium', subject: '', description: '' })
  const [reply, setReply] = useState(''); const [internal, setInternal] = useState(false); const [resolution, setResolution] = useState('')
  const [ok, setOk] = useState(''); const [saving, setSaving] = useState(false)
  const rows = data || []
  const current = rows.find((g) => g.id === selected)
  useEffect(() => { setResolution(current?.resolution || '') }, [current?.id, current?.resolution])

  const run = async (fn, success) => { setSaving(true); setError(''); setOk(''); try { await fn(); setOk(success); reload() } catch (e) { setError(errText(e, 'Request failed.')) } finally { setSaving(false) } }
  const create = (e) => { e.preventDefault(); run(async () => { const r = await api.post('/grievances', form); setSelected(r.data.id); setForm({ ...form, subject: '', description: '' }) }, 'Grievance registered.') }
  const send = (e) => { e.preventDefault(); if (!reply.trim()) return; run(async () => { await api.post(`/grievances/${current.id}/comments`, { message: reply, is_internal: staff && internal }); setReply('') }, 'Reply posted.') }
  const setStatus = (status) => run(() => api.patch(`/grievances/${current.id}`, { status, ...(resolution ? { resolution } : {}) }), `Status changed to ${status.replace('_', ' ')}.`)
  const upload = (file) => { if (!file) return; const fd = new FormData(); fd.append('file', file); run(() => api.post(`/grievances/${current.id}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }), 'Attachment uploaded.') }
  const download = async (a) => { try { const r = await api.get(`/grievances/${current.id}/attachments/${a.id}`, { responseType: 'blob' }); const url = URL.createObjectURL(r.data); const link = document.createElement('a'); link.href = url; link.download = a.original_filename; link.click(); URL.revokeObjectURL(url) } catch (e) { setError(errText(e, 'Download failed.')) } }

  return <Shell title={staff ? 'Grievance Desk' : 'Grievances'} role={staff ? 'officer' : 'customer'}>
    <ErrorNotice message={error} /><Success message={ok} />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="space-y-5">
        {!staff && <Card title="Raise a grievance">
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <Field label="Category"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>)}</Select></Field>
            <Field label="Priority"><Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{['low', 'medium', 'high', 'urgent'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Subject" className="sm:col-span-2"><Input required minLength={5} maxLength={200} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
            <Field label="Describe the issue (min. 20 characters)" className="sm:col-span-2"><TextArea required minLength={20} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Btn disabled={saving}>Submit grievance</Btn></div>
          </form>
        </Card>}
        <Card title={staff ? 'All grievances' : 'My grievances'} actions={<Btn kind="ghost" onClick={reload}>Refresh</Btn>}>
          {loading ? <p className="text-sm text-slate-400">Loading…</p> : !rows.length ? <p className="text-sm text-slate-400">No grievances yet.</p> :
            <ul className="space-y-2">{rows.map((g) => <li key={g.id}><button onClick={() => setSelected(g.id)} className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${selected === g.id ? 'border-cyan-600 bg-cyan-900/20' : 'border-slate-800 hover:bg-slate-800/50'}`}>
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-mono text-slate-400">{g.grievance_number}</span><Pill value={g.status} /></div>
              <div className="mt-1 text-sm font-medium text-white">{g.subject}</div>
              <div className="text-xs text-slate-500">{g.category.replaceAll('_', ' ')} · {g.priority}{staff && ` · ${g.customer_name || ''}`}</div>
            </button></li>)}</ul>}
        </Card>
      </div>
      <Card title={current ? `${current.grievance_number} · ${current.subject}` : 'Select a grievance'}>
        {!current ? <p className="text-sm text-slate-400">Choose a grievance to see its conversation.</p> : <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400"><Pill value={current.status} /><span>Raised {when(current.created_at)}</span>{current.assigned_to_name && <span>· Handler: {current.assigned_to_name}</span>}</div>
          <p className="whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-sm text-slate-200">{current.description}</p>
          {current.resolution && <div className="rounded-lg border border-emerald-600/30 bg-emerald-900/10 p-3 text-sm text-emerald-200"><b>Resolution:</b> {current.resolution}</div>}
          <div className="space-y-2">{current.comments.map((c) => <div key={c.id} className={`rounded-lg p-3 text-sm ${c.is_internal ? 'border border-amber-600/30 bg-amber-900/10' : 'bg-slate-800/60'}`}><div className="mb-1 text-xs text-slate-400">{c.author_name || 'User'} · {when(c.created_at)}{c.is_internal && ' · internal note'}</div><div className="whitespace-pre-wrap text-slate-100">{c.message}</div></div>)}</div>
          {!!current.attachments.length && <div className="flex flex-wrap gap-2">{current.attachments.map((a) => <button key={a.id} onClick={() => download(a)} className="rounded border border-slate-700 px-2 py-1 text-xs text-cyan-300 hover:bg-slate-800">📎 {a.original_filename}</button>)}</div>}
          {current.status !== 'closed' && <form onSubmit={send} className="space-y-2">
            <TextArea rows={3} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
            <div className="flex flex-wrap items-center gap-3"><Btn disabled={saving || !reply.trim()}>Send reply</Btn>
              {staff && <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />Internal note (hidden from customer)</label>}
              <label className="cursor-pointer text-xs text-cyan-300 hover:underline">Attach file (PDF, JPG, PNG, TXT)<input type="file" accept=".pdf,.jpg,.jpeg,.png,.txt" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /></label>
            </div>
          </form>}
          {staff && !!NEXT_STATUS[current.status].length && <div className="space-y-2 border-t border-slate-800 pt-4">
            <Field label="Resolution note (required to resolve or reject)"><TextArea rows={2} value={resolution} onChange={(e) => setResolution(e.target.value)} /></Field>
            <div className="flex flex-wrap gap-2">{NEXT_STATUS[current.status].map((s) => <Btn key={s} kind={s === 'rejected' ? 'danger' : 'ghost'} disabled={saving} onClick={() => setStatus(s)}>Move to {s.replace('_', ' ')}</Btn>)}</div>
          </div>}
        </div>}
      </Card>
    </div>
  </Shell>
}

// ── AI assistant ─────────────────────────────────────────────────

export function AssistantPage() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const shipments = useLoad('/shipments')
  const [shipmentId, setShipmentId] = useState(''); const [recs, setRecs] = useState(null)
  const ask = async (e) => {
    e.preventDefault(); const q = text.trim(); if (!q) return
    setMessages((m) => [...m, { role: 'user', text: q }]); setText(''); setBusy(true); setError('')
    try { const { data } = await api.post('/ai/assistant/chat', { message: q }); setMessages((m) => [...m, { role: 'assistant', text: data.answer, sources: data.sources, mode: data.mode }]) } catch (err) { setError(errText(err, 'The assistant is unavailable.')) } finally { setBusy(false) }
  }
  const recommend = async () => { if (!shipmentId) return; setError(''); try { const { data } = await api.get('/ai/assistant/recommendations', { params: { shipment_id: shipmentId } }); setRecs(data) } catch (err) { setError(errText(err, 'Could not get recommendations.')) } }
  const shipList = Array.isArray(shipments.data) ? shipments.data : (shipments.data?.items || [])
  return <Shell title="MarineSure AI Assistant" role="customer">
    <p className="mb-5 text-sm text-slate-400">Ask about products, coverages, exclusions, deductibles, or your own policies and claims. Answers cite their sources. The assistant cannot approve, settle or change anything.</p>
    <ErrorNotice message={error} />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Card title="Ask a question">
        <div className="mb-4 max-h-[28rem] space-y-3 overflow-y-auto">
          {!messages.length && <div className="flex flex-wrap gap-2">{['What does the marine cargo product exclude?', 'What is the deductible on my policy?', 'What is the status of my claim?'].map((s) => <button key={s} onClick={() => setText(s)} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800">{s}</button>)}</div>}
          {messages.map((m, i) => <div key={i} className={`rounded-lg p-3 text-sm ${m.role === 'user' ? 'ml-10 bg-cyan-900/30 text-cyan-50' : 'mr-10 bg-slate-800/70 text-slate-100'}`}>
            <div className="whitespace-pre-wrap">{m.text}</div>
            {!!m.sources?.length && <div className="mt-2 flex flex-wrap gap-1.5">{m.sources.map((s, j) => <span key={s.id} className="rounded bg-slate-950 px-2 py-0.5 text-[11px] text-slate-400">[{j + 1}] {s.title}</span>)}</div>}
          </div>)}
          {busy && <p className="text-xs text-slate-400">Thinking…</p>}
        </div>
        <form onSubmit={ask} className="flex gap-2"><Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your question…" maxLength={1000} /><Btn disabled={busy || text.trim().length < 2}>Ask</Btn></form>
      </Card>
      <Card title="Product recommendations">
        <Field label="Shipment"><Select value={shipmentId} onChange={(e) => { setShipmentId(e.target.value); setRecs(null) }}><option value="">Select a shipment…</option>{shipList.map((s) => <option key={s.id} value={s.id}>{s.shipment_number} · {s.origin_location} → {s.destination_location}</option>)}</Select></Field>
        <Btn className="mt-3" disabled={!shipmentId} onClick={recommend}>Recommend products</Btn>
        {recs && <ol className="mt-4 space-y-2">{recs.recommendations.map((r) => <li key={r.product_id} className={`rounded-lg border p-3 text-sm ${r.is_eligible ? 'border-slate-700' : 'border-slate-800 opacity-60'}`}>
          <div className="flex justify-between gap-2"><span className="font-semibold text-white">#{r.rank} {r.product_name}</span><span>{inr(r.estimated_total_premium)}</span></div>
          <div className="mt-1 text-xs text-slate-400">{r.is_eligible ? 'Eligible' : 'Not eligible'} · {r.reasons.join('; ')}</div>
        </li>)}<p className="text-xs text-slate-500">{recs.note}</p></ol>}
      </Card>
    </div>
  </Shell>
}

// ── Admin: roles & permissions matrix ────────────────────────────

export function RolesPermissionsPage() {
  const { data, error, loading, reload, setError } = useLoad('/admin/permission-matrix')
  const [draft, setDraft] = useState({}); const [ok, setOk] = useState(''); const [saving, setSaving] = useState('')
  const [newRole, setNewRole] = useState({ role_name: '', description: '' })
  const [newPerm, setNewPerm] = useState({ code: '', name: '', category: 'general' })
  useEffect(() => { if (data) setDraft(Object.fromEntries(data.roles.map((r) => [r.id, new Set(r.permissions)]))) }, [data])
  const perms = data?.permissions || []
  const roles = data?.roles || []
  const grouped = useMemo(() => perms.reduce((acc, p) => { (acc[p.category] ||= []).push(p); return acc }, {}), [perms])
  const dirty = (r) => { const a = draft[r.id]; return a && (a.size !== r.permissions.length || r.permissions.some((c) => !a.has(c))) }
  const toggle = (role, code) => { if (role.role_name === 'admin') return; setDraft((d) => { const s = new Set(d[role.id]); s.has(code) ? s.delete(code) : s.add(code); return { ...d, [role.id]: s } }) }
  const run = async (key, fn, msg) => { setSaving(key); setError(''); setOk(''); try { await fn(); setOk(msg); reload() } catch (e) { setError(errText(e, 'Request failed.')) } finally { setSaving('') } }
  const save = (r) => run(r.id, () => api.put(`/admin/roles/${r.id}/permissions`, { permission_codes: [...draft[r.id]] }), `Saved permissions for ${r.role_name}.`)
  const createRole = (e) => { e.preventDefault(); run('newrole', () => api.post('/admin/roles', { ...newRole, permission_codes: [] }), `Role ${newRole.role_name} created.`).then(() => setNewRole({ role_name: '', description: '' })) }
  const createPerm = (e) => { e.preventDefault(); run('newperm', () => api.post('/admin/permissions', newPerm), `Permission ${newPerm.code} created.`).then(() => setNewPerm({ code: '', name: '', category: 'general' })) }
  const deleteRole = (r) => { if (window.confirm(`Delete role ${r.role_name}?`)) run(r.id, () => api.delete(`/admin/roles/${r.id}`), `Role ${r.role_name} deleted.`) }
  const deletePerm = (p) => { if (window.confirm(`Delete permission ${p.code}?`)) run(p.id, () => api.delete(`/admin/permissions/${p.id}`), `Permission ${p.code} deleted.`) }

  return <Shell title="Roles & Permissions" role="admin">
    <p className="mb-5 text-sm text-slate-400">Tick a box to grant a permission to a role, then save that role's column. Changes apply on the user's next request. The administrator role always holds every permission.</p>
    <ErrorNotice message={error} /><Success message={ok} />
    {loading && !data ? <Empty>Loading permission matrix…</Empty> : <>
      <div className="mb-5 overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900 text-slate-300"><tr><th className="sticky left-0 bg-slate-900 px-4 py-3 text-left">Permission</th>{roles.map((r) => <th key={r.id} className="px-2 py-3 text-center align-bottom"><div className="text-xs font-semibold">{r.role_name.replaceAll('_', ' ')}</div><div className="text-[10px] font-normal text-slate-500">{r.user_count} users{!r.is_system && ' · custom'}</div></th>)}</tr></thead>
          <tbody>{Object.entries(grouped).map(([cat, items]) => <React.Fragment key={cat}>
            <tr><td colSpan={roles.length + 1} className="bg-slate-950 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-400">{cat}</td></tr>
            {items.map((p) => <tr key={p.id} className="border-t border-slate-800">
              <td className="sticky left-0 bg-slate-900/95 px-4 py-2"><div className="font-medium text-slate-100">{p.name}</div><div className="font-mono text-[11px] text-slate-500">{p.code}{!p.is_builtin && <button onClick={() => deletePerm(p)} className="ml-2 text-rose-400 hover:underline">delete</button>}</div></td>
              {roles.map((r) => <td key={r.id} className="px-2 py-2 text-center"><input type="checkbox" aria-label={`${r.role_name} ${p.code}`} disabled={r.role_name === 'admin'} checked={!!draft[r.id]?.has(p.code)} onChange={() => toggle(r, p.code)} className="h-4 w-4 accent-cyan-500" /></td>)}
            </tr>)}
          </React.Fragment>)}</tbody>
          <tfoot><tr className="border-t border-slate-700 bg-slate-900"><td className="sticky left-0 bg-slate-900 px-4 py-3 text-xs text-slate-400">Save / delete</td>{roles.map((r) => <td key={r.id} className="px-2 py-3 text-center"><div className="flex flex-col items-center gap-1">{r.role_name !== 'admin' && <button disabled={!dirty(r) || saving === r.id} onClick={() => save(r)} className="rounded bg-cyan-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-30">Save</button>}{!r.is_system && <button onClick={() => deleteRole(r)} className="text-[11px] text-rose-400 hover:underline">delete</button>}</div></td>)}</tr></tfoot>
        </table>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Create custom role"><form onSubmit={createRole} className="grid gap-3">
          <Field label="Role name (lowercase, e.g. finance_analyst)"><Input required pattern="[a-z][a-z0-9_]{2,49}" value={newRole.role_name} onChange={(e) => setNewRole({ ...newRole, role_name: e.target.value })} /></Field>
          <Field label="Description"><Input value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} /></Field>
          <div><Btn disabled={saving === 'newrole'}>Create role</Btn></div>
          <p className="text-xs text-slate-500">Assign it from User Management. Custom roles grant API permissions; sidebar pages still follow the user's built-in role.</p>
        </form></Card>
        <Card title="Create permission"><form onSubmit={createPerm} className="grid gap-3">
          <Field label="Code (area.action, e.g. reports.export)"><Input required pattern="[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*" value={newPerm.code} onChange={(e) => setNewPerm({ ...newPerm, code: e.target.value })} /></Field>
          <Field label="Name"><Input required minLength={3} value={newPerm.name} onChange={(e) => setNewPerm({ ...newPerm, name: e.target.value })} /></Field>
          <Field label="Category"><Input required value={newPerm.category} onChange={(e) => setNewPerm({ ...newPerm, category: e.target.value })} /></Field>
          <div><Btn disabled={saving === 'newperm'}>Create permission</Btn></div>
          <p className="text-xs text-slate-500">New permissions are only enforced once backend code checks them; built-in ones are already enforced.</p>
        </form></Card>
      </div>
    </>}
  </Shell>
}

// ── Admin: product catalogue ─────────────────────────────────────

const MODES = ['sea', 'air', 'road', 'rail', 'multimodal']
const blankProduct = { product_code: '', product_name: '', description: '', min_insured_value: '10000.00', max_insured_value: '100000000.00', base_rate: '0.0050', deductible_percentage: '5.00', min_deductible: '5000.00', applicable_modes: ['sea'], coverage_duration_days: 30, terms_and_conditions: '', coverages: 'All risks of physical loss or damage', exclusions: '' }

export function AdminProductsPage() {
  const { data, error, loading, reload, setError } = useLoad('/admin/insurance-products')
  const [form, setForm] = useState(null); const [editing, setEditing] = useState(null); const [ok, setOk] = useState(''); const [saving, setSaving] = useState(false)
  const lines = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean).map((name) => ({ name }))
  const startEdit = (p) => { setEditing(p.id); setForm({ ...p, applicable_modes: p.applicable_modes.split(','), coverages: p.coverages.map((c) => c.coverage_name).join('\n'), exclusions: p.exclusions.map((c) => c.exclusion_name).join('\n') }) }
  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError(''); setOk('')
    const body = { ...form, coverage_duration_days: Number(form.coverage_duration_days), coverages: lines(form.coverages), exclusions: lines(form.exclusions) }
    ;['id', 'status', 'created_at', 'updated_at'].forEach((k) => delete body[k])
    try {
      if (editing) { delete body.product_code; await api.patch(`/admin/insurance-products/${editing}`, body); setOk('Product updated.') } else { await api.post('/admin/insurance-products', body); setOk('Product created as inactive. Activate it to offer it to customers.') }
      setForm(null); setEditing(null); reload()
    } catch (err) { setError(errText(err, 'Save failed.')) } finally { setSaving(false) }
  }
  const toggle = async (p) => { setError(''); setOk(''); try { await api.post(`/admin/insurance-products/${p.id}/${p.status === 'active' ? 'deactivate' : 'activate'}`); setOk(`${p.product_code} ${p.status === 'active' ? 'deactivated' : 'activated'}.`); reload() } catch (err) { setError(errText(err, 'Status change failed.')) } }
  const retire = async (p) => { if (!window.confirm(`Retire ${p.product_code}? Only possible if nobody has applied for it.`)) return; try { await api.delete(`/admin/insurance-products/${p.id}`); setOk(`${p.product_code} retired.`); reload() } catch (err) { setError(errText(err, 'Retire failed.')) } }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  return <Shell title="Insurance Product Catalog" role="admin">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-400">Create, edit, activate and deactivate products. Deactivated products stop being quoted; existing policies are unaffected.</p>{!form && <Btn onClick={() => { setEditing(null); setForm(blankProduct) }}>+ New product</Btn>}</div>
    <ErrorNotice message={error} /><Success message={ok} />
    {form && <Card title={editing ? `Edit ${form.product_code}` : 'New product'} className="mb-5"><form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
      <Field label="Code (A–Z, 0–9)"><Input required disabled={!!editing} pattern="[A-Z][A-Z0-9_]{1,19}" value={form.product_code} onChange={set('product_code')} /></Field>
      <Field label="Name" className="md:col-span-2"><Input required minLength={3} value={form.product_name} onChange={set('product_name')} /></Field>
      <Field label="Description" className="md:col-span-3"><TextArea required minLength={10} rows={2} value={form.description} onChange={set('description')} /></Field>
      <Field label="Min insured value (₹)"><Input required type="number" step="0.01" min="1" value={form.min_insured_value} onChange={set('min_insured_value')} /></Field>
      <Field label="Max insured value (₹)"><Input required type="number" step="0.01" min="1" value={form.max_insured_value} onChange={set('max_insured_value')} /></Field>
      <Field label="Base rate (0.0050 = 0.5%)"><Input required type="number" step="0.0001" min="0.0001" max="0.2" value={form.base_rate} onChange={set('base_rate')} /></Field>
      <Field label="Deductible %"><Input required type="number" step="0.01" min="0" max="50" value={form.deductible_percentage} onChange={set('deductible_percentage')} /></Field>
      <Field label="Minimum deductible (₹)"><Input required type="number" step="0.01" min="0" value={form.min_deductible} onChange={set('min_deductible')} /></Field>
      <Field label="Cover period (days)"><Input required type="number" min="1" max="730" value={form.coverage_duration_days} onChange={set('coverage_duration_days')} /></Field>
      <div className="md:col-span-3"><span className="text-sm text-slate-300">Transport modes</span><div className="mt-1 flex flex-wrap gap-3">{MODES.map((m) => <label key={m} className="flex items-center gap-1.5 text-sm text-slate-200"><input type="checkbox" className="accent-cyan-500" checked={form.applicable_modes.includes(m)} onChange={() => setForm({ ...form, applicable_modes: form.applicable_modes.includes(m) ? form.applicable_modes.filter((x) => x !== m) : [...form.applicable_modes, m] })} />{m}</label>)}</div></div>
      <Field label="Coverages (one per line)"><TextArea required rows={4} value={form.coverages} onChange={set('coverages')} /></Field>
      <Field label="Exclusions (one per line)"><TextArea rows={4} value={form.exclusions} onChange={set('exclusions')} /></Field>
      <Field label="Terms & conditions"><TextArea required minLength={10} rows={4} value={form.terms_and_conditions} onChange={set('terms_and_conditions')} /></Field>
      <div className="flex gap-2 md:col-span-3"><Btn disabled={saving || !form.applicable_modes.length}>{editing ? 'Save changes' : 'Create product'}</Btn><Btn kind="ghost" type="button" onClick={() => { setForm(null); setEditing(null) }}>Cancel</Btn></div>
    </form></Card>}
    {loading && !data ? <Empty>Loading catalogue…</Empty> : <Table head={['Code', 'Product', 'Rate', 'Deductible', 'Insured value range', 'Modes', 'Status', 'Actions']}>
      {(data || []).map((p) => <tr key={p.id}><Td className="font-mono">{p.product_code}</Td><Td><div className="font-medium text-white">{p.product_name}</div><div className="text-xs text-slate-500">{p.coverages.length} coverages · {p.exclusions.length} exclusions · {p.coverage_duration_days} days</div></Td>
        <Td>{(Number(p.base_rate) * 100).toFixed(2)}%</Td><Td>{p.deductible_percentage}% (min {inr(p.min_deductible)})</Td><Td className="whitespace-nowrap">{inr(p.min_insured_value)} – {inr(p.max_insured_value)}</Td><Td>{p.applicable_modes}</Td><Td><Pill value={p.status} /></Td>
        <Td className="space-x-2 whitespace-nowrap"><Btn kind="ghost" onClick={() => startEdit(p)}>Edit</Btn><Btn kind={p.status === 'active' ? 'danger' : 'primary'} onClick={() => toggle(p)}>{p.status === 'active' ? 'Deactivate' : 'Activate'}</Btn>{p.status !== 'active' && <button onClick={() => retire(p)} className="text-xs text-rose-400 hover:underline">Retire</button>}</Td></tr>)}
    </Table>}
  </Shell>
}

// ── Admin: finance (ledger, reports, reconciliation) ─────────────

const ACCOUNTS = ['cash', 'premium_income', 'premium_refunds', 'claims_paid', 'commission_expense', 'adjustments']

export function FinancePage() {
  const [range, setRange] = useState({ date_from: '', date_to: '' })
  const qs = new URLSearchParams(Object.entries(range).filter(([, v]) => v)).toString()
  const summary = useLoad(`/finance/summary${qs ? `?${qs}` : ''}`)
  const ledger = useLoad(`/finance/ledger${qs ? `?${qs}` : ''}`)
  const recons = useLoad('/finance/reconciliations')
  const [verify, setVerify] = useState(null); const [error, setError] = useState(''); const [ok, setOk] = useState('')
  const [adj, setAdj] = useState({ debit_account: 'cash', credit_account: 'adjustments', amount: '', description: '', external_reference: '' })
  const today = new Date().toISOString().slice(0, 10)
  const [rec, setRec] = useState({ source: 'payment_gateway', period_start: today, period_end: today, csv: '' })
  const [lastRun, setLastRun] = useState(null)
  const refreshAll = () => { summary.reload(); ledger.reload(); recons.reload() }
  const run = async (fn, msg) => { setError(''); setOk(''); try { const r = await fn(); setOk(msg); refreshAll(); return r } catch (e) { setError(errText(e, 'Request failed.')) } }
  const doVerify = async () => { try { setVerify((await api.get('/finance/ledger/verify')).data) } catch (e) { setError(errText(e, 'Verification failed.')) } }
  const postAdj = (e) => { e.preventDefault(); run(() => api.post('/finance/ledger/adjustments', { ...adj, external_reference: adj.external_reference || null }), 'Adjustment posted.').then(() => setAdj({ ...adj, amount: '', description: '', external_reference: '' })) }
  const reverse = (entry) => { const reason = window.prompt(`Reason for reversing ${entry.entry_number}?`); if (reason) run(() => api.post(`/finance/ledger/${entry.id}/reverse`, { reason }), `${entry.entry_number} reversed.`) }
  const reconcile = async (e) => {
    e.preventDefault()
    const lines = rec.csv.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [reference, amount] = l.split(/[,\t;]/).map((x) => x.trim()); return { reference, amount } })
    if (lines.some((l) => !l.reference || l.amount === undefined || Number.isNaN(Number(l.amount)))) { setError('Each statement line must be "reference,amount".'); return }
    const r = await run(() => api.post('/finance/reconciliations', { source: rec.source, period_start: rec.period_start, period_end: rec.period_end, lines }), 'Reconciliation complete.')
    if (r) setLastRun(r.data)
  }
  const s = summary.data
  const reversed = new Set((ledger.data || []).map((e) => e.reverses_entry_id).filter(Boolean))
  const tiles = s ? [['Gross premium', s.gross_premium], ['Refunds', s.premium_refunds], ['Net premium', s.net_premium], ['Claims paid', s.claims_paid], ['Commissions paid', s.commissions_paid], ['Underwriting result', s.underwriting_result]] : []
  return <Shell title="Financial Reports" role="admin">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <p className="max-w-2xl text-sm text-slate-400">All figures are derived from the append-only ledger. Entries are hash-chained; corrections are made with reversal entries, never edits.</p>
      <div className="flex flex-wrap items-end gap-2"><Field label="From"><Input type="date" value={range.date_from} onChange={(e) => setRange({ ...range, date_from: e.target.value })} /></Field><Field label="To"><Input type="date" value={range.date_to} onChange={(e) => setRange({ ...range, date_to: e.target.value })} /></Field><Btn kind="ghost" onClick={() => setRange({ date_from: '', date_to: '' })}>All time</Btn></div>
    </div>
    <ErrorNotice message={error || summary.error || ledger.error} /><Success message={ok} />
    <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{tiles.map(([label, v]) => <Card key={label}><p className="text-xs uppercase text-slate-400">{label}</p><p className={`mt-1 break-words text-xl font-bold ${Number(v) < 0 ? 'text-rose-300' : 'text-white'}`}>{inr(v)}</p></Card>)}</div>
    {s && <p className="mb-5 text-sm text-slate-400">Loss ratio: <b className="text-slate-200">{s.loss_ratio_percent === null ? 'n/a' : `${s.loss_ratio_percent}%`}</b> · Net cash movement: <b className="text-slate-200">{inr(s.net_cash_movement)}</b></p>}

    <Card title="Ledger" className="mb-5" actions={<><Btn kind="ghost" onClick={doVerify}>Verify integrity</Btn><Btn kind="ghost" onClick={refreshAll}>Refresh</Btn></>}>
      {verify && <div className={`mb-4 rounded-lg border p-3 text-sm ${verify.valid ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>{verify.valid ? `✓ Hash chain intact across ${verify.entries_checked} entries.` : `✗ Integrity failure at entry #${verify.first_invalid_sequence}: ${verify.reason}`}</div>}
      {!(ledger.data || []).length ? <p className="text-sm text-slate-400">No ledger entries in this period.</p> : <Table head={['#', 'Posted', 'Type', 'Debit', 'Credit', 'Amount', 'Reference', 'Description', '']}>
        {ledger.data.map((e) => <tr key={e.id}><Td className="font-mono text-xs">{e.entry_number}</Td><Td className="whitespace-nowrap text-xs">{when(e.posted_at)}</Td><Td><Pill value={e.entry_type} /></Td><Td>{e.debit_account}</Td><Td>{e.credit_account}</Td><Td className="whitespace-nowrap font-semibold">{inr(e.amount)}</Td><Td className="font-mono text-xs">{e.external_reference || '—'}</Td><Td className="max-w-xs text-xs">{e.description}</Td>
          <Td>{e.entry_type !== 'reversal' && !reversed.has(e.id) && e.reference_type !== 'settlement' && <button onClick={() => reverse(e)} className="text-xs text-rose-400 hover:underline">Reverse</button>}{reversed.has(e.id) && <span className="text-xs text-slate-500">reversed</span>}</Td></tr>)}
      </Table>}
    </Card>

    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Post manual adjustment"><form onSubmit={postAdj} className="grid gap-3 sm:grid-cols-2">
        <Field label="Debit account"><Select value={adj.debit_account} onChange={(e) => setAdj({ ...adj, debit_account: e.target.value })}>{ACCOUNTS.map((a) => <option key={a}>{a}</option>)}</Select></Field>
        <Field label="Credit account"><Select value={adj.credit_account} onChange={(e) => setAdj({ ...adj, credit_account: e.target.value })}>{ACCOUNTS.map((a) => <option key={a}>{a}</option>)}</Select></Field>
        <Field label="Amount (₹)"><Input required type="number" min="0.01" step="0.01" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} /></Field>
        <Field label="External reference (optional)"><Input value={adj.external_reference} onChange={(e) => setAdj({ ...adj, external_reference: e.target.value })} /></Field>
        <Field label="Description" className="sm:col-span-2"><Input required minLength={5} value={adj.description} onChange={(e) => setAdj({ ...adj, description: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Btn disabled={adj.debit_account === adj.credit_account}>Post adjustment</Btn></div>
      </form></Card>
      <Card title="Reconcile a statement"><form onSubmit={reconcile} className="grid gap-3 sm:grid-cols-3">
        <Field label="Source"><Select value={rec.source} onChange={(e) => setRec({ ...rec, source: e.target.value })}><option value="payment_gateway">Payment gateway (premiums)</option><option value="bank_payouts">Bank payouts (claims, commissions)</option></Select></Field>
        <Field label="Period start"><Input type="date" required value={rec.period_start} onChange={(e) => setRec({ ...rec, period_start: e.target.value })} /></Field>
        <Field label="Period end"><Input type="date" required value={rec.period_end} onChange={(e) => setRec({ ...rec, period_end: e.target.value })} /></Field>
        <Field label="Statement lines — one per line: reference,amount" className="sm:col-span-3"><TextArea rows={4} placeholder={'pay_ABC123,7080.00\npay_DEF456,12500.00'} value={rec.csv} onChange={(e) => setRec({ ...rec, csv: e.target.value })} /></Field>
        <div className="sm:col-span-3"><Btn>Run reconciliation</Btn></div>
      </form>
        {lastRun && <div className="mt-4 space-y-2 text-sm"><div className="flex items-center gap-2"><Pill value={lastRun.status} /><span>{lastRun.matched_count} matched · statement {inr(lastRun.statement_total)} vs ledger {inr(lastRun.ledger_total)} · difference {inr(lastRun.difference)}</span></div>
          {[['amount_mismatches', 'Amount mismatches'], ['missing_in_ledger', 'In statement but not in ledger'], ['missing_in_statement', 'In ledger but not in statement'], ['duplicate_statement_references', 'Duplicate statement references']].map(([k, label]) => lastRun.results[k]?.length ? <div key={k} className="rounded border border-rose-500/30 bg-rose-500/5 p-2"><b className="text-rose-200">{label}:</b> <span className="font-mono text-xs text-slate-300">{lastRun.results[k].map((x) => (typeof x === 'string' ? x : `${x.reference} (${x.statement_amount || x.ledger_amount})`)).join(', ')}</span></div> : null)}
        </div>}
      </Card>
    </div>
    <Card title="Reconciliation history" className="mt-5">
      {!(recons.data || []).length ? <p className="text-sm text-slate-400">No reconciliations run yet.</p> : <Table head={['Run', 'Source', 'Period', 'Statement', 'Ledger', 'Difference', 'Matched', 'Status']}>
        {recons.data.map((r) => <tr key={r.id}><Td className="font-mono text-xs">{r.run_number}</Td><Td>{r.source.replace('_', ' ')}</Td><Td className="whitespace-nowrap text-xs">{r.period_start.slice(0, 10)} → {r.period_end.slice(0, 10)}</Td><Td>{inr(r.statement_total)}</Td><Td>{inr(r.ledger_total)}</Td><Td>{inr(r.difference)}</Td><Td>{r.matched_count}</Td><Td><Pill value={r.status} /></Td></tr>)}
      </Table>}
    </Card>
  </Shell>
}

// ── Inspections (surveyor calendar and officer view) ─────────────

const toLocalInput = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 16) }

export function InspectionsPage({ staff = false }) {
  const { data, error, loading, reload, setError } = useLoad('/inspections')
  const claims = useLoad(staff ? '/claims' : '/surveyor/assignments')
  const start0 = new Date(Date.now() + 86400000); start0.setMinutes(0, 0, 0)
  const [form, setForm] = useState({ claim_id: '', location: '', start: toLocalInput(start0), hours: 2, notes: '' })
  const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false)
  const schedulable = (claims.data || []).filter((c) => c.assigned_surveyor_id && ['surveyor_assigned', 'inspection_completed', 'under_review'].includes(c.status))
  const run = async (fn, msg) => { setBusy(true); setError(''); setOk(''); try { await fn(); setOk(msg); reload() } catch (e) { setError(errText(e, 'Request failed.')) } finally { setBusy(false) } }
  const window_ = (startLocal, hours) => { const s = new Date(startLocal); return { scheduled_start: s.toISOString(), scheduled_end: new Date(s.getTime() + Number(hours) * 3600000).toISOString() } }
  const schedule = (e) => { e.preventDefault(); run(() => api.post('/inspections', { claim_id: form.claim_id, location: form.location, notes: form.notes || null, ...window_(form.start, form.hours) }), 'Inspection scheduled. The customer has been notified.') }
  const reschedule = (a) => { const when_ = window.prompt('New start (YYYY-MM-DD HH:MM, your local time):', toLocalInput(new Date(`${a.scheduled_start}Z`)).replace('T', ' ')); if (!when_) return; const reason = window.prompt('Reason for rescheduling:'); if (!reason) return; const hrs = (new Date(`${a.scheduled_end}Z`) - new Date(`${a.scheduled_start}Z`)) / 3600000; run(() => api.post(`/inspections/${a.id}/reschedule`, { reason, ...window_(when_.replace(' ', 'T'), hrs) }), 'Inspection rescheduled.') }
  const cancel = (a) => { const reason = window.prompt('Reason for cancelling:'); if (reason) run(() => api.post(`/inspections/${a.id}/cancel`, { reason }), 'Inspection cancelled.') }
  const complete = (a) => run(() => api.post(`/inspections/${a.id}/complete`), 'Marked as completed. Remember to submit the survey report.')
  const rows = data || []
  const groups = rows.reduce((acc, a) => { const k = new Date(`${a.scheduled_start}Z`).toDateString(); (acc[k] ||= []).push(a); return acc }, {})
  return <Shell title={staff ? 'Inspection Calendar' : 'Inspection Schedule'} role={staff ? 'officer' : 'surveyor'}>
    <ErrorNotice message={error} /><Success message={ok} />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <Card title="Schedule an inspection">
        {!schedulable.length ? <p className="text-sm text-slate-400">No claims with an assigned surveyor are waiting for inspection.</p> :
          <form onSubmit={schedule} className="grid gap-3">
            <Field label="Claim"><Select required value={form.claim_id} onChange={(e) => setForm({ ...form, claim_id: e.target.value })}><option value="">Select claim…</option>{schedulable.map((c) => <option key={c.id} value={c.id}>{c.claim_number} · {c.status.replaceAll('_', ' ')}</option>)}</Select></Field>
            <Field label="Location"><Input required minLength={3} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. JNPT CFS, Bay 4" /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Start (local time)"><Input type="datetime-local" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field><Field label="Duration (hours)"><Input type="number" min="0.5" max="12" step="0.5" required value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></Field></div>
            <Field label="Notes"><TextArea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <div><Btn disabled={busy}>Schedule</Btn></div>
          </form>}
      </Card>
      <Card title="Upcoming & past inspections" actions={<Btn kind="ghost" onClick={reload}>Refresh</Btn>}>
        {loading ? <p className="text-sm text-slate-400">Loading…</p> : !rows.length ? <p className="text-sm text-slate-400">No inspections scheduled.</p> :
          <div className="space-y-4">{Object.entries(groups).map(([day, items]) => <div key={day}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">{day}</h3><div className="space-y-2">{items.map((a) => <div key={a.id} className="rounded-lg border border-slate-800 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-medium text-white">{new Date(`${a.scheduled_start}Z`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{new Date(`${a.scheduled_end}Z`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {a.claim_number}</div><Pill value={a.status} /></div>
            <div className="mt-1 text-xs text-slate-400">{a.location}{staff && ` · ${a.surveyor_name}`} · {a.appointment_number}{a.reschedule_count ? ` · rescheduled ${a.reschedule_count}×` : ''}</div>
            {a.cancellation_reason && <div className="mt-1 text-xs text-rose-300">Cancelled: {a.cancellation_reason}</div>}
            {a.status === 'scheduled' && <div className="mt-2 flex gap-2"><Btn kind="ghost" disabled={busy} onClick={() => reschedule(a)}>Reschedule</Btn><Btn kind="danger" disabled={busy} onClick={() => cancel(a)}>Cancel</Btn><Btn disabled={busy} onClick={() => complete(a)}>Mark completed</Btn></div>}
          </div>)}</div></div>)}</div>}
      </Card>
    </div>
  </Shell>
}

// ── Surveyor report history ──────────────────────────────────────

export function SurveyorReportsPage() {
  const { data, error, loading } = useLoad('/surveyor/reports')
  return <Shell title="Survey Reports" role="surveyor">
    <p className="mb-5 text-sm text-slate-400">Every inspection report you have submitted.</p>
    <ErrorNotice message={error} />
    {loading ? <Empty>Loading reports…</Empty> : !(data || []).length ? <Empty>No reports submitted yet.</Empty> :
      <Table head={['Report', 'Claim', 'Inspected', 'Location', 'Cause', 'Covered', 'Est. loss', 'Recommended', 'Claim status']}>
        {data.map((r) => <tr key={r.id}><Td className="font-mono text-xs">{r.report_number}</Td><Td>{r.claim_number}</Td><Td className="whitespace-nowrap text-xs">{when(r.inspection_date)}</Td><Td>{r.inspection_location}</Td><Td>{r.cause_of_loss.replaceAll('_', ' ')}</Td><Td>{r.is_covered_peril ? 'Yes' : 'No'}</Td><Td>{inr(r.estimated_loss_amount)}</Td><Td className="font-semibold">{inr(r.recommended_settlement)}</Td><Td><Pill value={r.claim_status} /></Td></tr>)}
      </Table>}
  </Shell>
}

export { DataTable }
