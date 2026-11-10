import React, { useMemo, useState } from 'react'
import { CalendarDaysIcon, ClipboardDocumentCheckIcon, DocumentTextIcon, ExclamationTriangleIcon, InboxStackIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Alert, Button, Card, EmptyState, Field, Input, Modal, Select, StatCard, StatusBadge, Stepper, TextArea, useToast } from '../../components/ui'
import { HeroBanner, useDashboardData } from '../../components/dashboard'
import { apiError, date, dateTime, humanize, inr, toDate } from '../../lib/format'
import api from '../../services/api'

const STEPS = [{ label: 'Assigned' }, { label: 'Inspection scheduled' }, { label: 'Inspected' }, { label: 'Report submitted' }]
const REPORTED = ['inspection_completed', 'under_review', 'approved', 'rejected', 'settled', 'payout_failed']
const CAUSES = ['rough_handling', 'seawater_damage', 'reefer_temperature_breach', 'theft_pilferage', 'fire_explosion', 'heavy_weather', 'contamination', 'other']

function stepFor(claim, appts) {
  if (REPORTED.includes(claim.status)) return 4
  const mine = appts.filter((a) => a.claim_id === claim.id)
  if (mine.some((a) => a.status === 'completed')) return 2
  if (mine.some((a) => a.status === 'scheduled')) return 1
  return 0
}

function ReportForm({ claim, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({
    inspection_date: new Date().toISOString().slice(0, 16), inspection_location: '', damage_assessment: '', cause_of_loss: 'rough_handling',
    is_covered_peril: true, estimated_loss_amount: claim?.claim_amount || '', salvage_value: '0', recommended_settlement: claim?.claim_amount || '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const est = Number(form.estimated_loss_amount || 0); const salvage = Number(form.salvage_value || 0)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await api.post(`/claims/${claim.id}/survey-reports`, {
        ...form, inspection_date: new Date(form.inspection_date).toISOString(),
        estimated_loss_amount: est, salvage_value: salvage, recommended_settlement: Number(form.recommended_settlement || 0), evidence_photos: [],
      })
      toast(`Survey report filed for ${claim.claim_number}.`)
      onDone()
    } catch (err) { setError(apiError(err, 'The report could not be submitted.')) } finally { setBusy(false) }
  }
  return <Modal open={!!claim} onClose={onClose} size="lg" title={`Survey report · ${claim?.claim_number || ''}`}
    description={claim ? `Claimed ${inr(claim.claim_amount)} · ${humanize(claim.claim_type)}` : ''}
    footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="survey-form" loading={busy}>Submit report</Button></>}>
    {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
    <form id="survey-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Inspection date and time" required><Input type="datetime-local" required value={form.inspection_date} onChange={set('inspection_date')} /></Field>
      <Field label="Inspection location" required><Input required minLength={3} placeholder="e.g. JNPT CFS, Bay 4" value={form.inspection_location} onChange={set('inspection_location')} /></Field>
      <Field label="Damage assessment" className="sm:col-span-2" required hint="What you saw, how much cargo is affected and how you measured it.">
        <TextArea required minLength={10} rows={4} value={form.damage_assessment} onChange={set('damage_assessment')} />
      </Field>
      <Field label="Cause of loss" required><Select value={form.cause_of_loss} onChange={set('cause_of_loss')}>{CAUSES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}</Select></Field>
      <label className="flex items-center gap-3 self-end rounded-lg border border-navy-700 bg-navy-950/40 px-3 py-2.5 text-sm text-navy-100">
        <input type="checkbox" checked={form.is_covered_peril} onChange={set('is_covered_peril')} className="h-4 w-4 accent-teal-500" />Loss caused by a covered peril
      </label>
      <Field label="Estimated loss (₹)" required><Input type="number" min="0" step="0.01" required value={form.estimated_loss_amount} onChange={set('estimated_loss_amount')} /></Field>
      <Field label="Salvage value (₹)"><Input type="number" min="0" step="0.01" value={form.salvage_value} onChange={set('salvage_value')} /></Field>
      <Field label="Recommended settlement (₹)" required hint={`Estimated loss less salvage: ${inr(Math.max(0, est - salvage))}. The officer applies the deductible.`} className="sm:col-span-2">
        <Input type="number" min="0" step="0.01" required value={form.recommended_settlement} onChange={set('recommended_settlement')} />
      </Field>
      <Alert tone="info" className="sm:col-span-2">Photo and document evidence can't be attached yet; the API has no upload endpoint for survey evidence. Describe the evidence in the assessment.</Alert>
    </form>
  </Modal>
}

