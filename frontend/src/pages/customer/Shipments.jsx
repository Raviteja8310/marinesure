import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon, ArrowRightIcon, CheckBadgeIcon, CubeIcon, DocumentArrowUpIcon, DocumentTextIcon, PlusCircleIcon, PlusIcon, TrashIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import {
  Alert, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, StatusBadge, Stepper, TextArea, useToast,
} from '../../components/ui'
import { RouteSummary } from '../../components/dashboard'
import { apiError, date, humanize, inr } from '../../lib/format'
import api from '../../services/api'

const MODES = ['sea', 'air', 'road', 'rail', 'multimodal']
const CATEGORIES = ['general', 'electronics', 'machinery', 'perishable', 'hazardous', 'fragile', 'textiles', 'chemicals', 'pharmaceuticals', 'automotive']
const CONTAINER_TYPES = ['20ft', '40ft', '40ft_hc', 'reefer_20ft', 'reefer_40ft', 'open_top', 'flat_rack']
const DOC_TYPES = ['commercial_invoice', 'packing_list', 'shipping_document', 'other']

// ── List ─────────────────────────────────────────────────────────

function ShipmentDetail({ shipment, onClose, isCustomer }) {
  if (!shipment) return null
  const total = (shipment.cargo_items || []).reduce((s, c) => s + Number(c.value || 0), 0)
  return <Modal open={!!shipment} onClose={onClose} size="xl" title={shipment.shipment_number} description={`Registered ${date(shipment.created_at)}`}
    footer={<>{isCustomer && <Button to={`/customer/applications/new?shipment_id=${shipment.id}`} icon={ArrowRightIcon}>Get a quotation</Button>}<Button variant="secondary" onClick={onClose}>Close</Button></>}>
    <div className="grid gap-6 lg:grid-cols-2">
      <div><div className="mb-3 flex items-center gap-2"><StatusBadge status={shipment.status} /><span className="text-xs text-navy-400">Declared value {inr(shipment.declared_value)}</span></div><RouteSummary shipment={shipment} /></div>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-white">Cargo · {inr(total)}</p>
          <ul className="divide-y divide-navy-800 rounded-xl border border-navy-800">{(shipment.cargo_items || []).map((c) => <li key={c.id} className="flex justify-between gap-3 px-3 py-2.5 text-sm">
            <span className="min-w-0"><span className="block font-medium text-white">{c.cargo_name}</span><span className="text-xs capitalize text-navy-400">{humanize(c.category)} · {c.quantity} {c.unit}</span></span>
            <span className="tabular shrink-0 text-navy-100">{inr(c.value)}</span></li>)}</ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-white">Containers</p>
          {(shipment.containers || []).length ? <ul className="flex flex-wrap gap-2">{shipment.containers.map((c) => <li key={c.id} className="rounded-lg border border-navy-700 bg-navy-950/50 px-2.5 py-1 font-mono text-xs text-navy-100">{c.container_number} · {humanize(c.container_type)}</li>)}</ul> : <p className="text-sm text-navy-400">None recorded.</p>}
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-white">Documents</p>
          {(shipment.documents || []).length ? <ul className="space-y-1.5">{shipment.documents.map((d) => <li key={d.id} className="flex items-center gap-2 text-sm text-navy-100"><DocumentTextIcon className="h-4 w-4 text-teal-300" aria-hidden />{d.original_filename}<span className="text-xs text-navy-400">· {humanize(d.document_type)}</span></li>)}</ul> : <p className="text-sm text-navy-400">No documents uploaded.</p>}
        </div>
      </div>
    </div>
  </Modal>
}

