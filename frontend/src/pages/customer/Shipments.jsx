import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import api from '../../services/api'

const NAV = [
  { name: 'Dashboard', path: '/customer', icon: '📊' },
  { name: 'My Shipments', path: '/customer/shipments', icon: '🚢' },
  { name: 'Register Shipment', path: '/customer/shipments/new', icon: '➕' },
]

const EMPTY = {
  transport_mode: 'sea',
  origin_country: 'India',
  origin_location: 'Nhava Sheva Port, Mumbai',
  destination_country: 'Netherlands',
  destination_location: 'Port of Rotterdam',
  currency: 'INR',
  cargo_name: 'Industrial Valve Units',
  category: 'machinery',
  quantity: 50,
  value: '2500000.00',
  container_number: 'MSCU7291840',
  container_type: '20ft',
}

const SAMPLE_BL_TEXT = `MEDITERRANEAN SHIPPING COMPANY S.A.
BILL OF LADING FOR OCEAN TRANSPORT
B/L NUMBER: BL-MSCU8491028
VESSEL: MSC ISABELLA VOYAGE: 2408W
PORT OF LOADING (POL): Jawaharlal Nehru Port (Nhava Sheva), India
PORT OF DISCHARGE (POD): Port of Rotterdam, Netherlands
SHIPPER: Apex Export Logistics Pvt Ltd, Mumbai, India
CONSIGNEE: EuroMarine Distribution BV, Rotterdam
CONTAINER NO: MSCU7291840 / SEAL: SL948102
DESCRIPTION OF GOODS: 50 Wooden Crates of Industrial High-Pressure Valve Assemblies
CARGO CATEGORY: machinery
TOTAL DECLARED VALUE: INR 3,500,000.00
GROSS WEIGHT: 18,400 KGS`

