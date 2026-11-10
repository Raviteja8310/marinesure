import React, { useState } from 'react'
import { BanknotesIcon, CheckBadgeIcon, ClockIcon, DocumentCheckIcon, PlusCircleIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Alert, Button, Card, DataTable, EmptyState, Field, Input, Modal, Select, StatCard, StatusBadge, useToast } from '../../components/ui'
import { HeroBanner, useDashboardData } from '../../components/dashboard'
import { BarChart } from '../../components/charts'
import { apiError, date, inr } from '../../lib/format'
import api from '../../services/api'

function RecordCommission({ open, onClose, policies, onDone }) {
  const toast = useToast()
  const [policyId, setPolicyId] = useState('')
  const [rate, setRate] = useState('10')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('')
    try { await api.post('/agent/commissions/record', { policy_id: policyId, commission_rate: Number(rate) }); toast('Commission recorded as accrued.'); onDone() }
    catch (err) { setError(apiError(err, 'Could not record the commission.')) } finally { setBusy(false) }
  }
  const selected = policies.find((p) => p.id === policyId)
  return <Modal open={open} onClose={onClose} title="Record a commission" description="Accrue commission on a policy you placed. An insurance officer pays it out."
    footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="commission-form" loading={busy} disabled={!policyId}>Record commission</Button></>}>
    {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
    {!policies.length ? <Alert tone="info">No policies are visible to your account, so there is nothing to record a commission against.</Alert> :
      <form id="commission-form" onSubmit={submit} className="grid gap-4">
        <Field label="Policy" required><Select required value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
          <option value="">Select a policy…</option>{policies.map((p) => <option key={p.id} value={p.id}>{p.policy_number} · premium {inr(p.premium_paid)}</option>)}
        </Select></Field>
        <Field label="Commission rate (%)" required><Input type="number" min="0.5" max="25" step="0.5" required value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
        {selected && <p className="text-sm text-navy-300">Commission: <span className="tabular font-semibold text-white">{inr(Number(selected.premium_paid) * Number(rate || 0) / 100)}</span></p>}
      </form>}
  </Modal>
}

export default function AgentDashboard() {
  const [refresh, setRefresh] = useState(0)
  const [open, setOpen] = useState(false)
  const { loading, data, errors } = useDashboardData({ metrics: `/agent/metrics?r=${refresh}`, commissions: `/agent/commissions?r=${refresh}`, policies: '/policies' })
  const m = data.metrics || {}
  const rows = data.commissions || []
  const byMonth = rows.reduce((acc, c) => { const k = new Date(c.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }); acc[k] = (acc[k] || 0) + Number(c.commission_amount); return acc }, {})

  return <DashboardLayout title="Agent desk">
    <HeroBanner image="harbor-sunset" credit="Photo: Port Jersey · Eric Kilby, CC BY-SA 2.0" title="Agent desk"
      actions={<><Button icon={PlusCircleIcon} onClick={() => setOpen(true)}>Record commission</Button><Button to="/agent/products" variant="secondary" className="border-white/15 bg-white/5">Product catalogue</Button></>}>
      Customers you've assisted, the policies you've placed and the commission they've earned, straight from the commission ledger.
    </HeroBanner>
    {Object.keys(errors).length > 0 && <Alert tone="warning" className="mb-6">Some figures couldn't be loaded.</Alert>}

    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard label="Customers assisted" value={m.referred_customers_count} icon={UserGroupIcon} loading={loading} />
      <StatCard label="Policies placed" value={m.policies_sold} icon={DocumentCheckIcon} loading={loading} />
      <StatCard label="Commission earned" value={m.total_commission_earned} format={(v) => inr(v)} icon={BanknotesIcon} tone="gold" loading={loading} />
      <StatCard label="Pending payout" value={m.pending_commission} format={(v) => inr(v)} icon={ClockIcon} tone="amber" loading={loading} />
      <div className="col-span-2 lg:col-span-1"><StatCard label="Paid out" value={m.paid_commission} format={(v) => inr(v)} icon={CheckBadgeIcon} tone="emerald" loading={loading} /></div>
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <Card title="Commission ledger">
        <DataTable loading={loading} rows={rows} pageSize={8} searchPlaceholder="Search reference, status…"
          empty={<EmptyState icon={BanknotesIcon} title="No commissions yet" description="Commissions appear here once recorded against a policy you placed." />}
          columns={[
            { key: 'commission_reference', header: 'Reference', render: (c) => <span className="whitespace-nowrap font-semibold text-white">{c.commission_reference}</span> },
            { key: 'premium_amount', header: 'Premium', align: 'right', render: (c) => inr(c.premium_amount) },
            { key: 'commission_rate', header: 'Rate', align: 'right', render: (c) => `${Number(c.commission_rate)}%` },
            { key: 'commission_amount', header: 'Commission', align: 'right', render: (c) => <span className="font-semibold text-white">{inr(c.commission_amount)}</span> },
            { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
            { key: 'payout_reference', header: 'Payout ref.', render: (c) => <span className="font-mono text-xs">{c.payout_reference || '—'}</span> },
            { key: 'created_at', header: 'Recorded', render: (c) => date(c.created_at) },
          ]} />
      </Card>
      <Card title="Commission by month">
        {loading ? <div className="ms-skeleton h-56" /> : <BarChart currency labels={Object.keys(byMonth)} series={[{ label: 'Commission', data: Object.values(byMonth), color: '#D5B477' }]} />}
      </Card>
    </div>
    <RecordCommission open={open} onClose={() => setOpen(false)} policies={data.policies || []} onDone={() => { setOpen(false); setRefresh((r) => r + 1) }} />
  </DashboardLayout>
}
