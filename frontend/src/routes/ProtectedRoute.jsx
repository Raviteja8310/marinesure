import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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
      return <Navigate to="/login" replace />
    }
  }

  return children
}
