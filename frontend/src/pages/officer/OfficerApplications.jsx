import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import api from '../../services/api'


export default function OfficerApplications() {
  const [applications, setApplications] = useState([])
  const [selectedApp, setSelectedApp] = useState(null)
  const [decision, setDecision] = useState('approved')
  const [riskScore, setRiskScore] = useState('low')
  const [riskRemarks, setRiskRemarks] = useState('')
  const [officerRemarks, setOfficerRemarks] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = () =>
    api.get('/applications').then((res) => {
      setApplications(res.data)
      setSelectedApp((curr) => res.data.find((a) => a.id === curr?.id) || res.data[0] || null)
    })

  useEffect(() => {
    load()
  }, [])

  const handleReview = async (e) => {
    e.preventDefault()
    if (!selectedApp) return
    setError('')
    setMessage('')
    setReviewing(true)

    try {
      await api.post(`/applications/${selectedApp.id}/review`, {
        decision,
        risk_score: riskScore,
        risk_remarks: riskRemarks,
        officer_remarks: officerRemarks,
      })
      setMessage(`Decision recorded: Application ${decision.toUpperCase()}`)
      setRiskRemarks('')
      setOfficerRemarks('')
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to record underwriting decision')
    } finally {
      setReviewing(false)
    }
  }

  return (
    <DashboardLayout title="Underwriting & Application Reviews">
      {message && (
        <div className="p-4 mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="p-4 mb-6 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Applications List */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-950/40">
            <h3 className="font-semibold text-white text-sm">Customer Applications ({applications.length})</h3>
          </div>
          <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
            {applications.map((a) => {
              const active = selectedApp?.id === a.id
              return (
                <div
                  key={a.id}
                  onClick={() => setSelectedApp(a)}
                  className={`p-4 cursor-pointer transition ${
                    active ? 'bg-marine-600/20 text-white' : 'hover:bg-slate-800/40 text-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs font-semibold text-marine-400">
                      {a.application_number}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        a.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : a.status === 'rejected'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400 flex justify-between">
                    <span>Insured: ₹{Number(a.requested_insured_amount).toLocaleString()}</span>
                    <span className="text-emerald-400 font-semibold">
                      ₹{Number(a.calculated_premium).toLocaleString()}
                    </span>
                  </div>
                </div>
              )
            })}
            {applications.length === 0 && (
              <p className="p-6 text-center text-xs text-slate-500">No applications under review.</p>
            )}
          </div>
        </div>

        {/* Selected Application Review Panel */}
        {selectedApp && (
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-xs text-marine-400 font-semibold">
                    {selectedApp.application_number}
                  </span>
                  <h2 className="text-xl font-bold text-white mt-1">Application Evaluation</h2>
                </div>
                <span
                  className={`text-xs uppercase font-bold px-3 py-1 rounded-full border ${
                    selectedApp.status === 'approved'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : selectedApp.status === 'rejected'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {selectedApp.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block">Requested Coverage</span>
                  <span className="text-white font-bold text-sm">
                    ₹{Number(selectedApp.requested_insured_amount).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Calculated Premium</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    ₹{Number(selectedApp.calculated_premium).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Submission Date</span>
                  <span className="text-white font-semibold">
                    {new Date(selectedApp.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {selectedApp.special_conditions && (
                <div className="p-3 bg-slate-950/40 rounded-lg text-xs text-slate-300 border border-slate-800">
                  <span className="font-bold text-slate-400 block mb-1">Customer Special Conditions:</span>
                  {selectedApp.special_conditions}
                </div>
              )}
            </div>

            {/* Decision Form */}
            {['submitted', 'under_review', 'documents_required'].includes(selectedApp.status) ? (
              <form onSubmit={handleReview} className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="font-bold text-white text-base">Underwriting Decision & Risk Assessment</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Underwriting Decision</label>
                    <select
                      value={decision}
                      onChange={(e) => setDecision(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                    >
                      <option value="approved">Approve Application</option>
                      <option value="rejected">Reject Application</option>
                      <option value="documents_required">Request Additional Documents</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Risk Score</label>
                    <select
                      value={riskScore}
                      onChange={(e) => setRiskScore(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                    >
                      <option value="low">Low Risk</option>
                      <option value="medium">Medium Risk</option>
                      <option value="high">High Risk (Requires Senior Review)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Risk Assessment Remarks</label>
                  <input
                    type="text"
                    value={riskRemarks}
                    onChange={(e) => setRiskRemarks(e.target.value)}
                    placeholder="e.g. Clean shipping route; packaging verified standard seaworthy..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Official Decision Remarks</label>
                  <textarea
                    value={officerRemarks}
                    onChange={(e) => setOfficerRemarks(e.target.value)}
                    placeholder="e.g. Approved. Customer may proceed with premium payment."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white h-20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={reviewing}
                  className="w-full py-3 bg-marine-600 hover:bg-marine-500 text-white rounded-lg font-bold text-sm transition shadow-lg disabled:opacity-50"
                >
                  {reviewing ? 'Recording Decision...' : 'Record Underwriting Decision &rarr;'}
                </button>
              </form>
            ) : (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 text-center text-xs text-slate-400">
                This application has completed underwriting review with status{' '}
                <span className="font-bold text-white uppercase">{selectedApp.status}</span>.
                {selectedApp.officer_remarks && (
                  <p className="mt-2 text-slate-300">Remarks: {selectedApp.officer_remarks}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
