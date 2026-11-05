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
  origin_country: '',
  origin_location: '',
  destination_country: '',
  destination_location: '',
  currency: 'INR',
  cargo_name: '',
  category: '',
  quantity: 1,
  value: '',
  container_number: '',
  container_type: '20ft',
}

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
      <div className="flex justify-end mb-4">
        <Link
          to="/customer/shipments/new"
          className="px-4 py-2 bg-marine-600 hover:bg-marine-500 rounded-lg text-sm font-semibold"
        >
          Register shipment
        </Link>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Reference</th>
              <th className="text-left px-4 py-3">Route</th>
              <th className="text-left px-4 py-3">Mode</th>
              <th className="text-right px-4 py-3">Declared value</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map((s) => (
              <tr key={s.id} className="border-t border-slate-800">
                <td className="px-4 py-3 font-mono text-marine-300">{s.shipment_number}</td>
                <td className="px-4 py-3">
                  {s.origin_location} → {s.destination_location}
                </td>
                <td className="px-4 py-3 capitalize">{s.transport_mode}</td>
                <td className="px-4 py-3 text-right">
                  {s.currency} {Number(s.declared_value).toLocaleString()}
                </td>
                <td className="px-4 py-3 capitalize">{s.status.replaceAll('_', ' ')}</td>
              </tr>
            ))}
            {shipments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No shipments yet.
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

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value })

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
    <DashboardLayout title="Register Shipment" roleLabel="Customer" navigation={NAV}>
      {result ? (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6">
          <p className="font-semibold text-emerald-300">Shipment registered</p>
          <p className="mt-2 font-mono text-white">{result.shipment_number}</p>
          <p className="text-sm text-slate-400 mt-1">
            Declared value {result.currency} {Number(result.declared_value).toLocaleString()}
          </p>
          <Link to="/customer/shipments" className="inline-block mt-4 text-sm text-marine-300">
            Back to my shipments
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="max-w-2xl grid grid-cols-2 gap-4">
          {error && <p className="col-span-2 text-red-400 text-sm">{String(error)}</p>}
          <label className="block text-xs text-slate-400">
            Transport mode
            <select
              name="transport_mode"
              value={form.transport_mode}
              onChange={set}
              className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
            >
              {['sea', 'air', 'road', 'rail', 'multimodal'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          {field('currency', 'Currency')}
          {field('origin_country', 'Origin country')}
          {field('origin_location', 'Origin location')}
          {field('destination_country', 'Destination country')}
          {field('destination_location', 'Destination location')}
          {field('cargo_name', 'Cargo name')}
          {field('category', 'Cargo category')}
          {field('quantity', 'Quantity', 'number')}
          {field('value', 'Cargo value')}
          <label className="block text-xs text-slate-400">
            Container number (optional)
            <input
              name="container_number"
              value={form.container_number}
              onChange={set}
              className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
            />
          </label>
          <button
            disabled={saving}
            className="col-span-2 py-2.5 bg-marine-600 hover:bg-marine-500 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Register shipment'}
          </button>
        </form>
      )}
    </DashboardLayout>
  )
}
