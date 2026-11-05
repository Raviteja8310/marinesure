import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import api from '../../services/api'

const NAV = [
  { name: 'Dashboard', path: '/customer', icon: '📊' },
  { name: 'My Shipments', path: '/customer/shipments', icon: '🚢' },
  { name: 'Insurance Products', path: '/customer/products', icon: '📋' },
  { name: 'My Applications', path: '/customer/applications', icon: '📝' },
]

export default function InsuranceProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    api.get('/insurance-products')
      .then((res) => {
        setProducts(res.data)
        if (res.data.length > 0) setSelected(res.data[0])
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <DashboardLayout title="Marine Insurance Products" roleLabel="Customer" navigation={NAV}>
      {loading ? (
        <div className="text-slate-400">Loading products catalog...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product List */}
          <div className="lg:col-span-1 space-y-3">
            {products.map((p) => {
              const active = selected?.id === p.id
              return (
                <div
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    active
                      ? 'bg-marine-600/20 border-marine-500 text-white shadow-lg shadow-marine-600/10'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-marine-500/20 text-marine-300">
                      {p.product_code}
                    </span>
                    <span className="text-xs text-slate-400">
                      Rate: {(Number(p.base_rate) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <h3 className="font-semibold text-white mt-2 text-sm">{p.product_name}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.description}</p>
                </div>
              )
            })}
          </div>

          {/* Product Detail Card */}
          {selected && (
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-marine-500/20 text-marine-300">
                    {selected.product_code}
                  </span>
                  <Link
                    to={`/customer/applications/new?product_id=${selected.id}`}
                    className="px-4 py-2 bg-marine-600 hover:bg-marine-500 text-white rounded-lg text-sm font-semibold transition shadow-md shadow-marine-600/30"
                  >
                    Apply for this Policy &rarr;
                  </Link>
                </div>
                <h2 className="text-xl font-bold text-white mt-3">{selected.product_name}</h2>
                <p className="text-sm text-slate-300 mt-2">{selected.description}</p>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-400 block">Base Premium Rate</span>
                  <span className="text-white font-semibold text-sm">
                    {(Number(selected.base_rate) * 100).toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Deductible</span>
                  <span className="text-white font-semibold text-sm">
                    {selected.deductible_percentage}% (min ₹{Number(selected.min_deductible).toLocaleString()})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Transport Modes</span>
                  <span className="text-white font-semibold text-sm capitalize">
                    {selected.applicable_modes.replaceAll(',', ', ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Coverage Duration</span>
                  <span className="text-white font-semibold text-sm">
                    {selected.coverage_duration_days} Days
                  </span>
                </div>
              </div>

              {/* Coverages & Exclusions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span>✓</span> Covered Perils
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {selected.coverages?.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{c.coverage_name}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <span>✕</span> Policy Exclusions
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {selected.exclusions?.map((e, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{e.exclusion_name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Terms & Conditions */}
              <div className="border-t border-slate-800 pt-4 text-xs text-slate-400">
                <span className="font-semibold text-slate-300 block mb-1">Standard Terms:</span>
                {selected.terms_and_conditions}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
