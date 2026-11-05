import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function DashboardLayout({ title, roleLabel, navigation = [], children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col fixed inset-y-0 z-40">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-marine-400 to-marine-600 flex items-center justify-center font-bold text-lg shadow-md shadow-marine-500/20">
            ⚓
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white">MarineSure 2.0</span>
            <span className="block text-[10px] uppercase tracking-wider text-marine-400 font-semibold">
              {roleLabel}
            </span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const active = location.pathname === item.path
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'bg-marine-600/20 text-marine-400 border border-marine-500/30 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-marine-700/50 flex items-center justify-center text-sm font-bold text-marine-300 border border-marine-600/40">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full text-center py-2 px-3 text-xs font-medium text-slate-400 hover:text-red-400 bg-slate-800/60 hover:bg-red-500/10 rounded-lg transition border border-slate-700/60 hover:border-red-500/20"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 pl-64 flex flex-col min-h-screen">
        <header className="h-16 bg-slate-900/50 border-b border-slate-800 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-8">
          <h1 className="text-xl font-bold text-white">{title}</h1>
          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-marine-500/10 text-marine-300 border border-marine-500/20">
              Role: {user?.roles?.join(', ')}
            </span>
            <span className="text-xs text-slate-400">
              Status: <span className="text-emerald-400 font-semibold uppercase">{user?.status}</span>
            </span>
          </div>
        </header>

        <main className="flex-1 p-8 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950">
          {children}
        </main>
      </div>
    </div>
  )
}
