import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowPathIcon, BellIcon, CheckIcon, KeyIcon, NoSymbolIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import {
  Alert, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, StatusBadge, Tabs, cx, useDialog, useToast,
} from '../../components/ui'
import { ROLE_LABEL } from '../../config/navigation'
import { apiError, date, dateTime, humanize, inr, relative } from '../../lib/format'
import api from '../../services/api'

/** Kept for pages written before the shared layout: wraps content in the app shell. */
export function Shell({ title, children }) {
  return <DashboardLayout title={title}>{children}</DashboardLayout>
}

export function ErrorNotice({ message }) {
  return message ? <Alert tone="danger" className="mb-4">{message}</Alert> : null
}

// Readable cell output for generic API rows.
function formatCell(key, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (/status|severity|priority/.test(key)) return <StatusBadge status={value} />
  if (/(amount|premium|value|payable|settlement|deductible)$/.test(key) && !Number.isNaN(Number(value))) return inr(value)
  if (/(_at|_date)$/.test(key)) return dateTime(value)
  if (Array.isArray(value)) return value.length ? `${value.length} item${value.length === 1 ? '' : 's'}` : '—'
  if (typeof value === 'object') return '—'
  return String(value)
}

const HIDDEN = /(^id$|_id$|password|hash|secret|token|storage_key)/i

/** Generic list page for endpoints that return an array of records. */
export function ApiListPage({ title, endpoint, description, unavailableMessage, transform, columns: preferred }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    if (!endpoint) { setLoading(false); setError(unavailableMessage || 'This view is not available yet.'); return }
    setLoading(true); setError('')
    api.get(endpoint).then(({ data }) => {
      const list = Array.isArray(data) ? data : (data?.items || data?.results || [])
      setRows(transform ? transform(list, data) : list)
    }).catch((err) => setError(apiError(err, `Unable to load ${title.toLowerCase()}.`))).finally(() => setLoading(false))
  }, [endpoint, title, transform, unavailableMessage])
  useEffect(load, [load])
  const columns = useMemo(() => {
    const keys = preferred || [...new Set(rows.flatMap((r) => Object.keys(r || {})))].filter((k) => !HIDDEN.test(k)).slice(0, 7)
    return keys.map((k) => ({ key: k, header: humanize(k).replace(/^./, (c) => c.toUpperCase()), render: (r) => formatCell(k, r[k]) }))
  }, [rows, preferred])
  return <DashboardLayout title={title}>
    <PageHeader title={title} description={description} actions={<Button variant="secondary" icon={ArrowPathIcon} onClick={load}>Refresh</Button>} />
    <ErrorNotice message={error} />
    <Card bodyClassName="p-4 sm:p-5"><DataTable loading={loading} rows={rows} columns={columns} /></Card>
  </DashboardLayout>
}

export function ProfilePage() {
  const toast = useToast()
  const { refreshUser } = useAuth()
  const [form, setForm] = useState({ name: '', phone: '', company_name: '', address: '', country: '' })
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pw, setPw] = useState({ current_password: '', new_password: '' })
  const [pwBusy, setPwBusy] = useState(false)
  useEffect(() => {
    api.get('/users/me').then(({ data }) => {
      setMeta(data)
      setForm({ name: data.name || '', phone: data.profile?.phone || '', company_name: data.profile?.company_name || '', address: data.profile?.address || '', country: data.profile?.country || '' })
    }).catch((e) => setError(apiError(e, 'Could not load your profile.'))).finally(() => setLoading(false))
  }, [])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.patch('/users/me', form)
      await refreshUser()
      toast('Profile updated.')
    } catch (err) { setError(apiError(err, 'Profile update failed.')) } finally { setSaving(false) }
  }
  const changePassword = async (e) => {
    e.preventDefault(); setPwBusy(true)
    try { await api.post('/users/me/password', pw); setPw({ current_password: '', new_password: '' }); toast('Password changed.') }
    catch (err) { toast(apiError(err, 'Password change failed.'), 'danger') } finally { setPwBusy(false) }
  }
  return <DashboardLayout title="Profile">
    <PageHeader title="Profile" description="Your contact details appear on policies, claims and correspondence." />
    <ErrorNotice message={error} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Card title="Account details">
        {loading ? <div className="ms-skeleton h-48" /> : <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required><Input required minLength={2} value={form.name} onChange={set('name')} autoComplete="name" /></Field>
          <Field label="Phone"><Input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" /></Field>
          <Field label="Company name"><Input value={form.company_name} onChange={set('company_name')} autoComplete="organization" /></Field>
          <Field label="Country"><Input value={form.country} onChange={set('country')} autoComplete="country-name" /></Field>
          <Field label="Address" className="sm:col-span-2"><Input value={form.address} onChange={set('address')} autoComplete="street-address" /></Field>
          <div className="sm:col-span-2"><Button type="submit" loading={saving}>Save changes</Button></div>
        </form>}
      </Card>
      <div className="space-y-6">
        <Card title="Sign-in">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-navy-400">Email</dt><dd className="truncate text-white">{meta?.email || '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-navy-400">Roles</dt><dd className="text-white">{(meta?.roles || []).map((r) => ROLE_LABEL[r] || humanize(r)).join(', ') || '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-navy-400">Member since</dt><dd className="text-white">{date(meta?.created_at)}</dd></div>
          </dl>
        </Card>
        <Card title="Change password">
          <form onSubmit={changePassword} className="grid gap-4">
            <Field label="Current password" required><Input type="password" required autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
            <Field label="New password" hint="At least 8 characters." required><Input type="password" required minLength={8} autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
            <div><Button type="submit" variant="secondary" loading={pwBusy}>Update password</Button></div>
          </form>
        </Card>
      </div>
    </div>
  </DashboardLayout>
}

