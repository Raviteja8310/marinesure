import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import api from '../../services/api'
import { BanknotesIcon, MagnifyingGlassIcon, UserPlusIcon } from '@heroicons/react/24/outline'
import { confirmDialog, notify } from '../../components/ui'


export default function OfficerClaims() {
  const [claims, setClaims] = useState([])
  const [surveyors, setSurveyors] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  // Modals state
  const [assignClaim, setAssignClaim] = useState(null)
  const [selectedSurveyorId, setSelectedSurveyorId] = useState('')
  const [reviewClaim, setReviewClaim] = useState(null)
  const [approvedAmount, setApprovedAmount] = useState('')
  const [officerNotes, setOfficerNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionType, setActionType] = useState('approved')
  const [msg, setMsg] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const loadData = async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        api.get('/claims'),
        api.get('/surveyors'),
      ])
      setClaims(cRes.data)
      setSurveyors(sRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAssignSurveyor = async (e) => {
    e.preventDefault()
    if (!selectedSurveyorId) return
    setActionLoading(true)
    try {
      await api.post(`/claims/${assignClaim.id}/assign-surveyor`, {
        surveyor_id: selectedSurveyorId,
      })
      setMsg(`Surveyor assigned to Claim ${assignClaim.claim_number}`)
      setAssignClaim(null)
      loadData()
    } catch (err) {
      notify(err.response?.data?.detail || 'Surveyor assignment failed.', 'danger')
    } finally {
      setActionLoading(false)
    }
  }

  const openReviewModal = (claim) => {
    setReviewClaim(claim)
    setActionType('approved')
    setApprovedAmount(claim.claim_amount)
    setOfficerNotes('Inspection and claim documentation verified against policy terms.')
    setRejectionReason('')
  }

  const handleReviewClaim = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      await api.post(`/claims/${reviewClaim.id}/review`, {
        status: actionType,
        approved_amount: actionType === 'approved' ? parseFloat(approvedAmount) : 0,
        officer_notes: officerNotes,
        rejection_reason: actionType === 'rejected' ? rejectionReason : null,
      })
      setMsg(`Claim ${reviewClaim.claim_number} reviewed and ${actionType}!`)
      setReviewClaim(null)
      loadData()
    } catch (err) {
      notify(err.response?.data?.detail || 'The review could not be saved.', 'danger')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSettle = async (claimId) => {
    if (!(await confirmDialog({ title: 'Release settlement payout?', message: 'The net payable is posted to the ledger as a claim payout and the customer is notified. A failed transfer can later be marked failed and retried.', confirmLabel: 'Release payout' }))) return
    setActionLoading(true)
    try {
      await api.post(`/claims/${claimId}/settle`, {})
      setMsg(`Claim settled and payout reference generated!`)
      loadData()
    } catch (err) {
      notify(err.response?.data?.detail || 'Settlement failed.', 'danger')
    } finally {
      setActionLoading(false)
    }
  }

  const filteredClaims = filter === 'all' ? claims : claims.filter((c) => c.status === filter)

  return (
    <DashboardLayout title="Claims & Survey Administration">
      {msg && (
        <div className="p-4 mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {msg}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-800 pb-3">
        {[
          { key: 'all', label: 'All Claims' },
          { key: 'submitted', label: 'Needs Surveyor' },
          { key: 'inspection_completed', label: 'Ready for Review' },
          { key: 'approved', label: 'Ready for Settlement' },
          { key: 'settled', label: 'Settled' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === t.key
                ? 'bg-marine-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-xs uppercase bg-slate-950/40">
            <tr>
              <th className="text-left px-4 py-3">Claim #</th>
              <th className="text-left px-4 py-3">Claim Amount</th>
              <th className="text-left px-4 py-3">Approved / Deductible</th>
              <th className="text-left px-4 py-3">Net Payable</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Reports</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClaims.map((c) => (
              <tr key={c.id} className="border-t border-slate-800 hover:bg-slate-800/20">
                <td className="px-4 py-3 font-mono text-marine-300 font-semibold">{c.claim_number}</td>
                <td className="px-4 py-3 font-medium">₹{Number(c.claim_amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-xs">
                  {c.approved_amount ? (
                    <div>
                      <span>₹{Number(c.approved_amount).toLocaleString()}</span>
                      <span className="text-rose-400 ml-1">(-₹{Number(c.deductible_applied).toLocaleString()})</span>
                    </div>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {c.net_payable ? (
                    <span className="text-emerald-400">₹{Number(c.net_payable).toLocaleString()}</span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                      c.status === 'settled'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : c.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : c.status === 'rejected'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : c.status === 'inspection_completed'
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {c.status.replaceAll('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-slate-400">
                  {c.survey_reports?.length || 0} report(s)
                </td>
                <td className="px-4 py-3 text-xs flex gap-2">
                  {c.status === 'submitted' && (
                    <button
                      onClick={() => setAssignClaim(c)}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium"
                    >
                      <UserPlusIcon className="h-4 w-4" aria-hidden /> Assign surveyor
                    </button>
                  )}
                  {(c.status === 'inspection_completed' || c.status === 'surveyor_assigned') && (
                    <button
                      onClick={() => openReviewModal(c)}
                      className="px-2.5 py-1 bg-marine-600 hover:bg-marine-500 text-white rounded font-medium"
                    >
                      <MagnifyingGlassIcon className="h-4 w-4" aria-hidden /> Review claim
                    </button>
                  )}
                  {c.status === 'approved' && (
                    <button
                      onClick={() => handleSettle(c.id)}
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium"
                    >
                      <BanknotesIcon className="h-4 w-4" aria-hidden /> Settle payout
                    </button>
                  )}
                  {c.status === 'settled' && (
                    <span className="font-mono text-[11px] text-purple-300">
                      {c.settlement_reference}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filteredClaims.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No claims in this category.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Assign Surveyor Modal */}
      {assignClaim && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-white mb-2">
              Assign Marine Surveyor to {assignClaim.claim_number}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Select an accredited marine surveyor to conduct physical inspection and cargo casualty assessment.
            </p>

            <form onSubmit={handleAssignSurveyor} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Available Marine Surveyors</label>
                <select
                  required
                  value={selectedSurveyorId}
                  onChange={(e) => setSelectedSurveyorId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                >
                  <option value="">-- Choose Marine Surveyor --</option>
                  {surveyors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.qualification || 'Certified Marine Cargo Surveyor'} - {s.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAssignClaim(null)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-marine-600 hover:bg-marine-500 text-white rounded-lg font-semibold"
                >
                  {actionLoading ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Claim Modal */}
      {reviewClaim && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-1">
              Underwriting Claim Review: {reviewClaim.claim_number}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Original Claimed Loss: ₹{Number(reviewClaim.claim_amount).toLocaleString()}
            </p>

            {/* Existing Survey Reports */}
            {reviewClaim.survey_reports && reviewClaim.survey_reports.length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <span className="text-[11px] uppercase font-bold text-marine-400">
                  Surveyor Assessment ({reviewClaim.survey_reports[0].report_number})
                </span>
                <p className="mt-1 text-slate-300">
                  <strong>Cause:</strong> {reviewClaim.survey_reports[0].cause_of_loss.replaceAll('_', ' ')}
                </p>
                <p className="text-slate-300">
                  <strong>Assessment:</strong> {reviewClaim.survey_reports[0].damage_assessment}
                </p>
                <p className="text-slate-300">
                  <strong>Covered Peril:</strong> {reviewClaim.survey_reports[0].is_covered_peril ? 'Yes' : 'No'}
                </p>
                <p className="text-emerald-400 font-bold mt-1">
                  Surveyor Recommended Settlement: ₹{Number(reviewClaim.survey_reports[0].recommended_settlement).toLocaleString()}
                </p>
              </div>
            )}

            <form onSubmit={handleReviewClaim} className="space-y-4 text-xs">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="radio"
                    name="action"
                    checked={actionType === 'approved'}
                    onChange={() => setActionType('approved')}
                  />
                  <span>Approve Claim</span>
                </label>
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="radio"
                    name="action"
                    checked={actionType === 'rejected'}
                    onChange={() => setActionType('rejected')}
                  />
                  <span>Reject Claim</span>
                </label>
              </div>

              {actionType === 'approved' ? (
                <div>
                  <label className="block text-slate-400 mb-1">Approved Loss Amount (₹)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    * Policy deductible (5% or min ₹5,000) will be automatically calculated and deducted upon approval.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-400 mb-1">Rejection Reason</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide specific exclusion grounds or policy violation reasons..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1">Officer Assessment Notes</label>
                <textarea
                  rows={2}
                  value={officerNotes}
                  onChange={(e) => setOfficerNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setReviewClaim(null)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`px-4 py-2 text-white rounded-lg font-semibold ${
                    actionType === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {actionLoading ? 'Processing...' : `Submit ${actionType.toUpperCase()}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
