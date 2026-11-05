import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'customer',
    customer_type: 'importer',
    company_name: '',
    country: '',
    registration_number: '',
    agency_name: '',
    qualification: '',
    phone: '',
  })
  const [devToken, setDevToken] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const res = await register(formData)
      setMessage(res.data.message)
      if (res.data.dev_token) {
        setDevToken(res.data.dev_token)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please check your inputs.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickVerify = async () => {
    try {
      await api.post('/auth/verify-email', { token: devToken })
      navigate('/login')
    } catch (err) {
      setError('Verification failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-marine-950  to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-8 bg-slate-900/90 border border-marine-800/80 p-8 rounded-2xl shadow-2xl backdrop-blur-xl">
        <div>
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-marine-400 to-marine-600 flex items-center justify-center text-2xl shadow-lg shadow-marine-500/20">
            ⚓
          </div>
          <h2 className="mt-4 text-center text-3xl font-extrabold text-white">
            Create MarineSure Account
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Join the Marine Cargo Insurance & Claims platform
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {message ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-6 rounded-xl text-center space-y-4">
            <p className="font-semibold">{message}</p>
            {devToken && (
              <div className="space-y-2">
                <p className="text-xs text-slate-300">
                  Development verification token generated:
                </p>
                <div className="bg-slate-950 p-3 rounded font-mono text-xs text-marine-300 break-all border border-marine-900">
                  {devToken}
                </div>
                <button
                  onClick={async () => {
                    await api.post('/auth/verify-email', { token: devToken })
                    navigate('/login')
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
                >
                  Verify & Proceed to Login &rarr;
                </button>
              </div>
            )}
          </div>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-700 bg-slate-800 text-white rounded-lg text-sm focus:ring-2 focus:ring-marine-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-700 bg-slate-800 text-white rounded-lg text-sm focus:ring-2 focus:ring-marine-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                  Password (min 8 chars)
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-700 bg-slate-800 text-white rounded-lg text-sm focus:ring-2 focus:ring-marine-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                  Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-700 bg-slate-800 text-white rounded-lg text-sm focus:ring-2 focus:ring-marine-500"
                >
                  <option value="customer">Customer (Importer / Exporter)</option>
                  <option value="shipping_company">Shipping Company</option>
                  <option value="surveyor">Insurance Surveyor</option>
                  <option value="agent">Agent / Broker</option>
                </select>
              </div>
            </div>

            {formData.role === 'customer' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                    Customer Type
                  </label>
                  <select
                    name="customer_type"
                    value={formData.customer_type}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-800 text-white rounded-lg text-sm"
                  >
                    <option value="importer">Importer</option>
                    <option value="exporter">Exporter</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-800 text-white rounded-lg text-sm"
                  />
                </div>
              </div>
            )}

            {formData.role === 'shipping_company' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    name="company_name"
                    required
                    value={formData.company_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-800 text-white rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    name="registration_number"
                    value={formData.registration_number}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-800 text-white rounded-lg text-sm"
                  />
                </div>
              </div>
            )}

            {formData.role === 'surveyor' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                  Qualifications / Certifications
                </label>
                <input
                  type="text"
                  name="qualification"
                  placeholder="e.g. Master Mariner, IILA Diploma"
                  value={formData.qualification}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-700 bg-slate-800 text-white rounded-lg text-sm"
                />
              </div>
            )}

            {formData.role === 'agent' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                  Agency Name
                </label>
                <input
                  type="text"
                  name="agency_name"
                  required
                  value={formData.agency_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-700 bg-slate-800 text-white rounded-lg text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-700 bg-slate-800 text-white rounded-lg text-sm"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-marine-600 hover:bg-marine-500 transition shadow-lg shadow-marine-600/30 disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Register Account'}
              </button>
            </div>

            <div className="text-center text-sm pt-2">
              <Link to="/login" className="text-marine-400 hover:text-marine-300 font-medium">
                Already have an account? Sign in &rarr;
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
