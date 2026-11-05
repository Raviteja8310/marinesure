import { useState, useEffect } from 'react'
import api from './services/api'

export default function App() {
  const [backendStatus, setBackendStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/health')
      .then((res) => setBackendStatus(res.data))
      .catch((err) => setBackendStatus({ status: 'offline', error: err.message }))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-marine-950 to-slate-900 text-white">
      {/* Navigation */}
      <header className="border-b border-marine-800/50 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-marine-400 to-marine-600 flex items-center justify-center font-bold text-xl shadow-lg shadow-marine-500/20">
              ⚓
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-marine-300 to-white bg-clip-text text-transparent">
                MarineSure 2.0
              </span>
              <span className="block text-[10px] tracking-wider uppercase text-marine-300/80 font-medium">
                Cargo Insurance & Claims Platform
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center gap-x-1.5 rounded-full px-3 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Phase 1 Initialized
            </span>
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-marine-300 hover:text-white transition px-3 py-1.5 rounded-md border border-marine-700/60 hover:border-marine-500"
            >
              API Docs &rarr;
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-marine-100 to-marine-300 bg-clip-text text-transparent">
            Complete Marine Cargo Insurance, Protection & Claims
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            A centralized, AI-assisted platform digitizing policy applications, real-time shipment tracking, premium calculation, damage inspection, and end-to-end claim settlement.
          </p>
        </div>

        {/* System Status Tile */}
        <div className="mt-12 max-w-md mx-auto rounded-2xl border border-marine-800/80 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Backend Connectivity</span>
            {loading ? (
              <span className="text-xs text-amber-400">Checking...</span>
            ) : backendStatus?.status === 'healthy' ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                <span className="h-2 w-2 rounded-full bg-amber-400"></span> Offline / Standalone
              </span>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Stack:</span>
              <span className="text-slate-200">FastAPI + React + MySQL 8.4</span>
            </div>
            <div className="flex justify-between">
              <span>Modules:</span>
              <span className="text-slate-200">23 Integrated Modules</span>
            </div>
            <div className="flex justify-between">
              <span>AI Integration:</span>
              <span className="text-slate-200">Policy Recommendations & Assistant</span>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-marine-900 bg-slate-900/50 p-6 hover:border-marine-700/60 transition">
            <div className="text-2xl mb-3">🚢</div>
            <h3 className="font-semibold text-white">Shipment & Policy Lifecycle</h3>
            <p className="text-xs text-slate-400 mt-2">
              End-to-end shipment registration, container tracking, quotations, underwriting, and ReportLab PDF certificate issuance.
            </p>
          </div>

          <div className="rounded-xl border border-marine-900 bg-slate-900/50 p-6 hover:border-marine-700/60 transition">
            <div className="text-2xl mb-3">📋</div>
            <h3 className="font-semibold text-white">Damage Inspection & Claims</h3>
            <p className="text-xs text-slate-400 mt-2">
              Cargo incident reporting, surveyor assignment, on-site inspection reporting, deductible calculation, and multi-tier settlement.
            </p>
          </div>

          <div className="rounded-xl border border-marine-900 bg-slate-900/50 p-6 hover:border-marine-700/60 transition">
            <div className="text-2xl mb-3">🤖</div>
            <h3 className="font-semibold text-white">MarineSure AI Intelligence</h3>
            <p className="text-xs text-slate-400 mt-2">
              Intelligent policy recommendations based on cargo risk profiles and conversational assistant for claim checklists and procedures.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
