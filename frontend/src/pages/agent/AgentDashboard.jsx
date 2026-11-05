import React from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'

const NAV = [
  { name: 'Dashboard', path: '/agent', icon: '📊' },
  { name: 'Assigned Customers', path: '/agent/customers', icon: '👤' },
  { name: 'Insurance Products', path: '/agent/products', icon: '📋' },
  { name: 'Quotations', path: '/agent/quotations', icon: '📝' },
  { name: 'Commissions', path: '/agent/commissions', icon: '💰' },
  { name: 'Notifications', path: '/agent/notifications', icon: '🔔' },
  { name: 'Profile', path: '/agent/profile', icon: '👤' },
]

export default function AgentDashboard() {
  return (
    <DashboardLayout title="Agent / Broker Dashboard" roleLabel="Agent" navigation={NAV}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Assigned Customers', value: '—', icon: '👤' },
          { label: 'Active Quotations', value: '—', icon: '📝' },
          { label: 'Commission This Month', value: '—', icon: '💰' },
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
