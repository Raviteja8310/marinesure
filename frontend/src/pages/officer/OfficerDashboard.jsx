import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BanknotesIcon, ChartPieIcon, ClipboardDocumentListIcon, DocumentCheckIcon, ExclamationTriangleIcon, ScaleIcon,
  ShieldExclamationIcon, UserPlusIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { Alert, Button, Card, Field, Input, Select, StatCard, StatusBadge, cx } from '../../components/ui'
import { HeroBanner, useDashboardData } from '../../components/dashboard'
import { BarChart, DonutChart } from '../../components/charts'
import { apiError, humanize, inr } from '../../lib/format'
import api from '../../services/api'

// Mirrors the backend rule in insurance_service.review_application: ₹50,00,000+ needs a senior officer.
const HIGH_VALUE = 5000000

function Queue({ title, count, to, tone = 'info', icon: Icon, children }) {
  return <Link to={to} className="group flex items-center gap-4 rounded-xl border border-navy-800 bg-navy-950/40 p-4 transition hover:-translate-y-0.5 hover:border-navy-700 hover:bg-navy-800/40">
    <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-xl',
      { info: 'bg-teal-400/10 text-teal-300', warning: 'bg-amber-400/10 text-amber-300', danger: 'bg-rose-400/10 text-rose-300', gold: 'bg-gold-400/10 text-gold-300' }[tone])}><Icon className="h-5 w-5" aria-hidden /></span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{title}</span><span className="block truncate text-xs text-navy-400">{children}</span></span>
    <span className="tabular text-2xl font-bold text-white">{count}</span>
  </Link>
}

