import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRightIcon, CheckIcon, ClipboardDocumentCheckIcon, CubeIcon, DocumentCheckIcon, FingerPrintIcon,
  LockClosedIcon, PlusIcon, ScaleIcon, ShieldCheckIcon, TruckIcon, WalletIcon,
} from '@heroicons/react/24/outline'
import { BrandLockup } from '../../components/Brand'
import { Alert, Button, Field, Input, TextArea, cx } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { HOME, primaryRole } from '../../config/navigation'
import { inr } from '../../lib/format'
import api from '../../services/api'

const JOURNEY = [
  { icon: CubeIcon, title: 'Register the shipment', text: 'Cargo, containers, route and documents in one record.' },
  { icon: ScaleIcon, title: 'Compare and quote', text: 'Premiums are priced by the underwriting engine, GST included.' },
  { icon: ClipboardDocumentCheckIcon, title: 'Underwriting review', text: 'An insurance officer approves, rejects or asks for documents.' },
  { icon: WalletIcon, title: 'Pay and receive a policy', text: 'Verified payment issues a PDF certificate straight away.' },
  { icon: TruckIcon, title: 'Follow the voyage', text: 'Your shipping company records milestones as cargo moves.' },
  { icon: DocumentCheckIcon, title: 'Claim and settle', text: 'Survey, review and payout, every step in your timeline.' },
]

const FAQ = [
  ['Who can register on MarineSure?', 'Importers and exporters, shipping companies, marine surveyors and insurance agents can create an account. Insurance officers and administrators are appointed by an administrator; nobody can give themselves those roles.'],
  ['How is my premium calculated?', 'The backend underwriting engine applies the product base rate, cargo and transport-mode factors, fixed charges and 18% GST to your declared value. The quotation you see is that calculation, not an estimate made in the browser.'],
  ['When does my policy become active?', 'Only after the payment gateway confirms your payment. The policy and its PDF certificate are issued at that moment; an unpaid or unverified payment never produces a policy.'],
  ['Does MarineSure track ships live?', 'No. Shipments show the milestones your shipping company records: departure, transit, arrival and so on. MarineSure does not show live GPS positions.'],
  ['What happens after I file a claim?', 'An insurance officer assigns a marine surveyor, who schedules and carries out an inspection and files a report. The officer then reviews the claim, applies the policy deductible and settles approved claims. You can see each step and every payout reference.'],
  ['How is financial data protected?', 'Every premium, refund and payout is written to an append-only ledger. Each entry is hash-chained to the one before it, so any later edit is detectable. Corrections are made with reversal entries, never by changing history.'],
]

function useProducts() {
  const [state, setState] = useState({ items: [], loading: true, error: '' })
  useEffect(() => {
    api.get('/insurance-products')
      .then(({ data }) => setState({ items: data || [], loading: false, error: '' }))
      .catch(() => setState({ items: [], loading: false, error: 'The product catalogue is unavailable right now.' }))
  }, [])
  return state
}

function SiteHeader() {
  const { user } = useAuth()
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24)
    on(); window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return <header className={cx('fixed inset-x-0 top-0 z-50 transition duration-300', solid ? 'border-b border-white/5 bg-navy-950/85 backdrop-blur-md' : 'bg-transparent')}>
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <BrandLockup to="/" />
      <nav className="hidden items-center gap-7 text-sm font-medium text-navy-200 md:flex" aria-label="Sections">
        <a href="#how" className="hover:text-white">How it works</a>
        <a href="#products" className="hover:text-white">Insurance</a>
        <a href="#claims" className="hover:text-white">Claims</a>
        <a href="#faq" className="hover:text-white">FAQ</a>
      </nav>
      <div className="flex items-center gap-2">
        {user ? <Button to={HOME[primaryRole(user.roles)]} size="sm" iconRight={ArrowRightIcon}>Open dashboard</Button> : <>
          <Button to="/login" variant="ghost" size="sm">Sign in</Button>
          <Button to="/register" size="sm">Get started</Button>
        </>}
      </div>
    </div>
  </header>
}

