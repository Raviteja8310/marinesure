import {
  BanknotesIcon, BellIcon, BuildingLibraryIcon, CalendarDaysIcon, ChartBarSquareIcon,
  ClipboardDocumentCheckIcon, ClipboardDocumentListIcon, CubeIcon, DocumentCheckIcon, DocumentTextIcon,
  ExclamationTriangleIcon, IdentificationIcon, KeyIcon, MapIcon, MegaphoneIcon, PlusCircleIcon, ReceiptPercentIcon,
  ScaleIcon, ShieldCheckIcon, SparklesIcon, Squares2X2Icon, UserCircleIcon, UserGroupIcon, WalletIcon,
  ClipboardDocumentIcon, DocumentMagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

export const ROLE_LABEL = {
  customer: 'Customer',
  shipping_company: 'Shipping company',
  surveyor: 'Marine surveyor',
  agent: 'Insurance agent',
  insurance_officer: 'Insurance officer',
  senior_officer: 'Senior insurance officer',
  admin: 'Administrator',
}

export function primaryRole(roles = []) {
  return ['admin', 'senior_officer', 'insurance_officer', 'surveyor', 'shipping_company', 'agent', 'customer'].find((r) => roles.includes(r)) || 'customer'
}

const officer = [
  { group: 'Overview', items: [{ name: 'Dashboard', path: '/officer', icon: Squares2X2Icon }] },
  { group: 'Underwriting', items: [
    { name: 'Applications', path: '/officer/applications', icon: ClipboardDocumentListIcon },
    { name: 'Underwriting desk', path: '/officer/underwriting', icon: DocumentMagnifyingGlassIcon },
  ] },
  { group: 'Claims', items: [
    { name: 'Claims', path: '/officer/claims', icon: ScaleIcon },
    { name: 'Inspections', path: '/officer/inspections', icon: CalendarDaysIcon },
    { name: 'Surveyors', path: '/officer/surveyors', icon: IdentificationIcon },
    { name: 'Settlements', path: '/officer/settlements', icon: BanknotesIcon },
  ] },
  { group: 'Service', items: [{ name: 'Grievances', path: '/officer/grievances', icon: MegaphoneIcon }] },
  { group: 'Account', items: [{ name: 'Profile', path: '/profile', icon: UserCircleIcon }] },
]

/** Sidebar navigation per role, grouped. Paths match routes in App.jsx. */
export const NAVIGATION = {
  customer: [
    { group: 'Overview', items: [{ name: 'Dashboard', path: '/customer', icon: Squares2X2Icon }] },
    { group: 'Shipments', items: [
      { name: 'My shipments', path: '/customer/shipments', icon: CubeIcon },
      { name: 'Register shipment', path: '/customer/shipments/new', icon: PlusCircleIcon },
    ] },
    { group: 'Insurance', items: [
      { name: 'Products', path: '/customer/products', icon: ShieldCheckIcon },
      { name: 'Applications', path: '/customer/applications', icon: ClipboardDocumentListIcon },
      { name: 'Policies', path: '/customer/policies', icon: DocumentCheckIcon },
      { name: 'Payments', path: '/customer/payments', icon: WalletIcon },
    ] },
    { group: 'Claims', items: [
      { name: 'Claims', path: '/customer/claims', icon: ScaleIcon },
      { name: 'Settlements', path: '/customer/settlements', icon: BanknotesIcon },
    ] },
    { group: 'Support', items: [
      { name: 'Grievances', path: '/customer/grievances', icon: MegaphoneIcon },
      { name: 'Assistant', path: '/customer/ai', icon: SparklesIcon },
      { name: 'Notifications', path: '/customer/notifications', icon: BellIcon },
      { name: 'Profile', path: '/customer/profile', icon: UserCircleIcon },
    ] },
  ],
  shipping_company: [
    { group: 'Overview', items: [{ name: 'Dashboard', path: '/shipping', icon: Squares2X2Icon }] },
    { group: 'Operations', items: [
      { name: 'Shipments', path: '/shipping/shipments', icon: CubeIcon },
      { name: 'Tracking', path: '/shipping/tracking', icon: MapIcon },
      { name: 'Incidents', path: '/shipping/incidents', icon: ExclamationTriangleIcon },
    ] },
    { group: 'Account', items: [{ name: 'Profile', path: '/shipping/profile', icon: UserCircleIcon }] },
  ],
  surveyor: [
    { group: 'Overview', items: [{ name: 'Dashboard', path: '/surveyor', icon: Squares2X2Icon }] },
    { group: 'Inspections', items: [
      { name: 'Assigned claims', path: '/surveyor/claims', icon: ClipboardDocumentCheckIcon },
      { name: 'Schedule', path: '/surveyor/schedule', icon: CalendarDaysIcon },
      { name: 'Survey reports', path: '/surveyor/reports', icon: DocumentTextIcon },
    ] },
    { group: 'Account', items: [{ name: 'Profile', path: '/profile', icon: UserCircleIcon }] },
  ],
  agent: [
    { group: 'Overview', items: [{ name: 'Dashboard', path: '/agent', icon: Squares2X2Icon }] },
    { group: 'Sales', items: [
      { name: 'Commissions', path: '/agent/commissions', icon: ReceiptPercentIcon },
      { name: 'Products', path: '/agent/products', icon: ShieldCheckIcon },
    ] },
    { group: 'Account', items: [{ name: 'Profile', path: '/profile', icon: UserCircleIcon }] },
  ],
  insurance_officer: officer,
  senior_officer: officer,
  admin: [
    { group: 'Overview', items: [{ name: 'Command centre', path: '/admin', icon: ChartBarSquareIcon }] },
    { group: 'Access', items: [
      { name: 'Users', path: '/admin/users', icon: UserGroupIcon },
      { name: 'Roles & permissions', path: '/admin/roles', icon: KeyIcon },
    ] },
    { group: 'Business', items: [
      { name: 'Products', path: '/admin/products', icon: ShieldCheckIcon },
      { name: 'Finance', path: '/admin/finance', icon: BuildingLibraryIcon },
    ] },
    { group: 'Compliance', items: [{ name: 'Audit logs', path: '/admin/audit', icon: ClipboardDocumentIcon }] },
    { group: 'Account', items: [{ name: 'Profile', path: '/profile', icon: UserCircleIcon }] },
  ],
}

export const HOME = { customer: '/customer', shipping_company: '/shipping', surveyor: '/surveyor', agent: '/agent', insurance_officer: '/officer', senior_officer: '/officer', admin: '/admin' }

// Customers and shipping companies keep their existing URLs; every other role uses /profile.
export const PROFILE_PATH = { customer: '/customer/profile', shipping_company: '/shipping/profile', surveyor: '/profile', agent: '/profile', insurance_officer: '/profile', senior_officer: '/profile', admin: '/profile' }