export function NotificationsPage() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = () => { setLoading(true); api.get('/notifications').then(({ data }) => setItems(Array.isArray(data) ? data : [])).catch((e) => setError(apiError(e, 'Unable to load notifications.'))).finally(() => setLoading(false)) }
  useEffect(load, [])
  const markOne = async (id) => { try { await api.post(`/notifications/${id}/read`); load() } catch (e) { toast(apiError(e), 'danger') } }
  const markAll = async () => { try { await api.post('/notifications/read-all'); toast('All notifications marked as read.'); load() } catch (e) { toast(apiError(e), 'danger') } }
  const unread = items.filter((n) => !n.is_read).length
  const types = [...new Set(items.map((n) => n.notification_type))]
  const shown = items.filter((n) => filter === 'all' || (filter === 'unread' ? !n.is_read : n.notification_type === filter))
  const tone = { success: 'bg-emerald-400', warning: 'bg-amber-400', alert: 'bg-rose-400', info: 'bg-teal-400' }
  return <DashboardLayout title="Notifications">
    <PageHeader title="Notifications" description={unread ? `${unread} unread` : 'You are all caught up.'} actions={unread > 0 && <Button variant="secondary" icon={CheckIcon} onClick={markAll}>Mark all as read</Button>} />
    <ErrorNotice message={error} />
    <Tabs className="mb-4" value={filter} onChange={setFilter} tabs={[{ value: 'all', label: 'All', count: items.length }, { value: 'unread', label: 'Unread', count: unread }, ...types.map((t) => ({ value: t, label: humanize(t).replace(/^./, (c) => c.toUpperCase()) }))]} />
    {loading ? <div className="ms-skeleton h-48" /> : !shown.length ? <EmptyState icon={BellIcon} title="Nothing here" description="Updates about your applications, policies and claims will appear here." /> :
      <ul className="space-y-2.5">{shown.map((n) => <li key={n.id} className={cx('flex items-start gap-4 rounded-2xl border p-4 transition', n.is_read ? 'border-navy-800 bg-navy-900/50' : 'border-navy-700 bg-navy-900')}>
        <span className={cx('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.is_read ? 'bg-navy-600' : tone[n.notification_type] || 'bg-teal-400')} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={cx('text-sm', n.is_read ? 'text-navy-200' : 'font-semibold text-white')}>{n.title}</p>
          <p className="mt-0.5 text-sm text-navy-300">{n.message}</p>
          <p className="mt-1.5 text-xs text-navy-500">{relative(n.created_at)} · {dateTime(n.created_at)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {n.link && <Link to={n.link} onClick={() => !n.is_read && markOne(n.id)} className="text-xs font-semibold text-teal-300 hover:text-teal-200">Open</Link>}
          {!n.is_read && <button type="button" onClick={() => markOne(n.id)} className="text-xs text-navy-400 hover:text-white">Mark read</button>}
        </div>
      </li>)}</ul>}
  </DashboardLayout>
}

export function AdminUsersPage() {
  const toast = useToast()
  const { confirm } = useDialog()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState(null)
  const [role, setRole] = useState('')
  const [employeeCode, setEmployeeCode] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const load = () => {
    setLoading(true)
    Promise.all([api.get('/users'), api.get('/admin/roles').catch(() => ({ data: [] }))])
      .then(([u, r]) => { setUsers(u.data); setRoles(r.data) })
      .catch((e) => setError(apiError(e, 'Unable to load users.'))).finally(() => setLoading(false))
  }
  useEffect(load, [])
  const toggleStatus = async (u) => {
    const next = u.status === 'active' ? 'suspended' : 'active'
    const ok = await confirm({ title: next === 'suspended' ? `Suspend ${u.name}?` : `Reactivate ${u.name}?`, message: next === 'suspended' ? 'They will be signed out and unable to sign in until reactivated.' : 'They will be able to sign in again.', confirmLabel: next === 'suspended' ? 'Suspend' : 'Reactivate', danger: next === 'suspended' })
    if (!ok) return
    setBusy(u.id)
    try { await api.post(`/users/${u.id}/status`, { status: next }); toast(`${u.name} is now ${next}.`); load() } catch (e) { toast(apiError(e, 'Status change failed.'), 'danger') } finally { setBusy('') }
  }
  const needsCode = ['insurance_officer', 'senior_officer', 'admin'].includes(role)
  const assign = async (e) => {
    e.preventDefault(); setBusy(editing.id)
    try {
      await api.post(`/users/${editing.id}/roles`, { role, ...(needsCode && employeeCode ? { employee_code: employeeCode } : {}) })
      toast(`Added the ${ROLE_LABEL[role] || humanize(role)} role to ${editing.name}.`); setEditing(null); load()
    } catch (err) { toast(apiError(err, 'Role assignment failed.'), 'danger') } finally { setBusy('') }
  }
  const shown = users.filter((u) => statusFilter === 'all' || u.status === statusFilter)
  return <DashboardLayout title="Users">
    <PageHeader title="Users" description="Review accounts, add roles and suspend or reactivate access. Role changes are recorded in the audit log."
      actions={<Button to="/admin/roles" variant="secondary" icon={KeyIcon}>Roles & permissions</Button>} />
    <ErrorNotice message={error} />
    <Card bodyClassName="p-4 sm:p-5">
      <DataTable loading={loading} rows={shown} pageSize={12} searchPlaceholder="Search name, email, role…"
        toolbar={<Tabs value={statusFilter} onChange={setStatusFilter} tabs={[{ value: 'all', label: 'All', count: users.length }, ...['active', 'pending', 'suspended'].map((s) => ({ value: s, label: humanize(s).replace(/^./, (c) => c.toUpperCase()), count: users.filter((u) => u.status === s).length }))]} />}
        empty={<EmptyState icon={UserGroupIcon} title="No users found" />}
        columns={[
          { key: 'name', header: 'User', render: (u) => <div className="min-w-0"><p className="font-semibold text-white">{u.name}</p><p className="truncate text-xs text-navy-400">{u.email}</p></div> },
          { key: 'roles', header: 'Roles', sortValue: (u) => (u.roles || []).join(','), render: (u) => <div className="flex flex-wrap gap-1">{(u.roles || []).map((r) => <span key={r} className="rounded-md border border-navy-700 bg-navy-800/60 px-2 py-0.5 text-xs text-navy-100">{ROLE_LABEL[r] || humanize(r)}</span>)}</div> },
          { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.status} /> },
          { key: 'email_verified', header: 'Verified', render: (u) => (u.email_verified ? 'Yes' : 'No') },
          { key: 'created_at', header: 'Registered', render: (u) => date(u.created_at) },
          { key: 'actions', header: '', sortable: false, render: (u) => <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" icon={KeyIcon} disabled={busy === u.id} onClick={() => { setEditing(u); setRole(''); setEmployeeCode('') }}>Add role</Button>
            <Button size="sm" variant={u.status === 'active' ? 'danger' : 'secondary'} icon={u.status === 'active' ? NoSymbolIcon : CheckIcon} disabled={busy === u.id} onClick={() => toggleStatus(u)}>{u.status === 'active' ? 'Suspend' : 'Activate'}</Button>
          </div> },
        ]} />
    </Card>
    <Modal open={!!editing} onClose={() => setEditing(null)} title={`Add a role to ${editing?.name || ''}`} description={`Current: ${(editing?.roles || []).map((r) => ROLE_LABEL[r] || humanize(r)).join(', ') || 'none'}`}
      footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form="role-form" loading={busy === editing?.id} disabled={!role || (needsCode && !employeeCode && !editing?.profile?.employee_code)}>Add role</Button></>}>
      <form id="role-form" onSubmit={assign} className="grid gap-4">
        <Field label="Role" required><Select required value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Choose a role…</option>
          {roles.filter((r) => !(editing?.roles || []).includes(r.role_name)).map((r) => <option key={r.id} value={r.role_name}>{ROLE_LABEL[r.role_name] || humanize(r.role_name)}{r.is_system ? '' : ' (custom)'}</option>)}
        </Select></Field>
        {needsCode && <Field label="Employee code" hint="Required the first time someone becomes an officer or administrator."><Input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} /></Field>}
      </form>
    </Modal>
  </DashboardLayout>
}
