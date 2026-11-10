// Shared formatting helpers so money, dates and statuses read the same everywhere.

const inrFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 2 })
const inrCompact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 })

export function inr(value, { compact = false } = {}) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return '—'
  return (compact ? inrCompact : inrFormatter).format(Number(value))
}

// API datetimes are UTC; some arrive without a zone suffix.
export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const s = String(value)
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(s) || s.length <= 10 ? s : `${s}Z`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function dateTime(value) {
  const d = toDate(value)
  return d ? d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}

export function date(value) {
  const d = toDate(value)
  return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

export function relative(value) {
  const d = toDate(value)
  if (!d) return '—'
  const s = Math.round((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const days = Math.round(h / 24)
  return days < 30 ? `${days} d ago` : date(value)
}

export const humanize = (s) => (s ? String(s).replaceAll('_', ' ') : '—')

export function apiError(err, fallback = 'Something went wrong. Please try again.') {
  const d = err?.response?.data?.detail
  if (Array.isArray(d)) return d.map((x) => `${(x.loc || []).slice(-1)[0]}: ${x.msg}`).join('; ')
  if (typeof d === 'string') return d
  if (err?.response?.status >= 500) return 'The server ran into a problem. Please try again in a moment.'
  if (!err?.response && err?.message) return 'Cannot reach the MarineSure server. Check that the backend is running.'
  return fallback
}

// One tone per status, used by every badge in the app.
const TONES = {
  success: ['active', 'approved', 'paid', 'settled', 'completed', 'resolved', 'matched', 'delivered', 'verified', 'success', 'issued', 'converted', 'accepted', 'arrived'],
  info: ['submitted', 'in_transit', 'scheduled', 'surveyor_assigned', 'open', 'dispatched', 'registered', 'documents_submitted', 'inspection_completed', 'accrued', 'created', 'ready_for_dispatch', 'transshipment', 'customs_clearance', 'out_for_delivery'],
  warning: ['pending', 'under_review', 'in_progress', 'documents_required', 'under_investigation', 'claim_filed', 'payout_failed', 'reported', 'moderate', 'medium', 'high'],
  danger: ['rejected', 'failed', 'mismatched', 'cancelled_by_insurer', 'suspended', 'severe', 'urgent', 'anomaly'],
  critical: ['critical', 'total_loss'],
  neutral: ['inactive', 'closed', 'cancelled', 'expired', 'withdrawn', 'archived', 'low', 'minor', 'renewed'],
}
export function toneFor(status) {
  const s = String(status || '').toLowerCase()
  return Object.keys(TONES).find((tone) => TONES[tone].includes(s)) || 'neutral'
}
