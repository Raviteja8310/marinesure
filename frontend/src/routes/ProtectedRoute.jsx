import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** The dashboard a user lands on for their highest built-in role. */
export function homeFor(roles = []) {
  if (roles.includes('admin')) return '/admin'
  if (roles.includes('insurance_officer') || roles.includes('senior_officer')) return '/officer'
  if (roles.includes('surveyor')) return '/surveyor'
  if (roles.includes('shipping_company')) return '/shipping'
  if (roles.includes('agent')) return '/agent'
  return '/customer'
}

export default function ProtectedRoute({ allowedRoles = [], children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-marine-400">
        Loading session...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles.length > 0) {
    const userRoles = user.roles || []
    const hasRole = allowedRoles.some((r) => userRoles.includes(r))
    if (!hasRole) {
      // Signed in, just not allowed here: go to their own dashboard, not the login page.
      return <Navigate to={homeFor(userRoles)} replace />
    }
  }

  return children
}