export function ShipmentList() {
  const { user } = useAuth()
  const isCustomer = (user?.roles || []).includes('customer')
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(null)
  useEffect(() => {
    api.get('/shipments').then(({ data }) => setShipments(data)).catch((err) => setError(apiError(err, 'Could not load shipments.'))).finally(() => setLoading(false))
  }, [])
  return <DashboardLayout title="Shipments">
    <PageHeader title="Shipments" description={isCustomer ? 'Every shipment you have registered, with its route, cargo and voyage milestones.' : 'Shipments assigned to your company.'}
      actions={isCustomer && <Button to="/customer/shipments/new" icon={PlusCircleIcon}>Register shipment</Button>} />
    {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
    <Card bodyClassName="p-4 sm:p-5">
      <DataTable loading={loading} rows={shipments} onRowClick={setOpen} searchPlaceholder="Search number, port, cargo…"
        empty={<EmptyState icon={CubeIcon} title="No shipments yet" description={isCustomer ? 'Register a shipment to get it insured.' : 'Shipments assigned to your company appear here.'} action={isCustomer && <Button to="/customer/shipments/new" size="sm">Register shipment</Button>} />}
        columns={[
          { key: 'shipment_number', header: 'Shipment', render: (s) => <span className="whitespace-nowrap font-semibold text-white">{s.shipment_number}</span> },
          { key: 'route', header: 'Route', sortValue: (s) => s.origin_location, render: (s) => <span><span className="text-white">{s.origin_location}</span><span className="text-navy-400"> → </span><span className="text-white">{s.destination_location}</span></span> },
          { key: 'cargo', header: 'Cargo', sortable: false, render: (s) => s.cargo_items?.map((c) => c.cargo_name).join(', ') || '—' },
          { key: 'transport_mode', header: 'Mode', render: (s) => <span className="capitalize">{s.transport_mode}</span> },
          { key: 'declared_value', header: 'Value', align: 'right', render: (s) => <span className="tabular whitespace-nowrap">{inr(s.declared_value, { compact: true })}</span> },
          { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
          { key: 'expected_arrival_date', header: 'ETA', render: (s) => <span className="whitespace-nowrap">{date(s.expected_arrival_date)}</span> },
        ]} />
    </Card>
    <ShipmentDetail shipment={open} onClose={() => setOpen(null)} isCustomer={isCustomer} />
  </DashboardLayout>
}

// ── Registration wizard ──────────────────────────────────────────

const STEPS = [
  { label: 'Shipment' }, { label: 'Route' }, { label: 'Cargo' }, { label: 'Containers' }, { label: 'Carrier' }, { label: 'Documents' }, { label: 'Review' },
]
const blankCargo = () => ({ cargo_name: '', category: 'general', quantity: '1', unit: 'units', value: '', description: '' })
const blankContainer = () => ({ container_number: '', container_type: '20ft', seal_number: '' })

function validate(step, f) {
  const e = {}
  if (step === 0) {
    if (f.departure_date && f.expected_arrival_date && f.expected_arrival_date < f.departure_date) e.expected_arrival_date = 'Arrival must be after departure.'
  }
  if (step === 1) {
    ['origin_country', 'origin_location', 'destination_country', 'destination_location'].forEach((k) => { if ((f[k] || '').trim().length < 2) e[k] = 'Required (at least 2 characters).' })
  }
  if (step === 2) {
    f.cargo_items.forEach((c, i) => {
      if (!c.cargo_name.trim()) e[`cargo_${i}_name`] = 'Name the cargo.'
      if (!(Number(c.quantity) > 0)) e[`cargo_${i}_qty`] = 'Quantity must be above zero.'
      if (c.value === '' || Number(c.value) < 0) e[`cargo_${i}_value`] = 'Enter the value.'
    })
  }
  if (step === 3) {
    f.containers.forEach((c, i) => { if (c.container_number && !/^[A-Z]{4}\d{6,7}$/i.test(c.container_number.trim())) e[`cont_${i}`] = 'Use the ISO format, e.g. MSCU1234567.' })
  }
  return e
}

export function RegisterShipment() {
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [f, setF] = useState({
    transport_mode: 'sea', currency: 'INR', departure_date: '', expected_arrival_date: '', packaging_details: '', special_handling: '',
    origin_country: 'India', origin_location: '', destination_country: '', destination_location: '', route_details: '',
    cargo_items: [blankCargo()], containers: [], shipping_company_id: '',
  })
  const [docs, setDocs] = useState([])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [blOpen, setBlOpen] = useState(false)
  const [blText, setBlText] = useState('')
  const [blBusy, setBlBusy] = useState(false)
  const [blNote, setBlNote] = useState('')

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const setItem = (list, i, k) => (e) => setF((p) => ({ ...p, [list]: p[list].map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) }))
  const total = f.cargo_items.reduce((s, c) => s + Number(c.value || 0), 0)

  const next = () => { const e = validate(step, f); setErrors(e); if (!Object.keys(e).length) setStep((s) => Math.min(s + 1, STEPS.length - 1)) }
  const back = () => { setErrors({}); setStep((s) => Math.max(0, s - 1)) }
  const goTo = (i) => { for (let s = 0; s < i; s += 1) { const e = validate(s, f); if (Object.keys(e).length) { setErrors(e); setStep(s); return } } setStep(i) }

  const parseBl = async () => {
    setBlBusy(true); setBlNote('')
    try {
      const { data: x } = await api.post('/ai/parse-bill-of-lading', { document_text: blText, document_name: 'bill_of_lading.txt' })
      const filled = []
      setF((p) => {
        const n = { ...p }
        if (x.port_of_loading) { n.origin_location = x.port_of_loading; filled.push('port of loading') }
        if (x.port_of_discharge) { n.destination_location = x.port_of_discharge; filled.push('port of discharge') }
        if (x.cargo_description) { n.cargo_items = [{ ...p.cargo_items[0], cargo_name: x.cargo_description, category: x.cargo_category || p.cargo_items[0].category, value: x.declared_value ? String(x.declared_value) : p.cargo_items[0].value }, ...p.cargo_items.slice(1)]; filled.push('cargo') }
        if (x.container_numbers?.length) { n.containers = x.container_numbers.map((c) => ({ ...blankContainer(), container_number: c })); filled.push(`${x.container_numbers.length} container(s)`) }
        return n
      })
      setBlNote(filled.length ? `Filled from the B/L: ${filled.join(', ')}. Check every value before submitting.` : 'No recognisable fields were found in that text.')
    } catch (err) { setBlNote(apiError(err, 'The bill of lading text could not be read.')) } finally { setBlBusy(false) }
  }

  const submit = async () => {
    setSaving(true); setServerError('')
    const payload = {
      transport_mode: f.transport_mode, currency: f.currency,
      departure_date: f.departure_date || null, expected_arrival_date: f.expected_arrival_date || null,
      packaging_details: f.packaging_details || null, special_handling: f.special_handling || null,
      origin_country: f.origin_country.trim(), origin_location: f.origin_location.trim(), destination_country: f.destination_country.trim(), destination_location: f.destination_location.trim(),
      route_details: f.route_details || null, shipping_company_id: f.shipping_company_id.trim() || null,
      cargo_items: f.cargo_items.map((c) => ({ cargo_name: c.cargo_name.trim(), category: c.category, quantity: Number(c.quantity), unit: c.unit || 'units', value: String(Number(c.value || 0).toFixed(2)), description: c.description || null })),
      containers: f.containers.filter((c) => c.container_number.trim()).map((c) => ({ container_number: c.container_number.trim().toUpperCase(), container_type: c.container_type, seal_number: c.seal_number || null })),
    }
    try {
      const { data: shipment } = await api.post('/shipments', payload)
      const failed = []
      for (const d of docs) {
        const fd = new FormData(); fd.append('document_type', d.type); fd.append('file', d.file)
        try { await api.post(`/shipments/${shipment.id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }) } catch { failed.push(d.file.name) }
      }
      toast(failed.length ? `Shipment ${shipment.shipment_number} registered, but ${failed.length} document(s) failed to upload.` : `Shipment ${shipment.shipment_number} registered.`, failed.length ? 'warning' : 'success')
      navigate(`/customer/applications/new?shipment_id=${shipment.id}`)
    } catch (err) { setServerError(apiError(err, 'The shipment could not be registered.')) } finally { setSaving(false) }
  }

  const E = ({ k }) => (errors[k] ? <p className="mt-1 text-xs text-rose-300">{errors[k]}</p> : null)

  return <DashboardLayout title="Register shipment">
    <PageHeader title="Register a shipment" description="Seven short steps. You can go back at any point; nothing is saved until you submit."
      actions={<Button variant="secondary" icon={DocumentTextIcon} onClick={() => setBlOpen(true)}>Fill from bill of lading</Button>} />
    <Card className="mb-6" bodyClassName="p-4"><Stepper steps={STEPS} current={step} /></Card>
    {serverError && <Alert tone="danger" className="mb-4">{serverError}</Alert>}

    <Card title={`${step + 1}. ${['Shipment details', 'Origin and destination', 'Cargo', 'Containers', 'Shipping company', 'Documents', 'Review and submit'][step]}`}>
      {step === 0 && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Transport mode" required><Select value={f.transport_mode} onChange={set('transport_mode')}>{MODES.map((m) => <option key={m} value={m}>{humanize(m)}</option>)}</Select></Field>
        <Field label="Currency"><Select value={f.currency} onChange={set('currency')}>{['INR', 'USD', 'EUR'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <div />
        <Field label="Departure date"><Input type="date" value={f.departure_date} onChange={set('departure_date')} /></Field>
        <div><Field label="Expected arrival"><Input type="date" value={f.expected_arrival_date} onChange={set('expected_arrival_date')} /></Field><E k="expected_arrival_date" /></div>
        <div />
        <Field label="Packaging" className="sm:col-span-2 lg:col-span-1"><Input value={f.packaging_details} onChange={set('packaging_details')} placeholder="e.g. Palletised, shrink-wrapped" /></Field>
        <Field label="Special handling" className="sm:col-span-2"><Input value={f.special_handling} onChange={set('special_handling')} placeholder="e.g. Keep frozen at −18 °C" /></Field>
      </div>}
      {step === 1 && <div className="grid gap-4 sm:grid-cols-2">
        <div><Field label="Origin country" required><Input value={f.origin_country} onChange={set('origin_country')} /></Field><E k="origin_country" /></div>
        <div><Field label="Port / place of loading" required><Input value={f.origin_location} onChange={set('origin_location')} placeholder="e.g. Nhava Sheva (JNPT)" /></Field><E k="origin_location" /></div>
        <div><Field label="Destination country" required><Input value={f.destination_country} onChange={set('destination_country')} /></Field><E k="destination_country" /></div>
        <div><Field label="Port / place of discharge" required><Input value={f.destination_location} onChange={set('destination_location')} placeholder="e.g. Rotterdam" /></Field><E k="destination_location" /></div>
        <Field label="Route notes" className="sm:col-span-2" hint="Transhipment ports or canal transits help the underwriter assess route risk."><TextArea value={f.route_details} onChange={set('route_details')} /></Field>
      </div>}
      {step === 2 && <div className="space-y-4">
        {f.cargo_items.map((c, i) => <div key={i} className="grid gap-3 rounded-xl border border-navy-800 bg-navy-950/40 p-4 sm:grid-cols-6">
          <div className="sm:col-span-2"><Field label="Cargo" required><Input value={c.cargo_name} onChange={setItem('cargo_items', i, 'cargo_name')} /></Field><E k={`cargo_${i}_name`} /></div>
          <Field label="Category"><Select value={c.category} onChange={setItem('cargo_items', i, 'category')}>{CATEGORIES.map((x) => <option key={x} value={x}>{humanize(x)}</option>)}</Select></Field>
          <div><Field label="Quantity" required><Input type="number" min="1" value={c.quantity} onChange={setItem('cargo_items', i, 'quantity')} /></Field><E k={`cargo_${i}_qty`} /></div>
          <Field label="Unit"><Input value={c.unit} onChange={setItem('cargo_items', i, 'unit')} /></Field>
          <div><Field label={`Value (${f.currency})`} required><Input type="number" min="0" step="0.01" value={c.value} onChange={setItem('cargo_items', i, 'value')} /></Field><E k={`cargo_${i}_value`} /></div>
          <Field label="Description" className="sm:col-span-5"><Input value={c.description} onChange={setItem('cargo_items', i, 'description')} /></Field>
          <div className="flex items-end">{f.cargo_items.length > 1 && <Button variant="ghost" size="sm" icon={TrashIcon} onClick={() => setF((p) => ({ ...p, cargo_items: p.cargo_items.filter((_, j) => j !== i) }))}>Remove</Button>}</div>
        </div>)}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" icon={PlusIcon} onClick={() => setF((p) => ({ ...p, cargo_items: [...p.cargo_items, blankCargo()] }))}>Add cargo line</Button>
          <p className="text-sm text-navy-300">Declared value: <span className="tabular font-semibold text-white">{inr(total)}</span></p>
        </div>
      </div>}
      {step === 3 && <div className="space-y-3">
        {!f.containers.length && <p className="text-sm text-navy-400">Optional. Add containers if your cargo travels containerised.</p>}
        {f.containers.map((c, i) => <div key={i} className="grid items-end gap-3 rounded-xl border border-navy-800 bg-navy-950/40 p-4 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
          <div><Field label="Container number"><Input value={c.container_number} onChange={setItem('containers', i, 'container_number')} placeholder="ABCU1234567" /></Field><E k={`cont_${i}`} /></div>
          <Field label="Type"><Select value={c.container_type} onChange={setItem('containers', i, 'container_type')}>{CONTAINER_TYPES.map((x) => <option key={x} value={x}>{humanize(x)}</option>)}</Select></Field>
          <Field label="Seal number"><Input value={c.seal_number} onChange={setItem('containers', i, 'seal_number')} /></Field>
          <Button variant="ghost" icon={TrashIcon} aria-label="Remove container" onClick={() => setF((p) => ({ ...p, containers: p.containers.filter((_, j) => j !== i) }))} />
        </div>)}
        <Button variant="secondary" icon={PlusIcon} onClick={() => setF((p) => ({ ...p, containers: [...p.containers, blankContainer()] }))}>Add container</Button>
      </div>}
      {step === 4 && <div className="max-w-xl space-y-4">
        <Alert tone="info">MarineSure doesn't publish a directory of shipping companies yet. If your carrier has given you their MarineSure account ID, enter it so they can record milestones; otherwise leave it blank and an officer can assign them later.</Alert>
        <Field label="Shipping company account ID (optional)"><Input value={f.shipping_company_id} onChange={set('shipping_company_id')} placeholder="e.g. 3f2b…" /></Field>
      </div>}
      {step === 5 && <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-navy-600 bg-navy-950/40 px-6 py-10 text-center transition hover:border-teal-500">
          <DocumentArrowUpIcon className="h-8 w-8 text-teal-300" aria-hidden />
          <span className="text-sm font-semibold text-white">Choose documents to upload</span>
          <span className="text-xs text-navy-400">PDF, JPEG, PNG or text · up to 10 MB each · uploaded after the shipment is created</span>
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.txt" className="sr-only" onChange={(e) => { setDocs((d) => [...d, ...[...e.target.files].map((file) => ({ file, type: 'commercial_invoice' }))]); e.target.value = '' }} />
        </label>
        {docs.length > 0 && <ul className="space-y-2">{docs.map((d, i) => <li key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-navy-800 bg-navy-950/40 px-3 py-2">
          <DocumentTextIcon className="h-5 w-5 text-teal-300" aria-hidden /><span className="min-w-0 flex-1 truncate text-sm text-white">{d.file.name}</span>
          <Select aria-label={`Type of ${d.file.name}`} className="!w-48" value={d.type} onChange={(e) => setDocs((all) => all.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>{DOC_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select>
          <Button variant="ghost" size="sm" icon={TrashIcon} aria-label="Remove document" onClick={() => setDocs((all) => all.filter((_, j) => j !== i))} />
        </li>)}</ul>}
      </div>}
      {step === 6 && <div className="grid gap-6 lg:grid-cols-2">
        <dl className="space-y-2 text-sm">
          {[['Mode', humanize(f.transport_mode)], ['Route', `${f.origin_location}, ${f.origin_country} → ${f.destination_location}, ${f.destination_country}`], ['Dates', `${f.departure_date ? date(f.departure_date) : 'Not set'} → ${f.expected_arrival_date ? date(f.expected_arrival_date) : 'Not set'}`], ['Containers', f.containers.filter((c) => c.container_number).map((c) => c.container_number).join(', ') || 'None'], ['Carrier', f.shipping_company_id || 'Not assigned'], ['Documents', docs.length ? `${docs.length} file(s)` : 'None']].map(([k, v]) =>
            <div key={k} className="flex justify-between gap-4 border-b border-navy-800 pb-2"><dt className="text-navy-400">{k}</dt><dd className="text-right capitalize-first text-white">{v}</dd></div>)}
        </dl>
        <div>
          <p className="mb-2 text-sm font-semibold text-white">Cargo · {inr(total)}</p>
          <ul className="space-y-1.5 text-sm">{f.cargo_items.map((c, i) => <li key={i} className="flex justify-between gap-3 text-navy-100"><span>{c.cargo_name} <span className="text-navy-400">· {c.quantity} {c.unit}</span></span><span className="tabular">{inr(c.value)}</span></li>)}</ul>
          <Alert tone="info" className="mt-5">After registering you'll go straight to the quotation, priced for this shipment.</Alert>
        </div>
      </div>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-navy-800 pt-5">
        <Button variant="ghost" icon={ArrowLeftIcon} onClick={back} disabled={step === 0}>Back</Button>
        <div className="flex gap-2">
          {step < STEPS.length - 1 && step > 0 && <Button variant="secondary" onClick={() => goTo(STEPS.length - 1)}>Skip to review</Button>}
          {step < STEPS.length - 1 ? <Button iconRight={ArrowRightIcon} onClick={next}>Continue</Button> : <Button icon={CheckBadgeIcon} loading={saving} onClick={submit}>Register shipment</Button>}
        </div>
      </div>
    </Card>

    <Modal open={blOpen} onClose={() => setBlOpen(false)} size="lg" title="Fill from a bill of lading" description="Paste the text of your B/L. Recognised fields fill the form; nothing else is assumed."
      footer={<><Button variant="secondary" onClick={() => setBlOpen(false)}>Close</Button><Button onClick={parseBl} loading={blBusy} disabled={blText.trim().length < 20}>Read bill of lading</Button></>}>
      <TextArea rows={10} value={blText} onChange={(e) => setBlText(e.target.value)} placeholder="Paste the bill of lading text here…" />
      {blNote && <Alert tone="info" className="mt-4">{blNote}</Alert>}
    </Modal>
  </DashboardLayout>
}