function Hero() {
  return <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden pb-16 pt-28 sm:items-center sm:pb-24">
    <picture>
      <source media="(max-width: 900px)" srcSet="/images/hero-aerial-ship-sm.jpg" />
      <img src="/images/hero-aerial-ship.jpg" alt="Container ship leaving port, seen from above, with a tug alongside" fetchpriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[62%_center]" />
    </picture>
    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950 via-navy-950/80 to-navy-950/10" aria-hidden />
    <div className="absolute inset-0 -z-10 bg-navy-950/55 sm:hidden" aria-hidden />
    <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-navy-950 to-transparent" aria-hidden />
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl animate-fade-up">
        <h1 className="text-[2.6rem] font-extrabold leading-[1.05] text-white sm:text-6xl lg:text-[4.25rem]">Every voyage deserves protection.</h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-navy-100 sm:text-xl">Smarter marine insurance. Transparent shipment tracking. Reliable claims management.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button to="/register" size="lg" iconRight={ArrowRightIcon}>Get started</Button>
          <Button href="#products" size="lg" variant="secondary" className="border-white/20 bg-white/5 backdrop-blur">Explore insurance</Button>
          <Button to="/login" size="lg" variant="ghost">Sign in</Button>
        </div>
        <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-200">
          {['Premiums priced by the underwriting engine', 'Policies only after verified payment', 'Hash-chained financial ledger'].map((t) => <li key={t} className="flex items-center gap-2"><CheckIcon className="h-4 w-4 text-teal-300" aria-hidden />{t}</li>)}
        </ul>
      </div>
    </div>
    <p className="absolute bottom-3 right-4 text-[10px] text-white/50">Photo: CMA CGM Seine, Le Havre · Arizonaman1, CC0</p>
  </section>
}

function Journey() {
  return <section id="how" className="relative scroll-mt-16 py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl">One record, from departure to delivery.</h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-navy-300">
            MarineSure keeps the shipment, its insurance and any claim in the same place, so customers, carriers, surveyors and underwriters work from the same facts instead of email threads and spreadsheets.
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-navy-400">MarineSure is an academic project. It is built on a working backend, and every number in the app comes from that backend.</p>
        </div>
        <ol className="relative">
          <span className="absolute bottom-6 left-[19px] top-6 w-px bg-gradient-to-b from-teal-400 via-teal-600/60 to-gold-400/70" aria-hidden />
          {JOURNEY.map((s) => <li key={s.title} className="relative flex gap-5 pb-10 last:pb-0">
            <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-teal-400/40 bg-navy-950 text-teal-300"><s.icon className="h-5 w-5" aria-hidden /></span>
            <div className="pt-1.5">
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-navy-300">{s.text}</p>
            </div>
          </li>)}
        </ol>
      </div>
    </div>
  </section>
}

function Products() {
  const { items, loading, error } = useProducts()
  return <section id="products" className="scroll-mt-16 border-y border-white/5 bg-ocean/60 py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold sm:text-4xl">Cover for the way your cargo travels.</h2>
          <p className="mt-4 text-base leading-relaxed text-navy-300">The live catalogue, read directly from MarineSure's product database. Rates are base rates; your quotation adds cargo and route factors.</p>
        </div>
        <Button to="/register" variant="secondary" iconRight={ArrowRightIcon}>Get a quotation</Button>
      </div>
      {error && <Alert tone="warning" className="mt-10">{error}</Alert>}
      <div className="mt-12 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-navy-950/50">
        {loading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="ms-skeleton m-5 h-14" />)}
        {items.map((p) => <article key={p.id} className="grid gap-4 p-6 transition hover:bg-white/[0.02] md:grid-cols-[minmax(0,1.5fr)_minmax(0,22rem)_9rem] md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="rounded-md border border-gold-400/40 px-2 py-0.5 font-mono text-xs text-gold-300">{p.product_code}</span>
              <h3 className="text-lg font-semibold">{p.product_name}</h3>
            </div>
            <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-relaxed text-navy-300">{p.description}</p>
          </div>
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div><dt className="text-xs text-navy-400">Base rate</dt><dd className="tabular mt-0.5 font-semibold text-white">{(Number(p.base_rate) * 100).toFixed(2)}%</dd></div>
            <div><dt className="text-xs text-navy-400">Cover period</dt><dd className="tabular mt-0.5 font-semibold text-white">{p.coverage_duration_days} days</dd></div>
            <div><dt className="text-xs text-navy-400">Insured up to</dt><dd className="tabular mt-0.5 font-semibold text-white">{inr(p.max_insured_value, { compact: true })}</dd></div>
          </dl>
          <p className="text-xs capitalize text-navy-400 md:text-right">{p.applicable_modes.replaceAll(',', ' · ')}</p>
        </article>)}
      </div>
    </div>
  </section>
}

