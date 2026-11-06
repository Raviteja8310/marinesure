import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DashboardLayout from '../../layouts/DashboardLayout'
import api from '../../services/api'

const NAV = [
  { name: 'Dashboard', path: '/customer', icon: '📊' },
  { name: 'My Shipments', path: '/customer/shipments', icon: '🚢' },
  { name: 'Insurance Products', path: '/customer/products', icon: '📋' },
  { name: 'My Applications', path: '/customer/applications', icon: '📝' },
]

export function ApplicationsList() {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState(null)
  const [msg, setMsg] = useState('')

  const load = () =>
    api.get('/applications')
      .then((res) => setApps(res.data))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const handlePay = async (appId) => {
    setPayingId(appId)
    setMsg('')
    try {
      // 1. Create order
      const orderRes = await api.post('/payments/create-order', { application_id: appId })
      const order = orderRes.data

      // 2. Simulate Razorpay Test Mode confirmation & backend verification
      await api.post(`/payments/${order.id}/verify`, {
        gateway_payment_id: `pay_test_${Date.now()}`,
        gateway_signature: 'test_mode_signature',
      })

      setMsg('Payment verified! Insurance Policy & PDF certificate issued.')
      window.location.href = '/customer/policies'
    } catch (err) {
      alert(err.response?.data?.detail || 'Payment failed')
      setPayingId(null)
    }
  }

  return (
    <DashboardLayout title="My Insurance Applications" roleLabel="Customer" navigation={NAV}>
      {msg && (
        <div className="p-4 mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {msg}
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-slate-400">
          Track underwriting reviews and approval status for registered shipments.
        </p>
        <Link
          to="/customer/applications/new"
          className="px-4 py-2 bg-marine-600 hover:bg-marine-500 text-white rounded-lg text-sm font-semibold transition"
        >
          Submit New Application &rarr;
        </Link>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-xs uppercase bg-slate-950/40">
            <tr>
              <th className="text-left px-4 py-3">Application #</th>
              <th className="text-left px-4 py-3">Insured Amount</th>
              <th className="text-left px-4 py-3">Estimated Premium</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Actions</th>
              <th className="text-right px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id} className="border-t border-slate-800 hover:bg-slate-800/20">
                <td className="px-4 py-3 font-mono text-marine-300 font-semibold">
                  {a.application_number}
                </td>
                <td className="px-4 py-3">₹{Number(a.requested_insured_amount).toLocaleString()}</td>
                <td className="px-4 py-3 font-semibold text-emerald-400">
                  ₹{Number(a.calculated_premium).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                      a.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : a.status === 'rejected'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {a.status.replaceAll('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {a.status === 'approved' ? (
                    <button
                      onClick={() => handlePay(a.id)}
                      disabled={payingId === a.id}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold transition disabled:opacity-50"
                    >
                      {payingId === a.id ? 'Processing...' : '💳 Pay & Issue Policy'}
                    </button>
                  ) : (
                    <span className="text-slate-500">{a.officer_remarks || 'Under review'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-xs text-slate-400">
                  {new Date(a.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {apps.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No insurance applications submitted yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  )
}

export function NewApplication() {
  const [searchParams] = useSearchParams()
  const initialProductId = searchParams.get('product_id') || ''

  const [shipments, setShipments] = useState([])
  const [products, setProducts] = useState([])
  const [selectedShipment, setSelectedShipment] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(initialProductId)
  const [comparisons, setComparisons] = useState([])
  const [loadingCompare, setLoadingCompare] = useState(false)
  const [specialConditions, setSpecialConditions] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submittedApp, setSubmittedApp] = useState(null)

  useEffect(() => {
    Promise.all([api.get('/shipments'), api.get('/insurance-products')]).then(
      ([shipRes, prodRes]) => {
        setShipments(shipRes.data)
        setProducts(prodRes.data)
        if (shipRes.data.length > 0) {
          setSelectedShipment(shipRes.data[0].id)
        }
      }
    )
  }, [])

  useEffect(() => {
    if (selectedShipment) {
      setLoadingCompare(true)
      api.get(`/shipments/${selectedShipment}/compare-products`)
        .then((res) => setComparisons(res.data))
        .catch(() => setComparisons([]))
        .finally(() => setLoadingCompare(false))
    }
  }, [selectedShipment])

  const shipmentObj = shipments.find((s) => s.id === selectedShipment)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedShipment || !selectedProduct) {
      setError('Please select both a shipment and an insurance product.')
      return
    }
    setError('')
    setSubmitting(true)

    try {
      const res = await api.post('/applications', {
        shipment_id: selectedShipment,
        product_id: selectedProduct,
        requested_insured_amount: shipmentObj ? shipmentObj.declared_value : 100000,
        special_conditions: specialConditions,
      })
      setSubmittedApp(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout title="Apply for Cargo Insurance" roleLabel="Customer" navigation={NAV}>
      {submittedApp ? (
        <div className="max-w-xl mx-auto bg-slate-900/90 border border-marine-800 p-8 rounded-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-2xl">
            ✓
          </div>
          <h2 className="text-xl font-bold text-white">Application Submitted Successfully</h2>
          <p className="font-mono text-marine-300 font-semibold text-lg">
            {submittedApp.application_number}
          </p>
          <p className="text-sm text-slate-300">
            Estimated Premium:{' '}
            <span className="font-semibold text-emerald-400">
              ₹{Number(submittedApp.calculated_premium).toLocaleString()}
            </span>
          </p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Your application is now under officer underwriting review. You will be notified once a decision is recorded.
          </p>
          <div className="pt-4">
            <Link
              to="/customer/applications"
              className="px-6 py-2.5 bg-marine-600 hover:bg-marine-500 text-white rounded-lg text-sm font-semibold transition"
            >
              View My Applications &rarr;
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-4xl space-y-8">
          {error && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Select Shipment */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-white text-base">1. Select Registered Shipment</h3>
            {shipments.length === 0 ? (
              <p className="text-xs text-slate-400">
                You have no registered shipments.{' '}
                <Link to="/customer/shipments/new" className="text-marine-400 underline">
                  Register a shipment first &rarr;
                </Link>
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Shipment Reference</label>
                  <select
                    value={selectedShipment}
                    onChange={(e) => setSelectedShipment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                  >
                    {shipments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shipment_number} ({s.origin_location} → {s.destination_location})
                      </option>
                    ))}
                  </select>
                </div>
                {shipmentObj && (
                  <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Declared Value:</span>
                      <span className="text-white font-semibold">
                        ₹{Number(shipmentObj.declared_value).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Transport Mode:</span>
                      <span className="text-white capitalize">{shipmentObj.transport_mode}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Compare & Select Product */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-white text-base">2. Compare & Select Insurance Policy</h3>
            {loadingCompare ? (
              <p className="text-xs text-slate-400">Calculating eligible quotations...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {comparisons.map(({ product, quotation, is_eligible, eligibility_notes }) => {
                  const selected = selectedProduct === product.id
                  return (
                    <div
                      key={product.id}
                      onClick={() => is_eligible && setSelectedProduct(product.id)}
                      className={`p-4 rounded-xl border transition ${
                        !is_eligible
                          ? 'opacity-50 border-slate-800 bg-slate-950 cursor-not-allowed'
                          : selected
                          ? 'border-marine-500 bg-marine-600/20 text-white cursor-pointer shadow-lg'
                          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 cursor-pointer'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-sm text-white">{product.product_name}</span>
                        {is_eligible ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                            Eligible
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                            Ineligible
                          </span>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs space-y-1">
                        <div className="flex justify-between text-slate-400">
                          <span>Est. Premium:</span>
                          <span className="text-emerald-400 font-bold text-sm">
                            ₹{Number(quotation.total_premium).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Deductible:</span>
                          <span className="text-white">
                            ₹{Number(quotation.deductible_amount).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {!is_eligible && eligibility_notes.length > 0 && (
                        <p className="text-[11px] text-rose-400 mt-2">{eligibility_notes.join(', ')}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Step 3: Special Conditions */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-3">
            <h3 className="font-semibold text-white text-base">3. Special Handling / Conditions (Optional)</h3>
            <textarea
              value={specialConditions}
              onChange={(e) => setSpecialConditions(e.target.value)}
              placeholder="e.g. Temperature monitoring required below 4°C, armed escort for high value cargo..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white h-24"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedShipment || !selectedProduct}
            className="w-full py-3.5 bg-marine-600 hover:bg-marine-500 text-white rounded-xl font-bold text-sm transition shadow-lg shadow-marine-600/30 disabled:opacity-50"
          >
            {submitting ? 'Submitting Application...' : 'Submit Application for Underwriting Review &rarr;'}
          </button>
        </form>
      )}
    </DashboardLayout>
  )
}
