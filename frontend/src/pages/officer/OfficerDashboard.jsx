import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import api from '../../services/api'

const NAV = [
  { name: 'Dashboard', path: '/officer', icon: '📊' },
  { name: 'Applications', path: '/officer/applications', icon: '📝' },
  { name: 'Underwriting', path: '/officer/underwriting', icon: '🔍' },
  { name: 'Claims', path: '/officer/claims', icon: '⚖️' },
  { name: 'Settlements', path: '/officer/settlements', icon: '💰' },
]

export default function OfficerDashboard() {
  const [kpis, setKpis] = useState(null)
  const [exposure, setExposure] = useState(null)
  const [loading, setLoading] = useState(true)

  // Quick Risk Evaluator State
  const [evalData, setEvalData] = useState({
    insured_amount: '5000000',
    cargo_category: 'electronics',
    transport_mode: 'sea',
    origin_country: 'India',
    origin_location: 'Mumbai Port',
    dest_country: 'Egypt',
    dest_location: 'Port Said (Red Sea transit)',
  })
  const [evalResult, setEvalResult] = useState(null)
  const [evaluating, setEvaluating] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/analytics/dashboard-kpis'),
      api.get('/analytics/portfolio-exposure'),
    ])
      .then(([kpiRes, expRes]) => {
        setKpis(kpiRes.data)
        setExposure(expRes.data)
      })
      .catch((err) => console.error('Failed to load analytics', err))
      .finally(() => setLoading(false))
  }, [])

  const handleEvaluateRisk = async (e) => {
    e.preventDefault()
    setEvaluating(true)
    try {
      const res = await api.post('/risk/evaluate-custom', {
        insured_amount: parseFloat(evalData.insured_amount),
        cargo_category: evalData.cargo_category,
        transport_mode: evalData.transport_mode,
        origin_country: evalData.origin_country,
        origin_location: evalData.origin_location,
        dest_country: evalData.dest_country,
        dest_location: evalData.dest_location,
      })
      setEvalResult(res.data)
    } catch (err) {
      alert(err.response?.data?.detail || 'Risk calculation failed')
    } finally {
      setEvaluating(false)
    }
  }

  const fin = kpis?.financials || {}
  const ops = kpis?.operations || {}

  return (
    <DashboardLayout title="Underwriting & Portfolio Analytics" roleLabel="Marine Underwriter" navigation={NAV}>
      {/* Top Financial & Operational Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Gross Written Premium</span>
            <span className="text-xl">💰</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-white font-mono">
            ₹{Number(fin.gross_written_premium || 0).toLocaleString()}
          </p>
          <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1">
            <span>↑ Earned across {ops.total_policies_issued || 0} policies</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Portfolio Loss Ratio</span>
            <span className="text-xl">⚖️</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-bold text-white font-mono">
              {fin.portfolio_loss_ratio_pct ?? '0.0'}%
            </p>
            <span
              className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                (fin.portfolio_loss_ratio_pct || 0) <= 60
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {fin.portfolio_health?.status || 'Profitable'}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Settled: ₹{Number(fin.total_claims_paid || 0).toLocaleString()}
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Total Risk Exposure</span>
            <span className="text-xl">🛡️</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-marine-400 font-mono">
            ₹{Number(fin.total_insured_risk_exposure || 0).toLocaleString()}
          </p>
          <p className="mt-2 text-[11px] text-slate-400">
            Active Sum Insured ({ops.active_policies_count || 0} active policies)
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Underwriting Queue</span>
            <span className="text-xl">📝</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-400 font-mono">
            {ops.pending_applications_count || 0}
          </p>
          <div className="mt-2 flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Approval Rate: {ops.underwriting_approval_rate_pct || 0}%</span>
            <Link to="/officer/applications" className="text-marine-400 hover:underline">
              Review &rarr;
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Exposure by Mode & Category */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🌐</span> Portfolio Risk Exposure Distribution
            </h3>
            <span className="text-xs text-slate-500">Live Underwriting Book</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By Mode */}
            <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
              <h4 className="text-xs uppercase font-bold text-slate-400 mb-3">
                By Transport Mode
              </h4>
              <div className="space-y-2.5">
                {exposure?.transport_modes?.length > 0 ? (
                  exposure.transport_modes.map((m) => (
                    <div key={m.mode} className="text-xs">
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span className="capitalize">{m.mode} ({m.policies} policies)</span>
                        <span className="font-mono font-semibold text-white">₹{Number(m.exposure).toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-marine-500 h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (m.exposure / (fin.total_insured_risk_exposure || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No active policy exposure data yet.</p>
                )}
              </div>
            </div>

            {/* By Cargo Category */}
            <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
              <h4 className="text-xs uppercase font-bold text-slate-400 mb-3">
                By Cargo Category
              </h4>
              <div className="space-y-2.5">
                {exposure?.cargo_categories?.length > 0 ? (
                  exposure.cargo_categories.map((c) => (
                    <div key={c.category} className="text-xs">
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span className="capitalize">{c.category} ({c.policies})</span>
                        <span className="font-mono font-semibold text-white">₹{Number(c.exposure).toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-cyan-500 h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (c.exposure / (fin.total_insured_risk_exposure || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">General standard cargo portfolio.</p>
                )}
              </div>
            </div>
          </div>

          {/* Product Performance Table */}
          <div className="mt-5 pt-4 border-t border-slate-800">
            <h4 className="text-xs uppercase font-bold text-slate-400 mb-3">
              Insurance Product Profitability & Loss Ratios
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-slate-500 uppercase bg-slate-950/40">
                  <tr>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Product Name</th>
                    <th className="px-3 py-2">Active Policies</th>
                    <th className="px-3 py-2">Gross Premium</th>
                    <th className="px-3 py-2">Claims Paid</th>
                    <th className="px-3 py-2">Loss Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {exposure?.product_performance?.map((p) => (
                    <tr key={p.product_code} className="border-t border-slate-800/60">
                      <td className="px-3 py-2 font-mono text-marine-400 font-bold">{p.product_code}</td>
                      <td className="px-3 py-2 text-white font-medium">{p.product_name}</td>
                      <td className="px-3 py-2 text-slate-300">{p.active_policies}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">₹{Number(p.gwp).toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono text-rose-400">₹{Number(p.claims_paid).toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono font-bold">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            p.loss_ratio_pct <= 60
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {p.loss_ratio_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Quick Underwriting Risk Evaluator */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🤖</span>
            <h3 className="text-sm font-bold text-white">Algorithmic Risk Engine</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Simulate multi-factorial marine risk scores, chokepoint danger factors, and warranty clauses.
          </p>

          <form onSubmit={handleEvaluateRisk} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Declared Cargo Value (₹)</label>
              <input
                type="number"
                step="1000"
                required
                value={evalData.insured_amount}
                onChange={(e) => setEvalData({ ...evalData, insured_amount: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 mb-1">Cargo Type</label>
                <select
                  value={evalData.cargo_category}
                  onChange={(e) => setEvalData({ ...evalData, cargo_category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                >
                  <option value="electronics">Electronics (Theft/Shock)</option>
                  <option value="perishable">Perishable (Reefer)</option>
                  <option value="hazardous">Hazardous (Chemicals)</option>
                  <option value="fragile">Fragile Goods</option>
                  <option value="machinery">Heavy Machinery</option>
                  <option value="general">General Cargo</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Transport Mode</label>
                <select
                  value={evalData.transport_mode}
                  onChange={(e) => setEvalData({ ...evalData, transport_mode: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                >
                  <option value="sea">Maritime (Sea)</option>
                  <option value="multimodal">Multimodal</option>
                  <option value="air">Air Cargo</option>
                  <option value="road">Road Freight</option>
                  <option value="rail">Rail Transport</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Origin Port / Country</label>
              <input
                type="text"
                required
                value={evalData.origin_location}
                onChange={(e) => setEvalData({ ...evalData, origin_location: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Destination & Transit Corridor</label>
              <input
                type="text"
                required
                placeholder="e.g. Red Sea or Rotterdam"
                value={evalData.dest_location}
                onChange={(e) => setEvalData({ ...evalData, dest_location: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
              />
            </div>

            <button
              type="submit"
              disabled={evaluating}
              className="w-full py-2 bg-marine-600 hover:bg-marine-500 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              {evaluating ? 'Analyzing...' : '⚡ Run Risk Assessment'}
            </button>
          </form>

          {/* Assessment Output Card */}
          {evalResult && (
            <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-white">Score: {evalResult.composite_score} / 100</span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    evalResult.risk_tier === 'LOW'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : evalResult.risk_tier === 'MODERATE'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {evalResult.risk_tier} RISK
                </span>
              </div>
              <p className="text-slate-300 mb-2 font-medium">{evalResult.recommendation}</p>

              {/* Warranties */}
              <div className="pt-2 border-t border-slate-800 text-slate-400">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Recommended Underwriting Warranties:
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                  {evalResult.suggested_warranties?.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
