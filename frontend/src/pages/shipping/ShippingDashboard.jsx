import React from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'

const NAV = [
  { name: 'Dashboard', path: '/shipping', icon: '📊' },
  { name: 'Register Shipment', path: '/shipping/new', icon: '🚢' },
  { name: 'Manage Shipments', path: '/shipping/shipments', icon: '📋' },
  { name: 'Shipment Tracking', path: '/shipping/tracking', icon: '📍' },
  { name: 'Incidents', path: '/shipping/incidents', icon: '⚠️' },
  { name: 'Profile', path: '/shipping/profile', icon: '👤' },
]

export default function ShippingDashboard() {
  return (
    <DashboardLayout title="Shipping Company Dashboard" roleLabel="Shipping" navigation={NAV}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Active Shipments', value: '—', icon: '🚢' },
          { label: 'In Transit', value: '—', icon: '📍' },
          { label: 'Delivered', value: '—', icon: '✅' },
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
