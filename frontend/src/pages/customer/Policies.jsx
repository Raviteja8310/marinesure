import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import api from '../../services/api'
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import { notify } from '../../components/ui'


export default function PoliciesList() {
  const [policies, setPolicies] = useState([])
  const [selectedPolicy, setSelectedPolicy] = useState(null)
  const [endorseModal, setEndorseModal] = useState(false)
  const [endorseChanges, setEndorseChanges] = useState('')
  const [endorseReason, setEndorseReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')
  const [error, setError] = useState('')

  const load = () =>
    api.get('/policies').then((res) => {
      setPolicies(res.data)
      setSelectedPolicy((curr) => res.data.find((p) => p.id === curr?.id) || res.data[0] || null)
    })

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  const handleEndorse = async (e) => {
    e.preventDefault()
    if (!selectedPolicy) return
    setError('')
    setActionMsg('')
    try {
      await api.post(`/policies/${selectedPolicy.id}/endorsements`, {
        requested_changes: endorseChanges,
        reason: endorseReason,
      })
      setActionMsg('Policy endorsement approved and certificate updated!')
      setEndorseModal(false)
      setEndorseChanges('')
      setEndorseReason('')
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Endorsement failed')
    }
  }

  const handleRenew = async () => {
    if (!selectedPolicy) return
    setError('')
    setActionMsg('')
    try {
      await api.post(`/policies/${selectedPolicy.id}/renewals`, {})
      setActionMsg('Policy successfully renewed for next coverage period!')
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Renewal failed')
    }
  }

  const handleCancel = async () => {
    if (!selectedPolicy) return
    const reason = prompt('Enter cancellation reason:')
    if (!reason) return
    setError('')
    setActionMsg('')
    try {
      await api.post(`/policies/${selectedPolicy.id}/cancellations`, { reason })
      setActionMsg('Policy cancelled. Refund processed where applicable.')
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Cancellation failed')
    }
  }

  const downloadCert = async (policyId, policyNum) => {
    try {
      const res = await api.get(`/policies/${policyId}/certificate`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `MarineSure_Policy_${policyNum.replace('/', '_')}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      notify('The PDF certificate could not be downloaded.', 'danger')
    }
  }

  return (
    <DashboardLayout title="Active Policies & Certificates">
      {actionMsg && (
        <div className="p-4 mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {actionMsg}
        </div>
      )}
      {error && (
        <div className="p-4 mb-6 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Policies List */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-950/40">
            <h3 className="font-semibold text-white text-sm">Issued Policies ({policies.length})</h3>
          </div>
          <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
            {policies.map((p) => {
              const active = selectedPolicy?.id === p.id
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPolicy(p)}
                  className={`p-4 cursor-pointer transition ${
                    active ? 'bg-marine-600/20 text-white' : 'hover:bg-slate-800/40 text-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs font-bold text-marine-400">
                      {p.policy_number}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        p.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400 flex justify-between">
                    <span>Insured: ₹{Number(p.insured_amount).toLocaleString()}</span>
                    <span className="text-emerald-400 font-semibold">
                      Paid: ₹{Number(p.premium_paid).toLocaleString()}
                    </span>
                  </div>
                </div>
              )
            })}
            {policies.length === 0 && !loading && (
              <p className="p-6 text-center text-xs text-slate-500">
                No policies issued yet.{' '}
                <Link to="/customer/applications" className="text-marine-400 underline">
                  Check approved applications &rarr;
                </Link>
              </p>
            )}
          </div>
        </div>

        {/* Selected Policy View */}
        {selectedPolicy && (
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-xs font-bold text-marine-400">
                    {selectedPolicy.policy_number}
                  </span>
                  <h2 className="text-2xl font-bold text-white mt-1">Marine Cargo Policy</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Coverage: {selectedPolicy.effective_date} to {selectedPolicy.expiry_date}
                  </p>
                </div>
                <button
                  onClick={() => downloadCert(selectedPolicy.id, selectedPolicy.policy_number)}
                  className="px-4 py-2 bg-marine-600 hover:bg-marine-500 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2 shadow-lg shadow-marine-600/20"
                >
                  <DocumentArrowDownIcon className="h-4 w-4" aria-hidden /> Download certificate (PDF)
                </button>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block">Insured Cargo Sum</span>
                  <span className="text-white font-bold text-base">
                    ₹{Number(selectedPolicy.insured_amount).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Premium Paid</span>
                  <span className="text-emerald-400 font-bold text-base">
                    ₹{Number(selectedPolicy.premium_paid).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Deductible</span>
                  <span className="text-white font-semibold text-base">
                    ₹{Number(selectedPolicy.deductible_amount).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Policy Lifecycle Actions */}
              {selectedPolicy.status === 'active' && (
                <div className="border-t border-slate-800 pt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => setEndorseModal(true)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                  >
                    Request Endorsement / Amendment
                  </button>
                  <button
                    onClick={handleRenew}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                  >
                    Renew Policy
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold border border-rose-500/30 transition"
                  >
                    Cancel Policy & Request Refund
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Endorsement Modal */}
      {endorseModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Policy Endorsement Request</h3>
            <form onSubmit={handleEndorse} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Requested Amendments</label>
                <textarea
                  required
                  value={endorseChanges}
                  onChange={(e) => setEndorseChanges(e.target.value)}
                  placeholder="e.g. Change of transit vessel to MV Ocean Pearl..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white h-24"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Reason for Amendment</label>
                <input
                  type="text"
                  required
                  value={endorseReason}
                  onChange={(e) => setEndorseReason(e.target.value)}
                  placeholder="e.g. Carrier logistics update"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEndorseModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-marine-600 hover:bg-marine-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Submit Endorsement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
