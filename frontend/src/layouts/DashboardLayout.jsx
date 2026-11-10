import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRightOnRectangleIcon, Bars3Icon, BellIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, ChevronRightIcon,
  UserCircleIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import { BrandLockup } from '../components/Brand'
import { cx } from '../components/ui'
import { HOME, NAVIGATION, PROFILE_PATH, ROLE_LABEL, primaryRole } from '../config/navigation'
import { relative } from '../lib/format'
import api from '../services/api'

const COLLAPSE_KEY = 'ms.sidebar.collapsed'
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false } }

function findCurrent(groups, pathname) {
  let best = null
  groups.forEach((g) => g.items.forEach((it) => {
    if (pathname === it.path || pathname.startsWith(`${it.path}/`)) {
      if (!best || it.path.length > best.item.path.length) best = { group: g.group, item: it }
    }
  }))
  return best
}

function Sidebar({ role, groups, collapsed, onNavigate, user, onLogout }) {
  return <div className="flex h-full flex-col">
    <div className={cx('flex h-16 shrink-0 items-center border-b border-white/5', collapsed ? 'justify-center px-2' : 'px-5')}>
      <BrandLockup to={HOME[role]} collapsed={collapsed} subtitle={ROLE_LABEL[role]} />
    </div>
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Main">
      {groups.map((g) => <div key={g.group}>
        {!collapsed && <p className="mb-1.5 px-3 text-[11px] font-semibold text-navy-400">{g.group}</p>}
        <ul className="space-y-0.5">
          {g.items.map((it) => <li key={it.path}>
            <NavLink to={it.path} end onClick={onNavigate} title={collapsed ? it.name : undefined}
              className={({ isActive }) => cx(
                'group relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors',
                collapsed ? 'justify-center px-2' : 'px-3',
                isActive ? 'bg-teal-400/10 text-white' : 'text-navy-300 hover:bg-white/[0.04] hover:text-white',
              )}>
              {({ isActive }) => <>
                {isActive && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-teal-400" aria-hidden />}
                <it.icon className={cx('h-5 w-5 shrink-0', isActive ? 'text-teal-300' : 'text-navy-400 group-hover:text-navy-200')} aria-hidden />
                {!collapsed && <span className="truncate">{it.name}</span>}
              </>}
            </NavLink>
          </li>)}
        </ul>
      </div>)}
    </nav>
    <div className={cx('border-t border-white/5 p-3', collapsed && 'flex flex-col items-center')}>
      <Link to={PROFILE_PATH[role] || '/profile'} onClick={onNavigate} title="Open profile"
        className={cx('flex items-center gap-3 rounded-lg p-2 transition hover:bg-white/[0.05]', collapsed && 'justify-center')}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-sm font-bold text-navy-950" aria-hidden>
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </span>
        {!collapsed && <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
          <p className="truncate text-xs text-navy-400">{user?.email}</p>
        </div>}
      </Link>
      <button type="button" onClick={onLogout} title="Sign out"
        className={cx('mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-navy-300 transition hover:bg-rose-500/10 hover:text-rose-200', collapsed && 'justify-center px-2')}>
        <ArrowRightOnRectangleIcon className="h-5 w-5" aria-hidden />{!collapsed && 'Sign out'}
      </button>
    </div>
  </div>
}

function NotificationsMenu({ role }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const ref = useRef(null)
  const navigate = useNavigate()
  const load = useCallback(() => {
    api.get('/notifications').then(({ data }) => { setItems(Array.isArray(data) ? data : []); setError('') })
      .catch(() => setError('Notifications are unavailable right now.'))
  }, [])
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [load])
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  const unread = items.filter((n) => !n.is_read).length
  const openItem = async (n) => {
    if (!n.is_read) { try { await api.post(`/notifications/${n.id}/read`) } catch { /* shown on next load */ } }
    setOpen(false); load()
    if (n.link) navigate(n.link)
  }
  const markAll = async () => { try { await api.post('/notifications/read-all'); load() } catch { setError('Could not mark notifications as read.') } }
  return <div className="relative" ref={ref}>
    <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true"
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      className="relative grid h-10 w-10 place-items-center rounded-lg text-navy-300 transition hover:bg-white/5 hover:text-white">
      <BellIcon className="h-5 w-5" aria-hidden />
      {unread > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-[18px] place-items-center rounded-full bg-teal-400 px-1 text-[10px] font-bold leading-[18px] text-navy-950">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-navy-700 bg-navy-900 shadow-lift animate-fade-up">
      <div className="flex items-center justify-between border-b border-navy-800 px-4 py-3">
        <p className="text-sm font-semibold text-white">Notifications</p>
        {unread > 0 && <button type="button" onClick={markAll} className="text-xs font-semibold text-teal-300 hover:text-teal-200">Mark all read</button>}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {error && <p className="px-4 py-6 text-sm text-rose-300">{error}</p>}
        {!error && !items.length && <p className="px-4 py-8 text-center text-sm text-navy-400">You're all caught up.</p>}
        {items.slice(0, 8).map((n) => <button type="button" key={n.id} onClick={() => openItem(n)}
          className="flex w-full gap-3 border-b border-navy-800/60 px-4 py-3 text-left transition hover:bg-white/[0.03]">
          <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.is_read ? 'bg-transparent' : 'bg-teal-400')} aria-hidden />
          <span className="min-w-0">
            <span className={cx('block truncate text-sm', n.is_read ? 'text-navy-300' : 'font-semibold text-white')}>{n.title}</span>
            <span className="mt-0.5 line-clamp-2 block text-xs text-navy-400">{n.message}</span>
            <span className="mt-1 block text-[11px] text-navy-500">{relative(n.created_at)}</span>
          </span>
        </button>)}
      </div>
      {role === 'customer' && <Link to="/customer/notifications" onClick={() => setOpen(false)} className="block border-t border-navy-800 px-4 py-2.5 text-center text-xs font-semibold text-teal-300 hover:bg-white/[0.03]">View all notifications</Link>}
    </div>}
  </div>
}

