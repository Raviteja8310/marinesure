import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import api from '../../services/api'

const NAV = [
  { name: 'Dashboard', path: '/shipping', icon: '📊' },
  { name: 'Assigned Shipments', path: '/shipping/shipments', icon: '🚢' },
]

const NEXT = [
  'documents_submitted',
  'ready_for_dispatch',
  'dispatched',
  'in_transit',
  'transshipment',
  'arrived',
  'customs_clearance',
  'out_for_delivery',
  'delivered',
]

export default function Tracking() {
  const [shipments, setShipments] = useState([])
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState('dispatched')
  const [location, setLocation] = useState('')
  const [remarks, setRemarks] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = () =>
    api.get('/shipments').then((res) => {
      setShipments(res.data)
      setSelected((current) => res.data.find((s) => s.id === current?.id) || res.data[0] || null)
    })

  useEffect(() => {
    load().catch(() => setError('Could not load assigned shipments'))
  }, [])

  const record = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      await api.post(`/shipments/${selected.id}/milestones`, { status, location, remarks })
      setMessage(`Recorded: ${status.replaceAll('_', ' ')}`)
      setRemarks('')
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not record the milestone')
    }
  }

  return (
    <DashboardLayout title="Shipment Tracking" roleLabel="Shipping" navigation={NAV}>
      {error && <p className="text-red-400 text-sm mb-4">{String(error)}</p>}
      {message && <p className="text-emerald-400 text-sm mb-4">{message}</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl">
          {shipments.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={`w-full text-left px-4 py-3 border-b border-slate-800 text-sm ${
                selected?.id === s.id ? 'bg-marine-600/10' : ''
              }`}
            >
              <span className="font-mono text-marine-300">{s.shipment_number}</span>
              <span className="block text-slate-400">
                {s.origin_location} → {s.destination_location} · {s.status.replaceAll('_', ' ')}
              </span>
            </button>
          ))}
          {shipments.length === 0 && (
            <p className="px-4 py-8 text-center text-slate-500 text-sm">
              No shipments are assigned to your company yet.
            </p>
          )}
        </div>

        {selected && (
          <div className="space-y-4">
            <ol className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-sm space-y-2">
              {selected.milestones.map((m) => (
                <li key={m.id} className="flex justify-between">
                  <span className="capitalize">{m.status.replaceAll('_', ' ')}</span>
                  <span className="text-slate-500">{m.location || '—'}</span>
                </li>
              ))}
            </ol>
            <form onSubmit={record} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
              >
                {NEXT.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
              />
              <input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Remarks"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
              />
              <button className="w-full py-2 bg-marine-600 hover:bg-marine-500 rounded-lg text-sm font-semibold">
                Record milestone
              </button>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
