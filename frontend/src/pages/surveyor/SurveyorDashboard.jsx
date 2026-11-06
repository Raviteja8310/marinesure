import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import api from '../../services/api'

const NAV = [
  { name: 'Dashboard', path: '/surveyor', icon: '📊' },
  { name: 'Assigned Claims', path: '/surveyor/claims', icon: '📋' },
  { name: 'Inspection Schedule', path: '/surveyor/schedule', icon: '📅' },
  { name: 'Survey Reports', path: '/surveyor/reports', icon: '📝' },
]

export default function SurveyorDashboard() {
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [showSurveyModal, setShowSurveyModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  // AI Damage Vision State
  const [visionImageKey, setVisionImageKey] = useState('water_ingress')
  const [analyzingVision, setAnalyzingVision] = useState(false)
  const [visionResult, setVisionResult] = useState(null)

  const [formData, setFormData] = useState({
    inspection_date: new Date().toISOString().slice(0, 16),
    inspection_location: '',
    damage_assessment: '',
    cause_of_loss: 'rough_handling',
    is_covered_peril: true,
    estimated_loss_amount: '',
    salvage_value: '0',
    recommended_settlement: '',
  })

  const loadAssignments = async () => {
    try {
      const res = await api.get('/surveyor/assignments')
      setClaims(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAssignments()
  }, [])

  const openSurveyModal = (claim) => {
    setSelectedClaim(claim)
    setVisionResult(null)
    setFormData({
      inspection_date: new Date().toISOString().slice(0, 16),
      inspection_location: 'Container Freight Station / Terminal',
      damage_assessment: '',
      cause_of_loss: 'rough_handling',
      is_covered_peril: true,
      estimated_loss_amount: claim.claim_amount,
      salvage_value: '0',
      recommended_settlement: claim.claim_amount,
    })
    setShowSurveyModal(true)
  }

  const handleRunAiVision = async () => {
    setAnalyzingVision(true)
    try {
      const res = await api.post('/ai/analyze-damage', {
        image_url_or_base64: `cargo_photo_${visionImageKey}.jpg`,
        cargo_category: selectedClaim?.claim_type || 'general',
      })
      const v = res.data
      setVisionResult(v)

      // Auto-suggest fields from AI analysis
      setFormData((prev) => ({
        ...prev,
        cause_of_loss: v.detected_damage_type.includes('water')
          ? 'seawater_damage'
          : v.detected_damage_type.includes('spoilage')
          ? 'reefer_temperature_breach'
          : 'rough_handling',
        is_covered_peril: v.peril_coverage_status.includes('covered'),
        damage_assessment: `[AI Vision Assessment (${v.confidence_pct}%)]: ${v.detected_damage_type.replaceAll('_', ' ').toUpperCase()}. Symptoms: ${v.damage_symptoms.join(', ')}. Action: ${v.recommended_surveyor_action}`,
      }))
    } catch (err) {
      alert(err.response?.data?.detail || 'AI Vision analysis failed')
    } finally {
      setAnalyzingVision(false)
    }
  }

  const handleSubmitReport = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setMsg('')
    try {
      await api.post(`/claims/${selectedClaim.id}/survey-reports`, {
        inspection_date: new Date(formData.inspection_date).toISOString(),
        inspection_location: formData.inspection_location,
        damage_assessment: formData.damage_assessment,
        cause_of_loss: formData.cause_of_loss,
        is_covered_peril: formData.is_covered_peril,
        estimated_loss_amount: parseFloat(formData.estimated_loss_amount),
        salvage_value: parseFloat(formData.salvage_value || 0),
        recommended_settlement: parseFloat(formData.recommended_settlement),
        evidence_photos: [
          { name: `cargo_damage_${visionImageKey}.jpg`, url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec' },
        ],
      })
      setMsg(`Inspection report submitted for Claim ${selectedClaim.claim_number}!`)
      setShowSurveyModal(false)
      loadAssignments()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit report')
    } finally {
      setSubmitting(false)
    }
  }

  const totalAssigned = claims.length
  const pendingInspections = claims.filter(
    (c) => c.status === 'surveyor_assigned' || c.status === 'submitted'
  ).length
  const reportsDone = claims.filter(
    (c) => c.status === 'inspection_completed' || c.status === 'approved' || c.status === 'settled'
  ).length

  return (
    <DashboardLayout title="Surveyor Inspection & AI Vision Portal" roleLabel="Marine Surveyor" navigation={NAV}>
      {msg && (
        <div className="p-4 mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {msg}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-2xl">📋</span>
            <span className="text-3xl font-bold text-white">{totalAssigned}</span>
          </div>
          <p className="mt-3 text-sm text-slate-400">Total Assigned Claims</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-2xl">🔍</span>
            <span className="text-3xl font-bold text-amber-400">{pendingInspections}</span>
          </div>
          <p className="mt-3 text-sm text-slate-400">Pending Physical Inspections</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="text-2xl">📝</span>
            <span className="text-3xl font-bold text-emerald-400">{reportsDone}</span>
          </div>
          <p className="mt-3 text-sm text-slate-400">Inspection Reports Completed</p>
        </div>
      </div>

      {/* Claims Assignment Table */}
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-base font-bold text-white">Designated Damage Survey Assignments</h3>
        <span className="text-xs text-slate-500">Live inspection queue</span>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-xs uppercase bg-slate-950/40">
            <tr>
              <th className="text-left px-4 py-3">Claim #</th>
              <th className="text-left px-4 py-3">Claim Amount</th>
              <th className="text-left px-4 py-3">Claim Type</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Reports</th>
              <th className="text-left px-4 py-3">Actions</th>
              <th className="text-right px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-t border-slate-800 hover:bg-slate-800/20">
                <td className="px-4 py-3 font-mono text-marine-300 font-semibold">{c.claim_number}</td>
                <td className="px-4 py-3 font-medium">₹{Number(c.claim_amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-xs uppercase text-slate-300">
                  {c.claim_type.replaceAll('_', ' ')}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                      c.status === 'inspection_completed'
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        : c.status === 'approved' || c.status === 'settled'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {c.status.replaceAll('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-slate-400">
                  {c.survey_reports?.length || 0} filed
                </td>
                <td className="px-4 py-3 text-xs">
                  <button
                    onClick={() => openSurveyModal(c)}
                    className="px-3 py-1 bg-marine-600 hover:bg-marine-500 text-white rounded font-medium transition"
                  >
                    📝 Submit Survey Report
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
                  No claims currently assigned for physical marine survey.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Survey Modal with Computer Vision Assistant */}
      {showSurveyModal && selectedClaim && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-1">
              Marine Damage Inspection Report
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Surveying Claim <strong className="text-marine-400 font-mono">{selectedClaim.claim_number}</strong> (Claimed: ₹{Number(selectedClaim.claim_amount).toLocaleString()})
            </p>

            {/* AI Computer Vision Assistant Box */}
            <div className="mb-4 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">📸</span>
                <span className="font-bold text-white">AI Damage Photo Vision Classifier</span>
                <span className="text-[10px] text-marine-400 font-semibold px-2 py-0.5 rounded bg-marine-500/10">
                  ICC Peril Analyzer
                </span>
              </div>
              <p className="text-slate-400 text-[11px] mb-3">
                Select sample photo casualty pattern to test AI vision classification against Institute Cargo Clauses.
              </p>
              <div className="flex gap-2">
                <select
                  value={visionImageKey}
                  onChange={(e) => setVisionImageKey(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white text-xs flex-1"
                >
                  <option value="water_ingress">Photo A: Seawater Ingress & Rust Corrosion</option>
                  <option value="crush_impact">Photo B: Rough Cargo Handling & Pallet Crush</option>
                  <option value="thermal_spoilage_mold">Photo C: Reefer Temperature Failure & Spoilage</option>
                  <option value="container_breach">Photo D: Structural Container Puncture</option>
                </select>
                <button
                  type="button"
                  onClick={handleRunAiVision}
                  disabled={analyzingVision}
                  className="px-4 py-1.5 bg-marine-600 hover:bg-marine-500 text-white rounded font-semibold transition"
                >
                  {analyzingVision ? 'Analyzing...' : '⚡ Run Vision AI'}
                </button>
              </div>

              {visionResult && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-emerald-400 uppercase">
                      Detected: {visionResult.detected_damage_type.replaceAll('_', ' ')} ({visionResult.confidence_pct}%)
                    </span>
                    <span className="text-slate-400">Severity: <strong className="text-white uppercase">{visionResult.severity_rating}</strong></span>
                  </div>
                  <p className="text-slate-300"><strong>ICC Clauses:</strong> {visionResult.icc_clauses_applied.join(', ')}</p>
                  <p className="text-slate-400"><strong>Symptoms:</strong> {visionResult.damage_symptoms.join(' • ')}</p>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Inspection Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.inspection_date}
                    onChange={(e) => setFormData({ ...formData, inspection_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Inspection Location</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Berth 4, JNPT Terminal, Mumbai"
                    value={formData.inspection_location}
                    onChange={(e) => setFormData({ ...formData, inspection_location: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Cause of Loss (Surveyor Finding)</label>
                <select
                  value={formData.cause_of_loss}
                  onChange={(e) => setFormData({ ...formData, cause_of_loss: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                >
                  <option value="rough_handling">Rough Cargo Handling / Drop Impact</option>
                  <option value="seawater_damage">Seawater Ingress / Hatch Leakage</option>
                  <option value="condensation_sweat">Ship Sweat / Condensation</option>
                  <option value="reefer_temperature_breach">Reefer Temperature Fluctuation Breach</option>
                  <option value="theft_pilferage">Theft / Seal Tampering</option>
                  <option value="fire_smoke">Fire / Heat / Smoke Damage</option>
                  <option value="packaging_failure">Inadequate Packaging / Shifting</option>
                  <option value="inherent_vice">Inherent Vice of Goods</option>
                  <option value="other">Other External Casualty</option>
                </select>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <input
                  type="checkbox"
                  id="covered_peril"
                  checked={formData.is_covered_peril}
                  onChange={(e) => setFormData({ ...formData, is_covered_peril: e.target.checked })}
                  className="w-4 h-4 text-marine-600 rounded bg-slate-900 border-slate-700"
                />
                <label htmlFor="covered_peril" className="text-slate-300">
                  <span className="font-semibold block">Covered Peril Assessment</span>
                  <span className="text-[11px] text-slate-500">
                    Checked if casualty falls within Institute Cargo Clauses policy terms.
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Detailed Damage Assessment Findings</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Record container condition, seal integrity, visual inspection of packaging, water marks, mold, extent of compromised units..."
                  value={formData.damage_assessment}
                  onChange={(e) => setFormData({ ...formData, damage_assessment: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Estimated Loss (₹)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={formData.estimated_loss_amount}
                    onChange={(e) => setFormData({ ...formData, estimated_loss_amount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Salvage Value (₹)</label>
                  <input
                    type="number"
                    step="1"
                    value={formData.salvage_value}
                    onChange={(e) => setFormData({ ...formData, salvage_value: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Recommended Settlement (₹)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={formData.recommended_settlement}
                    onChange={(e) => setFormData({ ...formData, recommended_settlement: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSurveyModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-marine-600 hover:bg-marine-500 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Sign & Submit Survey Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
