# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Seven roles use one web app, each with its own dashboard:

- **Customers** (Indian exporters and importers) register shipments, compare insurance products, apply, pay premiums, hold policies, report incidents, file claims, raise grievances and use an assistant.
- **Shipping companies** follow shipments assigned to them, update milestones and report incidents.
- **Marine surveyors** inspect assigned claims, schedule inspections and submit survey reports. They cannot approve or settle claims.
- **Insurance officers** underwrite applications, assign surveyors, review and settle claims, and handle grievances.
- **Senior insurance officers** do the same plus higher-value approvals, finance views and reconciliation.
- **Agents** follow customers they assist and the commissions they earn.
- **Administrators** manage users, roles and permissions, products, finance (ledger, reconciliation) and audit logs. They have no underwriting authority.

## Product Purpose

MarineSure is a marine cargo insurance, shipment protection and claims management system. It covers a shipment from registration through quotation, underwriting, payment, policy issue, incidents, survey, claim review, settlement and financial reconciliation.

## Positioning

An academic / portfolio project, not a live company. Every screen shows real backend data. Nothing claims capabilities, customers, partners, licences or statistics that do not exist.

## Operating Context

- **Market:** India first. Currency is INR, premiums include 18% GST, and the demo data uses Indian and international ports.
- **Stack:** React 18 + Vite + Tailwind CSS 3, React Router 7, Axios with JWT access/refresh, Chart.js, Heroicons. Backend: FastAPI, SQLAlchemy, MySQL 8.4.
- **Security:** permissions are enforced in the backend; the frontend only reflects them.

## Capabilities and Constraints

- **Shipments:** registration, cargo, containers, documents, milestones.
- **Insurance:** products, quotations (the backend is the premium formula's source of truth), applications, underwriting, Razorpay test payment, policy PDF certificates.
- **Claims:** incidents, claims, surveyor assignment, inspections, survey reports, settlements with failure and retry.
- **Finance:** immutable ledger, reconciliation, payment history, agent commissions.
- **Service:** grievances, notifications, audit logs, role-permission matrix, retrieval-based assistant.
- **No live vessel tracking.** Shipments have origin and destination names only, with no coordinates. No map may show invented positions or routes.
- **No public contact endpoint.** The landing page contact form must say it cannot send yet.
- **No global search API.** Search works only within individual lists.

## Brand Commitments

- **Name:** "MarineSure", with no version number in the UI.
- **Identity and palette:** maritime and financial trust. The user specified:
  - Midnight Navy #061827
  - Deep Ocean #082B40
  - Marine Blue #0D4664
  - Ocean Teal #10B9AE
  - Aqua #54D8D0
  - Sea Mist #E8F6F5
  - Pearl White #F7FAFC
  - Slate #64748B
  - Champagne Gold #D5B477
- **Fonts:** Inter, Manrope or Plus Jakarta Sans, one family used consistently.
- **Landing hero copy (user-supplied):**
  - "Every Voyage Deserves Protection."
  - "Smarter marine insurance. Transparent shipment tracking. Reliable claims management."
  - Alternative: "Protecting Every Journey. Securing Every Shipment." with "Intelligent marine insurance and shipment protection, from departure to delivery."

## Evidence on Hand

- **Demo accounts:** seeded with password MarineSure@2026 (customer, carrier, surveyor, agent, officer, admin).
- **Must not be fabricated:** no testimonials, customers, partners, coverage statistics, office addresses or phone numbers exist.

## Product Principles

1. Real data or an honest empty state; never filler numbers.
2. Every visible control performs a real backend action, or explains why it can't.
3. Role boundaries come from the backend; the UI never implies authority a role does not have.
4. Financial figures are exact and traceable to the ledger.
5. Calm, trustworthy operation over spectacle inside the app; imagery belongs on public and hero surfaces.

## Accessibility & Inclusion

- WCAG AA contrast, keyboard navigation, visible focus states and labelled form fields.
- Respect `prefers-reduced-motion`. The interface must work from 360px wide upwards.
