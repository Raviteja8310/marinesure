import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import Login from './pages/auth/Login'
const Register = lazy(() => import('./pages/auth/Register'))
const CustomerDashboard = lazy(() => import('./pages/customer/CustomerDashboard'))
const ShipmentList = lazy(() => import('./pages/customer/Shipments').then((m) => ({ default: m.ShipmentList })))
const RegisterShipment = lazy(() => import('./pages/customer/Shipments').then((m) => ({ default: m.RegisterShipment })))
const InsuranceProducts = lazy(() => import('./pages/customer/InsuranceProducts'))
const ApplicationsList = lazy(() => import('./pages/customer/Applications').then((m) => ({ default: m.ApplicationsList })))
const NewApplication = lazy(() => import('./pages/customer/Applications').then((m) => ({ default: m.NewApplication })))
const PoliciesList = lazy(() => import('./pages/customer/Policies'))
const CustomerClaims = lazy(() => import('./pages/customer/Claims'))
const ShippingDashboard = lazy(() => import('./pages/shipping/ShippingDashboard'))
const Tracking = lazy(() => import('./pages/shipping/Tracking'))
const SurveyorDashboard = lazy(() => import('./pages/surveyor/SurveyorDashboard'))
const AgentDashboard = lazy(() => import('./pages/agent/AgentDashboard'))
const OfficerDashboard = lazy(() => import('./pages/officer/OfficerDashboard'))
const OfficerApplications = lazy(() => import('./pages/officer/OfficerApplications'))
const OfficerClaims = lazy(() => import('./pages/officer/OfficerClaims'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit'))
import Landing from './pages/public/Landing'
const ApiListPage = lazy(() => import('./pages/shared/OperationalPages').then((m) => ({ default: m.ApiListPage })))
const ProfilePage = lazy(() => import('./pages/shared/OperationalPages').then((m) => ({ default: m.ProfilePage })))
const NotificationsPage = lazy(() => import('./pages/shared/OperationalPages').then((m) => ({ default: m.NotificationsPage })))
const AdminUsersPage = lazy(() => import('./pages/shared/OperationalPages').then((m) => ({ default: m.AdminUsersPage })))
const PaymentsPage = lazy(() => import('./pages/shared/OpsModules').then((m) => ({ default: m.PaymentsPage })))
const SettlementsPage = lazy(() => import('./pages/shared/OpsModules').then((m) => ({ default: m.SettlementsPage })))
const GrievancesPage = lazy(() => import('./pages/shared/OpsModules').then((m) => ({ default: m.GrievancesPage })))
const AssistantPage = lazy(() => import('./pages/shared/OpsModules').then((m) => ({ default: m.AssistantPage })))
const RolesPermissionsPage = lazy(() => import('./pages/shared/OpsModules').then((m) => ({ default: m.RolesPermissionsPage })))
const AdminProductsPage = lazy(() => import('./pages/shared/OpsModules').then((m) => ({ default: m.AdminProductsPage })))
const FinancePage = lazy(() => import('./pages/shared/OpsModules').then((m) => ({ default: m.FinancePage })))
const InspectionsPage = lazy(() => import('./pages/shared/OpsModules').then((m) => ({ default: m.InspectionsPage })))
const SurveyorReportsPage = lazy(() => import('./pages/shared/OpsModules').then((m) => ({ default: m.SurveyorReportsPage })))

// Resets after navigation so a crash on one page doesn't block the others.
function RouteErrorBoundary({ children }) {
  const location = useLocation()
  return <ErrorBoundary resetKey={location.pathname}>
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-navy-950" role="status"><span className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" /><span className="sr-only">Loading…</span></div>}>
      {children}
    </Suspense>
  </ErrorBoundary>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RouteErrorBoundary>
        <Routes>
          <Route path="/" element={<Landing />} />
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
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/customer/profile" element={<ProtectedRoute allowedRoles={['customer']}><ProfilePage role="customer" /></ProtectedRoute>} />
          <Route path="/customer/payments" element={<ProtectedRoute allowedRoles={['customer']}><PaymentsPage /></ProtectedRoute>} />
          <Route path="/customer/settlements" element={<ProtectedRoute allowedRoles={['customer']}><SettlementsPage /></ProtectedRoute>} />
          <Route path="/customer/grievances" element={<ProtectedRoute allowedRoles={['customer']}><GrievancesPage /></ProtectedRoute>} />
          <Route path="/customer/ai" element={<ProtectedRoute allowedRoles={['customer']}><AssistantPage /></ProtectedRoute>} />
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
          <Route path="/officer/settlements" element={<ProtectedRoute allowedRoles={['insurance_officer', 'senior_officer']}><SettlementsPage staff /></ProtectedRoute>} />
          <Route path="/officer/grievances" element={<ProtectedRoute allowedRoles={['insurance_officer', 'senior_officer']}><GrievancesPage staff /></ProtectedRoute>} />
          <Route path="/officer/inspections" element={<ProtectedRoute allowedRoles={['insurance_officer', 'senior_officer']}><InspectionsPage staff /></ProtectedRoute>} />
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
          <Route path="/surveyor/schedule" element={<ProtectedRoute allowedRoles={['surveyor']}><InspectionsPage /></ProtectedRoute>} />
          <Route path="/surveyor/reports" element={<ProtectedRoute allowedRoles={['surveyor']}><SurveyorReportsPage /></ProtectedRoute>} />
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
          <Route path="/admin/roles" element={<ProtectedRoute allowedRoles={['admin']}><RolesPermissionsPage /></ProtectedRoute>} />
          <Route path="/admin/products" element={<ProtectedRoute allowedRoles={['admin']}><AdminProductsPage /></ProtectedRoute>} />
          <Route path="/admin/finance" element={<ProtectedRoute allowedRoles={['admin']}><FinancePage /></ProtectedRoute>} />
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
        </RouteErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  )
}
