import React from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'

const NAV = [
  { name: 'Dashboard', path: '/customer', icon: '📊' },
  { name: 'My Profile', path: '/customer/profile', icon: '👤' },
  { name: 'My Shipments', path: '/customer/shipments', icon: '🚢' },
  { name: 'Insurance Products', path: '/customer/products', icon: '📋' },
  { name: 'My Applications', path: '/customer/applications', icon: '📝' },
  { name: 'My Policies', path: '/customer/policies', icon: '📜' },
  { name: 'Payments', path: '/customer/payments', icon: '💳' },
  { name: 'My Claims', path: '/customer/claims', icon: '📦' },
  { name: 'Settlements', path: '/customer/settlements', icon: '💰' },
  { name: 'Grievances', path: '/customer/grievances', icon: '📢' },
  { name: 'AI Assistant', path: '/customer/ai', icon: '🤖' },
  { name: 'Notifications', path: '/customer/notifications', icon: '🔔' },
]

export default function CustomerDashboard() {
  return (
    <DashboardLayout title="Customer Dashboard" roleLabel="Customer" navigation={NAV}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Shipments', value: '—', icon: '🚢', color: 'marine' },
          { label: 'Active Policies', value: '—', icon: '📜', color: 'emerald' },
          { label: 'Pending Claims', value: '—', icon: '📦', color: 'amber' },
          { label: 'Settlements', value: '—', icon: '💰', color: 'sky' },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 hover:border-marine-700/60 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">{card.icon}</span>
              <span className="text-3xl font-bold text-white">{card.value}</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">{card.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 bg-slate-900/60 border border-slate-800/80 rounded-xl p-8 text-center text-slate-400">
        <p className="text-lg font-semibold text-white mb-2">Welcome to MarineSure 2.0</p>
        <p className="text-sm max-w-lg mx-auto">
          From here you can register shipments, browse insurance products, get AI-powered recommendations, submit claims, and track settlements.
        </p>
      </div>
    </DashboardLayout>
  )
}
