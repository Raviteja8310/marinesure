import React from 'react'
import { Link } from 'react-router-dom'

/** MarineSure mark: a hull riding a swell inside a shield — protection at sea. */
export function BrandMark({ className = 'h-9 w-9' }) {
  return <svg viewBox="0 0 40 40" className={className} role="img" aria-label="MarineSure">
    <defs>
      <linearGradient id="ms-mark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#54D8D0" />
        <stop offset="1" stopColor="#10B9AE" />
      </linearGradient>
    </defs>
    <path d="M20 2.5 34.5 8v11.2c0 9.3-6.1 15.9-14.5 18.3C11.6 35.1 5.5 28.5 5.5 19.2V8L20 2.5Z" fill="#082B40" stroke="url(#ms-mark)" strokeWidth="1.6" />
    <path d="M11 19.5h18l-2.6 5.2H13.6L11 19.5Z" fill="url(#ms-mark)" />
    <path d="M15 19.5v-3.3h3.6v3.3M19.6 19.5v-5h3.6v5M24.2 19.5v-2.6h2.4v2.6" stroke="#D5B477" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
    <path d="M9.5 28c2.1 0 2.1-1.4 4.2-1.4s2.1 1.4 4.2 1.4 2.1-1.4 4.2-1.4 2.1 1.4 4.2 1.4 2.1-1.4 4.2-1.4" stroke="#54D8D0" strokeWidth="1.4" fill="none" strokeLinecap="round" />
  </svg>
}

export function BrandLockup({ to = '/', collapsed = false, subtitle, className = '' }) {
  return <Link to={to} className={`flex items-center gap-3 ${className}`} aria-label="MarineSure home">
    <BrandMark className="h-9 w-9 shrink-0" />
    {!collapsed && <span className="min-w-0 leading-tight">
      <span className="block text-[17px] font-bold tracking-tight text-white">MarineSure</span>
      {subtitle && <span className="block truncate text-[11px] font-medium text-teal-300/90">{subtitle}</span>}
    </span>}
  </Link>
}
