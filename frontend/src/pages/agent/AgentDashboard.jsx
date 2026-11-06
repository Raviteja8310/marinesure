import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import api from '../../services/api'

const NAV = [
  { name: 'Dashboard', path: '/agent', icon: '📊' },
  { name: 'Commission Ledger', path: '/agent/commissions', icon: '💰' },
  { name: 'Products Catalog', path: '/agent/products', icon: '📋' },
]

export default function AgentDashboard() {
  const [metrics, setMetrics] = useState(null)
  const [commissions, setCommissions] = useState([])
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedPolicyId, setSelectedPolicyId] = useState('')
  const [rate, setRate] = useState('10')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  const loadData = async () => {
    try {
      const [mRes, cRes, pRes] = await Promise.all([
        api.get('/agent/metrics'),
        api.get('/agent/commissions'),
        api.get('/policies'),
      ])
      setMetrics(mRes.data)
      setCommissions(cRes.data)
      setPolicies(pRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRegisterCommission = async (e) => {
    e.preventDefault()
    if (!selectedPolicyId) return
    setSubmitting(true)
    setMsg('')
    try {
      await api.post('/agent/commissions/record', {
        policy_id: selectedPolicyId,
        commission_rate: parseFloat(rate),
      })
      setMsg('Commission accrued and credited to your broker ledger!')
      setShowModal(false)
      loadData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to register commission')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout title="Agent & Broker Portal" roleLabel="Insurance Agent" navigation={NAV}>
      {msg && (
        <div className="p-4 mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {msg}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Earned</span>
            <span className="text-2xl">💰</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-white font-mono">
            ₹{Number(metrics?.total_commission_earned || 0).toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-slate-400">Across all referred policies</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Pending Payout</span>
            <span className="text-2xl">⏳</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-400 font-mono">
            ₹{Number(metrics?.pending_commission || 0).toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-slate-400">Accrued, awaiting disbursement</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Disbursed Paid</span>
            <span className="text-2xl">✅</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-400 font-mono">
            ₹{Number(metrics?.paid_commission || 0).toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-slate-400">Paid out to bank account</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Referred Policies</span>
            <span className="text-2xl">📜</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-marine-400 font-mono">
            {metrics?.policies_sold || 0}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {metrics?.referred_customers_count || 0} unique clients
          </p>
        </div>
      </div>

      {/* Commission Ledger Table */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-base font-bold text-white">Broker Commission Ledger</h3>
          <p className="text-xs text-slate-400">Track accrued sales earnings per policy issue</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-marine-600 hover:bg-marine-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2"
        >
          <span>➕</span> Record Policy Commission
        </button>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-xs uppercase bg-slate-950/40">
            <tr>
              <th className="text-left px-4 py-3">Commission Ref</th>
              <th className="text-left px-4 py-3">Premium Amount</th>
              <th className="text-left px-4 py-3">Rate</th>
              <th className="text-left px-4 py-3">Commission Earned</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Payout Ref</th>
              <th className="text-right px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((c) => (
              <tr key={c.id} className="border-t border-slate-800 hover:bg-slate-800/20">
                <td className="px-4 py-3 font-mono text-marine-300 font-semibold">{c.commission_reference}</td>
                <td className="px-4 py-3 text-slate-300">₹{Number(c.premium_amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-400">{c.commission_rate}%</td>
                <td className="px-4 py-3 font-semibold text-emerald-400">
                  ₹{Number(c.commission_amount).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                      c.status === 'paid'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-slate-400">
                  {c.payout_reference || '—'}
                </td>
                <td className="px-4 py-3 text-right text-xs text-slate-400">
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {commissions.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No commission entries recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Record Commission Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-white mb-2">
              Record Broker Commission on Policy
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Select an issued policy to attach broker agency representation.
            </p>

            <form onSubmit={handleRegisterCommission} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Select Policy</label>
                <select
                  required
                  value={selectedPolicyId}
                  onChange={(e) => setSelectedPolicyId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                >
                  <option value="">-- Choose Issued Policy --</option>
                  {policies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.policy_number} (Premium: ₹{Number(p.premium_paid).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Commission Rate (%)</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="50"
                  required
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-marine-600 hover:bg-marine-500 text-white rounded-lg font-semibold"
                >
                  {submitting ? 'Recording...' : 'Accrue Commission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