function Claims() {
  const steps = ['Claim submitted', 'Surveyor assigned', 'Inspection completed', 'Officer review', 'Approved or rejected', 'Settled to your account']
  return <section id="claims" className="relative isolate scroll-mt-16 overflow-hidden py-28">
    <img src="/images/terminal-night.jpg" alt="" loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover" />
    <div className="absolute inset-0 -z-10 bg-gradient-to-l from-navy-950 via-navy-950/85 to-navy-950/40" aria-hidden />
    <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
      <div className="lg:col-start-2">
        <h2 className="text-3xl font-bold sm:text-4xl">When something goes wrong at sea, you see every step.</h2>
        <p className="mt-5 max-w-lg text-base leading-relaxed text-navy-200">Incidents, survey reports, the deductible applied, the approved amount and the payout reference all sit in your claim timeline, and nothing happens off the record.</p>
        <ol className="mt-9 grid gap-3 sm:grid-cols-2">
          {steps.map((s, i) => <li key={s} className="flex items-center gap-3 rounded-xl border border-white/10 bg-navy-950/60 px-4 py-3 text-sm backdrop-blur">
            <span className="tabular grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-400/15 text-xs font-bold text-teal-200">{i + 1}</span>
            <span className="text-navy-100">{s}</span>
          </li>)}
        </ol>
      </div>
    </div>
    <p className="absolute bottom-3 left-4 text-[10px] text-white/50">Photo: Container Terminal Burchardkai at night · mybroetchen, CC BY 2.0</p>
  </section>
}

function Trust() {
  const items = [
    { icon: LockClosedIcon, title: 'Append-only ledger', text: 'Premiums, refunds, claim payouts and commissions are hash-chained. Any edit breaks the chain and shows up in verification.' },
    { icon: FingerPrintIcon, title: 'Role-based access', text: 'Each role sees only its own work. Permissions are checked by the server on every request, not just hidden in the interface.' },
    { icon: ShieldCheckIcon, title: 'Verified payments', text: 'Payment signatures are verified before a policy is issued, and each payout reference can be used only once.' },
  ]
  return <section className="py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <figure className="relative overflow-hidden rounded-3xl border border-white/10">
          <img src="/images/voyage-sunset-sm.jpg" srcSet="/images/voyage-sunset-sm.jpg 1100w, /images/voyage-sunset.jpg 2200w" sizes="(min-width: 1024px) 45vw, 92vw"
            alt="Fully laden container ship entering port at sunset with a tug alongside" loading="lazy" className="aspect-[4/3] w-full object-cover" />
          <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-navy-950/90 to-transparent px-5 pb-3 pt-10 text-[10px] text-white/60">Photo: CMA CGM Marco Polo, Savannah · Lovemedead, CC BY-SA 4.0</figcaption>
        </figure>
        <div>
          <h2 className="text-3xl font-bold sm:text-4xl">Built like the money matters. Because it does.</h2>
          <dl className="mt-10 space-y-8">
            {items.map((it) => <div key={it.title} className="flex gap-4">
              <dt className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-400/10 text-gold-300"><it.icon className="h-5 w-5" aria-hidden /><span className="sr-only">{it.title}</span></dt>
              <dd><p className="font-semibold text-white">{it.title}</p><p className="mt-1 max-w-lg text-sm leading-relaxed text-navy-300">{it.text}</p></dd>
            </div>)}
          </dl>
        </div>
      </div>
    </div>
  </section>
}