export function ShipmentList() {
  const [shipments, setShipments] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/shipments')
      .then((res) => setShipments(res.data))
      .catch(() => setError('Could not load shipments'))
  }, [])

  return (
    <DashboardLayout title="My Shipments" roleLabel="Customer" navigation={NAV}>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-slate-400">
          Manage registered sea, air, and multimodal cargo consignments under active marine coverage.
        </p>
        <Link
          to="/customer/shipments/new"
          className="px-4 py-2 bg-marine-600 hover:bg-marine-500 rounded-lg text-sm font-semibold transition"
        >
          ➕ Register New Shipment
        </Link>
      </div>
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-xs uppercase bg-slate-950/40">
            <tr>
              <th className="text-left px-4 py-3">Shipment #</th>
              <th className="text-left px-4 py-3">Mode</th>
              <th className="text-left px-4 py-3">Route (Origin &rarr; Destination)</th>
              <th className="text-left px-4 py-3">Declared Value</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Registered</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map((s) => (
              <tr key={s.id} className="border-t border-slate-800 hover:bg-slate-800/20">
                <td className="px-4 py-3 font-mono text-marine-300 font-semibold">{s.shipment_number}</td>
                <td className="px-4 py-3 text-xs uppercase text-slate-300">{s.transport_mode}</td>
                <td className="px-4 py-3 text-xs text-slate-300">
                  {s.origin_location} ({s.origin_country}) &rarr; {s.destination_location} ({s.destination_country})
                </td>
                <td className="px-4 py-3 font-mono font-medium text-white">
                  ₹{Number(s.declared_value).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase bg-marine-500/10 text-marine-400 border border-marine-500/20">
                    {s.status.replaceAll('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs text-slate-400">
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {shipments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No shipments registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  )
}

export function RegisterShipment() {
  const [form, setForm] = useState(EMPTY)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Document AI State
  const [blText, setBlText] = useState(SAMPLE_BL_TEXT)
  const [parsing, setParsing] = useState(false)
  const [aiMessage, setAiMessage] = useState('')

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleParseBL = async () => {
    setParsing(true)
    setError('')
    setAiMessage('')
    try {
      const res = await api.post('/ai/parse-bill-of-lading', {
        document_text: blText,
        document_name: 'Ocean_Bill_of_Lading.txt',
      })
      const ext = res.data

      setForm((prev) => ({
        ...prev,
        origin_country: 'India',
        origin_location: ext.port_of_loading,
        destination_country: 'Netherlands',
        destination_location: ext.port_of_discharge,
        cargo_name: ext.cargo_description,
        category: ext.cargo_category || 'machinery',
        value: ext.declared_value ? String(ext.declared_value) : prev.value,
        container_number: ext.container_numbers?.[0] || 'MSCU7291840',
      }))
      setAiMessage(`✨ Extracted B/L ${ext.bl_number} (Vessel: ${ext.vessel_name}, Confidence: ${ext.confidence_score}%)`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to parse Bill of Lading')
    } finally {
      setParsing(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    const payload = {
      transport_mode: form.transport_mode,
      origin_country: form.origin_country,
      origin_location: form.origin_location,
      destination_country: form.destination_country,
      destination_location: form.destination_location,
      currency: form.currency,
      cargo_items: [
        {
          cargo_name: form.cargo_name,
          category: form.category,
          quantity: Number(form.quantity),
          value: form.value,
        },
      ],
      containers: form.container_number
        ? [{ container_number: form.container_number, container_type: form.container_type }]
        : [],
    }
    try {
      const res = await api.post('/shipments', payload)
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not register the shipment')
    } finally {
      setSaving(false)
    }
  }

  const field = (name, label, type = 'text') => (
    <label className="block text-xs text-slate-400">
      {label}
      <input
        name={name}
        type={type}
        required
        value={form[name]}
        onChange={set}
        className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
      />
    </label>
  )

  return (
    <DashboardLayout title="Register Shipment & Document AI" roleLabel="Customer" navigation={NAV}>
      {result ? (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 max-w-xl">
          <p className="font-semibold text-emerald-300">Shipment Successfully Registered</p>
          <p className="mt-2 font-mono text-xl text-white">{result.shipment_number}</p>
          <p className="text-sm text-slate-400 mt-1">
            Declared value: {result.currency} ₹{Number(result.declared_value).toLocaleString()}
          </p>
          <div className="mt-4 flex gap-4">
            <Link
              to="/customer/products"
              className="px-4 py-2 bg-marine-600 hover:bg-marine-500 text-white rounded-lg text-xs font-semibold"
            >
              Get Instant Insurance Quotes &rarr;
            </Link>
            <Link to="/customer/shipments" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs">
              View All Shipments
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Smart B/L Parser Box */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 h-fit">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">📄</span>
              <h3 className="text-sm font-bold text-white">Smart Bill of Lading Extractor</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Paste or inspect maritime Bill of Lading manifest text to auto-fill cargo, container, route, and valuation details.
            </p>

            <textarea
              rows={8}
              value={blText}
              onChange={(e) => setBlText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-[11px] font-mono text-slate-300 mb-3"
            />

            <button
              type="button"
              onClick={handleParseBL}
              disabled={parsing}
              className="w-full py-2 bg-marine-700 hover:bg-marine-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
            >
              {parsing ? 'Parsing...' : '⚡ Auto-Fill Form from B/L'}
            </button>

            {aiMessage && (
              <div className="mt-3 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px]">
                {aiMessage}
              </div>
            )}
          </div>

          {/* Shipment Registration Form */}
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-bold text-white mb-4">Cargo Consignment Particulars</h3>
            <form onSubmit={submit} className="grid grid-cols-2 gap-4">
              {error && <p className="col-span-2 text-red-400 text-xs">{String(error)}</p>}
              <label className="block text-xs text-slate-400">
                Transport Mode
                <select
                  name="transport_mode"
                  value={form.transport_mode}
                  onChange={set}
                  className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                >
                  {['sea', 'air', 'road', 'rail', 'multimodal'].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              {field('currency', 'Currency')}
              {field('origin_country', 'Origin Country')}
              {field('origin_location', 'Port of Loading (POL)')}
              {field('destination_country', 'Destination Country')}
              {field('destination_location', 'Port of Discharge (POD)')}
              {field('cargo_name', 'Cargo Description')}
              <label className="block text-xs text-slate-400">
                Cargo Category
                <select
                  name="category"
                  value={form.category}
                  onChange={set}
                  className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                >
                  <option value="general">General Cargo</option>
                  <option value="machinery">Heavy Machinery / Equipment</option>
                  <option value="electronics">Electronics & IT</option>
                  <option value="perishable">Perishable (Reefer)</option>
                  <option value="hazardous">Hazardous / Dangerous Goods</option>
                  <option value="fragile">Fragile Goods</option>
                  <option value="textiles">Textiles & Apparel</option>
                </select>
              </label>
              {field('quantity', 'Quantity Units', 'number')}
              {field('value', 'Total Declared Value (INR)')}
              <label className="block text-xs text-slate-400">
                Container Number
                <input
                  name="container_number"
                  value={form.container_number}
                  onChange={set}
                  className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-mono"
                />
              </label>
              <button
                disabled={saving}
                className="col-span-2 py-2.5 bg-marine-600 hover:bg-marine-500 rounded-lg text-sm font-semibold disabled:opacity-50 text-white transition"
              >
                {saving ? 'Saving...' : 'Register Consignment & Proceed'}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
