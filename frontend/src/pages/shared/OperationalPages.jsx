import React, { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import api from '../../services/api'

const roleNav = {
  customer: [
    ['Dashboard', '/customer', '📊'], ['My Profile', '/customer/profile', '👤'],
    ['My Shipments', '/customer/shipments', '🚢'], ['Insurance Products', '/customer/products', '📋'],
    ['My Applications', '/customer/applications', '📝'], ['My Policies', '/customer/policies', '📜'],
    ['Payments', '/customer/payments', '💳'], ['My Claims', '/customer/claims', '⚖️'],
    ['Settlements', '/customer/settlements', '💰'], ['Grievances', '/customer/grievances', '📢'],
    ['AI Assistant', '/customer/ai', '🤖'], ['Notifications', '/customer/notifications', '🔔'],
  ],
  admin: [
    ['Dashboard', '/admin', '📊'], ['User Management', '/admin/users', '👥'],
    ['Roles & Permissions', '/admin/roles', '🔑'], ['Insurance Products', '/admin/products', '📋'],
    ['Financial Reports', '/admin/finance', '💰'], ['Audit Logs', '/admin/audit', '📝'],
  ],
  officer: [
    ['Dashboard', '/officer', '📊'], ['Applications', '/officer/applications', '📝'],
    ['Underwriting', '/officer/underwriting', '🔍'], ['Claims', '/officer/claims', '⚖️'],
    ['Settlements', '/officer/settlements', '💰'], ['Surveyors', '/officer/surveyors', '🧭'],
  ],
  shipping: [
    ['Dashboard', '/shipping', '📊'], ['Register Shipment', '/shipping/new', '➕'],
    ['Manage Shipments', '/shipping/shipments', '🚢'], ['Tracking', '/shipping/tracking', '📍'],
    ['Incidents', '/shipping/incidents', '⚠️'], ['Profile', '/shipping/profile', '👤'],
  ],
  surveyor: [
    ['Dashboard', '/surveyor', '📊'], ['Assigned Claims', '/surveyor/claims', '📋'],
    ['Inspection Schedule', '/surveyor/schedule', '📅'], ['Survey Reports', '/surveyor/reports', '📝'],
  ],
  agent: [
    ['Dashboard', '/agent', '📊'], ['Commission Ledger', '/agent/commissions', '💰'],
    ['Products Catalog', '/agent/products', '📋'],
  ],
}

function Shell({ title, role = 'customer', children }) {
  const nav = (roleNav[role] || roleNav.customer).map(([name, path, icon]) => ({ name, path, icon }))
  return <DashboardLayout title={title} roleLabel={role.replace('_', ' ')} navigation={nav}>{children}</DashboardLayout>
}

function ErrorNotice({ message }) {
  if (!message) return null
  return <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{message}</div>
}

function DataTable({ rows }) {
  const columns = useMemo(() => {
    const keys = new Set()
    rows.forEach((row) => Object.keys(row || {}).forEach((key) => {
      if (!['password_hash', 'hashed_password', 'secret', 'token'].includes(key.toLowerCase())) keys.add(key)
    }))
    return [...keys].slice(0, 8)
  }, [rows])
  if (!rows.length) return <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">No records found.</div>
  return <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="min-w-full text-left text-sm"><thead className="bg-slate-900 text-slate-400"><tr>{columns.map((key) => <th key={key} className="px-4 py-3 font-semibold">{key.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || row.uuid || index} className="border-t border-slate-800 text-slate-200">{columns.map((key) => <td key={key} className="max-w-xs px-4 py-3">{formatValue(row[key])}</td>)}</tr>)}</tbody></table></div>
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function ApiListPage({ title, role = 'customer', endpoint, description, unavailableMessage, transform }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    if (!endpoint) {
      setLoading(false)
      setError(unavailableMessage || 'The backend endpoint for this page has not been implemented yet. This screen is intentionally not showing fabricated records.')
      return () => { active = false }
    }
    api.get(endpoint).then(({ data }) => {
      if (!active) return
      const list = Array.isArray(data) ? data : (data?.items || data?.results || [])
      setRows(transform ? transform(list, data) : list)
    }).catch((err) => {
      if (active) setError(err.response?.data?.detail || `Unable to load ${title.toLowerCase()}. Check the API and your permissions.`)
    }).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [endpoint, refresh, title, transform, unavailableMessage])
  return <Shell title={title} role={role}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-400">{description}</p><button onClick={() => setRefresh((v) => v + 1)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">Refresh</button></div>
    <ErrorNotice message={error} />
    {loading ? <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">Loading records…</div> : <DataTable rows={rows} />}
  </Shell>
}

export function ProfilePage({ role = 'customer' }) {
  const [form, setForm] = useState({ name: '', phone: '', company_name: '', address: '', country: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { api.get('/users/me').then(({ data }) => setForm({ name: data.name || '', phone: data.profile?.phone || '', company_name: data.profile?.company_name || '', address: data.profile?.address || '', country: data.profile?.country || '' })).catch((e) => setError(e.response?.data?.detail || 'Could not load profile.')).finally(() => setLoading(false)) }, [])
  const update = (key) => (event) => setForm((old) => ({ ...old, [key]: event.target.value }))
  const save = async (event) => { event.preventDefault(); setSaving(true); setError(''); setMessage(''); try { await api.patch('/users/me', form); setMessage('Profile updated successfully.') } catch (e) { setError(e.response?.data?.detail || 'Profile update failed.') } finally { setSaving(false) } }
  return <Shell title="Profile Management" role={role}><div className="max-w-3xl rounded-xl border border-slate-800 bg-slate-900/70 p-6"><p className="mb-5 text-sm text-slate-400">Update the profile information associated with your signed-in account.</p><ErrorNotice message={error}/>{message && <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</div>}{loading ? <p className="text-slate-400">Loading profile…</p> : <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">{[['name','Full name'],['phone','Phone'],['company_name','Company name'],['country','Country'],['address','Address']].map(([key,label]) => <label key={key} className="grid gap-1 text-sm text-slate-300">{label}<input value={form[key]} onChange={update(key)} required={key==='name'} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500" /></label>)}<div className="sm:col-span-2"><button disabled={saving} className="rounded-lg bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save profile'}</button></div></form>}</div></Shell>
}

export function NotificationsPage({ role = 'customer' }) {
  const [items, setItems] = useState([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  const load = () => { setLoading(true); api.get('/notifications').then(({data}) => setItems(Array.isArray(data) ? data : [])).catch((e) => setError(e.response?.data?.detail || 'Unable to load notifications.')).finally(() => setLoading(false)) }
  useEffect(load, [])
  const markOne = async (id) => { try { await api.post(`/notifications/${id}/read`); load() } catch (e) { setError(e.response?.data?.detail || 'Unable to update notification.') } }
  const markAll = async () => { try { await api.post('/notifications/read-all'); load() } catch (e) { setError(e.response?.data?.detail || 'Unable to update notifications.') } }
  return <Shell title="Notifications" role={role}><div className="mb-4 flex justify-end"><button onClick={markAll} className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">Mark all as read</button></div><ErrorNotice message={error}/>{loading ? <p className="text-slate-400">Loading notifications…</p> : <div className="space-y-3">{items.length ? items.map((n) => <article key={n.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-white">{n.title || n.subject || 'Notification'}</h3><p className="mt-1 text-sm text-slate-300">{n.message || n.body || ''}</p><p className="mt-2 text-xs text-slate-500">{n.created_at ? new Date(n.created_at).toLocaleString() : ''} · {n.is_read || n.read_at ? 'Read' : 'Unread'}</p></div>{!(n.is_read || n.read_at) && <button onClick={() => markOne(n.id)} className="shrink-0 rounded-lg border border-cyan-700 px-3 py-1.5 text-xs text-cyan-300">Mark read</button>}</div></article>) : <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">You have no notifications.</div>}</div>}</Shell>
}

export function AdminUsersPage() {
  const [users, setUsers] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState('')
  const load = () => { setLoading(true); api.get('/users').then(({data}) => setUsers(data)).catch((e) => setError(e.response?.data?.detail || 'Unable to load users. Admin permission is required.')).finally(() => setLoading(false)) }
  useEffect(load, [])
  const changeStatus = async (user) => { const status = user.status === 'active' ? 'suspended' : 'active'; if (!window.confirm(`Change ${user.name} status to ${status}?`)) return; setBusy(user.id); setError(''); try { await api.post(`/users/${user.id}/status`, {status}); load() } catch (e) { setError(e.response?.data?.detail || 'Status update failed.') } finally { setBusy('') } }
  const changeRole = async (user) => { const role = window.prompt('Enter one role: customer, shipping_company, surveyor, agent, insurance_officer, senior_officer, admin', user.roles?.[0] || 'customer'); if (!role) return; const allowed = ['customer','shipping_company','surveyor','agent','insurance_officer','senior_officer','admin']; if (!allowed.includes(role)) { setError('Invalid role. No changes made.'); return } setBusy(user.id); setError(''); try { await api.post(`/users/${user.id}/roles`, {role}); load() } catch (e) { setError(e.response?.data?.detail || 'Role update failed.') } finally { setBusy('') } }
  return <Shell title="User Management" role="admin"><div className="mb-4 flex items-center justify-between"><p className="text-sm text-slate-400">Review registered users, assign roles and manage account status.</p><button onClick={load} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Refresh</button></div><ErrorNotice message={error}/>{loading ? <p className="text-slate-400">Loading users…</p> : <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="min-w-full text-left text-sm"><thead className="bg-slate-900 text-slate-400"><tr>{['Name','Email','Roles','Status','Email verified','Actions'].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody>{users.map(u=><tr key={u.id} className="border-t border-slate-800"><td className="px-4 py-3">{u.name}</td><td className="px-4 py-3">{u.email}</td><td className="px-4 py-3">{(u.roles||[]).join(', ')}</td><td className="px-4 py-3">{u.status}</td><td className="px-4 py-3">{u.email_verified ? 'Yes' : 'No'}</td><td className="space-x-2 whitespace-nowrap px-4 py-3"><button disabled={busy===u.id} onClick={()=>changeRole(u)} className="rounded border border-cyan-700 px-2 py-1 text-xs text-cyan-300">Change role</button><button disabled={busy===u.id} onClick={()=>changeStatus(u)} className="rounded border border-amber-700 px-2 py-1 text-xs text-amber-300">{u.status==='active'?'Suspend':'Activate'}</button></td></tr>)}</tbody></table>{!users.length && <p className="p-6 text-center text-slate-400">No users found.</p>}</div>}</Shell>
}
