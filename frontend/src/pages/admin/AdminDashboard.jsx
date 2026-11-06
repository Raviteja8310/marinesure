import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import api from '../../services/api'

const NAV = [
  { name: 'Dashboard', path: '/admin', icon: '📊' },
  { name: 'User Management', path: '/admin/users', icon: '👥' },
  { name: 'Roles & Permissions', path: '/admin/roles', icon: '🔑' },
  { name: 'Insurance Products', path: '/admin/products', icon: '📋' },
  { name: 'Financial Reports', path: '/admin/finance', icon: '💰' },
  { name: 'Audit Logs', path: '/admin/audit', icon: '📝' },
]

export default function AdminDashboard() {
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/analytics/dashboard-kpis')
      .then((res) => setKpis(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const fin = kpis?.financials || {}
  const ops = kpis?.operations || {}

  return (
    <DashboardLayout title="System Administration & Executive Overview" roleLabel="Admin" navigation={NAV}>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Gross Written Premium</span>
            <span className="text-2xl">💰</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-white font-mono">
            ₹{Number(fin.gross_written_premium || 0).toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-emerald-400">Total Portfolio Revenue</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Policies</span>
            <span className="text-2xl">📜</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-marine-400 font-mono">
            {ops.active_policies_count || 0}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Across {ops.total_registered_shipments || 0} shipments
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Portfolio Loss Ratio</span>
            <span className="text-2xl">⚖️</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-white font-mono">
            {fin.portfolio_loss_ratio_pct ?? '0.0'}%
          </p>
          <p className="mt-2 text-xs text-purple-400">
            Paid: ₹{Number(fin.total_claims_paid || 0).toLocaleString()}
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Underwriting Queue</span>
            <span className="text-2xl">📝</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-400 font-mono">
            {ops.pending_applications_count || 0}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Approval Rate: {ops.underwriting_approval_rate_pct || 0}%
          </p>
        </div>
      </div>

      {/* Quick Administrative Operations Cards */}
      <h3 className="text-sm font-bold text-white mb-4">Core Platform Modules</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
          <div className="text-2xl mb-2">📋</div>
          <h4 className="text-base font-bold text-white mb-1">Insurance Products Catalog</h4>
          <p className="text-xs text-slate-400 mb-4">
            Manage Institute Cargo Clauses coverage terms, deductibles, and base rating matrices.
          </p>
          <Link
            to="/customer/products"
            className="text-xs text-marine-400 font-semibold hover:underline"
          >
            Manage Marine Products &rarr;
          </Link>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
          <div className="text-2xl mb-2">🔍</div>
          <h4 className="text-base font-bold text-white mb-1">Underwriting Administration</h4>
          <p className="text-xs text-slate-400 mb-4">
            Oversee application reviews, special conditions, and policy risk evaluations.
          </p>
          <Link
            to="/officer"
            className="text-xs text-marine-400 font-semibold hover:underline"
          >
            Open Underwriting Dashboard &rarr;
          </Link>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
          <div className="text-2xl mb-2">⚖️</div>
          <h4 className="text-base font-bold text-white mb-1">Claims & Surveyor Oversight</h4>
          <p className="text-xs text-slate-400 mb-4">
            Audit casualty claims, survey reports, deductible deductions, and settlement vouchers.
          </p>
          <Link
            to="/officer/claims"
            className="text-xs text-marine-400 font-semibold hover:underline"
          >
            Review Claims & Surveys &rarr;
          </Link>
        </div>
      </div>
    </DashboardLayout>
  )
}
