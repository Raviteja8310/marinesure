import React from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'

const NAV = [
  { name: 'Dashboard', path: '/admin', icon: '📊' },
  { name: 'User Management', path: '/admin/users', icon: '👥' },
  { name: 'Roles & Permissions', path: '/admin/roles', icon: '🔑' },
  { name: 'Insurance Products', path: '/admin/products', icon: '📋' },
  { name: 'Premium Rules', path: '/admin/premium-rules', icon: '💲' },
  { name: 'Financial Reports', path: '/admin/finance', icon: '💰' },
  { name: 'Audit Logs', path: '/admin/audit', icon: '📝' },
  { name: 'AI Configuration', path: '/admin/ai', icon: '🤖' },
  { name: 'System Settings', path: '/admin/settings', icon: '⚙️' },
]

export default function AdminDashboard() {
  return (
    <DashboardLayout title="Administrator Dashboard" roleLabel="Admin" navigation={NAV}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Users', value: '—', icon: '👥' },
          { label: 'Active Policies', value: '—', icon: '📜' },
          { label: 'Premium Collected', value: '—', icon: '💰' },
          { label: 'Total Claims', value: '—', icon: '📦' },
        ].map((c) => (
          <div key={c.label} className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <span className="text-2xl">{c.icon}</span>
              <span className="text-3xl font-bold text-white">{c.value}</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">{c.label}</p>
          </div>
        ))}
      </div>
    </DashboardLayout>
  )
}
