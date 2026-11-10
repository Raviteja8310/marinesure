import React, { useMemo } from 'react'
import { CheckBadgeIcon, ClockIcon, CubeIcon, ExclamationTriangleIcon, MapIcon, TruckIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '../../layouts/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { Alert, Button, Card, DataTable, EmptyState, StatCard, StatusBadge, Timeline } from '../../components/ui'
import { HeroBanner, RouteSummary, useDashboardData } from '../../components/dashboard'
import { date, dateTime, humanize, relative } from '../../lib/format'

const TRANSIT = ['dispatched', 'in_transit', 'transshipment', 'arrived', 'customs_clearance', 'out_for_delivery']
const DONE = ['delivered', 'archived']
const NEEDS_UPDATE = ['registered', 'documents_submitted', 'ready_for_dispatch']

export default function ShippingDashboard() {
  const { user } = useAuth()
  const { loading, data, errors } = useDashboardData({ shipments: '/shipments', incidents: '/incidents' })
  const shipments = data.shipments || []
  const incidents = data.incidents || []

  const stats = useMemo(() => ({
    assigned: shipments.length,
    transit: shipments.filter((s) => TRANSIT.includes(s.status)).length,
    delivered: shipments.filter((s) => DONE.includes(s.status)).length,
    pending: shipments.filter((s) => NEEDS_UPDATE.includes(s.status)).length,
    incidents: incidents.filter((i) => !['closed', 'resolved'].includes(i.status)).length,
  }), [shipments, incidents])

  const activity = useMemo(() => shipments
    .flatMap((s) => (s.milestones || []).map((m) => ({ ...m, shipment_number: s.shipment_number })))
    .sort((a, b) => new Date(b.event_time) - new Date(a.event_time))
    .slice(0, 6), [shipments])

  const focus = shipments.find((s) => TRANSIT.includes(s.status)) || shipments[0]

  return <DashboardLayout title="Operations">
    <HeroBanner image="terminal-night" credit="Photo: Container Terminal Burchardkai · mybroetchen, CC BY 2.0"
      title={`Operations desk${user?.name ? ` · ${user.name}` : ''}`}
      actions={<><Button to="/shipping/tracking" icon={MapIcon}>Update milestones</Button><Button to="/shipping/incidents" variant="secondary" className="border-white/15 bg-white/5">Incidents</Button></>}>
      Shipments assigned to your company, the milestones you've recorded and any incidents on the voyages you carry.
    </HeroBanner>
    {Object.keys(errors).length > 0 && <Alert tone="warning" className="mb-6">Some data couldn't be loaded. Refresh to try again.</Alert>}

    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard label="Assigned shipments" value={stats.assigned} icon={CubeIcon} to="/shipping/shipments" loading={loading} />
      <StatCard label="In transit" value={stats.transit} icon={TruckIcon} to="/shipping/tracking" loading={loading} />
      <StatCard label="Delivered" value={stats.delivered} icon={CheckBadgeIcon} tone="emerald" loading={loading} />
      <StatCard label="Awaiting first update" value={stats.pending} icon={ClockIcon} tone="amber" hint="Not yet dispatched" loading={loading} />
      <div className="col-span-2 lg:col-span-1"><StatCard label="Open incidents" value={stats.incidents} icon={ExclamationTriangleIcon} tone="rose" to="/shipping/incidents" loading={loading} /></div>
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card title="Assigned shipments" description="Only shipments assigned to your company are visible.">
        <DataTable loading={loading} rows={shipments} pageSize={8} searchPlaceholder="Search shipment, port, cargo…"
          empty={<EmptyState icon={CubeIcon} title="No shipments assigned" description="When a customer assigns your company to a shipment, it appears here." />}
          columns={[
            { key: 'shipment_number', header: 'Shipment', render: (s) => <span className="whitespace-nowrap font-semibold text-white">{s.shipment_number}</span> },
            { key: 'origin_location', header: 'Origin', render: (s) => <span className="whitespace-nowrap">{s.origin_location}</span> },
            { key: 'destination_location', header: 'Destination', render: (s) => <span className="whitespace-nowrap">{s.destination_location}</span> },
            { key: 'cargo', header: 'Cargo', sortable: false, render: (s) => s.cargo_items?.map((c) => c.cargo_name).join(', ') || '—' },
            { key: 'containers', header: 'Containers', sortValue: (s) => s.containers?.length || 0, render: (s) => s.containers?.length || 0 },
            { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
            { key: 'updated', header: 'Last update', sortValue: (s) => s.milestones?.at(-1)?.event_time || s.created_at, render: (s) => relative(s.milestones?.at(-1)?.event_time || s.created_at) },
            { key: 'actions', header: '', sortable: false, render: () => <Button to="/shipping/tracking" size="sm" variant="secondary">Update</Button> },
          ]} />
      </Card>
      <div className="space-y-6">
        <Card title="Voyage in focus" description={focus?.shipment_number}>
          {loading ? <div className="ms-skeleton h-40" /> : focus ? <RouteSummary shipment={focus} /> : <EmptyState icon={MapIcon} title="Nothing in transit" />}
        </Card>
        <Card title="Recent milestones">
          {loading ? <div className="ms-skeleton h-32" /> : activity.length
            ? <Timeline items={activity.map((m) => ({ title: `${m.shipment_number} · ${humanize(m.status)}`, time: dateTime(m.event_time), description: [m.location, m.remarks].filter(Boolean).join(' · ') }))} />
            : <p className="text-sm text-navy-400">No milestones recorded yet.</p>}
        </Card>
      </div>
    </div>

    {incidents.length > 0 && <Card title="Incidents on your shipments" className="mt-6" actions={<Button to="/shipping/incidents" variant="ghost" size="sm">All incidents</Button>}>
      <DataTable rows={incidents} searchable={false} pageSize={5} columns={[
        { key: 'incident_number', header: 'Incident', render: (i) => <span className="font-semibold text-white">{i.incident_number}</span> },
        { key: 'incident_type', header: 'Type', render: (i) => <span className="capitalize">{humanize(i.incident_type)}</span> },
        { key: 'severity', header: 'Severity', render: (i) => <StatusBadge status={i.severity} /> },
        { key: 'location_name', header: 'Location' },
        { key: 'incident_date', header: 'Date', render: (i) => date(i.incident_date) },
        { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
      ]} />
    </Card>}
  </DashboardLayout>
}
