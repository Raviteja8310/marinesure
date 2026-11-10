import React from 'react'
import { Link } from 'react-router-dom'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { BrandLockup, BrandMark } from '../../components/Brand'

/**
 * Split auth layout: the Kochi terminal photograph fills the left half on
 * desktop and sits behind a darkened panel on smaller screens.
 */
export default function AuthShell({ title, subtitle, children, wide = false }) {
  return <div className="relative isolate min-h-screen bg-navy-950 lg:grid lg:grid-cols-[1.05fr_1fr]">
    <div className="absolute inset-0 -z-10 lg:relative lg:z-auto">
      <picture>
        <source media="(max-width: 1023px)" srcSet="/images/auth-kochi-night-sm.jpg" />
        <img src="/images/auth-kochi-night.jpg" alt="Container cranes at Vallarpadam terminal, Kochi, lit at night over the water" className="h-full w-full object-cover object-[60%_center]" />
      </picture>
      <div className="absolute inset-0 bg-navy-950/80 lg:bg-gradient-to-b lg:from-navy-950/85 lg:via-navy-950/5 lg:to-navy-950/90" aria-hidden />
      <div className="absolute inset-x-0 top-0 hidden p-12 lg:block">
        <Link to="/" className="inline-flex items-center gap-4" aria-label="MarineSure home">
          <BrandMark className="h-14 w-14" />
          <span className="text-3xl font-bold tracking-tight text-white">MarineSure</span>
        </Link>
        <p className="mt-5 max-w-md text-base leading-relaxed text-navy-100">
          Marine cargo insurance, shipment protection and claims management for India's exporters and importers. Register a shipment, get it insured, follow the voyage and settle claims, all in one place.
        </p>
        <ul className="mt-5 space-y-2 text-sm text-navy-200">
          {['Quotations priced for your exact shipment', 'Policies issued only after verified payment', 'Claims tracked from survey to settlement'].map((t) =>
            <li key={t} className="flex items-center gap-2.5"><CheckCircleIcon className="h-5 w-5 shrink-0 text-teal-300" aria-hidden />{t}</li>)}
        </ul>
      </div>
      <div className="absolute inset-x-0 bottom-0 hidden p-12 lg:block">
        <p className="max-w-md text-3xl font-bold leading-tight text-white">Protecting every journey. Securing every shipment.</p>
        <p className="mt-3 max-w-md text-base leading-relaxed text-navy-200">Intelligent marine insurance and shipment protection, from departure to delivery.</p>
        <p className="mt-10 text-[10px] text-white/50">Photo: Vallarpadam container terminal, Kochi · Ranjithsiji, CC BY-SA 4.0</p>
      </div>
    </div>
    <div className="flex min-h-screen flex-col px-4 py-6 sm:px-8 lg:bg-navy-950 lg:px-14">
      <BrandLockup to="/" className="lg:hidden" />
      <div className="flex flex-1 items-center justify-center py-10">
        <div className={`w-full ${wide ? 'max-w-xl' : 'max-w-md'} animate-fade-up rounded-2xl border border-white/10 bg-navy-900/70 p-6 shadow-lift backdrop-blur-xl sm:p-8 lg:border-navy-800 lg:bg-navy-900/60 lg:backdrop-blur-none`}>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-navy-300">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  </div>
}
