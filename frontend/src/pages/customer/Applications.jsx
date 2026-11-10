import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckBadgeIcon, CheckCircleIcon, ClipboardDocumentListIcon, CreditCardIcon, CubeIcon, DocumentCheckIcon, PlusCircleIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout'
import { Alert, Button, Card, EmptyState, Field, LoadingRows, Modal, PageHeader, Select, StatusBadge, Stepper, Tabs, TextArea } from '../../components/ui'
import { apiError, date, inr } from '../../lib/format'
import api from '../../services/api'


const APP_STEPS = [{ label: 'Submitted' }, { label: 'Underwriting' }, { label: 'Decision' }, { label: 'Paid & insured' }]
function appStep(a, policyIssued) {
  if (policyIssued) return 4
  if (['approved', 'rejected', 'withdrawn'].includes(a.status)) return 2
  if (['under_review', 'documents_required'].includes(a.status)) return 1
  return 0
}

function PaymentDialog({ app, onClose }) {
  const navigate = useNavigate()
  const [gateway, setGateway] = useState(null)
  const [order, setOrder] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!app) return
    setOrder(null); setError('')
    api.get('/payments/gateway').then(({ data }) => setGateway(data)).catch(() => setGateway({ mode: 'unknown' }))
  }, [app])
  const pay = async () => {
    setBusy(true); setError('')
    try {
      const o = order || (await api.post('/payments/create-order', { application_id: app.id })).data
      setOrder(o)
      if (gateway?.mode !== 'test') return
      // Development test mode only: the server verifies without a gateway signature and no money moves.
      await api.post(`/payments/${o.id}/verify`, { gateway_payment_id: `pay_devtest_${o.order_reference}` })
      navigate('/customer/policies', { state: { issued: app.application_number } })
    } catch (err) { setError(apiError(err, 'Payment could not be completed.')) } finally { setBusy(false) }
  }
  return <Modal open={!!app} onClose={onClose} title="Pay premium and issue policy" description={app ? `${app.application_number} · ${app.product_name || 'Marine cargo insurance'}` : ''}
    footer={<><Button variant="secondary" onClick={onClose}>Close</Button>
      {gateway?.mode === 'test' && <Button onClick={pay} loading={busy} icon={CreditCardIcon}>Complete test payment</Button>}
      {gateway?.mode === 'live' && !order && <Button onClick={pay} loading={busy} icon={CreditCardIcon}>Create payment order</Button>}</>}>
    {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
    <dl className="divide-y divide-navy-800 rounded-xl border border-navy-800 bg-navy-950/40 text-sm">
      <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-navy-300">Sum insured</dt><dd className="tabular font-semibold text-white">{inr(app?.requested_insured_amount)}</dd></div>
      <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-navy-300">Premium payable (incl. GST, as quoted)</dt><dd className="tabular text-lg font-bold text-white">{inr(app?.calculated_premium)}</dd></div>
      {app?.special_conditions && <div className="px-4 py-3"><dt className="text-navy-300">Special conditions</dt><dd className="mt-1 text-navy-100">{app.special_conditions}</dd></div>}
    </dl>
    <div className="mt-4">
      {!gateway && <div className="ms-skeleton h-14" />}
      {gateway?.mode === 'test' && <Alert tone="warning" title="Development test payment">This server runs without a payment gateway. Completing the payment records a test transaction and issues the policy; <strong>no money moves</strong>.</Alert>}
      {gateway?.mode === 'live' && <Alert tone="info" title={order ? `Order ${order.order_reference} created` : 'Online checkout'}>
        {order ? 'The gateway checkout window is not integrated in this version, so the payment cannot be completed here yet. Your order is saved; contact an insurance officer to complete payment.' : 'A payment order will be created with the gateway. Your policy is issued only after the gateway confirms payment.'}
      </Alert>}
      {gateway?.mode === 'unavailable' && <Alert tone="danger" title="Payments are unavailable">The payment gateway isn't configured on this server, so payments can't be verified. No policy can be issued until it is.</Alert>}
      {gateway?.mode === 'unknown' && <Alert tone="danger">Could not reach the payment service.</Alert>}
    </div>
  </Modal>
}

