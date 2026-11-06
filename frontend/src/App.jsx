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
import PoliciesList from './pages/customer/Policies'
import CustomerClaims from './pages/customer/Claims'
import ShippingDashboard from './pages/shipping/ShippingDashboard'
import Tracking from './pages/shipping/Tracking'
import SurveyorDashboard from './pages/surveyor/SurveyorDashboard'
import AgentDashboard from './pages/agent/AgentDashboard'
import OfficerDashboard from './pages/officer/OfficerDashboard'
import OfficerApplications from './pages/officer/OfficerApplications'
import OfficerClaims from './pages/officer/OfficerClaims'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminAudit from './pages/admin/AdminAudit'
import api from './services/api'
import { ApiListPage, ProfilePage, NotificationsPage, AdminUsersPage } from './pages/shared/OperationalPages'

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
            path="/customer/policies"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <PoliciesList />
              </ProtectedRoute>
            }
          />
          <Route path="/customer/profile" element={<ProtectedRoute allowedRoles={['customer']}><ProfilePage role="customer" /></ProtectedRoute>} />
          <Route path="/customer/payments" element={<ProtectedRoute allowedRoles={['customer']}><ApiListPage title="Payment History" role="customer" endpoint={null} description="Payment records and receipts." unavailableMessage="The current backend does not expose a customer payment-history endpoint. Add GET /payments before enabling payment history; this page will not invent payment records." /></ProtectedRoute>} />
          <Route path="/customer/settlements" element={<ProtectedRoute allowedRoles={['customer']}><ApiListPage title="My Settlements" role="customer" endpoint={null} description="Approved claim settlement statements and payout references." unavailableMessage="The current backend has no customer settlement-history endpoint or settlement transaction table. Implement GET /settlements/me and settlement transaction records." /></ProtectedRoute>} />
          <Route path="/customer/grievances" element={<ProtectedRoute allowedRoles={['customer']}><ApiListPage title="Grievances" role="customer" endpoint={null} description="Register and track service complaints and claim disputes." unavailableMessage="Grievance management is not implemented in the current backend. Add grievance models and authenticated create/list/update endpoints." /></ProtectedRoute>} />
          <Route path="/customer/ai" element={<ProtectedRoute allowedRoles={['customer']}><ApiListPage title="MarineSure AI Assistant" role="customer" endpoint={null} description="AI policy guidance and claim assistance." unavailableMessage="The current AI endpoints are limited to document parsing and damage analysis. A permission-aware chat/recommendation API is still required." /></ProtectedRoute>} />
          <Route path="/customer/notifications" element={<ProtectedRoute allowedRoles={['customer']}><NotificationsPage role="customer" /></ProtectedRoute>} />
          <Route
            path="/customer/claims"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <CustomerClaims />
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
            path="/officer/claims"
            element={
              <ProtectedRoute allowedRoles={['insurance_officer', 'senior_officer']}>
                <OfficerClaims />
              </ProtectedRoute>
            }
          />
          <Route path="/officer/settlements" element={<ProtectedRoute allowedRoles={['insurance_officer', 'senior_officer']}><ApiListPage title="Settlement Management" role="officer" endpoint={null} description="Review approved amounts, deductions, payout references and reconciliation." unavailableMessage="The backend does not yet expose settlement transactions or payout reconciliation. This page deliberately reports the missing API instead of showing fabricated data." /></ProtectedRoute>} />
          <Route path="/officer/surveyors" element={<ProtectedRoute allowedRoles={['insurance_officer', 'senior_officer']}><ApiListPage title="Surveyor Management" role="officer" endpoint="/surveyors" description="Registered surveyors available for claim assignment." /></ProtectedRoute>} />
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
          <Route path="/shipping/profile" element={<ProtectedRoute allowedRoles={['shipping_company']}><ProfilePage role="shipping" /></ProtectedRoute>} />
          <Route path="/shipping/incidents" element={<ProtectedRoute allowedRoles={['shipping_company']}><ApiListPage title="Shipment Incidents" role="shipping" endpoint="/incidents" description="Incidents reported for shipments accessible to this account." /></ProtectedRoute>} />
          <Route
            path="/surveyor/claims"
            element={<ProtectedRoute allowedRoles={['surveyor']}><ApiListPage title="Assigned Claims" role="surveyor" endpoint="/surveyor/assignments" description="Claims assigned to the signed-in surveyor." /></ProtectedRoute>}
          />
          <Route path="/surveyor/schedule" element={<ProtectedRoute allowedRoles={['surveyor']}><ApiListPage title="Inspection Schedule" role="surveyor" endpoint="/surveyor/assignments" description="Assigned claims requiring inspection. A calendar API is not yet available." /></ProtectedRoute>} />
          <Route path="/surveyor/reports" element={<ProtectedRoute allowedRoles={['surveyor']}><ApiListPage title="Survey Reports" role="surveyor" endpoint={null} description="Submitted survey reports and inspection history." unavailableMessage="Survey reports can currently be retrieved per claim only. Add GET /surveyor/reports to support a consolidated report history." /></ProtectedRoute>} />
          <Route path="/agent/commissions" element={<ProtectedRoute allowedRoles={['agent']}><ApiListPage title="Commission Ledger" role="agent" endpoint="/agent/commissions" description="Commission records for the signed-in agent." /></ProtectedRoute>} />
          <Route path="/agent/products" element={<ProtectedRoute allowedRoles={['agent']}><ApiListPage title="Products Catalog" role="agent" endpoint="/insurance-products" description="Insurance products available in the current catalog." /></ProtectedRoute>} />
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
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsersPage /></ProtectedRoute>} />
          <Route path="/admin/roles" element={<ProtectedRoute allowedRoles={['admin']}><ApiListPage title="Roles & Permissions" role="admin" endpoint={null} description="Review and configure role permissions." unavailableMessage="The backend currently supports role assignment but does not expose a role-permission matrix editor. Implement permission models and admin-only CRUD endpoints." /></ProtectedRoute>} />
          <Route path="/admin/products" element={<ProtectedRoute allowedRoles={['admin']}><ApiListPage title="Insurance Product Catalog" role="admin" endpoint="/insurance-products" description="Current catalog from the backend. Product create/update/activate APIs are not yet available, so this view is read-only." /></ProtectedRoute>} />
          <Route path="/admin/finance" element={<ProtectedRoute allowedRoles={['admin']}><ApiListPage title="Financial Reports" role="admin" endpoint={null} description="Premium, refunds, claim reserves and settlement reporting." unavailableMessage="The backend does not yet expose a financial reporting/ledger endpoint. Add immutable ledger and reconciliation APIs before showing financial totals." /></ProtectedRoute>} />
          <Route path="/admin/audit"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminAudit />
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