export default function SurveyorDashboard() {
  const [refresh, setRefresh] = useState(0)
  const { loading, data, errors } = useDashboardData({ claims: `/surveyor/assignments?r=${refresh}`, inspections: `/inspections?r=${refresh}`, reports: `/surveyor/reports?r=${refresh}` })
  const [active, setActive] = useState(null)
  const claims = data.claims || []
  const appts = data.inspections || []
  const reports = data.reports || []
  const now = Date.now()

  const stats = useMemo(() => ({
    assigned: claims.filter((c) => !REPORTED.includes(c.status)).length,
    upcoming: appts.filter((a) => a.status === 'scheduled' && toDate(a.scheduled_start) > now).length,
    unscheduled: claims.filter((c) => c.status === 'surveyor_assigned' && !appts.some((a) => a.claim_id === c.id && a.status !== 'cancelled')).length,
    completed: reports.length,
  }), [claims, appts, reports, now])
  const upcoming = appts.filter((a) => a.status === 'scheduled').sort((a, b) => toDate(a.scheduled_start) - toDate(b.scheduled_start)).slice(0, 5)

  return <DashboardLayout title="Inspection workspace">
    <HeroBanner image="yard-night" credit="Photo: Loading containers · Marcel Sala, CC BY 2.0" title="Inspection workspace"
      actions={<><Button to="/surveyor/schedule" icon={CalendarDaysIcon}>Open calendar</Button><Button to="/surveyor/reports" variant="secondary" className="border-white/15 bg-white/5" icon={DocumentTextIcon}>Report history</Button></>}>
      Claims assigned to you, the inspections you've booked and the reports you've filed. Approval and settlement stay with the insurance officer.
    </HeroBanner>
    {Object.keys(errors).length > 0 && <Alert tone="warning" className="mb-6">Some data couldn't be loaded. Refresh to try again.</Alert>}

    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Open assignments" value={stats.assigned} icon={InboxStackIcon} loading={loading} />
      <StatCard label="Need scheduling" value={stats.unscheduled} icon={ExclamationTriangleIcon} tone="amber" to="/surveyor/schedule" loading={loading} />
      <StatCard label="Upcoming inspections" value={stats.upcoming} icon={CalendarDaysIcon} to="/surveyor/schedule" loading={loading} />
      <StatCard label="Reports filed" value={stats.completed} icon={ClipboardDocumentCheckIcon} tone="emerald" to="/surveyor/reports" loading={loading} />
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <Card title="Assigned claims">
        {loading ? <div className="ms-skeleton h-48" /> : !claims.length ? <EmptyState icon={InboxStackIcon} title="No assignments" description="Claims an insurance officer assigns to you appear here." /> :
          <ul className="space-y-3">{claims.map((c) => {
            const step = stepFor(c, appts)
            const appt = appts.find((a) => a.claim_id === c.id && a.status === 'scheduled')
            return <li key={c.id} className="rounded-xl border border-navy-800 bg-navy-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{c.claim_number}</p>
                  <p className="mt-0.5 text-xs text-navy-400">{humanize(c.claim_type)} · claimed {inr(c.claim_amount)} · assigned {date(c.updated_at)}</p>
                  {c.claimant_notes && <p className="mt-2 max-w-xl text-sm text-navy-300">{c.claimant_notes}</p>}
                </div>
                <StatusBadge status={c.status} />
              </div>
              <Stepper steps={STEPS} current={step} className="mt-4" />
              {appt && <p className="mt-3 text-xs text-navy-300">Inspection booked {dateTime(appt.scheduled_start)} at {appt.location}</p>}
              {!REPORTED.includes(c.status) && <div className="mt-4 flex flex-wrap gap-2">
                {step === 0 && <Button to="/surveyor/schedule" size="sm" variant="secondary" icon={CalendarDaysIcon}>Schedule inspection</Button>}
                <Button size="sm" icon={DocumentTextIcon} onClick={() => setActive(c)}>File survey report</Button>
              </div>}
            </li>
          })}</ul>}
      </Card>
      <div className="space-y-6">
        <Card title="Next inspections" actions={<Button to="/surveyor/schedule" variant="ghost" size="sm">Calendar</Button>}>
          {loading ? <div className="ms-skeleton h-32" /> : !upcoming.length ? <p className="text-sm text-navy-400">No inspections booked.</p> :
            <ul className="space-y-3">{upcoming.map((a) => { const d = toDate(a.scheduled_start); return <li key={a.id} className="flex gap-3">
              <span className="grid w-12 shrink-0 place-items-center rounded-lg border border-navy-700 bg-navy-950/60 py-1.5 text-center">
                <span className="text-[10px] font-semibold uppercase text-teal-300">{d?.toLocaleDateString('en-IN', { month: 'short' })}</span>
                <span className="tabular text-lg font-bold leading-none text-white">{d?.getDate()}</span>
              </span>
              <span className="min-w-0"><span className="block text-sm font-semibold text-white">{a.claim_number}</span>
                <span className="block truncate text-xs text-navy-400">{d?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {a.location}</span></span>
            </li> })}</ul>}
        </Card>
        <Card title="Recent reports" actions={<Button to="/surveyor/reports" variant="ghost" size="sm">All</Button>}>
          {loading ? <div className="ms-skeleton h-32" /> : !reports.length ? <p className="text-sm text-navy-400">No reports filed yet.</p> :
            <ul className="divide-y divide-navy-800">{reports.slice(0, 4).map((r) => <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
              <span className="min-w-0"><span className="block text-sm font-semibold text-white">{r.report_number}</span><span className="block text-xs text-navy-400">{r.claim_number} · {date(r.inspection_date)}</span></span>
              <span className="tabular text-sm font-semibold text-white">{inr(r.recommended_settlement)}</span>
            </li>)}</ul>}
        </Card>
      </div>
    </div>
    {active && <ReportForm claim={active} onClose={() => setActive(null)} onDone={() => { setActive(null); setRefresh((r) => r + 1) }} />}
  </DashboardLayout>
}