function RiskEvaluator() {
  const [form, setForm] = useState({ insured_amount: '5000000', cargo_category: 'electronics', transport_mode: 'sea', origin_country: 'India', origin_location: 'Mumbai Port', dest_country: 'Egypt', dest_location: 'Port Said' })
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const run = async (e) => {
    e.preventDefault(); setBusy(true); setError('')
    try { const { data } = await api.post('/risk/evaluate-custom', { ...form, insured_amount: Number(form.insured_amount) }); setResult(data) }
    catch (err) { setError(apiError(err, 'Risk evaluation failed.')) } finally { setBusy(false) }
  }
  const tierTone = { LOW: 'success', MODERATE: 'warning', HIGH: 'danger', CRITICAL: 'critical' }
  return <Card title="Route & cargo risk check" description="Run the underwriting risk engine on a hypothetical voyage before quoting.">
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={run} className="grid gap-3 sm:grid-cols-2">
        <Field label="Sum insured (₹)"><Input type="number" min="1" required value={form.insured_amount} onChange={set('insured_amount')} /></Field>
        <Field label="Cargo category"><Select value={form.cargo_category} onChange={set('cargo_category')}>{['electronics', 'perishable', 'hazardous', 'fragile', 'machinery', 'general'].map((c) => <option key={c} value={c}>{humanize(c)}</option>)}</Select></Field>
        <Field label="Transport mode"><Select value={form.transport_mode} onChange={set('transport_mode')}>{['sea', 'air', 'road', 'rail', 'multimodal'].map((c) => <option key={c} value={c}>{humanize(c)}</option>)}</Select></Field>
        <Field label="Origin country"><Input required value={form.origin_country} onChange={set('origin_country')} /></Field>
        <Field label="Origin port"><Input required value={form.origin_location} onChange={set('origin_location')} /></Field>
        <Field label="Destination country"><Input required value={form.dest_country} onChange={set('dest_country')} /></Field>
        <Field label="Destination port" className="sm:col-span-2"><Input required value={form.dest_location} onChange={set('dest_location')} /></Field>
        <div className="sm:col-span-2"><Button type="submit" loading={busy} icon={ShieldExclamationIcon}>Evaluate risk</Button></div>
      </form>
      <div>
        {error && <Alert tone="danger">{error}</Alert>}
        {!result && !error && <div className="ms-contours grid h-full min-h-[220px] place-items-center rounded-xl border border-dashed border-navy-700 p-6 text-center text-sm text-navy-400">Results from the risk engine appear here: composite score, tier, route hazards and suggested warranties.</div>}
        {result && <div className="space-y-4 animate-fade-up">
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-xs text-navy-400">Composite score</p><p className="tabular text-4xl font-bold text-white">{result.composite_score}<span className="text-lg text-navy-400"> / 100</span></p></div>
            <StatusBadge tone={tierTone[result.risk_tier] || 'neutral'}>{humanize(result.risk_tier).toLowerCase()} risk</StatusBadge>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-navy-800" role="meter" aria-valuenow={result.composite_score} aria-valuemin={0} aria-valuemax={100} aria-label="Composite risk score">
            <div className="h-full rounded-full bg-gradient-to-r from-teal-400 via-amber-400 to-rose-500" style={{ width: `${Math.min(100, result.composite_score)}%` }} />
          </div>
          <p className="text-sm leading-relaxed text-navy-200">{result.recommendation}</p>
          {result.components?.route_risk?.hazards?.length > 0 && <div><p className="mb-1.5 text-xs font-semibold text-navy-300">Route hazards</p>
            <ul className="space-y-1 text-sm text-navy-200">{result.components.route_risk.hazards.map((h, i) => <li key={i} className="flex gap-2"><ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />{h.description}</li>)}</ul></div>}
          {result.suggested_warranties?.length > 0 && <div><p className="mb-1.5 text-xs font-semibold text-navy-300">Suggested warranties</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-navy-200">{result.suggested_warranties.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
        </div>}
      </div>
    </div>
  </Card>
}

export default function OfficerDashboard() {
  const { user } = useAuth()
  const senior = (user?.roles || []).includes('senior_officer')
  const { loading, data, errors } = useDashboardData({ kpis: '/analytics/dashboard-kpis', exposure: '/analytics/portfolio-exposure', applications: '/applications', claims: '/claims', settlements: '/settlements' })
  const apps = data.applications || []
  const claims = data.claims || []
  const fin = data.kpis?.financials || {}
  const ops = data.kpis?.operations || {}
  const modes = data.exposure?.transport_modes || []
  const cargo = data.exposure?.cargo_categories || []

  const q = useMemo(() => ({
    newApps: apps.filter((a) => a.status === 'submitted').length,
    reviewing: apps.filter((a) => ['under_review', 'documents_required'].includes(a.status)).length,
    highValue: apps.filter((a) => ['submitted', 'under_review'].includes(a.status) && Number(a.requested_insured_amount) >= HIGH_VALUE).length,
    needSurveyor: claims.filter((c) => c.status === 'submitted').length,
    inspected: claims.filter((c) => c.status === 'inspection_completed').length,
    toSettle: claims.filter((c) => c.status === 'approved').length,
    failedPayouts: (data.settlements || []).filter((s) => s.status === 'failed').length,
  }), [apps, claims, data.settlements])

  return <DashboardLayout title="Underwriting desk">
    <HeroBanner image="voyage-sunset" credit="Photo: CMA CGM Marco Polo · Lovemedead, CC BY-SA 4.0"
      title={senior ? 'Senior underwriting desk' : 'Underwriting & claims desk'}
      actions={<><Button to="/officer/applications" icon={ClipboardDocumentListIcon}>Review applications</Button><Button to="/officer/claims" variant="secondary" className="border-white/15 bg-white/5" icon={ScaleIcon}>Claims</Button></>}>
      {senior ? 'High-value approvals, portfolio exposure and claim settlements awaiting your authority.' : 'Applications to underwrite, claims to progress and settlements to release, in priority order.'}
    </HeroBanner>
    {Object.keys(errors).length > 0 && <Alert tone="warning" className="mb-6">Some panels couldn't load: {Object.keys(errors).join(', ')}.</Alert>}

    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard label="Premium written" value={fin.gross_written_premium} format={(v) => inr(v, { compact: true })} icon={BanknotesIcon} tone="gold" loading={loading} />
      <StatCard label="Active policies" value={ops.active_policies_count} icon={DocumentCheckIcon} tone="emerald" loading={loading} />
      <StatCard label="Applications pending" value={ops.pending_applications_count} icon={ClipboardDocumentListIcon} tone="amber" to="/officer/applications" loading={loading} />
      <StatCard label="Open claims" value={ops.pending_claims_count} icon={ScaleIcon} tone="rose" to="/officer/claims" loading={loading} />
      <div className="col-span-2 lg:col-span-1"><StatCard label="Loss ratio" value={fin.portfolio_loss_ratio_pct !== undefined ? `${fin.portfolio_loss_ratio_pct}%` : undefined} hint={fin.portfolio_health?.status} icon={ChartPieIcon} loading={loading} /></div>
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card title="Underwriting queues">
        <div className="grid gap-3">
          {senior && <Queue title="Senior approvals" count={q.highValue} to="/officer/underwriting" tone="gold" icon={ShieldExclamationIcon}>Applications of {inr(HIGH_VALUE, { compact: true })} or more awaiting a decision</Queue>}
          <Queue title="New applications" count={q.newApps} to="/officer/applications" icon={ClipboardDocumentListIcon}>Submitted and not yet picked up</Queue>
          <Queue title="Under review" count={q.reviewing} to="/officer/underwriting" tone="warning" icon={DocumentCheckIcon}>In review or waiting on customer documents</Queue>
        </div>
      </Card>
      <Card title="Claims queues">
        <div className="grid gap-3">
          <Queue title="Needs a surveyor" count={q.needSurveyor} to="/officer/claims" tone="warning" icon={UserPlusIcon}>Submitted claims without an inspection</Queue>
          <Queue title="Survey complete" count={q.inspected} to="/officer/claims" icon={ScaleIcon}>Reports filed and ready for your review</Queue>
          <Queue title="Approved, to settle" count={q.toSettle} to="/officer/claims" tone="gold" icon={BanknotesIcon}>Release payout and record the bank reference</Queue>
          {q.failedPayouts > 0 && <Queue title="Failed payouts" count={q.failedPayouts} to="/officer/settlements" tone="danger" icon={ExclamationTriangleIcon}>Bounced transfers waiting for a retry</Queue>}
        </div>
      </Card>
    </div>

    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card title="Exposure by transport mode" description="Sum insured on issued policies">
        {loading ? <div className="ms-skeleton h-56" /> : <DonutChart currency labels={modes.map((m) => humanize(m.mode))} data={modes.map((m) => m.exposure)} />}
      </Card>
      <Card title="Exposure by cargo category">
        {loading ? <div className="ms-skeleton h-56" /> : <BarChart currency horizontal labels={cargo.map((c) => humanize(c.category))} series={[{ label: 'Sum insured', data: cargo.map((c) => c.exposure) }]} height={Math.max(200, cargo.length * 44)} />}
      </Card>
    </div>

    <div className="mt-6"><RiskEvaluator /></div>
  </DashboardLayout>
}