function UserMenu({ user, role, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  return <div className="relative" ref={ref}>
    <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true" aria-label={`Account menu for ${user?.name || 'user'}`}
      className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 transition hover:bg-white/5">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-xs font-bold text-navy-950" aria-hidden>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
      <span className="hidden text-left leading-tight md:block">
        <span className="block max-w-[160px] truncate text-sm font-semibold text-white">{user?.name}</span>
        <span className="block text-[11px] text-navy-400">{ROLE_LABEL[role]}</span>
      </span>
    </button>
    {open && <div className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-xl border border-navy-700 bg-navy-900 py-1 shadow-lift animate-fade-up" role="menu">
      <div className="border-b border-navy-800 px-4 py-3">
        <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
        <p className="truncate text-xs text-navy-400">{user?.email}</p>
      </div>
      {<Link role="menuitem" to={PROFILE_PATH[role] || '/profile'} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-navy-200 hover:bg-white/[0.04] hover:text-white">
        <UserCircleIcon className="h-4 w-4" aria-hidden />My profile
      </Link>}
      <button role="menuitem" type="button" onClick={onLogout} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-rose-200 hover:bg-rose-500/10">
        <ArrowRightOnRectangleIcon className="h-4 w-4" aria-hidden />Sign out
      </button>
    </div>}
  </div>
}

/**
 * App shell for every signed-in page. Navigation is derived from the user's
 * role so all pages share one sidebar; `navigation`/`roleLabel` props from
 * older pages are accepted but ignored.
 */
export default function DashboardLayout({ title, children, actions }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const role = primaryRole(user?.roles || [])
  const groups = NAVIGATION[role] || NAVIGATION.customer
  const current = findCurrent(groups, location.pathname)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawer, setDrawer] = useState(false)

  useEffect(() => { try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0') } catch { /* ignore */ } }, [collapsed])
  useEffect(() => { setDrawer(false) }, [location.pathname])
  useEffect(() => {
    if (!drawer) return
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawer])
  useEffect(() => { document.title = title ? `${title} · MarineSure` : 'MarineSure' }, [title])

  return <div className="min-h-screen bg-navy-950 text-navy-100">
    <a href="#main" className="sr-only z-[90] rounded bg-teal-400 px-3 py-2 text-navy-950 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>

    {/* Desktop sidebar */}
    <aside className={cx('fixed inset-y-0 left-0 z-40 hidden border-r border-white/5 bg-ocean transition-[width] duration-300 ease-out lg:block', collapsed ? 'w-[76px]' : 'w-64')}>
      <Sidebar role={role} groups={groups} collapsed={collapsed} user={user} onLogout={logout} />
      <button type="button" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-20 grid h-6 w-6 place-items-center rounded-full border border-navy-700 bg-navy-900 text-navy-300 shadow-card transition hover:text-white">
        {collapsed ? <ChevronDoubleRightIcon className="h-3.5 w-3.5" /> : <ChevronDoubleLeftIcon className="h-3.5 w-3.5" />}
      </button>
    </aside>

    {/* Mobile drawer */}
    {drawer && <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm" onClick={() => setDrawer(false)} aria-hidden />
      <aside className="absolute inset-y-0 left-0 w-[min(84vw,300px)] border-r border-white/5 bg-ocean shadow-lift animate-fade-up">
        <button type="button" onClick={() => setDrawer(false)} className="absolute right-3 top-4 rounded-lg p-1.5 text-navy-300 hover:bg-white/5 hover:text-white" aria-label="Close navigation"><XMarkIcon className="h-5 w-5" /></button>
        <Sidebar role={role} groups={groups} collapsed={false} user={user} onLogout={logout} onNavigate={() => setDrawer(false)} />
      </aside>
    </div>}

    <div className={cx('flex min-h-screen min-w-0 flex-col transition-[padding] duration-300 ease-out', collapsed ? 'lg:pl-[76px]' : 'lg:pl-64')}>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/5 bg-navy-950/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
        <button type="button" onClick={() => setDrawer(true)} className="-ml-1 rounded-lg p-2 text-navy-300 hover:bg-white/5 hover:text-white lg:hidden" aria-label="Open navigation"><Bars3Icon className="h-6 w-6" /></button>
        <div className="min-w-0 flex-1">
          <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-xs text-navy-400 sm:flex">
            <Link to={HOME[role]} className="hover:text-white">{ROLE_LABEL[role]}</Link>
            {current?.group && current.group !== 'Overview' && <><ChevronRightIcon className="h-3 w-3" aria-hidden /><span>{current.group}</span></>}
            {current?.item && current.item.path !== HOME[role] && <><ChevronRightIcon className="h-3 w-3" aria-hidden /><span className="text-navy-200">{current.item.name}</span></>}
          </nav>
          <p className="truncate text-[15px] font-semibold text-white sm:text-base">{title}</p>
        </div>
        {actions && <div className="hidden items-center gap-2 md:flex">{actions}</div>}
        <NotificationsMenu role={role} />
        <UserMenu user={user} role={role} onLogout={logout} />
      </header>
      <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div key={location.pathname} className="animate-fade-up">{children}</div>
      </main>
    </div>
  </div>
}
