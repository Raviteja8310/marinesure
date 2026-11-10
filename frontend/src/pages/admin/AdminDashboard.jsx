import React, { useMemo } from 'react'
import {
  BanknotesIcon, BuildingLibraryIcon, CheckBadgeIcon, ClipboardDocumentIcon, CubeIcon, DocumentCheckIcon, KeyIcon,
  ScaleIcon, ShieldCheckIcon, ShieldExclamationIcon, UserGroupIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Alert, Button, Card, StatCard, StatusBadge } from '../../components/ui'
import { HeroBanner, QuickAction, useDashboardData } from '../../components/dashboard'
import { BarChart, DonutChart, TrendChart } from '../../components/charts'
import { ROLE_LABEL } from '../../config/navigation'
import { dateTime, humanize, inr } from '../../lib/format'

const ROLE_ORDER = ['customer', 'shipping_company', 'surveyor', 'agent', 'insurance_officer', 'senior_officer', 'admin']

function countBy(list, key) {
  return list.reduce((acc, item) => { const k = typeof key === 'function' ? key(item) : item[key]; acc[k] = (acc[k] || 0) + 1; return acc }, {})
}

export default function AdminDashboard() {
  const { loading, data, errors } = useDashboardData({
    kpis: '/analytics/dashboard-kpis', trends: '/analytics/monthly-trends', exposure: '/analytics/portfolio-exposure',
    users: '/users', finance: '/finance/summary', verify: '/finance/ledger/verify', recons: '/finance/reconciliations',
    claims: '/claims', applications: '/applications', audit: '/audit-logs?limit=6',
  })
  const ops = data.kpis?.operations || {}
  const fin = data.finance || {}
  const users = data.users || []
  const claims = data.claims || []
  const applications = data.applications || []
  const months = data.trends?.monthly_financial_history || []
  const products = data.exposure?.product_performance || []
  const lastRecon = (data.recons || [])[0]

  const roleCounts = useMemo(() => {
    const counts = {}
    users.forEach((u) => (u.roles || []).forEach((r) => { counts[r] = (counts[r] || 0) + 1 }))
    return counts
  }, [users])
  const claimStatus = useMemo(() => countBy(claims, 'status'), [claims])
  const appStatus = useMemo(() => countBy(applications, 'status'), [applications])
  const failed = Object.keys(errors)

  return <DashboardLayout title="Command centre">
    <HeroBanner image="yard-night" credit="Photo: Loading containers · Marcel Sala, CC BY 2.0" title="Platform command centre"
      actions={<><Button to="/admin/users" icon={UserGroupIcon}>Manage users</Button><Button to="/admin/finance" variant="secondary" className="border-white/15 bg-white/5" icon={BuildingLibraryIcon}>Finance</Button></>}>
      Users, underwriting, claims and money in one view. Every figure comes from the live database and the append-only ledger.
    </HeroBanner>
    {failed.length > 0 && <Alert tone="warning" className="mb-6">Some panels couldn't load: {failed.join(', ')}.</Alert>}

    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Registered users" value={users.length} icon={UserGroupIcon} to="/admin/users" loading={loading} />
      <StatCard label="Active policies" value={ops.active_policies_count} icon={DocumentCheckIcon} tone="emerald" loading={loading} />
      <StatCard label="Shipments" value={ops.total_registered_shipments} icon={CubeIcon} loading={loading} />
      <StatCard label="Open claims" value={ops.pending_claims_count} icon={ScaleIcon} tone="rose" loading={loading} />
      <StatCard label="Applications in queue" value={ops.pending_applications_count} icon={ClipboardDocumentIcon} tone="amber" loading={loading} />
      <StatCard label="Approval rate" value={ops.underwriting_approval_rate_pct !== undefined ? `${ops.underwriting_approval_rate_pct}%` : undefined} icon={CheckBadgeIcon} tone="gold" loading={loading} />
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <Card title="Premium written vs claims settled" description="Last six months, from issued policies and settled claims">
        {loading ? <div className="ms-skeleton h-64" /> : <TrendChart labels={months.map((m) => m.month)} series={[
          { label: 'Premium written', data: months.map((m) => m.gwp) },
          { label: 'Claims settled', data: months.map((m) => m.claims), color: '#D5B477' },
        ]} />}
      </Card>
      <Card title="Ledger" description="Totals derived only from ledger entries" actions={<Button to="/admin/finance" variant="ghost" size="sm">Open</Button>}>
        {loading ? <div className="ms-skeleton h-64" /> : <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-4">
            {[['Premium received', fin.gross_premium], ['Refunds', fin.premium_refunds], ['Claim payouts', fin.claims_paid], ['Commission payouts', fin.commissions_paid]].map(([l, v]) =>
              <div key={l}><dt className="text-xs text-navy-400">{l}</dt><dd className="tabular mt-0.5 text-lg font-semibold text-white">{inr(v)}</dd></div>)}
          </dl>
          <div className="flex items-center justify-between rounded-xl border border-navy-800 bg-navy-950/50 px-4 py-3">
            <div className="flex items-center gap-2.5">
              {data.verify?.valid ? <ShieldCheckIcon className="h-5 w-5 text-emerald-300" /> : <ShieldExclamationIcon className="h-5 w-5 text-rose-300" />}
              <div><p className="text-sm font-semibold text-white">Hash chain</p><p className="text-xs text-navy-400">{data.verify ? `${data.verify.entries_checked} entries checked` : 'Not available'}</p></div>
            </div>
            {data.verify && <StatusBadge tone={data.verify.valid ? 'success' : 'danger'}>{data.verify.valid ? 'Intact' : `Broken at #${data.verify.first_invalid_sequence}`}</StatusBadge>}
          </div>
          <div className="flex items-center justify-between rounded-xl border border-navy-800 bg-navy-950/50 px-4 py-3">
            <div><p className="text-sm font-semibold text-white">Last reconciliation</p><p className="text-xs text-navy-400">{lastRecon ? `${lastRecon.run_number} · ${dateTime(lastRecon.created_at)}` : 'No runs yet'}</p></div>
            {lastRecon && <StatusBadge status={lastRecon.status} />}
          </div>
          <p className="text-xs text-navy-400">Loss ratio: <span className="font-semibold text-white">{fin.loss_ratio_percent ?? 'n/a'}{fin.loss_ratio_percent != null && '%'}</span></p>
        </div>}
      </Card>
    </div>

    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <Card title="Users by role">
        {loading ? <div className="ms-skeleton h-56" /> : <DonutChart labels={ROLE_ORDER.filter((r) => roleCounts[r]).map((r) => ROLE_LABEL[r])} data={ROLE_ORDER.filter((r) => roleCounts[r]).map((r) => roleCounts[r])} />}
      </Card>
      <Card title="Applications by status">
        {loading ? <div className="ms-skeleton h-56" /> : <BarChart labels={Object.keys(appStatus).map(humanize)} series={[{ label: 'Applications', data: Object.values(appStatus) }]} height={240} />}
      </Card>
      <Card title="Claims by status">
        {loading ? <div className="ms-skeleton h-56" /> : <BarChart labels={Object.keys(claimStatus).map(humanize)} series={[{ label: 'Claims', data: Object.values(claimStatus), color: '#D5B477' }]} height={240} />}
      </Card>
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card title="Product performance" description="Premium and claims paid per product">
        {loading ? <div className="ms-skeleton h-64" /> : <BarChart currency horizontal height={Math.max(220, products.length * 44)} labels={products.map((p) => p.product_code)}
          series={[{ label: 'Premium', data: products.map((p) => p.gwp) }, { label: 'Claims paid', data: products.map((p) => p.claims_paid), color: '#D5B477' }]} />}
      </Card>
      <Card title="Recent audit activity" actions={<Button to="/admin/audit" variant="ghost" size="sm">Full log</Button>}>
        {loading ? <div className="ms-skeleton h-64" /> : !(data.audit || []).length ? <p className="text-sm text-navy-400">No audit entries yet.</p> :
          <ul className="divide-y divide-navy-800">{data.audit.map((a) => <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
            <div className="min-w-0"><p className="text-sm font-semibold text-white">{humanize(a.action).toLowerCase().replace(/^./, (c) => c.toUpperCase())}</p><p className="truncate text-xs text-navy-400">{humanize(a.resource_type)}{a.resource_id ? ` · ${String(a.resource_id).slice(0, 8)}` : ''}</p></div>
            <span className="shrink-0 text-xs text-navy-400">{dateTime(a.created_at)}</span>
          </li>)}</ul>}
      </Card>
    </div>

    <Card title="Administration" className="mt-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <QuickAction to="/admin/users" icon={UserGroupIcon} label="Users" description="Roles and account status" />
        <QuickAction to="/admin/roles" icon={KeyIcon} label="Permissions" description="Role-permission matrix" />
        <QuickAction to="/admin/products" icon={ShieldCheckIcon} label="Products" description="Catalogue and rates" />
        <QuickAction to="/admin/finance" icon={BanknotesIcon} label="Finance" description="Ledger and reconciliation" />
        <QuickAction to="/admin/audit" icon={ClipboardDocumentIcon} label="Audit logs" description="Compliance trail" />
      </div>
    </Card>
  </DashboardLayout>
}
