import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import CustomerDashboard from './pages/customer/CustomerDashboard'
import { ShipmentList, RegisterShipment } from './pages/customer/Shipments'
import InsuranceProducts from './pages/customer/InsuranceProducts'
import { ApplicationsList, NewApplication } from './pages/customer/Applications'
import ShippingDashboard from './pages/shipping/ShippingDashboard'
import Tracking from './pages/shipping/Tracking'
import SurveyorDashboard from './pages/surveyor/SurveyorDashboard'
import AgentDashboard from './pages/agent/AgentDashboard'
import OfficerDashboard from './pages/officer/OfficerDashboard'
import OfficerApplications from './pages/officer/OfficerApplications'
import AdminDashboard from './pages/admin/AdminDashboard'
import api from './services/api'

function LandingPage() {
  const [backendStatus, setBackendStatus] = useState(null)
  const { user } = useAuth()

  useEffect(() => {
    api.get('/health')
      .then((res) => setBackendStatus(res.data))
      .catch((err) => setBackendStatus({ status: 'offline', error: err.message }))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-marine-950 to-slate-900 text-white flex flex-col">
      {/* Header */}
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
                Marine Cargo Insurance Platform
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <Link
                to={
                  user.roles?.includes('admin')
                    ? '/admin'
                    : user.roles?.includes('insurance_officer')
                    ? '/officer'
                    : user.roles?.includes('surveyor')
                    ? '/surveyor'
                    : user.roles?.includes('shipping_company')
                    ? '/shipping'
                    : user.roles?.includes('agent')
                    ? '/agent'
                    : '/customer'
                }
                className="px-4 py-2 bg-marine-600 hover:bg-marine-500 rounded-lg text-sm font-semibold transition"
              >
                Go to Dashboard ({user.roles?.[0]}) &rarr;
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-slate-300 hover:text-white transition px-3 py-1.5"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-marine-600 hover:bg-marine-500 rounded-lg text-sm font-semibold transition shadow-md shadow-marine-600/30"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-x-2 rounded-full px-3 py-1 text-xs font-medium bg-marine-500/10 text-marine-300 border border-marine-500/20 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Phase 2 Authenticated Multi-Role System Active
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-marine-100 to-marine-300 bg-clip-text text-transparent">
            Marine Cargo Insurance, Protection & Claims
          </h1>
          <p className="mt-6 text-lg text-slate-300 leading-relaxed">
            A centralized, AI-assisted platform digitizing policy applications, real-time shipment tracking, premium calculation, damage inspection, and end-to-end claim settlement.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              to="/register"
              className="px-6 py-3 bg-marine-600 hover:bg-marine-500 text-white font-semibold rounded-xl transition shadow-lg shadow-marine-600/30"
            >
              Register Account &rarr;
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 bg-slate-800/80 hover:bg-slate-700/80 text-white font-semibold rounded-xl transition border border-slate-700/60"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Roles Grid */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              role: 'Customer',
              desc: 'Importers and exporters manage shipments, request quotes, purchase policies, and track claims.',
              icon: '🚢',
            },
            {
              role: 'Shipping Company',
              desc: 'Logistics partners register cargo, assign containers, and record transportation milestones.',
              icon: '📦',
            },
            {
              role: 'Surveyor',
              desc: 'Certified marine inspectors assess damaged cargo, upload photos, and file survey reports.',
              icon: '🔍',
            },
            {
              role: 'Insurance Officer',
              desc: 'Underwriters verify risk, issue policies, evaluate claims, and authorize settlements.',
              icon: '🛡️',
            },
          ].map((item) => (
            <div
              key={item.role}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 hover:border-marine-600/40 transition"
            >
              <div className="text-3xl mb-3">{item.icon}</div>
              <h3 className="font-bold text-white text-base">{item.role}</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        MarineSure 2.0 – Modular Monolithic Architecture · Python FastAPI · React · MySQL 8.4
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Role Dashboards */}
          <Route
            path="/customer"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/shipments"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <ShipmentList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/shipments/new"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <RegisterShipment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/products"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <InsuranceProducts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/applications"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <ApplicationsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/applications/new"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <NewApplication />
              </ProtectedRoute>
            }
          />
          <Route
            path="/officer/applications"
            element={
              <ProtectedRoute allowedRoles={['insurance_officer', 'senior_officer']}>
                <OfficerApplications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/officer/underwriting"
            element={
              <ProtectedRoute allowedRoles={['insurance_officer', 'senior_officer']}>
                <OfficerApplications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shipping"
            element={
              <ProtectedRoute allowedRoles={['shipping_company']}>
                <ShippingDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shipping/shipments"
            element={
              <ProtectedRoute allowedRoles={['shipping_company']}>
                <Tracking />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shipping/tracking"
            element={
              <ProtectedRoute allowedRoles={['shipping_company']}>
                <Tracking />
              </ProtectedRoute>
            }
          />
          <Route
            path="/surveyor/*"
            element={
              <ProtectedRoute allowedRoles={['surveyor']}>
                <SurveyorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agent/*"
            element={
              <ProtectedRoute allowedRoles={['agent']}>
                <AgentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/officer/*"
            element={
              <ProtectedRoute allowedRoles={['insurance_officer', 'senior_officer']}>
                <OfficerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
