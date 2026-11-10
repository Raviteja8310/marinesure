import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ChatBubbleLeftRightIcon, ClipboardDocumentListIcon, CubeIcon, DocumentCheckIcon, ExclamationTriangleIcon,
  MapIcon, PlusCircleIcon, ScaleIcon, ShieldCheckIcon, SparklesIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { Alert, Button, Card, DataTable, EmptyState, StatCard, StatusBadge } from '../../components/ui'
import { HeroBanner, QuickAction, RouteSummary, useDashboardData } from '../../components/dashboard'
import { date, inr } from '../../lib/format'

const PENDING_APPS = ['submitted', 'under_review', 'documents_required']
const CLOSED_CLAIMS = ['settled', 'rejected']

export default function CustomerDashboard() {
  const { user } = useAuth()
  const { loading, data, errors } = useDashboardData({ shipments: '/shipments', policies: '/policies', applications: '/applications', claims: '/claims' })
  const shipments = data.shipments || []
  const policies = data.policies || []
  const applications = data.applications || []
  const claims = data.claims || []

  const stats = useMemo(() => {
    const active = policies.filter((p) => p.status === 'active')
    return {
      shipments: shipments.length,
      activePolicies: active.length,
      pendingApps: applications.filter((a) => PENDING_APPS.includes(a.status)).length,
      approvedToPay: applications.filter((a) => a.status === 'approved' && !policies.some((p) => p.application_id === a.id)).length,
      openClaims: claims.filter((c) => !CLOSED_CLAIMS.includes(c.status)).length,
      protectedValue: active.reduce((s, p) => s + Number(p.insured_amount || 0), 0),
    }
  }, [shipments, policies, applications, claims])

  const latest = shipments[0]
  const firstName = (user?.name || '').split(' ')[0]
  const failed = Object.keys(errors)

  return <DashboardLayout title="Dashboard">
    <HeroBanner image="harbor-sunset" imageAlt="" credit="Photo: Port Jersey · Eric Kilby, CC BY-SA 2.0" title={`Welcome back${firstName ? `, ${firstName}` : ''}.`}
      actions={<><Button to="/customer/shipments/new" icon={PlusCircleIcon}>Register shipment</Button><Button to="/customer/products" variant="secondary" className="border-white/15 bg-white/5">Explore insurance</Button></>}>
      {loading ? 'Loading your portfolio…' : stats.activePolicies
        ? <>You have <strong className="text-white">{stats.activePolicies} active {stats.activePolicies === 1 ? 'policy' : 'policies'}</strong> protecting <strong className="text-white">{inr(stats.protectedValue)}</strong> of cargo.</>
        : 'Register a shipment and request a quotation to put your first cargo under cover.'}
    </HeroBanner>

    {failed.length > 0 && <Alert tone="warning" className="mb-6">Some figures couldn't be loaded ({failed.join(', ')}). The rest of the dashboard is up to date.</Alert>}
    {stats.approvedToPay > 0 && <Alert tone="info" className="mb-6" title={`${stats.approvedToPay} approved ${stats.approvedToPay === 1 ? 'application is' : 'applications are'} waiting for payment`}
      action={<Button to="/customer/applications" size="sm">Pay now</Button>}>Your policy is issued as soon as the payment is verified.</Alert>}

    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard label="Shipments" value={stats.shipments} icon={CubeIcon} to="/customer/shipments" loading={loading} />
      <StatCard label="Active policies" value={stats.activePolicies} icon={DocumentCheckIcon} tone="emerald" to="/customer/policies" loading={loading} />
      <StatCard label="Applications in review" value={stats.pendingApps} icon={ClipboardDocumentListIcon} tone="amber" to="/customer/applications" loading={loading} />
      <StatCard label="Open claims" value={stats.openClaims} icon={ScaleIcon} tone="rose" to="/customer/claims" loading={loading} />
      <div className="col-span-2 lg:col-span-1"><StatCard label="Protected cargo value" value={stats.protectedValue} format={(v) => inr(v, { compact: true })} hint="Sum insured, active policies" icon={ShieldCheckIcon} tone="gold" loading={loading} /></div>
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card title="Recent shipments" actions={<Button to="/customer/shipments" variant="ghost" size="sm">View all</Button>}>
        <DataTable loading={loading} rows={shipments} pageSize={5} searchPlaceholder="Search shipments…"
          empty={<EmptyState icon={CubeIcon} title="No shipments yet" description="Register your first shipment to get a quotation." action={<Button to="/customer/shipments/new" size="sm">Register shipment</Button>} />}
          columns={[
            { key: 'shipment_number', header: 'Shipment', render: (s) => <span className="whitespace-nowrap font-semibold text-white">{s.shipment_number}</span> },
            { key: 'route', header: 'Route', sortValue: (s) => s.origin_location, render: (s) => <span className="whitespace-nowrap">{s.origin_location} → {s.destination_location}</span> },
            { key: 'cargo', header: 'Cargo', sortable: false, render: (s) => s.cargo_items?.[0]?.cargo_name || '—' },
            { key: 'transport_mode', header: 'Mode', render: (s) => <span className="capitalize">{s.transport_mode}</span> },
            { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
            { key: 'expected_arrival_date', header: 'ETA', render: (s) => date(s.expected_arrival_date) },
          ]} />
      </Card>
      <Card title="Latest voyage" description={latest ? latest.shipment_number : undefined} actions={latest && <Button to="/customer/shipments" variant="ghost" size="sm" icon={MapIcon}>Details</Button>}>
        {loading ? <div className="ms-skeleton h-40" /> : latest ? <RouteSummary shipment={latest} /> : <EmptyState icon={MapIcon} title="No voyage to show" description="Your most recent shipment's route and milestones appear here." />}
      </Card>
    </div>

    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card title="Policies" actions={<Button to="/customer/policies" variant="ghost" size="sm">Manage</Button>}>
        {loading ? <div className="ms-skeleton h-32" /> : !policies.length ? <EmptyState icon={DocumentCheckIcon} title="No policies yet" description="Policies appear once an approved application is paid." /> :
          <ul className="divide-y divide-navy-800">
            {policies.slice(0, 4).map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0"><p className="font-semibold text-white">{p.policy_number}</p><p className="text-xs text-navy-400">Valid {date(p.effective_date)} – {date(p.expiry_date)}</p></div>
              <div className="text-right"><p className="tabular text-sm font-semibold text-white">{inr(p.insured_amount)}</p><p className="text-xs text-navy-400">Premium {inr(p.premium_paid)}</p></div>
              <StatusBadge status={p.status} />
            </li>)}
          </ul>}
      </Card>
      <Card title="Claims" actions={<Button to="/customer/claims" variant="ghost" size="sm">Track claims</Button>}>
        {loading ? <div className="ms-skeleton h-32" /> : !claims.length ? <EmptyState icon={ScaleIcon} title="No claims filed" description="If cargo is lost or damaged, report the incident and file a claim from the Claims page." /> :
          <ul className="divide-y divide-navy-800">
            {claims.slice(0, 4).map((c) => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0"><p className="font-semibold text-white">{c.claim_number}</p><p className="text-xs text-navy-400">Filed {date(c.created_at)} · updated {date(c.updated_at)}</p></div>
              <p className="tabular text-sm font-semibold text-white">{inr(c.net_payable && Number(c.net_payable) > 0 ? c.net_payable : c.claim_amount)}</p>
              <StatusBadge status={c.status} />
            </li>)}
          </ul>}
      </Card>
    </div>

    <Card title="Quick actions" className="mt-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction to="/customer/shipments/new" icon={PlusCircleIcon} label="Register shipment" description="Cargo, containers, route" />
        <QuickAction to="/customer/products" icon={ShieldCheckIcon} label="Explore insurance" description="Compare products" />
        <QuickAction to="/customer/applications/new" icon={ClipboardDocumentListIcon} label="Apply for cover" description="Quote and apply" />
        <QuickAction to="/customer/policies" icon={DocumentCheckIcon} label="View policies" description="Certificates and renewals" />
        <QuickAction to="/customer/claims" icon={ExclamationTriangleIcon} label="Report an incident" description="Start a claim" />
        <QuickAction to="/customer/shipments" icon={MapIcon} label="Track shipments" description="Milestones by voyage" />
        <QuickAction to="/customer/ai" icon={SparklesIcon} label="Ask the assistant" description="Coverage and claim questions" />
        <QuickAction to="/customer/grievances" icon={ChatBubbleLeftRightIcon} label="Contact support" description="Raise a grievance" />
      </div>
    </Card>
    <p className="mt-4 text-xs text-navy-500">Need help with something specific? <Link to="/customer/grievances" className="text-teal-300 hover:underline">Raise a grievance</Link> and an insurance officer will reply.</p>
  </DashboardLayout>
}
