import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowPathIcon, CheckCircleIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon, ExclamationTriangleIcon,
  InformationCircleIcon, MagnifyingGlassIcon, XCircleIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import { humanize, toneFor } from '../lib/format'

export const cx = (...c) => c.filter(Boolean).join(' ')

// ── Buttons ──────────────────────────────────────────────────────

const BTN = {
  primary: 'bg-teal-500 text-navy-950 hover:bg-teal-400 active:bg-teal-600 shadow-glow',
  secondary: 'border border-navy-700 bg-navy-900/60 text-navy-100 hover:border-navy-600 hover:bg-navy-800',
  ghost: 'text-navy-200 hover:bg-navy-800/70 hover:text-white',
  danger: 'border border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20',
  gold: 'bg-gold-400 text-navy-950 hover:bg-gold-300',
}
const SIZE = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2.5' }

export const Button = React.forwardRef(function Button(
  { variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, loading = false, to, href, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const classes = cx(
    'inline-flex shrink-0 items-center justify-center rounded-lg font-semibold transition duration-150 ease-out',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
    BTN[variant], SIZE[size], className,
  )
  const content = <>
    {loading ? <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden /> : Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />}
    {children}
    {IconRight && <IconRight className="h-4 w-4" aria-hidden />}
  </>
  if (to) return <Link ref={ref} to={to} className={classes} {...rest}>{content}</Link>
  if (href) return <a ref={ref} href={href} className={classes} {...rest}>{content}</a>
  return <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>{content}</button>
})

// ── Surfaces ─────────────────────────────────────────────────────

export function Card({ title, description, actions, children, className, bodyClassName, as: As = 'section' }) {
  return <As className={cx('min-w-0 rounded-2xl border border-navy-800 bg-navy-900/80 shadow-card', className)}>
    {(title || actions) && <header className="flex flex-wrap items-start justify-between gap-3 border-b border-navy-800/80 px-5 py-4">
      <div className="min-w-0">
        {title && <h2 className="text-[15px] font-semibold text-white">{title}</h2>}
        {description && <p className="mt-0.5 text-sm text-navy-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>}
    <div className={cx('p-5', bodyClassName)}>{children}</div>
  </As>
}

export function PageHeader({ title, description, actions, children }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0 max-w-3xl">
      {title && <h1 className="text-2xl font-bold text-white sm:text-[28px]">{title}</h1>}
      {description && <p className="mt-1.5 text-sm leading-relaxed text-navy-300">{description}</p>}
      {children}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
}

// ── Status ───────────────────────────────────────────────────────

const TONE_CLASS = {
  success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  info: 'border-teal-400/30 bg-teal-400/10 text-teal-200',
  warning: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  danger: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  critical: 'border-red-500/50 bg-red-600/20 text-red-100',
  neutral: 'border-navy-600 bg-navy-800/60 text-navy-200',
  gold: 'border-gold-400/40 bg-gold-400/10 text-gold-200',
}
const DOT = { success: 'bg-emerald-400', info: 'bg-teal-400', warning: 'bg-amber-400', danger: 'bg-rose-400', critical: 'bg-red-500', neutral: 'bg-navy-400', gold: 'bg-gold-400' }

export function StatusBadge({ status, tone, children, className }) {
  const t = tone || toneFor(status)
  return <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize', TONE_CLASS[t], className)}>
    <span className={cx('h-1.5 w-1.5 rounded-full', DOT[t])} aria-hidden />
    {children ?? humanize(status)}
  </span>
}

export function Alert({ tone = 'info', title, children, className, action }) {
  const Icon = { success: CheckCircleIcon, danger: XCircleIcon, warning: ExclamationTriangleIcon, info: InformationCircleIcon }[tone] || InformationCircleIcon
  if (!title && !children) return null
  return <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', TONE_CLASS[tone], className)}>
    <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
    <div className="min-w-0 flex-1">
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cx(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
    </div>
    {action}
  </div>
}

// ── Metrics ──────────────────────────────────────────────────────

function useCountUp(target, enabled) {
  const [v, setV] = useState(enabled ? 0 : target)
  useEffect(() => {
    if (!enabled || typeof target !== 'number' || !Number.isFinite(target)) { setV(target); return }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(target); return }
    let raf; const start = performance.now(); const dur = 700
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur)
      setV(target * (1 - Math.pow(1 - p, 4)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, enabled])
  return v
}

/** A dashboard figure. `value` must come from the API; pass `format` for money. */
export function StatCard({ label, value, format, hint, icon: Icon, tone = 'teal', to, loading }) {
  const numeric = typeof value === 'number'
  const animated = useCountUp(numeric ? value : 0, numeric)
  const shown = loading ? null : numeric ? (format ? format(animated) : Math.round(animated).toLocaleString('en-IN')) : (value ?? '—')
  const toneCls = { teal: 'text-teal-300 bg-teal-400/10', gold: 'text-gold-300 bg-gold-400/10', rose: 'text-rose-300 bg-rose-400/10', amber: 'text-amber-300 bg-amber-400/10', emerald: 'text-emerald-300 bg-emerald-400/10' }[tone]
  const body = <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="text-xs font-medium text-navy-400">{label}</p>
      {loading ? <div className="ms-skeleton mt-2 h-7 w-24" /> : <p className="tabular mt-1.5 break-words text-xl font-bold leading-tight text-white sm:text-2xl">{shown}</p>}
      {hint && <p className="mt-1 text-xs text-navy-400">{hint}</p>}
    </div>
    {Icon && <span className={cx('hidden h-10 w-10 shrink-0 place-items-center rounded-xl sm:grid', toneCls)}><Icon className="h-5 w-5" aria-hidden /></span>}
  </div>
  const cls = 'block min-w-0 rounded-2xl border border-navy-800 bg-navy-900/80 p-4 shadow-card transition duration-200 sm:p-5'
  return to ? <Link to={to} className={cx(cls, 'hover:-translate-y-0.5 hover:border-navy-700 hover:shadow-lift')}>{body}</Link> : <div className={cls}>{body}</div>
}

// ── Empty, loading ───────────────────────────────────────────────

export function EmptyState({ icon: Icon, title, description, action, className, image }) {
  return <div className={cx('ms-contours relative overflow-hidden rounded-2xl border border-dashed border-navy-700 bg-navy-900/50 px-6 py-12 text-center', className)}>
    {image && <img src={image} alt="" loading="lazy" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.07]" />}
    <div className="relative mx-auto max-w-md">
      {Icon && <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-teal-400/10 text-teal-300"><Icon className="h-6 w-6" aria-hidden /></span>}
      <p className="text-base font-semibold text-white">{title}</p>
      {description && <p className="mt-1.5 text-sm leading-relaxed text-navy-300">{description}</p>}
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  </div>
}

export const Skeleton = ({ className }) => <div className={cx('ms-skeleton', className)} aria-hidden />

export function LoadingRows({ rows = 4 }) {
  return <div className="space-y-3" role="status" aria-label="Loading">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
}

// ── Data table ───────────────────────────────────────────────────

/**
 * columns: [{ key, header, render?(row), sortValue?(row), className?, align? }]
 * Search, sort and pagination are applied to the rows passed in.
 */
export function DataTable({ columns, rows, loading, empty, searchable = true, searchPlaceholder = 'Search…', pageSize = 10, toolbar, rowKey = (r, i) => r.id ?? i, onRowClick }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [page, setPage] = useState(1)
  const filtered = useMemo(() => {
    const list = rows || []
    if (!query.trim()) return list
    const q = query.toLowerCase()
    return list.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }, [rows, query])
  const sorted = useMemo(() => {
    if (!sort.key) return filtered
    const col = columns.find((c) => c.key === sort.key)
    const val = col?.sortValue || ((r) => r[sort.key])
    return [...filtered].sort((a, b) => {
      const x = val(a); const y = val(b)
      const nx = Number(x); const ny = Number(y)
      const cmp = !Number.isNaN(nx) && !Number.isNaN(ny) && x !== '' && y !== '' ? nx - ny : String(x ?? '').localeCompare(String(y ?? ''))
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sort, columns])
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  useEffect(() => { setPage(1) }, [query, rows])
  const current = sorted.slice((page - 1) * pageSize, page * pageSize)
  const toggle = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))

  return <div className="space-y-3">
    {(searchable || toolbar) && <div className="flex flex-wrap items-center justify-between gap-3">
      {searchable && <label className="relative w-full max-w-xs">
        <span className="sr-only">Search table</span>
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-500" aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} className="h-9 w-full rounded-lg border border-navy-700 bg-navy-950/60 pl-9 pr-3 text-sm text-white outline-none transition focus:border-teal-500" />
      </label>}
      {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
    </div>}
    {loading ? <LoadingRows /> : !sorted.length ? (empty || <EmptyState title={query ? 'No matching records' : 'No records yet'} description={query ? 'Try a different search term.' : undefined} />) : <>
      <div className="overflow-x-auto rounded-xl border border-navy-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-navy-900 text-xs text-navy-400">
            <tr>{columns.map((c) => <th key={c.key} scope="col" className={cx('whitespace-nowrap px-4 py-3 font-semibold', c.align === 'right' && 'text-right', c.className)}>
              {c.sortable === false ? c.header : <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 hover:text-white">
                {c.header}<ChevronUpDownIcon className={cx('h-3.5 w-3.5', sort.key === c.key ? 'text-teal-300' : 'opacity-50')} aria-hidden />
              </button>}
            </th>)}</tr>
          </thead>
          <tbody className="divide-y divide-navy-800/80 bg-navy-950/30">
            {current.map((row, i) => <tr key={rowKey(row, i)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cx('text-navy-100 transition-colors hover:bg-navy-800/40', onRowClick && 'cursor-pointer')}>
              {columns.map((c) => <td key={c.key} className={cx('px-4 py-3 align-top', c.align === 'right' && 'text-right', c.cellClassName)}>{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>)}
            </tr>)}
          </tbody>
        </table>
      </div>
      {pages > 1 && <div className="flex items-center justify-between text-xs text-navy-400">
        <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" icon={ChevronLeftIcon} disabled={page === 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page" />
          <span className="px-2 text-navy-300">Page {page} of {pages}</span>
          <Button variant="ghost" size="sm" icon={ChevronRightIcon} disabled={page === pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page" />
        </div>
      </div>}
    </>}
  </div>
}

// ── Form fields ──────────────────────────────────────────────────

const FIELD = 'w-full rounded-lg border border-navy-700 bg-navy-950/60 px-3 py-2.5 text-sm text-white outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60'

export function Field({ label, hint, error, children, className, required }) {
  const id = useId()
  const child = React.isValidElement(children) ? React.cloneElement(children, { id: children.props.id || id, 'aria-invalid': error ? true : undefined, 'aria-describedby': hint || error ? `${id}-d` : undefined }) : children
  return <div className={cx('grid gap-1.5', className)}>
    {label && <label htmlFor={children?.props?.id || id} className="text-sm font-medium text-navy-200">{label}{required && <span className="text-teal-300"> *</span>}</label>}
    {child}
    {(hint || error) && <p id={`${id}-d`} className={cx('text-xs', error ? 'text-rose-300' : 'text-navy-400')}>{error || hint}</p>}
  </div>
}
export const Input = React.forwardRef((p, ref) => <input ref={ref} {...p} className={cx(FIELD, p.className)} />)
export const TextArea = React.forwardRef((p, ref) => <textarea ref={ref} {...p} className={cx(FIELD, 'min-h-[88px]', p.className)} />)
export const Select = React.forwardRef(({ children, ...p }, ref) => <select ref={ref} {...p} className={cx(FIELD, 'pr-8', p.className)}>{children}</select>)

// ── Tabs, steps, timeline ────────────────────────────────────────

export function Tabs({ tabs, value, onChange, className }) {
  return <div role="tablist" className={cx('inline-flex flex-wrap gap-1 rounded-xl border border-navy-800 bg-navy-900/70 p-1', className)}>
    {tabs.map((t) => {
      const key = t.value ?? t; const label = t.label ?? t
      const active = key === value
      return <button key={key} role="tab" aria-selected={active} type="button" onClick={() => onChange(key)} className={cx('rounded-lg px-3.5 py-1.5 text-sm font-medium transition', active ? 'bg-teal-500 text-navy-950 shadow-glow' : 'text-navy-300 hover:bg-navy-800 hover:text-white')}>
        {label}{t.count !== undefined && <span className={cx('ml-1.5 rounded-full px-1.5 text-xs', active ? 'bg-navy-950/20' : 'bg-navy-800 text-navy-300')}>{t.count}</span>}
      </button>
    })}
  </div>
}

/** steps: [{ label, description? }], current: index of the active step (completed before it). */
export function Stepper({ steps, current, className }) {
  return <ol className={cx('flex flex-wrap items-center gap-x-2 gap-y-3', className)}>
    {steps.map((s, i) => {
      const state = i < current ? 'done' : i === current ? 'active' : 'todo'
      return <li key={s.label} className="flex items-center gap-2">
        <span className={cx('grid h-7 w-7 place-items-center rounded-full border text-xs font-bold',
          state === 'done' && 'border-teal-500 bg-teal-500 text-navy-950',
          state === 'active' && 'border-teal-400 bg-teal-400/10 text-teal-200',
          state === 'todo' && 'border-navy-700 text-navy-400')}>{state === 'done' ? <CheckIcon className="h-4 w-4" aria-hidden /> : i + 1}</span>
        <span className={cx('text-sm', state === 'todo' ? 'text-navy-400' : 'font-medium text-white')}>{s.label}</span>
        {i < steps.length - 1 && <span className={cx('mx-1 hidden h-px w-8 sm:block', i < current ? 'bg-teal-500' : 'bg-navy-700')} aria-hidden />}
      </li>
    })}
  </ol>
}

/** items: [{ title, time?, description?, tone?, done? }] */
export function Timeline({ items }) {
  return <ol className="relative space-y-5 border-l border-navy-700 pl-6">
    {items.map((it, i) => <li key={i} className="relative">
      <span className={cx('absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-navy-950', it.done === false ? 'bg-navy-600' : DOT[it.tone || 'info'])} aria-hidden />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className={cx('text-sm font-semibold', it.done === false ? 'text-navy-400' : 'text-white')}>{it.title}</p>
        {it.time && <p className="text-xs text-navy-400">{it.time}</p>}
      </div>
      {it.description && <p className="mt-0.5 text-sm text-navy-300">{it.description}</p>}
    </li>)}
  </ol>
}

// ── Modal ────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const panel = useRef(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0]; const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    setTimeout(() => (panel.current?.querySelector('[data-autofocus], input, textarea, select, button') || panel.current)?.focus(), 0)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.() }
  }, [open, onClose])
  if (!open) return null
  return <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6">
    <div className="absolute inset-0 bg-navy-950/75 backdrop-blur-sm" onClick={onClose} aria-hidden />
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
      className={cx('relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-navy-700 bg-navy-900 shadow-lift animate-fade-up sm:rounded-2xl',
        { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size])}>
      <header className="flex items-start justify-between gap-4 border-b border-navy-800 px-5 py-4">
        <div><h2 id={titleId} className="text-base font-semibold text-white">{title}</h2>{description && <p className="mt-0.5 text-sm text-navy-400">{description}</p>}</div>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-navy-400 hover:bg-navy-800 hover:text-white" aria-label="Close dialog"><XMarkIcon className="h-5 w-5" /></button>
      </header>
      <div className="overflow-y-auto px-5 py-4">{children}</div>
      {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-navy-800 px-5 py-3">{footer}</footer>}
    </div>
  </div>
}

// ── Confirm / prompt dialogs and toasts (app-wide providers) ─────

const DialogContext = createContext(null)
const ToastContext = createContext(null)

// Module-level bridges so non-component code (event handlers in older pages)
// can raise the same toasts and dialogs as hook users.
let bridge = { toast: null, confirm: null, prompt: null }
export const notify = (message, tone = 'success') => bridge.toast?.(message, tone)
export const confirmDialog = (opts) => (bridge.confirm ? bridge.confirm(opts) : Promise.resolve(false))

export function UIProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const [value, setValue] = useState('')
  const [toasts, setToasts] = useState([])

  const confirm = useCallback((opts) => new Promise((resolve) => { setDialog({ kind: 'confirm', ...opts, resolve }) }), [])
  const prompt = useCallback((opts) => new Promise((resolve) => { setValue(opts.defaultValue || ''); setDialog({ kind: 'prompt', ...opts, resolve }) }), [])
  const close = (result) => { dialog?.resolve(result); setDialog(null) }

  const toast = useCallback((message, tone = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'danger' ? 7000 : 4000)
  }, [])

  useEffect(() => { bridge = { toast, confirm, prompt } }, [toast, confirm, prompt])
  const minLen = dialog?.minLength ?? 1
  return <DialogContext.Provider value={{ confirm, prompt }}>
    <ToastContext.Provider value={toast}>
      {children}
      <Modal open={!!dialog} onClose={() => close(dialog?.kind === 'confirm' ? false : null)} title={dialog?.title} description={dialog?.description} size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => close(dialog?.kind === 'confirm' ? false : null)}>Cancel</Button>
          <Button variant={dialog?.danger ? 'danger' : 'primary'} disabled={dialog?.kind === 'prompt' && value.trim().length < minLen}
            onClick={() => close(dialog?.kind === 'confirm' ? true : value.trim())}>{dialog?.confirmLabel || 'Confirm'}</Button>
        </>}>
        {dialog?.kind === 'prompt' ? <form onSubmit={(e) => { e.preventDefault(); if (value.trim().length >= minLen) close(value.trim()) }}>
          <Field label={dialog.label} hint={minLen > 1 ? `At least ${minLen} characters.` : dialog.hint}>
            {dialog.multiline ? <TextArea value={value} onChange={(e) => setValue(e.target.value)} data-autofocus /> : <Input type={dialog.inputType || 'text'} value={value} onChange={(e) => setValue(e.target.value)} placeholder={dialog.placeholder} data-autofocus />}
          </Field>
        </form> : <p className="text-sm leading-relaxed text-navy-200">{dialog?.message}</p>}
      </Modal>
      <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className="pointer-events-auto animate-toast-in"><Alert tone={t.tone} className="bg-navy-900 shadow-lift">{t.message}</Alert></div>)}
      </div>
    </ToastContext.Provider>
  </DialogContext.Provider>
}

export const useDialog = () => useContext(DialogContext)
export const useToast = () => useContext(ToastContext)
