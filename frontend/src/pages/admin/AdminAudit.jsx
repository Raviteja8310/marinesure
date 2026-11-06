import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import api from '../../services/api'

const NAV = [
  { name: 'Dashboard', path: '/admin', icon: '📊' },
  { name: 'Insurance Products', path: '/customer/products', icon: '📋' },
  { name: 'Underwriting', path: '/officer', icon: '🔍' },
  { name: 'Claims Oversight', path: '/officer/claims', icon: '⚖️' },
  { name: 'Audit Logs', path: '/admin/audit', icon: '📝' },
]

export default function AdminAudit() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('all')

  useEffect(() => {
    api.get('/audit-logs')
      .then((res) => setLogs(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const filteredLogs = filterAction === 'all'
    ? logs
    : logs.filter((l) => l.action.toLowerCase().includes(filterAction.toLowerCase()))

  return (
    <DashboardLayout title="System Compliance & Audit Trail" roleLabel="Administrator" navigation={NAV}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-sm text-slate-400">
            Immutable regulatory audit log tracking policy binding, payouts, underwriting actions, and security operations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Filter:</span>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs text-white rounded-lg px-3 py-1.5"
          >
            <option value="all">All Operations</option>
            <option value="COMMISSION">Commissions</option>
            <option value="POLICY">Policy Actions</option>
            <option value="CLAIM">Claims & Surveys</option>
            <option value="AUTH">Authentication</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="text-slate-400 uppercase bg-slate-950/40">
            <tr>
              <th className="text-left px-4 py-3">Timestamp</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Resource Type</th>
              <th className="text-left px-4 py-3">Resource ID</th>
              <th className="text-left px-4 py-3">Actor</th>
              <th className="text-left px-4 py-3">Audit Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id} className="border-t border-slate-800/80 hover:bg-slate-800/20">
                <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-semibold text-marine-300">
                  <span className="px-2 py-0.5 rounded bg-marine-500/10 border border-marine-500/20">
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300 uppercase font-mono">{log.resource_type}</td>
                <td className="px-4 py-3 font-mono text-slate-500 max-w-[120px] truncate">
                  {log.resource_id || '—'}
                </td>
                <td className="px-4 py-3 font-mono text-slate-400 max-w-[100px] truncate">
                  {log.actor_id || 'SYSTEM'}
                </td>
                <td className="px-4 py-3 text-slate-300 font-mono text-[11px] max-w-xs truncate">
                  {log.details ? JSON.stringify(log.details) : '—'}
                </td>
              </tr>
            ))}
            {filteredLogs.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No audit log entries matching criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  )
}
