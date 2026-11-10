import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import api from '../../services/api'
import { CheckIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { notify } from '../../components/ui'


const STATUS_STEPS = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'surveyor_assigned', label: 'Surveyor Assigned' },
  { key: 'inspection_completed', label: 'Inspection Done' },
  { key: 'approved', label: 'Approved' },
  { key: 'settled', label: 'Settled' },
]

export default function CustomerClaims() {
  const [claims, setClaims] = useState([])
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [msg, setMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    policy_id: '',
    incident_date: new Date().toISOString().slice(0, 16),
    incident_type: 'cargo_damage',
    severity: 'moderate',
    location_name: '',
    description: '',
    estimated_loss: '',
    claim_amount: '',
    claim_type: 'partial_loss',
    claimant_notes: '',
  })

  const loadData = async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        api.get('/claims'),
        api.get('/policies'),
      ])
      setClaims(cRes.data)
      setPolicies(pRes.data.filter((p) => p.status === 'active'))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateClaim = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setMsg('')
    try {
      const selPol = policies.find((p) => p.id === formData.policy_id)
      if (!selPol) {
        notify('Select an active policy first.', 'warning')
        setSubmitting(false)
        return
      }

      // 1. Report incident
      const incRes = await api.post('/incidents', {
        shipment_id: selPol.shipment_id,
        policy_id: selPol.id,
        incident_date: new Date(formData.incident_date).toISOString(),
        incident_type: formData.incident_type,
        severity: formData.severity,
        location_name: formData.location_name || 'En Route',
        description: formData.description,
        estimated_loss: parseFloat(formData.estimated_loss || formData.claim_amount),
      })

      // 2. Submit Claim
      await api.post('/claims', {
        policy_id: selPol.id,
        incident_id: incRes.data.id,
        claim_amount: parseFloat(formData.claim_amount),
        claim_type: formData.claim_type,
        claimant_notes: formData.claimant_notes,
      })

      setMsg('Incident reported and insurance claim filed successfully!')
      setShowModal(false)
      loadData()
    } catch (err) {
      notify(err.response?.data?.detail || 'The claim could not be filed.', 'danger')
    } finally {
      setSubmitting(false)
    }
  }

  const getStepIndex = (status) => {
    if (status === 'rejected') return -1
    const idx = STATUS_STEPS.findIndex((s) => s.key === status)
    return idx >= 0 ? idx : 0
  }

  return (
    <DashboardLayout title="Claims Management">
      {msg && (
        <div className="p-4 mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {msg}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-sm text-slate-400">
            Report casualties, track marine surveyor physical assessments, and monitor settlement payouts.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-marine-600 hover:bg-marine-500 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2"
        >
          <ExclamationTriangleIcon className="h-4 w-4" aria-hidden /> Report incident & file claim
        </button>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-xs uppercase bg-slate-950/40">
            <tr>
              <th className="text-left px-4 py-3">Claim #</th>
              <th className="text-left px-4 py-3">Claim Amount</th>
              <th className="text-left px-4 py-3">Approved / Deductible</th>
              <th className="text-left px-4 py-3">Net Settlement</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Details</th>
              <th className="text-right px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-t border-slate-800 hover:bg-slate-800/20">
                <td className="px-4 py-3 font-mono text-marine-300 font-semibold">
                  {c.claim_number}
                </td>
                <td className="px-4 py-3 font-medium">₹{Number(c.claim_amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-xs">
                  {c.approved_amount ? (
                    <div>
                      <span className="text-slate-300">₹{Number(c.approved_amount).toLocaleString()}</span>
                      <span className="text-rose-400 ml-1">(-₹{Number(c.deductible_applied).toLocaleString()})</span>
                    </div>
                  ) : (
                    <span className="text-slate-500">Under assessment</span>
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
                <td className="px-4 py-3 text-xs">
                  <button
                    onClick={() => setSelectedClaim(c)}
                    className="text-marine-400 hover:underline"
                  >
                    View Progress &rarr;
                  </button>
                </td>
                <td className="px-4 py-3 text-right text-xs text-slate-400">
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {claims.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No claims filed yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Claim Detail / Stepper Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Claim {selectedClaim.claim_number}</h3>
                <p className="text-xs text-slate-400">Type: {selectedClaim.claim_type.replaceAll('_', ' ').toUpperCase()}</p>
              </div>
              <button
                onClick={() => setSelectedClaim(null)}
                className="text-slate-400 hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {/* Stepper */}
            {selectedClaim.status !== 'rejected' ? (
              <div className="mb-8">
                <div className="flex items-center justify-between relative">
                  <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-800 -z-0" />
                  {STATUS_STEPS.map((s, idx) => {
                    const currentIdx = getStepIndex(selectedClaim.status)
                    const isDone = idx <= currentIdx
                    const isCurrent = idx === currentIdx
                    return (
                      <div key={s.key} className="flex flex-col items-center relative z-10 bg-slate-900 px-2">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            isCurrent
                              ? 'bg-marine-500 text-white ring-4 ring-marine-500/20'
                              : isDone
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isDone ? <CheckIcon className="h-4 w-4" aria-hidden /> : idx + 1}
                        </div>
                        <span className="text-[10px] mt-1 text-slate-400 text-center font-medium">
                          {s.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 mb-6 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                <p className="font-semibold">Claim Rejected</p>
                <p className="text-xs mt-1 text-rose-300">
                  {selectedClaim.rejection_reason || 'Claim did not meet policy coverage terms.'}
                </p>
              </div>
            )}

            {/* Financial Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                <span className="text-xs text-slate-400">Claim Amount</span>
                <p className="text-lg font-bold text-white">₹{Number(selectedClaim.claim_amount).toLocaleString()}</p>
              </div>
              <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                <span className="text-xs text-slate-400">Deductible Applied</span>
                <p className="text-lg font-bold text-rose-400">
                  {selectedClaim.deductible_applied ? `₹${Number(selectedClaim.deductible_applied).toLocaleString()}` : '—'}
                </p>
              </div>
              <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                <span className="text-xs text-slate-400">Net Payable</span>
                <p className="text-lg font-bold text-emerald-400">
                  {selectedClaim.net_payable ? `₹${Number(selectedClaim.net_payable).toLocaleString()}` : '—'}
                </p>
              </div>
            </div>

            {/* Settlement reference */}
            {selectedClaim.settlement_reference && (
              <div className="mb-6 p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm">
                <span className="text-xs text-purple-300 uppercase font-semibold">Settlement Voucher</span>
                <p className="text-white font-mono font-bold mt-1">{selectedClaim.settlement_reference}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Settled on: {new Date(selectedClaim.settled_at).toLocaleString()}
                </p>
              </div>
            )}

            {/* Surveyor Reports Section */}
            <div>
              <h4 className="text-xs uppercase font-bold text-slate-400 mb-3">
                Marine Surveyor Inspection Reports ({selectedClaim.survey_reports?.length || 0})
              </h4>
              {selectedClaim.survey_reports && selectedClaim.survey_reports.length > 0 ? (
                <div className="space-y-3">
                  {selectedClaim.survey_reports.map((rep) => (
                    <div key={rep.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-mono text-marine-400 font-semibold">{rep.report_number}</span>
                        <span className="text-slate-500">{new Date(rep.inspection_date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-slate-300 mb-2"><strong className="text-white">Location:</strong> {rep.inspection_location}</p>
                      <p className="text-slate-300 mb-2"><strong className="text-white">Cause of Loss:</strong> {rep.cause_of_loss.replaceAll('_', ' ')}</p>
                      <p className="text-slate-300 mb-2"><strong className="text-white">Damage Assessment:</strong> {rep.damage_assessment}</p>
                      <div className="flex gap-4 pt-2 border-t border-slate-800 text-slate-400">
                        <span>Covered Peril: <strong className={rep.is_covered_peril ? 'text-emerald-400' : 'text-rose-400'}>{rep.is_covered_peril ? 'YES' : 'NO'}</strong></span>
                        <span>Recommended Settlement: <strong className="text-emerald-400">₹{Number(rep.recommended_settlement).toLocaleString()}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No surveyor reports submitted yet for this claim.</p>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedClaim(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Claim Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-2">Report Incident & Submit Claim</h3>
            <p className="text-xs text-slate-400 mb-4">
              Submit casualty particulars under an active marine insurance certificate.
            </p>

            <form onSubmit={handleCreateClaim} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Select Active Policy</label>
                <select
                  required
                  value={formData.policy_id}
                  onChange={(e) => setFormData({ ...formData, policy_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:border-marine-500"
                >
                  <option value="">-- Choose active policy --</option>
                  {policies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.policy_number} (Insured: ₹{Number(p.insured_amount).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Incident Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.incident_date}
                    onChange={(e) => setFormData({ ...formData, incident_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Incident Type</label>
                  <select
                    value={formData.incident_type}
                    onChange={(e) => setFormData({ ...formData, incident_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  >
                    <option value="cargo_damage">Cargo Physical Damage</option>
                    <option value="water_ingress">Seawater Ingress / Flooding</option>
                    <option value="vessel_collision">Vessel Collision / Grounding</option>
                    <option value="theft_pilferage">Theft / Pilferage</option>
                    <option value="fire_explosion">Fire / Explosion</option>
                    <option value="heavy_weather">Heavy Weather / Jettison</option>
                    <option value="refrigeration_failure">Reefer Breakdown (Temperature)</option>
                    <option value="container_damage">Container Structural Breach</option>
                    <option value="other">Other Casualty</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Severity</label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  >
                    <option value="minor">Minor Damage</option>
                    <option value="moderate">Moderate Damage</option>
                    <option value="severe">Severe Structural Loss</option>
                    <option value="total_loss">Catastrophic / Total Loss</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Location of Casualty</label>
                  <input
                    type="text"
                    placeholder="e.g. Malacca Strait or Port of Antwerp"
                    value={formData.location_name}
                    onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Description of Incident & Damage</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail what occurred, weather conditions, container status, and evident physical cargo damage..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Claim Amount (₹)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    placeholder="e.g. 150000"
                    value={formData.claim_amount}
                    onChange={(e) => setFormData({ ...formData, claim_amount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Claim Type</label>
                  <select
                    value={formData.claim_type}
                    onChange={(e) => setFormData({ ...formData, claim_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  >
                    <option value="partial_loss">Partial Loss</option>
                    <option value="total_loss">Total Loss</option>
                    <option value="general_average">General Average Contribution</option>
                    <option value="salvage">Salvage Operation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Claimant Notes / Supporting Details</label>
                <input
                  type="text"
                  placeholder="Additional context for the marine insurance officer..."
                  value={formData.claimant_notes}
                  onChange={(e) => setFormData({ ...formData, claimant_notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-marine-600 hover:bg-marine-500 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'File Claim & Casualty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
