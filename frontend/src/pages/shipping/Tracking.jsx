import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import api from '../../services/api'

const NAV = [
  { name: 'Dashboard', path: '/shipping', icon: '📊' },
  { name: 'Assigned Shipments', path: '/shipping/shipments', icon: '🚢' },
  { name: 'IoT Telemetry & Tracking', path: '/shipping/tracking', icon: '📡' },
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
  const [status, setStatus] = useState('in_transit')
  const [location, setLocation] = useState('')
  const [remarks, setRemarks] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // IoT Telemetry State
  const [telemetry, setTelemetry] = useState([])
  const [summary, setSummary] = useState(null)
  const [sensorTemp, setSensorTemp] = useState('-18.2')
  const [sensorHumidity, setSensorHumidity] = useState('65')
  const [sensorShock, setSensorShock] = useState('0.4')
  const [sensorDoor, setSensorDoor] = useState('sealed')
  const [ingesting, setIngesting] = useState(false)

  const load = () =>
    api.get('/shipments').then((res) => {
      setShipments(res.data)
      setSelected((current) => res.data.find((s) => s.id === current?.id) || res.data[0] || null)
    })

  useEffect(() => {
    load().catch(() => setError('Could not load assigned shipments'))
  }, [])

  useEffect(() => {
    if (selected) {
      loadTelemetry(selected.id)
    }
  }, [selected])

  const loadTelemetry = async (shipmentId) => {
    try {
      const [tRes, sRes] = await Promise.all([
        api.get(`/telemetry/shipment/${shipmentId}`),
        api.get(`/telemetry/shipment/${shipmentId}/summary`),
      ])
      setTelemetry(tRes.data)
      setSummary(sRes.data)
    } catch (err) {
      console.error(err)
    }
  }

  const record = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      await api.post(`/shipments/${selected.id}/milestones`, { status, location, remarks })
      setMessage(`Recorded milestone: ${status.replaceAll('_', ' ')}`)
      setRemarks('')
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not record milestone')
    }
  }

  const handleSimulateTelemetry = async (e) => {
    e.preventDefault()
    if (!selected) return
    setIngesting(true)
    setMessage('')
    try {
      const res = await api.post('/telemetry/ingest', {
        shipment_id: selected.id,
        temperature_celsius: parseFloat(sensorTemp),
        humidity_pct: parseFloat(sensorHumidity),
        shock_g_force: parseFloat(sensorShock),
        door_status: sensorDoor,
        location_name: location || selected.destination_location,
      })
      if (res.data.is_anomaly) {
        setMessage(`⚠️ Sensor anomaly recorded! Casualty incident automatically filed.`)
      } else {
        setMessage(`IoT sensor telemetry point ingested successfully.`)
      }
      loadTelemetry(selected.id)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to ingest sensor data')
    } finally {
      setIngesting(false)
    }
  }

  return (
    <DashboardLayout title="Shipment Tracking & IoT Telemetry" roleLabel="Carrier / Logistics" navigation={NAV}>
      {error && <p className="text-red-400 text-sm mb-4">{String(error)}</p>}
      {message && <p className="text-emerald-400 text-sm mb-4">{message}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Shipments List */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden h-fit">
          <div className="px-4 py-3 bg-slate-950/40 border-b border-slate-800 text-xs uppercase font-bold text-slate-400">
            Assigned Active Shipments
          </div>
          {shipments.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={`w-full text-left px-4 py-3 border-b border-slate-800 text-sm transition ${
                selected?.id === s.id ? 'bg-marine-600/20 border-l-4 border-l-marine-500' : 'hover:bg-slate-800/40'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-mono text-marine-300 font-semibold">{s.shipment_number}</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {s.transport_mode}
                </span>
              </div>
              <span className="block text-xs text-slate-400 mt-1">
                {s.origin_location} &rarr; {s.destination_location}
              </span>
            </button>
          ))}
          {shipments.length === 0 && (
            <p className="px-4 py-8 text-center text-slate-500 text-sm">
              No shipments are assigned to your company yet.
            </p>
          )}
        </div>

        {/* Center & Right Columns: Milestone Tracker & IoT Telemetry Monitor */}
        {selected && (
          <div className="lg:col-span-2 space-y-6">
            {/* IoT Telemetry KPI Cards */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg">
                  <span className="text-[11px] text-slate-400">Current Temp</span>
                  <p className="text-xl font-bold font-mono text-cyan-400 mt-1">
                    {summary.current_temp !== null ? `${summary.current_temp}°C` : '—'}
                  </p>
                  <span className="text-[10px] text-slate-500">Avg: {summary.avg_temp ?? '—'}°C</span>
                </div>

                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg">
                  <span className="text-[11px] text-slate-400">Max Shock Impact</span>
                  <p className="text-xl font-bold font-mono text-amber-400 mt-1">
                    {summary.max_shock !== null ? `${summary.max_shock}G` : '0.0G'}
                  </p>
                  <span className="text-[10px] text-slate-500">Threshold: 3.0G</span>
                </div>

                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg">
                  <span className="text-[11px] text-slate-400">Container Seal</span>
                  <p className={`text-sm font-bold uppercase mt-2 ${summary.current_door_status === 'sealed' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {summary.current_door_status}
                  </p>
                  <span className="text-[10px] text-slate-500">IoT Seal Telemetry</span>
                </div>

                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg">
                  <span className="text-[11px] text-slate-400">Sensor Health</span>
                  <p className={`text-sm font-bold uppercase mt-2 ${summary.status === 'normal' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {summary.status.toUpperCase()}
                  </p>
                  <span className="text-[10px] text-slate-500">{summary.anomalies_detected} anomalies</span>
                </div>
              </div>
            )}

            {/* Simulated IoT Sensor Injection Box */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase text-slate-300 mb-3 flex items-center gap-2">
                <span>📡</span> Transmit IoT Sensor Telemetry Stream
              </h4>
              <form onSubmit={handleSimulateTelemetry} className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sensorTemp}
                    onChange={(e) => setSensorTemp(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Humidity (%)</label>
                  <input
                    type="number"
                    step="1"
                    value={sensorHumidity}
                    onChange={(e) => setSensorHumidity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Impact (G-Force)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sensorShock}
                    onChange={(e) => setSensorShock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Door Status</label>
                  <select
                    value={sensorDoor}
                    onChange={(e) => setSensorDoor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-white"
                  >
                    <option value="sealed">Sealed</option>
                    <option value="opened">Opened</option>
                    <option value="tampered">Tampered</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={ingesting}
                    className="w-full py-1.5 bg-marine-600 hover:bg-marine-500 text-white rounded font-semibold transition"
                  >
                    {ingesting ? 'Sending...' : 'Emit Stream'}
                  </button>
                </div>
              </form>
            </div>

            {/* Milestone Progress and Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-3">Milestone Progress</h4>
                <ol className="space-y-2 text-xs">
                  {selected.milestones.map((m) => (
                    <li key={m.id} className="flex justify-between border-b border-slate-800/60 pb-1">
                      <span className="capitalize text-slate-200">{m.status.replaceAll('_', ' ')}</span>
                      <span className="text-slate-500">{m.location || '—'}</span>
                    </li>
                  ))}
                  {selected.milestones.length === 0 && (
                    <li className="text-slate-500">No milestones posted yet.</li>
                  )}
                </ol>
              </div>

              <form onSubmit={record} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs">
                <h4 className="font-bold uppercase text-slate-400">Update Logistics Milestone</h4>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
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
                  placeholder="Current Location / Port"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                />
                <input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Voyage / Transit Remarks"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white"
                />
                <button className="w-full py-1.5 bg-marine-600 hover:bg-marine-500 rounded font-semibold text-white">
                  Record Milestone
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