function Audiences() {
  const cols = [
    { title: 'For importers and exporters', points: ['Compare products and get a quotation for your own shipment', 'Pay online and download your policy certificate', 'Report incidents and follow your claim to settlement', 'Raise a grievance and see who is handling it'] },
    { title: 'For logistics partners', points: ['See only the shipments assigned to your company', 'Record departure, transit and arrival milestones', 'Report incidents on the shipments you carry', 'Keep the customer and the insurer working from the same facts'] },
    { title: 'For surveyors and underwriters', points: ['An inspection calendar with conflict checks', 'Survey reports linked to claims and shipments', 'Deductibles applied by policy terms', 'Settlements, reconciliation and audit trail in one place'] },
  ]
  return <section className="border-t border-white/5 bg-ocean/40 py-24">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">Everyone on the voyage, on the same page.</h2>
      <div className="mt-12 grid gap-10 md:grid-cols-3">
        {cols.map((c) => <div key={c.title} className="border-t border-teal-400/40 pt-6">
          <h3 className="text-lg font-semibold">{c.title}</h3>
          <ul className="mt-4 space-y-3">{c.points.map((p) => <li key={p} className="flex gap-3 text-sm leading-relaxed text-navy-300"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />{p}</li>)}</ul>
        </div>)}
      </div>
    </div>
  </section>
}

function Faq() {
  return <section id="faq" className="scroll-mt-16 py-24">
    <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
      <h2 className="text-3xl font-bold sm:text-4xl">Questions, answered plainly.</h2>
      <div className="divide-y divide-white/10 border-y border-white/10">
        {FAQ.map(([q, a]) => <details key={q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white">
            {q}<span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 text-teal-300 transition duration-300 group-open:rotate-45" aria-hidden><PlusIcon className="h-4 w-4" /></span>
          </summary>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-navy-300">{a}</p>
        </details>)}
      </div>
    </div>
  </section>
}

function Contact() {
  const [sent, setSent] = useState(false)
  return <section id="contact" className="scroll-mt-16 border-t border-white/5 py-24">
    <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
      <div>
        <h2 className="text-3xl font-bold sm:text-4xl">Talk to us.</h2>
        <p className="mt-4 max-w-md text-base leading-relaxed text-navy-300">Signed-in customers can raise a grievance from their dashboard and follow the reply there. That is the fastest way to reach an insurance officer.</p>
        <Button to="/login" variant="secondary" className="mt-6" iconRight={ArrowRightIcon}>Sign in to raise a grievance</Button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setSent(true) }} className="grid gap-4 rounded-2xl border border-white/10 bg-navy-900/60 p-6">
        {sent ? <Alert tone="warning" title="This form can't send messages yet">MarineSure doesn't have a public contact service, so nothing was sent. Please sign in and raise a grievance instead.</Alert> : <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required><Input required autoComplete="name" /></Field>
            <Field label="Email" required><Input type="email" required autoComplete="email" /></Field>
          </div>
          <Field label="Message" required><TextArea required rows={4} /></Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-navy-400">Note: public messages are not delivered yet.</p>
            <Button type="submit">Send message</Button>
          </div>
        </>}
      </form>
    </div>
  </section>
}

function Footer() {
  return <footer className="border-t border-white/5 bg-navy-950 py-12">
    <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-sm">
        <BrandLockup to="/" />
        <p className="mt-4 text-sm leading-relaxed text-navy-400">Marine cargo insurance, shipment protection and claims management. An academic project; not a licensed insurer.</p>
      </div>
      <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-navy-300" aria-label="Footer">
        <a href="#how" className="hover:text-white">How it works</a>
        <Link to="/login" className="hover:text-white">Sign in</Link>
        <a href="#products" className="hover:text-white">Insurance</a>
        <Link to="/register" className="hover:text-white">Create account</Link>
        <a href="#claims" className="hover:text-white">Claims</a>
        <a href="#faq" className="hover:text-white">FAQ</a>
      </nav>
      <div className="w-full border-t border-white/5 pt-6 text-xs leading-relaxed text-navy-500">
        Photography via Wikimedia Commons: CMA CGM Seine (Arizonaman1, CC0); Container Terminal Burchardkai (mybroetchen, CC BY 2.0); CMA CGM Marco Polo (Lovemedead, CC BY-SA 4.0); Vallarpadam container terminal, Kochi (Ranjithsiji, CC BY-SA 4.0); Loading containers (Marcel Sala, CC BY 2.0); Port Jersey sunset (Eric Kilby, CC BY-SA 2.0).
      </div>
    </div>
  </footer>
}

export default function Landing() {
  useEffect(() => { document.title = 'MarineSure · Marine cargo insurance' }, [])
  return <div className="min-h-screen bg-navy-950 text-white">
    <SiteHeader />
    <main>
      <Hero />
      <Journey />
      <Products />
      <Claims />
      <Trust />
      <Audiences />
      <Faq />
      <Contact />
    </main>
    <Footer />
  </div>
}
