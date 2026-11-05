import React from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'

const NAV = [
  { name: 'Dashboard', path: '/surveyor', icon: '📊' },
  { name: 'Assigned Claims', path: '/surveyor/claims', icon: '📋' },
  { name: 'Inspection Schedule', path: '/surveyor/schedule', icon: '📅' },
  { name: 'Survey Reports', path: '/surveyor/reports', icon: '📝' },
  { name: 'Notifications', path: '/surveyor/notifications', icon: '🔔' },
  { name: 'Profile', path: '/surveyor/profile', icon: '👤' },
]

export default function SurveyorDashboard() {
  return (
    <DashboardLayout title="Surveyor Dashboard" roleLabel="Surveyor" navigation={NAV}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Assigned Claims', value: '—', icon: '📋' },
          { label: 'Pending Inspections', value: '—', icon: '🔍' },
          { label: 'Reports Submitted', value: '—', icon: '📝' },
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
