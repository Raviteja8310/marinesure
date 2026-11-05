import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      const roles = user.roles || []
      if (roles.includes('admin')) navigate('/admin')
      else if (roles.includes('insurance_officer') || roles.includes('senior_officer')) navigate('/officer')
      else if (roles.includes('surveyor')) navigate('/surveyor')
      else if (roles.includes('shipping_company')) navigate('/shipping')
      else if (roles.includes('agent')) navigate('/agent')
      else navigate('/customer')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password. Verify your email if newly registered.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-marine-950 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-slate-900/90 border border-marine-800/80 p-8 rounded-2xl shadow-2xl backdrop-blur-xl">
        <div>
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-marine-400 to-marine-600 flex items-center justify-center text-2xl shadow-lg shadow-marine-500/20">
            ⚓
          </div>
          <h2 className="mt-4 text-center text-3xl font-extrabold text-white">
            Sign in to MarineSure
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Marine Cargo Insurance & Claims Platform
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2.5 border border-slate-700 bg-slate-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-marine-500 focus:border-marine-500 sm:text-sm"
                placeholder="you@domain.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2.5 border border-slate-700 bg-slate-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-marine-500 focus:border-marine-500 sm:text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-marine-600 hover:bg-marine-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-marine-500 transition shadow-lg shadow-marine-600/30 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <Link to="/register" className="text-marine-400 hover:text-marine-300 font-medium">
              Create an account &rarr;
            </Link>
            <Link to="/" className="text-slate-400 hover:text-slate-300">
              &larr; Back to Home
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
