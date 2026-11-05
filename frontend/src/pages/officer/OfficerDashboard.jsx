import React from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'

const NAV = [
  { name: 'Dashboard', path: '/officer', icon: '📊' },
  { name: 'Applications', path: '/officer/applications', icon: '📝' },
  { name: 'Underwriting', path: '/officer/underwriting', icon: '🔍' },
  { name: 'Policies', path: '/officer/policies', icon: '📜' },
  { name: 'Claims', path: '/officer/claims', icon: '📦' },
  { name: 'Settlements', path: '/officer/settlements', icon: '💰' },
  { name: 'Surveyor Assignment', path: '/officer/surveyors', icon: '👷' },
  { name: 'Customer Support', path: '/officer/support', icon: '🎧' },
  { name: 'Reports', path: '/officer/reports', icon: '📈' },
]

export default function OfficerDashboard() {
  return (
    <DashboardLayout title="Insurance Officer Dashboard" roleLabel="Officer" navigation={NAV}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Pending Applications', value: '—', icon: '📝' },
          { label: 'Active Policies', value: '—', icon: '📜' },
          { label: 'Pending Claims', value: '—', icon: '📦' },
          { label: 'Pending Settlements', value: '—', icon: '💰' },
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
