import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLongRightIcon } from '@heroicons/react/24/outline'
import { cx } from './ui'
import { date, humanize } from '../lib/format'
import api from '../services/api'

/** Photographic banner used once at the top of a dashboard. */
export function HeroBanner({ image, imageAlt = '', credit, title, children, actions, className }) {
  return <section className={cx('relative isolate mb-6 overflow-hidden rounded-3xl border border-white/10', className)}>
    <img src={`/images/${image}-sm.jpg`} srcSet={`/images/${image}-sm.jpg 1100w, /images/${image}.jpg 2200w`} sizes="(min-width: 1024px) 70vw, 100vw"
      alt={imageAlt} className="absolute inset-0 -z-20 h-full w-full object-cover" />
    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy-950/30" aria-hidden />
    <div className="ms-contours absolute inset-0 -z-10 opacity-60" aria-hidden />
    <div className="flex flex-wrap items-end justify-between gap-6 px-6 py-8 sm:px-8 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl">{title}</h1>
        {children && <div className="mt-2 text-sm leading-relaxed text-navy-200 sm:text-base">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
    {credit && <p className="absolute bottom-2 right-3 text-[10px] text-white/45">{credit}</p>}
  </section>
}

/**
 * Honest route view: origin → destination with recorded milestones. MarineSure
 * stores place names, not coordinates, so no map or live position is drawn.
 */
export function RouteSummary({ shipment }) {
  if (!shipment) return null
  const milestones = [...(shipment.milestones || [])].sort((a, b) => new Date(a.event_time || 0) - new Date(b.event_time || 0))
  return <div>
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-navy-400">Origin</p>
        <p className="truncate text-base font-semibold text-white">{shipment.origin_location}</p>
        <p className="text-xs text-navy-400">{shipment.origin_country}</p>
      </div>
      <div className="relative flex flex-[1.2] items-center" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-teal-400" />
        <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,#54d8d0_0_6px,transparent_6px_12px)] opacity-70" />
        <ArrowLongRightIcon className="-ml-1 h-5 w-5 text-teal-300" />
      </div>
      <div className="min-w-0 flex-1 text-right">
        <p className="text-xs text-navy-400">Destination</p>
        <p className="truncate text-base font-semibold text-white">{shipment.destination_location}</p>
        <p className="text-xs text-navy-400">{shipment.destination_country}</p>
      </div>
    </div>
    <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-navy-950/50 p-3 text-xs">
      <div><dt className="text-navy-400">Mode</dt><dd className="mt-0.5 font-semibold capitalize text-white">{shipment.transport_mode}</dd></div>
      <div><dt className="text-navy-400">Departure</dt><dd className="mt-0.5 font-semibold text-white">{date(shipment.departure_date)}</dd></div>
      <div><dt className="text-navy-400">Expected arrival</dt><dd className="mt-0.5 font-semibold text-white">{date(shipment.expected_arrival_date)}</dd></div>
    </dl>
    {milestones.length > 0 && <ol className="mt-4 space-y-2.5">
      {milestones.slice(-4).map((m, i) => <li key={m.id || i} className="flex items-start gap-3 text-sm">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-400" aria-hidden />
        <span className="min-w-0 flex-1"><span className="font-medium capitalize text-white">{humanize(m.status)}</span>{m.location && <span className="text-navy-400"> · {m.location}</span>}</span>
        <span className="shrink-0 text-xs text-navy-400">{date(m.event_time)}</span>
      </li>)}
    </ol>}
    <p className="mt-3 text-[11px] text-navy-500">Milestones are recorded by the shipping company. MarineSure does not show live vessel positions.</p>
  </div>
}

/** Fetch several endpoints in parallel; failures are reported per key, never faked. */
export function useDashboardData(endpoints) {
  const [state, setState] = useState({ loading: true, data: {}, errors: {} })
  const key = JSON.stringify(endpoints)
  useEffect(() => {
    let alive = true
    const entries = Object.entries(endpoints)
    Promise.allSettled(entries.map(([, url]) => api.get(url))).then((results) => {
      if (!alive) return
      const data = {}; const errors = {}
      results.forEach((r, i) => {
        const name = entries[i][0]
        if (r.status === 'fulfilled') data[name] = r.value.data
        else errors[name] = r.reason?.response?.status === 403 ? 'forbidden' : 'failed'
      })
      setState({ loading: false, data, errors })
    })
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return state
}

export function QuickAction({ to, icon: Icon, label, description }) {
  return <Link to={to}
    className="group flex items-center gap-3 rounded-xl border border-navy-800 bg-navy-950/40 p-3.5 transition hover:border-teal-500/50 hover:bg-navy-800/40">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-400/10 text-teal-300 transition group-hover:bg-teal-400/20"><Icon className="h-5 w-5" aria-hidden /></span>
    <span className="min-w-0"><span className="block text-sm font-semibold text-white">{label}</span>{description && <span className="block truncate text-xs text-navy-400">{description}</span>}</span>
  </Link>
}