export function ApplicationsList() {
  const [apps, setApps] = useState([])
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(null)
  const [filter, setFilter] = useState('all')
  useEffect(() => {
    Promise.all([api.get('/applications'), api.get('/policies')])
      .then(([a, p]) => { setApps(a.data); setPolicies(p.data) })
      .catch((err) => setError(apiError(err, 'Could not load your applications.')))
      .finally(() => setLoading(false))
  }, [])
  const issued = new Set(policies.map((p) => p.application_id))
  const groups = {
    all: apps,
    action: apps.filter((a) => (a.status === 'approved' && !issued.has(a.id)) || a.status === 'documents_required'),
    review: apps.filter((a) => ['submitted', 'under_review'].includes(a.status)),
    done: apps.filter((a) => issued.has(a.id) || ['rejected', 'withdrawn'].includes(a.status)),
  }
  return <DashboardLayout title="Applications">
    <PageHeader title="Insurance applications" description="Track underwriting decisions, pay approved premiums and get your policy issued."
      actions={<Button to="/customer/applications/new" icon={PlusCircleIcon}>New application</Button>} />
    {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
    <Tabs className="mb-4" value={filter} onChange={setFilter} tabs={[
      { value: 'all', label: 'All', count: groups.all.length }, { value: 'action', label: 'Needs action', count: groups.action.length },
      { value: 'review', label: 'In review', count: groups.review.length }, { value: 'done', label: 'Completed', count: groups.done.length }]} />
    {loading ? <LoadingRows /> : !groups[filter].length ? <EmptyState icon={ClipboardDocumentListIcon} title={filter === 'all' ? 'No applications yet' : 'Nothing here'}
      description="Choose a shipment and a product to get a quotation and apply." action={<Button to="/customer/applications/new" size="sm">Start an application</Button>} /> :
      <ul className="space-y-3">{groups[filter].map((a) => {
        const paid = issued.has(a.id)
        return <li key={a.id} className="rounded-2xl border border-navy-800 bg-navy-900/80 p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5"><p className="text-base font-semibold text-white">{a.application_number}</p><StatusBadge status={paid ? 'issued' : a.status}>{paid ? 'Policy issued' : undefined}</StatusBadge></div>
              <p className="mt-1 text-sm text-navy-300">{a.product_name || 'Marine cargo insurance'} · submitted {date(a.created_at)}</p>
            </div>
            <dl className="flex gap-6 text-sm">
              <div><dt className="text-xs text-navy-400">Sum insured</dt><dd className="tabular font-semibold text-white">{inr(a.requested_insured_amount)}</dd></div>
              <div><dt className="text-xs text-navy-400">Premium</dt><dd className="tabular font-semibold text-white">{inr(a.calculated_premium)}</dd></div>
            </dl>
          </div>
          <Stepper className="mt-4" steps={APP_STEPS} current={appStep(a, paid)} />
          {a.officer_remarks && <p className="mt-3 rounded-lg bg-navy-950/50 px-3 py-2 text-sm text-navy-200"><span className="text-navy-400">Underwriter: </span>{a.officer_remarks}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {a.status === 'approved' && !paid && <Button icon={CreditCardIcon} onClick={() => setPaying(a)}>Pay {inr(a.calculated_premium)}</Button>}
            {paid && <Button to="/customer/policies" variant="secondary" icon={DocumentCheckIcon}>View policy</Button>}
            {a.status === 'documents_required' && <Button to="/customer/shipments" variant="secondary">Upload documents</Button>}
          </div>
        </li>
      })}</ul>}
    <PaymentDialog app={paying} onClose={() => setPaying(null)} />
  </DashboardLayout>
}

export function NewApplication() {
  const [searchParams] = useSearchParams()
  const [shipments, setShipments] = useState([])
  const [selectedShipment, setSelectedShipment] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(searchParams.get('product_id') || '')
  const [comparisons, setComparisons] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingCompare, setLoadingCompare] = useState(false)
  const [specialConditions, setSpecialConditions] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submittedApp, setSubmittedApp] = useState(null)

  useEffect(() => {
    api.get('/shipments').then(({ data }) => {
      setShipments(data)
      if (data.length) setSelectedShipment(searchParams.get('shipment_id') || data[0].id)
    }).catch((err) => setError(apiError(err, 'Could not load your shipments.'))).finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedShipment) return
    setLoadingCompare(true)
    api.get(`/shipments/${selectedShipment}/compare-products`)
      .then(({ data }) => {
        setComparisons(data)
        if (!data.some((c) => c.product.id === selectedProduct && c.is_eligible)) {
          const best = [...data].filter((c) => c.is_eligible).sort((a, b) => Number(a.quotation.total_premium) - Number(b.quotation.total_premium))[0]
          setSelectedProduct(best?.product.id || '')
        }
      })
      .catch((err) => { setComparisons([]); setError(apiError(err, 'Could not price this shipment.')) })
      .finally(() => setLoadingCompare(false))
  }, [selectedShipment]) // eslint-disable-line react-hooks/exhaustive-deps

  const shipment = shipments.find((s) => s.id === selectedShipment)
  const chosen = comparisons.find((c) => c.product.id === selectedProduct)
  const q = chosen?.quotation

  const submit = async (e) => {
    e.preventDefault()
    if (!selectedShipment || !selectedProduct) { setError('Choose a shipment and an eligible product.'); return }
    setError(''); setSubmitting(true)
    try {
      const { data } = await api.post('/applications', { shipment_id: selectedShipment, product_id: selectedProduct, requested_insured_amount: shipment.declared_value, special_conditions: specialConditions || null })
      setSubmittedApp(data)
    } catch (err) { setError(apiError(err, 'The application could not be submitted.')) } finally { setSubmitting(false) }
  }

  if (submittedApp) return <DashboardLayout title="Application submitted">
    <div className="mx-auto max-w-xl">
      <EmptyState icon={CheckBadgeIcon} title={`Application ${submittedApp.application_number} submitted`}
        description={`Quoted premium ${inr(submittedApp.calculated_premium)}. An underwriter will review it and you'll be notified of the decision; approved applications can then be paid from the Applications page.`}
        action={<><Button to="/customer/applications">View applications</Button><Button to="/customer" variant="secondary">Dashboard</Button></>} />
    </div>
  </DashboardLayout>

  return <DashboardLayout title="New application">
    <PageHeader title="Get a quotation and apply" description="Premiums are calculated by MarineSure's underwriting engine for your specific shipment. Nothing is priced in the browser." />
    {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
    {loading ? <LoadingRows /> : !shipments.length ? <EmptyState icon={CubeIcon} title="Register a shipment first" description="A quotation is priced for a specific shipment: its cargo, route, transport mode and declared value." action={<Button to="/customer/shipments/new">Register shipment</Button>} /> :
      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card title="1 · Shipment">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Shipment"><Select value={selectedShipment} onChange={(e) => setSelectedShipment(e.target.value)}>
                {shipments.map((s) => <option key={s.id} value={s.id}>{s.shipment_number} · {s.origin_location} → {s.destination_location}</option>)}
              </Select></Field>
              {shipment && <dl className="grid grid-cols-3 gap-3 rounded-xl bg-navy-950/50 p-3 text-xs">
                <div><dt className="text-navy-400">Declared value</dt><dd className="tabular mt-0.5 font-semibold text-white">{inr(shipment.declared_value, { compact: true })}</dd></div>
                <div><dt className="text-navy-400">Mode</dt><dd className="mt-0.5 font-semibold capitalize text-white">{shipment.transport_mode}</dd></div>
                <div><dt className="text-navy-400">Cargo</dt><dd className="mt-0.5 truncate font-semibold capitalize text-white">{shipment.cargo_items?.[0]?.category || '—'}</dd></div>
              </dl>}
            </div>
          </Card>
          <Card title="2 · Choose cover" description="Eligibility and price for this shipment.">
            {loadingCompare ? <LoadingRows rows={3} /> : <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
              {comparisons.map(({ product, quotation, is_eligible, eligibility_notes }) => {
                const active = selectedProduct === product.id
                return <button type="button" role="radio" aria-checked={active} key={product.id} disabled={!is_eligible} onClick={() => setSelectedProduct(product.id)}
                  className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'border-teal-500 bg-teal-400/10 shadow-glow' : 'border-navy-700 bg-navy-950/40 hover:border-navy-600'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-white">{product.product_name}</span>
                    {active ? <CheckCircleIcon className="h-5 w-5 shrink-0 text-teal-300" aria-hidden /> : <span className="font-mono text-[11px] text-gold-300">{product.product_code}</span>}
                  </div>
                  <p className="tabular mt-3 text-xl font-bold text-white">{inr(quotation.total_premium)}</p>
                  <p className="text-xs text-navy-400">Deductible {inr(quotation.deductible_amount)} · {product.coverage_duration_days} days</p>
                  {!is_eligible && <p className="mt-2 text-xs text-rose-300">{eligibility_notes.join('; ')}</p>}
                </button>
              })}
            </div>}
          </Card>
          <Card title="3 · Special conditions (optional)">
            <TextArea value={specialConditions} onChange={(e) => setSpecialConditions(e.target.value)} placeholder="For example: reefer kept at −18 °C, armed escort for high-value cargo" />
          </Card>
        </div>
        <div className="xl:sticky xl:top-24 xl:self-start">
          <Card title="Premium breakdown" description={chosen ? chosen.product.product_name : 'Select a product'}>
            {!q ? <p className="text-sm text-navy-400">Choose an eligible product to see the quotation.</p> : <>
              <dl className="tabular space-y-2.5 text-sm">
                <div className="flex justify-between"><dt className="text-navy-300">Sum insured</dt><dd className="text-white">{inr(q.insured_value)}</dd></div>
                <div className="flex justify-between"><dt className="text-navy-300">Effective rate</dt><dd className="text-white">{(Number(q.rate_applied) * 100).toFixed(3)}%</dd></div>
                <div className="flex justify-between"><dt className="text-navy-300">Base premium</dt><dd className="text-white">{inr(q.base_premium)}</dd></div>
                <div className="flex justify-between"><dt className="text-navy-300">Additional charges</dt><dd className="text-white">{inr(q.additional_charges)}</dd></div>
                <div className="flex justify-between"><dt className="text-navy-300">GST</dt><dd className="text-white">{inr(q.tax_amount)}</dd></div>
                <div className="flex justify-between border-t border-navy-800 pt-3 text-base"><dt className="font-semibold text-white">Total premium</dt><dd className="font-bold text-white">{inr(q.total_premium)}</dd></div>
                <div className="flex justify-between text-xs"><dt className="text-navy-400">Deductible per claim</dt><dd className="text-navy-200">{inr(q.deductible_amount)}</dd></div>
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-navy-400">The effective rate combines the product base rate with cargo and transport-mode factors. The underwriter may still adjust terms during review.</p>
            </>}
            <Button type="submit" size="lg" className="mt-5 w-full" loading={submitting} disabled={!q}>Submit for underwriting</Button>
          </Card>
        </div>
      </form>}
  </DashboardLayout>
}
